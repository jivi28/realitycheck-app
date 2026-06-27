import { Zap, Activity, Users, ShoppingBag, Coffee, CircleSlash } from "lucide-react";

/**
 * Activity categories. Tracked time is "lived on purpose" — not just work.
 * Each project belongs to a category so life activities (walks, family, meals,
 * chores) are honored as intentional time, not lumped as "unproductive".
 */
export const CATEGORIES = [
  { id: "focus",  label: "Focus",  color: "#00FF41", Icon: Zap,         hint: "work, study, coding" },
  { id: "health", label: "Health", color: "#FFD600", Icon: Activity,    hint: "exercise, walks, healthy meals" },
  { id: "social", label: "Social", color: "#B388FF", Icon: Users,       hint: "family, friends" },
  { id: "care",   label: "Care",   color: "#FF8C00", Icon: ShoppingBag, hint: "chores, errands, shopping" },
  { id: "rest",   label: "Rest",   color: "#60A5FA", Icon: Coffee,      hint: "intentional downtime" },
];

// Special category for time that wasn't spent on purpose — counts as Drifted,
// not toward the "on purpose" score. Offered in the reconcile sheet only.
export const NOT_PURPOSEFUL = { id: "not_purposeful", label: "Not purposeful", color: "#52525B", Icon: CircleSlash, hint: "drifted / wasted time" };

const DEFAULT_CATEGORY = "focus";

export function categoryMeta(id) {
  if (id === NOT_PURPOSEFUL.id) return NOT_PURPOSEFUL;
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[0];
}

// A project's category, defaulting to focus for legacy/uncategorized projects.
export function projectCategory(project) {
  return project && project.category && CATEGORIES.some((c) => c.id === project.category)
    ? project.category
    : DEFAULT_CATEGORY;
}
