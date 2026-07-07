/**
 * JSON export/import of all app data — cheap insurance against localStorage
 * wipes and the way to move data between browsers without cloud sync.
 */
import { STORAGE_KEY, replaceAllData } from "./browserApi";
import { readGoals } from "./goals";

export function exportAllData() {
  let state = null;
  try {
    state = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
  } catch (_error) {
    state = null;
  }
  const payload = {
    app: "realitycheck",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: state || { projects: [], schedules: [], entries: [], reports: [] },
    goals: readGoals(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `realitycheck-export-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Replaces ALL current data (local and cloud) with the file's contents, then
// reloads. Throws with a readable message on invalid files.
export async function importAllData(file) {
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (_error) {
    throw new Error("Not a valid JSON file");
  }
  if (payload?.app !== "realitycheck" || !payload.state || !Array.isArray(payload.state.entries)) {
    throw new Error("Not a RealityCheck export file");
  }
  await replaceAllData({ state: payload.state, goals: payload.goals || [] });
  window.location.reload();
}
