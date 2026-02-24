/**
 * Color mapping for entry types:
 * - task (Active Work): Neon Green (#00FF41) or project color
 * - break (Unaccounted): Muted Grey (#262626)
 * - scheduled (Committed Time): Deep Blue (#1E40AF) or schedule color
 */
export function getEntryColor(entry) {
  const entryType = entry.entry_type || (entry.is_break ? "break" : "task");

  if (entryType === "scheduled") {
    return entry.schedule_color || "#1E40AF";
  }
  if (entryType === "break" || entry.is_break) {
    return "#262626";
  }
  // task
  return entry.project_color || "#00FF41";
}

export function getEntryLabel(entry) {
  const entryType = entry.entry_type || (entry.is_break ? "break" : "task");
  if (entryType === "scheduled") return "Committed";
  if (entryType === "break") return "Unaccounted";
  return "Productive";
}

export function isProductiveEntry(entry) {
  const entryType = entry.entry_type || (entry.is_break ? "break" : "task");
  return entryType === "task";
}
