const STORAGE_KEY = "realitycheck-browser-v1";
const USER_ID = "shared-workspace";
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || "";
const CLOUD_STATE_URL = `${SUPABASE_URL}/rest/v1/realitycheck_shared_state`;
const USE_CLOUD_STORAGE = Boolean(SUPABASE_URL && SUPABASE_KEY);

const DEFAULT_PROJECTS = [
  { project_id: "proj_deep_work", name: "Deep Work", color: "#00FF41", is_default: true, category: "focus", icon: "briefcase" },
  { project_id: "proj_study", name: "Study", color: "#00CC33", is_default: false, category: "focus", icon: "book" },
  { project_id: "proj_coding", name: "Coding", color: "#33FF66", is_default: false, category: "focus", icon: "code" },
  { project_id: "proj_exercise", name: "Exercise", color: "#FFD600", is_default: false, category: "health", icon: "dumbbell" },
  { project_id: "proj_reading", name: "Reading", color: "#00BFFF", is_default: false, category: "rest", icon: "book" },
].map((project) => ({
  ...project,
  user_id: USER_ID,
  created_at: new Date().toISOString(),
}));

let installed = false;

function createState() {
  return {
    projects: DEFAULT_PROJECTS.map((project) => ({ ...project })),
    schedules: [],
    entries: [],
    reports: [],
  };
}

function loadBrowserState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    return saved && saved.projects && saved.entries ? saved : createState();
  } catch (_error) {
    return createState();
  }
}

