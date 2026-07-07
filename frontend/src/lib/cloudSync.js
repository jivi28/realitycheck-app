/**
 * Per-record Supabase sync.
 *
 * The legacy sync stored the whole app state as ONE json blob
 * (`realitycheck_shared_state`, row id='main') — every save was a full
 * read-modify-write, so two devices writing near-simultaneously clobbered
 * each other. This module syncs at record granularity instead: one row per
 * project/schedule/entry/report/goal in `rc_*` tables, shaped
 * { workspace, id, data jsonb, updated_at }. Conflicts shrink to per-record
 * last-write-wins, which is fine for a personal/shared tracker.
 *
 * browserApi.js decides the mode (tables missing → legacy blob fallback) and
 * owns the state cache; this module only talks to PostgREST.
 */

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || "";
// Lets the main and friends deployments share one Supabase project without
// mixing data. Defaults to "main" — the id the legacy blob used.
export const WORKSPACE = process.env.REACT_APP_WORKSPACE || "main";
export const CLOUD_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY);

const TABLES = {
  projects: { table: "rc_projects", pk: "project_id" },
  schedules: { table: "rc_schedules", pk: "schedule_id" },
  entries: { table: "rc_entries", pk: "entry_id" },
  reports: { table: "rc_reports", pk: "report_id" },
  goals: { table: "rc_goals", pk: "id" },
};
export const COLLECTION_KEYS = ["projects", "schedules", "entries", "reports"];
const UPSERT_CHUNK = 500;

function headers(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function restUrl(table, query) {
  return `${SUPABASE_URL}/rest/v1/${table}?${query}`;
}

class TablesMissingError extends Error {
  constructor() {
    super("rc_* tables not found — run the migration in supabase/rc_per_record_sync.sql");
    this.tablesMissing = true;
  }
}

async function fetchCollection(key) {
  const { table } = TABLES[key];
  const response = await window.fetch(
    restUrl(table, `workspace=eq.${encodeURIComponent(WORKSPACE)}&select=data`),
    { headers: headers() }
  );
  // PostgREST answers 404 (and PGRST205 in the body) for a missing table.
  if (response.status === 404) throw new TablesMissingError();
  if (!response.ok) throw new Error(`Supabase ${table} returned ${response.status}`);
  const rows = await response.json();
  return rows.map((row) => row.data);
}

// All five collections in parallel. Throws TablesMissingError if the
// migration hasn't been run yet (caller falls back to the legacy blob).
export async function fetchAllCollections() {
  const keys = [...COLLECTION_KEYS, "goals"];
  const results = await Promise.all(keys.map(fetchCollection));
  return Object.fromEntries(keys.map((key, i) => [key, results[i]]));
}

// The legacy whole-state blob, used to seed the rc_* tables exactly once.
export async function fetchLegacyBlob() {
  const response = await window.fetch(
    restUrl("realitycheck_shared_state", "id=eq.main&select=data"),
    { headers: headers() }
  );
  if (!response.ok) return null;
  const rows = await response.json();
  return rows.length ? rows[0].data : null;
}

async function upsertRecords(key, records) {
  if (!records.length) return;
  const { table, pk } = TABLES[key];
  const now = new Date().toISOString();
  for (let i = 0; i < records.length; i += UPSERT_CHUNK) {
    const chunk = records.slice(i, i + UPSERT_CHUNK).map((record) => ({
      workspace: WORKSPACE,
      id: record[pk],
      data: record,
      updated_at: now,
    }));
    const response = await window.fetch(restUrl(table, "on_conflict=workspace,id"), {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(chunk),
    });
    if (!response.ok) throw new Error(`Supabase upsert ${table} returned ${response.status}`);
  }
}

async function deleteRecords(key, ids) {
  if (!ids.length) return;
  const { table } = TABLES[key];
  const list = ids.map((v) => `"${String(v).replace(/"/g, "")}"`).join(",");
  const response = await window.fetch(
    restUrl(table, `workspace=eq.${encodeURIComponent(WORKSPACE)}&id=in.(${list})`),
    { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) }
  );
  if (!response.ok) throw new Error(`Supabase delete ${table} returned ${response.status}`);
}

function diffCollection(prevList, nextList, pk) {
  const prevById = new Map((prevList || []).map((r) => [r[pk], JSON.stringify(r)]));
  const upserts = [];
  const seen = new Set();
  for (const record of nextList || []) {
    seen.add(record[pk]);
    if (prevById.get(record[pk]) !== JSON.stringify(record)) upserts.push(record);
  }
  const deletedIds = [...prevById.keys()].filter((id) => !seen.has(id));
  return { upserts, deletedIds };
}

// Push only what changed between two state snapshots. Throws on any failure
// (caller keeps its snapshot stale so the next save retries the same diff).
export async function syncStateDiff(prevState, nextState) {
  for (const key of COLLECTION_KEYS) {
    const { pk } = TABLES[key];
    const { upserts, deletedIds } = diffCollection(prevState?.[key], nextState[key], pk);
    await upsertRecords(key, upserts);
    await deleteRecords(key, deletedIds);
  }
}

// ---- Goals (kept out of browserApi's state; pages write them directly) ----

let goalsSnapshot = null; // last goals list known to be in the cloud
let goalsReady = false; // set once browserApi confirms per-record mode

export function setGoalsSnapshot(goals) {
  goalsSnapshot = JSON.parse(JSON.stringify(goals || []));
  goalsReady = true;
}

export function goalsSyncReady() {
  return goalsReady;
}

// Fire-and-forget push of goal edits; failures keep the snapshot stale so the
// next edit retries the whole diff.
export async function syncGoals(nextGoals) {
  if (!CLOUD_ENABLED || !goalsReady) return;
  const { upserts, deletedIds } = diffCollection(goalsSnapshot, nextGoals, "id");
  try {
    await upsertRecords("goals", upserts);
    await deleteRecords("goals", deletedIds);
    goalsSnapshot = JSON.parse(JSON.stringify(nextGoals));
  } catch (err) {
    console.warn("Goal sync failed (will retry on next change):", err.message);
  }
}

// Bulk-seed used by the one-time blob→records migration.
export async function seedCollections(state, goals) {
  for (const key of COLLECTION_KEYS) await upsertRecords(key, state[key] || []);
  await upsertRecords("goals", goals || []);
}

// ---- Push subscriptions (one row per subscribed browser) ----

const PUSH_TABLE = "rc_push_subscriptions";

export async function savePushSubscription(id, data) {
  const response = await window.fetch(restUrl(PUSH_TABLE, "on_conflict=workspace,id"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([{ workspace: WORKSPACE, id, data, updated_at: new Date().toISOString() }]),
  });
  if (!response.ok) throw new Error(`Supabase push subscription save returned ${response.status}`);
}

export async function deletePushSubscription(id) {
  const response = await window.fetch(
    restUrl(PUSH_TABLE, `workspace=eq.${encodeURIComponent(WORKSPACE)}&id=eq.${encodeURIComponent(id)}`),
    { method: "DELETE", headers: headers({ Prefer: "return=minimal" }) }
  );
  if (!response.ok) throw new Error(`Supabase push subscription delete returned ${response.status}`);
}
