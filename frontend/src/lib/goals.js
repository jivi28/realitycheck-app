/**
 * Pure helpers for Daily Goals: time attribution, progress, and pacing.
 *
 * Goals live in localStorage (key `rc_goals`). Because browserApi keeps every
 * entry forever, carry-over progress is just "sum matching entries since the
 * goal's start date" — no extra persistence needed.
 */

export const GOALS_KEY = "rc_goals";

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function formatGoalTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s % 60}s`;
}

// Backfill fields on goals saved before this feature existed.
export function normalizeGoal(goal) {
  return {
    subgoals: [],
    carryOver: false,
    done: false,
    doneAt: null,
    doneSeconds: null,
    addedSeconds: 0,
    startDate: todayStr(),
    ...goal,
    subgoals: (goal.subgoals || []).map((s) => ({
      done: false,
      doneAt: null,
      doneSeconds: null,
      addedSeconds: 0,
      ...s,
    })),
  };
}

export function normalizeGoals(goals) {
  return (Array.isArray(goals) ? goals : []).map(normalizeGoal);
}

const isCountable = (entry) => entry && !entry.is_break && !entry.is_running;
const entryDate = (entry) => (entry.start_time || "").slice(0, 10);

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

function sumSeconds(entries, predicate, sinceDate) {
  return entries.reduce((total, entry) => {
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
  // Manual "+ add time" on the goal itself plus any logged on its subgoals —
  // subgoal time (tracked or manual) rolls up into the parent.
  const subAdded = (goal.subgoals || []).reduce((t, s) => t + (s.addedSeconds || 0), 0);
  const added = (goal.addedSeconds || 0) + subAdded;

  const computed =
    sumSeconds(allEntries, matches, sinceDate) + liveSeconds(currentTimer, matches) + added;
  const todayPortion =
    sumSeconds(allEntries, matches, today) + liveSeconds(currentTimer, matches) + added;

  const effective = goal.done && goal.doneSeconds != null ? goal.doneSeconds : computed;
  const todaySeconds = goal.done && goal.doneSeconds != null ? Math.min(todayPortion, effective) : todayPortion;
  return progressShape(effective, goal.targetHours, todaySeconds);
}

export function computeSubgoalProgress(goal, sub, { allEntries = [], currentTimer = null } = {}) {
  const today = todayStr();
  const sinceDate = goal.carryOver ? goal.startDate || today : today;
  const matches = (e) => subgoalMatchesEntry(sub, e);
  const added = sub.addedSeconds || 0;

  const computed =
    sumSeconds(allEntries, matches, sinceDate) + liveSeconds(currentTimer, matches) + added;
  const todayPortion =
    sumSeconds(allEntries, matches, today) + liveSeconds(currentTimer, matches) + added;

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

// Aggregate pacing: count items finished early vs over (done-over or in-progress
// already past target). Returns { status: 'ahead'|'over'|'onpace', early, over }.
export function computePacing(goals, ctx) {
  let early = 0;
  let over = 0;
  const tally = (item, prog) => {
    if (!prog.target) return;
    if (item.done) {
      if (prog.seconds < prog.target - 1) early += 1;
      else if (prog.seconds > prog.target + 1) over += 1;
    } else if (prog.over > 0) {
      over += 1;
    }
  };
  for (const goal of goals) {
    tally(goal, computeGoalProgress(goal, ctx));
    for (const sub of goal.subgoals || []) {
      tally(sub, computeSubgoalProgress(goal, sub, ctx));
    }
  }
  let status = "onpace";
  if (early > over && early > 0) status = "ahead";
  else if (over > early && over > 0) status = "over";
  return { status, early, over };
}
