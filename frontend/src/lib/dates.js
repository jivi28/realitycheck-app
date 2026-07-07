/**
 * Local-timezone day helpers. The app used to bucket days by UTC
 * (`iso.slice(0, 10)`), which shifted entries into the wrong day near
 * midnight for anyone not on UTC. All day math goes through these now.
 */

const pad = (n) => String(n).padStart(2, "0");

// YYYY-MM-DD of a Date (or parseable value) in the user's local timezone.
export function localDayStr(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Calendar-day arithmetic on YYYY-MM-DD strings (DST-safe via Date rollover).
export function dayOffset(day, days) {
  const [y, m, d] = day.split("-").map(Number);
  return localDayStr(new Date(y, m - 1, d + days));
}

// Monday of the current local week.
export function localStartOfWeekStr() {
  const now = new Date();
  const shift = (now.getDay() + 6) % 7; // Mon=0 … Sun=6
  return localDayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - shift));
}

// Mon=0..Sun=6 for a YYYY-MM-DD calendar day.
export function weekdayIndexLocal(day) {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

// ISO timestamp for local midnight of `day` plus `minutes`.
export function isoForLocalMinutes(day, minutes) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 0, minutes).toISOString();
}
