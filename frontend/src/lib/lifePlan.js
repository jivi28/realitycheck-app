import { localDayStr } from "./dates";

export const LIFE_PLAN_KEY = "rc_life_plan";

export const LIFE_AREAS = [
  { id: "health", label: "Health", color: "#FFD600" },
  { id: "career", label: "Career", color: "#00FF41" },
  { id: "learning", label: "Learning", color: "#60A5FA" },
  { id: "money", label: "Money", color: "#34D399" },
  { id: "relationships", label: "Relationships", color: "#B388FF" },
  { id: "home", label: "Home", color: "#FF8C00" },
  { id: "creative", label: "Creative", color: "#F472B6" },
  { id: "life", label: "Life", color: "#A1A1AA" },
];

export const ENERGY_MODES = [
  { id: "low", label: "Low", color: "#60A5FA" },
  { id: "normal", label: "Normal", color: "#00FF41" },
  { id: "deep", label: "Deep", color: "#B388FF" },
  { id: "quick", label: "Quick", color: "#FFD600" },
  { id: "admin", label: "Admin", color: "#FF8C00" },
];

export const LIFE_GOAL_STATUSES = [
  { id: "season", label: "Season" },
  { id: "active", label: "Active" },
  { id: "maintenance", label: "Maintaining" },
  { id: "paused", label: "Paused" },
  { id: "someday", label: "Someday" },
  { id: "complete", label: "Complete" },
];

const DEFAULT_PLAN = {
  version: 1,
  northStar: "",
  season: {
    label: "Current Season",
    timeframe: "Next 90 days",
    priorities: [],
  },
  queue: {
    now: "",
    next: "",
    later: "",
  },
  energyMode: "normal",
  antiTodos: [],
  longTermGoals: [],
  interviewNotes: [],
  updatedAt: null,
};

export function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function areaMeta(areaId) {
  return LIFE_AREAS.find((area) => area.id === areaId) || LIFE_AREAS[LIFE_AREAS.length - 1];
}

export function energyMeta(modeId) {
  return ENERGY_MODES.find((mode) => mode.id === modeId) || ENERGY_MODES[1];
}

export function normalizePriority(priority) {
  return {
    id: makeId("priority"),
    label: "",
    area: "life",
    createdAt: new Date().toISOString(),
    ...priority,
  };
}

export function normalizeMilestone(milestone) {
  return {
    id: makeId("milestone"),
    label: "",
    done: false,
    doneAt: null,
    createdAt: new Date().toISOString(),
    ...milestone,
  };
}

export function normalizeLifeGoal(goal) {
  const source = goal || {};
  return {
    id: makeId("life_goal"),
    title: "",
    area: "life",
    timeframe: "",
    status: "active",
    confidence: 60,
    projectIds: [],
    milestones: [],
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: null,
    ...source,
    projectIds: Array.isArray(source.projectIds) ? source.projectIds : [],
    milestones: (source.milestones || []).map(normalizeMilestone),
  };
}

export function normalizeAntiTodo(item) {
  return {
    id: makeId("anti"),
    label: "",
    active: true,
    createdAt: new Date().toISOString(),
    ...item,
  };
}

export function normalizeLifePlan(plan) {
  const base = { ...DEFAULT_PLAN, ...(plan || {}) };
  return {
    ...base,
    season: {
      ...DEFAULT_PLAN.season,
      ...(base.season || {}),
      priorities: (base.season?.priorities || []).map(normalizePriority),
    },
    queue: { ...DEFAULT_PLAN.queue, ...(base.queue || {}) },
    energyMode: ENERGY_MODES.some((mode) => mode.id === base.energyMode) ? base.energyMode : DEFAULT_PLAN.energyMode,
    antiTodos: (base.antiTodos || []).map(normalizeAntiTodo),
    longTermGoals: (base.longTermGoals || []).map(normalizeLifeGoal),
    interviewNotes: Array.isArray(base.interviewNotes) ? base.interviewNotes : [],
  };
}

export function readLifePlan() {
  try {
    return normalizeLifePlan(JSON.parse(window.localStorage.getItem(LIFE_PLAN_KEY)));
  } catch (_error) {
    return normalizeLifePlan(null);
  }
}

export function persistLifePlan(plan) {
  window.localStorage.setItem(LIFE_PLAN_KEY, JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }));
}

export function newPriority(label, area = "life") {
  return normalizePriority({ id: makeId("priority"), label: label.trim(), area });
}

export function newLifeGoal({ title, area, timeframe, status = "active", confidence = 60 }) {
  return normalizeLifeGoal({
    id: makeId("life_goal"),
    title: title.trim(),
    area,
    timeframe: timeframe.trim(),
    status,
    confidence,
  });
}

export function newMilestone(label) {
  return normalizeMilestone({ id: makeId("milestone"), label: label.trim() });
}

export function newAntiTodo(label) {
  return normalizeAntiTodo({ id: makeId("anti"), label: label.trim() });
}

export function trackedSecondsForProjects(entries = [], currentTimer = null, projectIds = []) {
  if (!projectIds.length) return { totalSeconds: 0, todaySeconds: 0 };
  const ids = new Set(projectIds);
  const today = localDayStr();
  let totalSeconds = 0;
  let todaySeconds = 0;
  for (const entry of entries) {
    if (!entry || entry.is_break || entry.is_running || !ids.has(entry.project_id)) continue;
    const seconds = entry.duration || 0;
    totalSeconds += seconds;
    if (entry.start_time && localDayStr(entry.start_time) === today) todaySeconds += seconds;
  }
  if (currentTimer && !currentTimer.is_break && ids.has(currentTimer.project_id)) {
    const live = Math.max(0, Math.floor((Date.now() - new Date(currentTimer.start_time).getTime()) / 1000));
    totalSeconds += live;
    todaySeconds += live;
  }
  return { totalSeconds, todaySeconds };
}

export function formatPlanTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "0m";
}
