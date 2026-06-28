/**
 * Color mapping for entry types:
 * - task (Active Work): Neon Green (#00FF41) or project color
 * - break (Unaccounted): Muted Grey (#262626)
 * - scheduled (Committed Time): Deep Blue (#1E40AF) or schedule color
 */
import { categoryMeta } from "@/lib/categories";

export function getEntryColor(entry) {
  const entryType = entry.entry_type || (entry.is_break ? "break" : "task");

  if (entryType === "scheduled") {
    return entry.schedule_color || "#1E40AF";
  }
  if (entryType === "pause") {
    return "#2DD4BF";
  }
  if (entryType === "break" || entry.is_break) {
    return "#262626";
  }
  // task — prefer the project color, else a reconciled entry's category color
  if (entry.project_color) return entry.project_color;
  if (entry.category) return categoryMeta(entry.category).color;
  return "#00FF41";
}

export function getEntryLabel(entry) {
  const entryType = entry.entry_type || (entry.is_break ? "break" : "task");
  if (entryType === "scheduled") return "Committed";
  if (entryType === "pause") return "Break";
  if (entryType === "break") return "Drifted";
  return "On purpose";
}

export function isProductiveEntry(entry) {
  const entryType = entry.entry_type || (entry.is_break ? "break" : "task");
  return entryType === "task";
}
