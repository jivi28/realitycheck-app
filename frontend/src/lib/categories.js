/**
 * Activity categories. Tracked time is "lived on purpose" — not just work.
 * Each project belongs to a category so life activities (walks, family, meals,
 * chores) are honored as intentional time, not lumped as "unproductive".
 */
export const CATEGORIES = [
  { id: "focus",  label: "Focus",  color: "#00FF41", hint: "work, study, coding" },
  { id: "health", label: "Health", color: "#FFD600", hint: "exercise, walks, healthy meals" },
  { id: "social", label: "Social", color: "#B388FF", hint: "family, friends" },
  { id: "care",   label: "Care",   color: "#FF8C00", hint: "chores, errands, shopping" },
  { id: "rest",   label: "Rest",   color: "#60A5FA", hint: "intentional downtime" },
];

const DEFAULT_CATEGORY = "focus";

export function categoryMeta(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

// A project's category, defaulting to focus for legacy/uncategorized projects.
export function projectCategory(project) {
  return project && project.category && CATEGORIES.some((c) => c.id === project.category)
    ? project.category
    : DEFAULT_CATEGORY;
}