function saveBrowserState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function loadState() {
  if (!USE_CLOUD_STORAGE) return loadBrowserState();
  try {
    const response = await window.fetch(`${CLOUD_STATE_URL}?id=eq.main&select=data`, {
      headers: supabaseHeaders(),
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
    const rows = await response.json();
    if (rows.length) return rows[0].data;
    const initialState = createState();
    await saveState(initialState);
    return initialState;
  } catch (err) {
    console.warn("Supabase unavailable, falling back to localStorage:", err.message);
    return loadBrowserState();
  }
}

async function saveState(state) {
  if (!USE_CLOUD_STORAGE) {
    saveBrowserState(state);
    return;
  }
  try {
    const response = await window.fetch(CLOUD_STATE_URL, {
      method: "POST",
      headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ id: "main", data: state, updated_at: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  } catch (err) {
    console.warn("Supabase save failed, falling back to localStorage:", err.message);
    saveBrowserState(state);
  }
}

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function projectMap(state) {
  return Object.fromEntries(state.projects.map((project) => [project.project_id, project]));
}

function enrichEntries(entries, state) {
  const projects = projectMap(state);
  return entries.map((entry) => {
    const project = projects[entry.project_id];
    return project
      ? { ...entry, project_name: project.name, project_color: project.color }
      : entry;
  });
}

function entryType(entry) {
  return entry.entry_type || (entry.is_break ? "break" : "task");
}

function dateValue(isoString) {
  return isoString.slice(0, 10);
}

function finishedForDate(state, date) {
  return enrichEntries(
    state.entries
      .filter((entry) => !entry.is_running && dateValue(entry.start_time) === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    state
  );
}

function analyticsForDate(state, date) {
  const entries = finishedForDate(state, date);
  const totals = entries.reduce(
    (result, entry) => {
      const duration = entry.duration || 0;
      if (entryType(entry) === "scheduled") result.scheduled_seconds += duration;
      else if (entryType(entry) === "break") result.break_seconds += duration;
      else result.productive_seconds += duration;
      return result;
    },
    { productive_seconds: 0, break_seconds: 0, scheduled_seconds: 0 }
  );
  return { date, ...totals, entries };
}

function startOfWeek() {
  const today = new Date();
  const day = (today.getUTCDay() + 6) % 7;
  today.setUTCDate(today.getUTCDate() - day);
  return today.toISOString().slice(0, 10);
}

function dateOffset(startDate, offset) {
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function weeklyAnalytics(state) {
  const weekStart = startOfWeek();
  let totalProductive = 0;
  let totalBreak = 0;
  let totalScheduled = 0;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = dateOffset(weekStart, index);
    const totals = analyticsForDate(state, date);
    totalProductive += totals.productive_seconds;
    totalBreak += totals.break_seconds;
    totalScheduled += totals.scheduled_seconds;
    return {
      date,
      day_name: new Date(`${date}T00:00:00Z`).toLocaleDateString("en", {
        weekday: "short",
        timeZone: "UTC",
      }),
      ...totals,
      productive_hours: Number((totals.productive_seconds / 3600).toFixed(2)),
      break_hours: Number((totals.break_seconds / 3600).toFixed(2)),
      scheduled_hours: Number((totals.scheduled_seconds / 3600).toFixed(2)),
    };
  });
  return {
    days,
    total_productive_seconds: totalProductive,
    total_break_seconds: totalBreak,
    total_scheduled_seconds: totalScheduled,
    total_productive_hours: Number((totalProductive / 3600).toFixed(2)),
    total_break_hours: Number((totalBreak / 3600).toFixed(2)),
    total_scheduled_hours: Number((totalScheduled / 3600).toFixed(2)),
  };
}

function projectAnalytics(state, date) {
  const projects = projectMap(state);
  const totals = {};
  finishedForDate(state, date)
    .filter((entry) => !entry.is_break)
    .forEach((entry) => {
      const key = entry.project_id || "uncategorized";
      totals[key] = (totals[key] || 0) + (entry.duration || 0);
    });
  return Object.entries(totals)
    .map(([projectId, seconds]) => ({
      project_id: projectId,
      project_name: projects[projectId]?.name || "Uncategorized",
      project_color: projects[projectId]?.color || "#666666",
      seconds,
      hours: Number((seconds / 3600).toFixed(2)),
    }))
    .sort((a, b) => b.seconds - a.seconds);
}

function addGapEntry(state, endTime) {
  const last = state.entries
    .filter((entry) => !entry.is_running && entry.end_time)
    .sort((a, b) => b.end_time.localeCompare(a.end_time))[0];
  if (!last) return;
  const duration = (new Date(endTime) - new Date(last.end_time)) / 1000;
  if (duration <= 60 || duration > 12 * 3600) return;
  state.entries.push({
    entry_id: id("entry"),
    user_id: USER_ID,
    project_id: null,
    description: "Untracked time",
    start_time: last.end_time,
    end_time: endTime,
    duration,
    is_break: true,
    is_running: false,
    entry_type: "break",
    schedule_id: null,
  });
}

function buildReport(state) {
  const weekly = weeklyAnalytics(state);
  const productive = weekly.total_productive_hours;
  const scheduled = weekly.total_scheduled_hours;
  const unaccounted = weekly.total_break_hours;
  const ratio = productive ? `${(unaccounted / productive).toFixed(1)}:1` : "undefined";
  const zeroDays = weekly.days
    .filter((day) => day.date <= new Date().toISOString().slice(0, 10) && !day.productive_hours)
    .map((day) => day.day_name);
  const content = [
    "## Reality Check",
    "",
    `You lived **${productive.toFixed(1)}h** on purpose this week — work and intentional life time. Committed time was **${scheduled.toFixed(1)}h**. Drifted (untracked) time was **${unaccounted.toFixed(1)}h**.`,
    "",
    "## The Numbers",
    "",
    `- On purpose: ${productive.toFixed(1)}h`,
    `- Committed time: ${scheduled.toFixed(1)}h`,
    `- Drifted time: ${unaccounted.toFixed(1)}h`,
    `- Drifted/on-purpose ratio: ${ratio}`,
    "",
    "## Pattern",
    "",
    zeroDays.length
      ? `No tracked time on: ${zeroDays.join(", ")}. A day only counts once you start tracking what you actually do.`
      : "You lived on purpose each tracked day. The useful question is whether the hours match the story you told yourself.",
    "",
    "## Next Moves",
    "",
    "- Start the timer before the activity begins — work or life.",
    "- Categorize projects so your day shows the real mix (focus, health, social, care).",
    "- Review drifted time daily, while it is still actionable.",
  ].join("\n");
  return {
    report_id: id("report"),
    user_id: USER_ID,
    week_start: startOfWeek(),
    generated_at: new Date().toISOString(),
    content,
    data_summary: {
      total_productive_hours: productive,
      total_scheduled_hours: scheduled,
      total_break_hours: unaccounted,
      days: weekly.days,
    },
  };
}

async function handleApiRequest(path, method, request) {
  const state = await loadState();
  let body = {};
  if (typeof request.body === "string") {
    try {
      body = JSON.parse(request.body);
    } catch (_error) {
      return json({ detail: "Invalid request body" }, 400);
    }
  }

  if (path === "/api/auth/logout" && method === "POST") return json({ message: "Logged out" });

  if (path === "/api/projects" && method === "GET") return json(state.projects);
  if (path === "/api/projects" && method === "POST") {
    const project = {
      project_id: id("proj"),
      user_id: USER_ID,
      name: body.name,
      color: body.color || "#00FF41",
      category: body.category || "focus",
      icon: body.icon || null,
      is_default: false,
      created_at: new Date().toISOString(),
    };
    state.projects.push(project);
    await saveState(state);
    return json(project);
  }
  const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && method === "PUT") {
    const project = state.projects.find((item) => item.project_id === projectMatch[1]);
    if (!project) return json({ detail: "Project not found" }, 404);
    Object.assign(project, body);
    await saveState(state);
    return json(project);
  }
  if (projectMatch && method === "DELETE") {
    state.projects = state.projects.filter((item) => item.project_id !== projectMatch[1]);
    await saveState(state);
    return json({ message: "Deleted" });
  }

  if (path === "/api/schedules" && method === "GET") return json(state.schedules);
  if (path === "/api/schedules" && method === "POST") {
    const schedule = {
      ...body,
      schedule_id: id("sched"),
      user_id: USER_ID,
      created_at: new Date().toISOString(),
    };
    state.schedules.push(schedule);
    await saveState(state);
    return json(schedule);
  }
  const scheduleMatch = path.match(/^\/api\/schedules\/([^/]+)$/);
  if (scheduleMatch && method === "DELETE") {
    state.schedules = state.schedules.filter((item) => item.schedule_id !== scheduleMatch[1]);
    await saveState(state);
    return json({ message: "Deleted" });
  }

  if (path === "/api/timer/current" && method === "GET") {
    const running = state.entries.find((entry) => entry.is_running);
    return json(running ? { ...enrichEntries([running], state)[0], running: true } : { running: false });
  }
  if (path === "/api/timer/start" && method === "POST") {
    if (state.entries.some((entry) => entry.is_running)) return json({ detail: "Timer already running. Stop it first." }, 400);
    const now = new Date().toISOString();
    addGapEntry(state, now);
    const defaultProject = state.projects.find((project) => project.is_default);
    const entry = {
      entry_id: id("entry"),
      user_id: USER_ID,
      project_id: body.project_id || defaultProject?.project_id || null,
      description: body.description || "Working",
      start_time: now,
      end_time: null,
      duration: null,
      is_break: false,
      is_running: true,
      entry_type: "task",
      schedule_id: null,
    };
    state.entries.push(entry);
    await saveState(state);
    return json(enrichEntries([entry], state)[0]);
  }
  if (path === "/api/timer/stop" && method === "POST") {
    const running = state.entries.find((entry) => entry.is_running);
    if (!running) return json({ detail: "No running timer" }, 400);
    running.end_time = new Date().toISOString();
    running.duration = (new Date(running.end_time) - new Date(running.start_time)) / 1000;
    running.is_running = false;
    await saveState(state);
    return json(enrichEntries([running], state)[0]);
  }

  if (path === "/api/entries" && method === "GET") {
    let entries = state.entries.slice().sort((a, b) => b.start_time.localeCompare(a.start_time));
    const date = request.searchParams.get("date");
    const limit = Number(request.searchParams.get("limit") || 50);
    if (date) entries = entries.filter((entry) => dateValue(entry.start_time) === date);
    return json(enrichEntries(entries.slice(0, limit), state));
  }
  if (path === "/api/entries" && method === "POST") {
    const start = body.start_time ? new Date(body.start_time) : null;
    const end = body.end_time ? new Date(body.end_time) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return json({ detail: "Valid start and end times are required" }, 400);
    }
    const duration = (end - start) / 1000;
    if (duration <= 0) return json({ detail: "End time must be after start time" }, 400);
    if (duration > 24 * 3600) return json({ detail: "Entry can't be longer than 24 hours" }, 400);
    const defaultProject = state.projects.find((project) => project.is_default);
    const isBreak = Boolean(body.is_break);
    const entry = {
      entry_id: id("entry"),
      user_id: USER_ID,
      // Reconciled/category time may have no project; only fall back to default
      // when neither a project nor a category was supplied.
      project_id: body.project_id || (body.category ? null : defaultProject?.project_id || null),
      category: body.category || null,
      description: (body.description && body.description.trim()) || "Logged time",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      duration,
      is_break: isBreak,
      is_running: false,
      entry_type: isBreak ? "break" : "task",
      schedule_id: null,
      manual: true,
    };
    state.entries.push(entry);
    await saveState(state);
    return json(enrichEntries([entry], state)[0]);
  }
  const entryMatch = path.match(/^\/api\/entries\/([^/]+)$/);
  if (entryMatch && method === "DELETE") {
    state.entries = state.entries.filter((entry) => entry.entry_id !== entryMatch[1]);
    await saveState(state);
    return json({ message: "Deleted" });
  }

  if (path === "/api/analytics/daily" && method === "GET") {
    const date = request.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    return json(analyticsForDate(state, date));
  }
  if (path === "/api/analytics/weekly" && method === "GET") return json(weeklyAnalytics(state));
  if (path === "/api/analytics/projects" && method === "GET") {
    const date = request.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    return json(projectAnalytics(state, date));
  }

  if (path === "/api/reports/weekly" && method === "GET") {
    return json(state.reports.slice().sort((a, b) => b.generated_at.localeCompare(a.generated_at)));
  }
  if (path === "/api/reports/weekly" && method === "POST") {
    const report = buildReport(state);
    state.reports.unshift(report);
    await saveState(state);
    return json(report);
  }
  const reportMatch = path.match(/^\/api\/reports\/weekly\/([^/]+)$/);
  if (reportMatch && method === "DELETE") {
    state.reports = state.reports.filter((report) => report.report_id !== reportMatch[1]);
    await saveState(state);
    return json({ message: "Deleted" });
  }
  if (path === "/api/voice/transcribe" && method === "POST") {
    return json({ detail: "Use your browser speech recognition for voice input." }, 503);
  }
  return json({ detail: "Not found" }, 404);
}

export function installBrowserApi() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === "string" ? input : input.url, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) {
      return nativeFetch(input, options);
    }
    const method = (options.method || (typeof input !== "string" && input.method) || "GET").toUpperCase();
    return Promise.resolve(handleApiRequest(url.pathname, method, {
      body: options.body,
      searchParams: url.searchParams,
    }));
  };
}
