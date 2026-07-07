/**
 * Vercel cron function: sends at most ONE useful push per subscriber per day,
 * chosen by priority — never generic "come back" spam:
 *   1. Evening reconcile (local hour >= 18, >= 2h of today unaccounted):
 *      "X.Xh of today is unaccounted — reconcile it."
 *   2. Streak at risk (local hour >= 18, streak >= 3, today under 1h on purpose).
 *
 * Scheduled daily via vercel.json crons; safe to also hit manually for testing.
 * Env vars: SUPABASE_URL, SUPABASE_KEY (same values as the REACT_APP_*
 * build-time vars), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, optional
 * VAPID_CONTACT (mailto:), CRON_SECRET (recommended — Vercel sends it as a
 * Bearer token on cron invocations).
 */
import webpush from "web-push";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "";

const STREAK_MIN_SECONDS = 3600;
const RECONCILE_MIN_SECONDS = 2 * 3600;
const NUDGE_FROM_LOCAL_HOUR = 18;
const AWAKE_START_HOUR = 7;

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function sbFetch(pathAndQuery, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    ...options,
    headers: sbHeaders(options.headers),
  });
  if (!response.ok) throw new Error(`Supabase ${pathAndQuery.split("?")[0]} returned ${response.status}`);
  return response.status === 204 ? null : response.json();
}

// Local wall-clock parts for a timezone.
function localParts(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
    };
  } catch (_error) {
    const now = new Date();
    return { date: now.toISOString().slice(0, 10), hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

const shiftDay = (day, days) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

// YYYY-MM-DD of an instant in a given timezone (matches the app's local-day bucketing).
function dayInTz(value, timezone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  } catch (_error) {
    return String(value).slice(0, 10);
  }
}

// Per-day tallies in the subscriber's timezone.
function tally(entries, timezone) {
  const taskByDay = new Map();
  let trackedToday = 0;
  const today = dayInTz(new Date(), timezone);
  for (const row of entries) {
    const entry = row.data || {};
    if (entry.is_running || !entry.duration) continue;
    if (!entry.start_time) continue;
    const day = dayInTz(entry.start_time, timezone);
    const type = entry.entry_type || (entry.is_break ? "break" : "task");
    if (type === "task") taskByDay.set(day, (taskByDay.get(day) || 0) + entry.duration);
    if (day === today) trackedToday += entry.duration;
  }
  const earned = (day) => (taskByDay.get(day) || 0) >= STREAK_MIN_SECONDS;
  let streak = 0;
  let cursor = shiftDay(today, -1); // streak through yesterday; today still in play
  while (earned(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return { todayTaskSeconds: taskByDay.get(today) || 0, trackedTodaySeconds: trackedToday, streakThroughYesterday: streak };
}

function pickNudge(stats, local) {
  if (local.hour < NUDGE_FROM_LOCAL_HOUR) return null;
  const awakeSoFar = Math.max(0, (local.hour - AWAKE_START_HOUR) * 3600 + local.minute * 60);
  const unaccounted = awakeSoFar - stats.trackedTodaySeconds;
  if (unaccounted >= RECONCILE_MIN_SECONDS) {
    const hours = (unaccounted / 3600).toFixed(1);
    return {
      tag: "rc-reconcile",
      title: "Reality check",
      body: `${hours}h of today is unaccounted. Reconcile it before it disappears.`,
    };
  }
  if (stats.streakThroughYesterday >= 3 && stats.todayTaskSeconds < STREAK_MIN_SECONDS) {
    return {
      tag: "rc-streak",
      title: `🔥 ${stats.streakThroughYesterday}-day streak at risk`,
      body: "One hour on purpose today keeps it alive.",
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ detail: "Unauthorized" });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return res.status(503).json({ detail: "Push not configured (SUPABASE_URL/SUPABASE_KEY/VAPID_* env vars)" });
  }
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const subs = await sbFetch("rc_push_subscriptions?select=workspace,id,data");
  if (!subs.length) return res.status(200).json({ sent: 0, subscriptions: 0 });

  const entriesByWorkspace = new Map();
  const statsCache = new Map(); // key: workspace|timezone
  const results = [];
  for (const sub of subs) {
    try {
      const timezone = sub.data?.timezone || "UTC";
      if (!entriesByWorkspace.has(sub.workspace)) {
        const cutoff = shiftDay(new Date().toISOString().slice(0, 10), -45);
        entriesByWorkspace.set(
          sub.workspace,
          await sbFetch(
            `rc_entries?workspace=eq.${encodeURIComponent(sub.workspace)}&select=data&data->>start_time=gte.${cutoff}`
          )
        );
      }
      const statsKey = `${sub.workspace}|${timezone}`;
      if (!statsCache.has(statsKey)) {
        statsCache.set(statsKey, tally(entriesByWorkspace.get(sub.workspace), timezone));
      }
      const stats = statsCache.get(statsKey);
      const local = localParts(timezone);

      if (sub.data?.last_nudge_date === local.date) {
        results.push({ id: sub.id, skipped: "already nudged today" });
        continue;
      }
      const nudge = pickNudge(stats, local);
      if (!nudge) {
        results.push({ id: sub.id, skipped: "nothing worth sending" });
        continue;
      }

      await webpush.sendNotification(
        sub.data.subscription,
        JSON.stringify({ ...nudge, url: "/dashboard" })
      );
      await sbFetch(
        `rc_push_subscriptions?workspace=eq.${encodeURIComponent(sub.workspace)}&id=eq.${encodeURIComponent(sub.id)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ data: { ...sub.data, last_nudge_date: local.date }, updated_at: new Date().toISOString() }),
        }
      );
      results.push({ id: sub.id, sent: nudge.tag });
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired/revoked — clean up the row.
        await sbFetch(
          `rc_push_subscriptions?workspace=eq.${encodeURIComponent(sub.workspace)}&id=eq.${encodeURIComponent(sub.id)}`,
          { method: "DELETE", headers: { Prefer: "return=minimal" } }
        ).catch(() => {});
        results.push({ id: sub.id, removed: "expired subscription" });
      } else {
        console.error("push-nudge failed for", sub.id, err.message);
        results.push({ id: sub.id, error: err.message });
      }
    }
  }
  return res.status(200).json({ subscriptions: subs.length, results });
}
