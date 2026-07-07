/**
 * Pure helpers for Goals: time attribution, progress, and pacing.
 *
 * Goals live in localStorage (key `rc_goals`) and, when Supabase is
 * configured, sync per-record to the `rc_goals` table via cloudSync. Because
 * browserApi keeps every entry forever, carry-over progress is just "sum
 * matching entries since the goal's start" — no extra persistence needed.
 */
import { syncGoals } from "./cloudSync";
import { localDayStr, localStartOfWeekStr } from "./dates";

export const GOALS_KEY = "rc_goals";

// Fired whenever goals in localStorage were replaced from the cloud (another
// device / a friend edited them); pages re-read on this signal.
export const GOALS_REFRESH_EVENT = "rc-goals-refresh";

export function readGoals() {
  try {
    return normalizeGoals(JSON.parse(window.localStorage.getItem(GOALS_KEY)) || []);
  } catch (_error) {
    return [];
  }
}

// Single write path for goal edits: persist locally, then push the diff to
// the cloud (fire-and-forget; cloudSync retries on the next edit if it fails).
export function persistGoals(next) {
  window.localStorage.setItem(GOALS_KEY, JSON.stringify(next));
  syncGoals(next);
}

export function todayStr() {
  return localDayStr();
}

export function formatGoalTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s % 60}s`;
}

// Monday-based start of the current week as YYYY-MM-DD (local, to match todayStr).
export function startOfWeekStr() {
  return localStartOfWeekStr();
}

// Human-friendly completion stamp, e.g. "Jul 2 · 14:32" (local time for display).
export function formatDoneStamp(doneAt) {
  if (!doneAt) return "";
  const d = new Date(doneAt);
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${time}`;
}

// Aggregate stats over completed goals for the dashboard "Completed" header.
// investedSeconds sums the frozen doneSeconds snapshot per goal.
export function completedSummary(goals) {
  const done = (Array.isArray(goals) ? goals : []).filter((g) => g.done);
  const today = todayStr();
  const weekStart = startOfWeekStr();
  let investedSeconds = 0, todayCount = 0, weekCount = 0;
  for (const g of done) {
    investedSeconds += g.doneSeconds || 0;
    const d = g.doneAt ? localDayStr(g.doneAt) : "";
    if (d === today) todayCount += 1;
    if (d && d >= weekStart) weekCount += 1;
  }
  return { total: done.length, todayCount, weekCount, investedSeconds };
}

// Completed goals grouped by completion day (newest first), for the Reports
// history. Each group: { date, goals (newest-done first), count, investedSeconds }.
export function completedByDay(goals) {
  const done = (Array.isArray(goals) ? goals : []).filter((g) => g.done && g.doneAt);
  const map = new Map();
  for (const g of done) {
    const d = localDayStr(g.doneAt);
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(g);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, gs]) => ({
      date,
      goals: gs.slice().sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || "")),
      count: gs.length,
      investedSeconds: gs.reduce((s, g) => s + (g.doneSeconds || 0), 0),
    }));
}

// Backfill fields on goals saved before this feature existed.
// `startAt: null` (not "now") on legacy goals keeps their historical progress.
export function normalizeGoal(goal) {
  return {
    subgoals: [],
    carryOver: true,
    done: false,
    doneAt: null,
    doneSeconds: null,
    addedSeconds: 0,
    startDate: todayStr(),
    startAt: null,
    ...goal,
    subgoals: (goal.subgoals || []).map((s) => ({
      done: false,
      doneAt: null,
      doneSeconds: null,
      addedSeconds: 0,
      startAt: null,
      ...s,
    })),
  };
}

export function normalizeGoals(goals) {
  return (Array.isArray(goals) ? goals : []).map(normalizeGoal);
}

// "Belongs to a goal" only cares that it isn't a break — NOT whether it's
// running. The running timer must match so live progress can tick; sumSeconds
// skips running entries separately (their duration is still null anyway).
const isCountable = (entry) => entry && !entry.is_break;
const entryDate = (entry) => (entry.start_time ? localDayStr(entry.start_time) : "");

// A goal "owns" an entry by project (if linked) else by label — its own label
// plus any subgoal labels, so subgoal work rolls up into the parent. Plain
// no-project goals (no subgoals, no carry-over) keep the legacy "any productive
// time" behavior so existing daily goals don't change.
export function goalMatchesEntry(goal, entry) {
  if (!isCountable(entry)) return false;
  if (goal.projectId) return entry.project_id === goal.projectId;
  if (goal.carryOver || (goal.subgoals && goal.subgoals.length)) {
    const labels = [goal.label, ...(goal.subgoals || []).map((s) => s.label)];
    return labels.includes(entry.description);
  }
  return true; // any productive task
}

export function subgoalMatchesEntry(sub, entry) {
  return isCountable(entry) && entry.description === sub.label;
}

