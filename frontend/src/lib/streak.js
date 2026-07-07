/**
 * Streak: consecutive days with at least an hour of on-purpose (task) time.
 * Derived purely from entries — no extra storage. A day still in progress
 * doesn't break the streak; it extends it once it crosses the threshold.
 */
import { todayStr } from "./goals";
import { localDayStr, dayOffset } from "./dates";

export const STREAK_MIN_SECONDS = 3600;

const shiftDay = dayOffset;

export function computeStreak(entries, { minSeconds = STREAK_MIN_SECONDS } = {}) {
  const daySeconds = new Map();
  for (const entry of entries || []) {
    if (!entry || entry.is_break || entry.is_running) continue;
    if ((entry.entry_type || "task") !== "task") continue;
    if (!entry.start_time) continue;
    const day = localDayStr(entry.start_time);
    daySeconds.set(day, (daySeconds.get(day) || 0) + (entry.duration || 0));
  }

  const earned = (day) => (daySeconds.get(day) || 0) >= minSeconds;
  const today = todayStr();
  let cursor = earned(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (earned(cursor)) {
    streak += 1;
    cursor = shiftDay(cursor, -1);
  }
  return { streak, todayEarned: earned(today), todaySeconds: daySeconds.get(today) || 0 };
}
