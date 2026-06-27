import {
  Code, BookOpen, Dumbbell, Brush, ShoppingCart, Coffee, Music, Briefcase,
  GraduationCap, Heart, Users, Home, PenTool, Camera, Gamepad2, Utensils,
  Plane, DollarSign, Sprout, Stethoscope,
} from "lucide-react";

// Curated icon set for projects — a second dimension beyond color, since there
// are only so many distinguishable colors. Stored on a project as `icon: key`.
export const PROJECT_ICONS = [
  { key: "code", Icon: Code },
  { key: "book", Icon: BookOpen },
  { key: "dumbbell", Icon: Dumbbell },
  { key: "brush", Icon: Brush },
  { key: "cart", Icon: ShoppingCart },
  { key: "coffee", Icon: Coffee },
  { key: "music", Icon: Music },
  { key: "briefcase", Icon: Briefcase },
  { key: "cap", Icon: GraduationCap },
  { key: "heart", Icon: Heart },
  { key: "users", Icon: Users },
  { key: "home", Icon: Home },
  { key: "pen", Icon: PenTool },
  { key: "camera", Icon: Camera },
  { key: "game", Icon: Gamepad2 },
  { key: "food", Icon: Utensils },
  { key: "plane", Icon: Plane },
  { key: "money", Icon: DollarSign },
  { key: "plant", Icon: Sprout },
  { key: "health", Icon: Stethoscope },
];

const ICON_MAP = Object.fromEntries(PROJECT_ICONS.map((i) => [i.key, i.Icon]));

// Returns the lucide component for a project's icon key, or null if unset/unknown.
export function projectIconComp(key) {
  return (key && ICON_MAP[key]) || null;
}