// Goals only count entries that happened after the goal was created (startAt),
// so a new goal for a project doesn't inherit hours already frozen into an
// earlier completed goal. An entry qualifies if it was CREATED after startAt
// ("Log past time" backfill counts — the entry is created now even when its
// window is in the past) OR it ENDED after startAt (a session running while
// the goal was added counts once it stops).
function countsSince(entry, startAt) {
  if (!startAt) return true; // legacy goals: keep historical behavior
  if (entry.created_at && entry.created_at >= startAt) return true;
  return !!(entry.end_time && entry.end_time >= startAt);
}

function sumSeconds(entries, predicate, sinceDate) {
  return entries.reduce((total, entry) => {
    if (entry.is_running) return total; // live elapsed is added separately
    if (!predicate(entry)) return total;
    if (sinceDate && entryDate(entry) < sinceDate) return total;
    return total + (entry.duration || 0);
  }, 0);
}

function liveSeconds(currentTimer, matches) {
  if (!currentTimer || currentTimer.is_break || !matches(currentTimer)) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(currentTimer.start_time).getTime()) / 1000));
}

function progressShape(effectiveSeconds, targetHours, todaySeconds) {
  const target = (targetHours || 0) * 3600;
  return {
    seconds: effectiveSeconds,
    todaySeconds,
    beforeSeconds: Math.max(0, effectiveSeconds - todaySeconds),
    target,
    pct: target > 0 ? Math.min((effectiveSeconds / target) * 100, 100) : 0,
    over: Math.max(0, effectiveSeconds - target),
    reached: target > 0 && effectiveSeconds >= target,
  };
}

export function computeGoalProgress(goal, { allEntries = [], currentTimer = null } = {}) {
  const today = todayStr();
  const sinceDate = goal.carryOver ? goal.startDate || today : today;
  const matches = (e) => goalMatchesEntry(goal, e);
  const countable = (e) => matches(e) && countsSince(e, goal.startAt);
  // Progress = real tracked time only (sessions + live). Worked time you forgot
  // to track is added via "Log past time", which creates a matching entry.
  // liveSeconds skips countsSince on purpose: a running session always ends
  // after startAt, so it counts live and stays counted when it stops.
  const computed =
    sumSeconds(allEntries, countable, sinceDate) + liveSeconds(currentTimer, matches);
  const todayPortion =
    sumSeconds(allEntries, countable, today) + liveSeconds(currentTimer, matches);

  const effective = goal.done && goal.doneSeconds != null ? goal.doneSeconds : computed;
  const todaySeconds = goal.done && goal.doneSeconds != null ? Math.min(todayPortion, effective) : todayPortion;
  return progressShape(effective, goal.targetHours, todaySeconds);
}

export function computeSubgoalProgress(goal, sub, { allEntries = [], currentTimer = null } = {}) {
  const today = todayStr();
  const sinceDate = goal.carryOver ? goal.startDate || today : today;
  const matches = (e) => subgoalMatchesEntry(sub, e);
  const countable = (e) => matches(e) && countsSince(e, sub.startAt || goal.startAt);

  const computed =
    sumSeconds(allEntries, countable, sinceDate) + liveSeconds(currentTimer, matches);
  const todayPortion =
    sumSeconds(allEntries, countable, today) + liveSeconds(currentTimer, matches);

  const effective = sub.done && sub.doneSeconds != null ? sub.doneSeconds : computed;
  const todaySeconds = sub.done && sub.doneSeconds != null ? Math.min(todayPortion, effective) : todayPortion;
  return progressShape(effective, sub.targetHours, todaySeconds);
}

// Does the current timer count toward this goal / subgoal right now?
export function isGoalActive(goal, currentTimer) {
  return !!currentTimer && !currentTimer.is_break && goalMatchesEntry(goal, currentTimer);
}
export function isSubgoalActive(sub, currentTimer) {
  return !!currentTimer && !currentTimer.is_break && subgoalMatchesEntry(sub, currentTimer);
}

// Aggregate pacing — a TODAY-only signal that resets at midnight. Only active
// (not done) DAILY goals form a daily pace: a carry-over goal is a long project,
// so passing its *total* estimate isn't a daily pacing failure and is excluded.
// "Over" uses today's time past the goal's (daily) target, so it clears overnight.
// Returns { status: 'ahead'|'over'|'onpace', early, over, aheadSeconds, overSeconds }.
export function computePacing(goals, ctx) {
  let ahead = 0; // active daily goals that have met today's target
  let over = 0;
  let overSeconds = 0; // today's time spent past target across active daily goals
  const tally = (carryOver, prog) => {
    if (!prog.target || carryOver) return; // carry-over projects aren't a daily pace
    const today = prog.todaySeconds;
    if (today > prog.target + 1) { over += 1; overSeconds += today - prog.target; }
    else if (today >= prog.target) { ahead += 1; }
  };
  for (const goal of goals) {
    if (goal.done) continue;
    tally(goal.carryOver, computeGoalProgress(goal, ctx));
    for (const sub of goal.subgoals || []) {
      if (sub.done) continue;
      tally(goal.carryOver, computeSubgoalProgress(goal, sub, ctx));
    }
  }
  let status = "onpace";
  if (over > 0) status = "over";
  else if (ahead > 0) status = "ahead";
  return { status, early: ahead, over, aheadSeconds: 0, overSeconds };
}
