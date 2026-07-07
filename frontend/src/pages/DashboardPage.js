import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Plus, X, Undo2, Star } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import ActiveTimer from "@/components/ActiveTimer";
import DailyTimeline from "@/components/DailyTimeline";
import StatsBar from "@/components/StatsBar";
import RecentEntries from "@/components/RecentEntries";
import ProjectChip from "@/components/ProjectChip";
import LogPastTimeForm from "@/components/LogPastTimeForm";
import GoalCard from "@/components/GoalCard";
import ReconcileSheet from "@/components/ReconcileSheet";
import { readGoals, persistGoals as writeGoals, GOALS_REFRESH_EVENT, normalizeGoal, computePacing, computeGoalProgress, computeSubgoalProgress, isGoalActive, todayStr, formatGoalTime, completedSummary } from "@/lib/goals";
import { computeStreak } from "@/lib/streak";
import { localDayStr } from "@/lib/dates";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Wraps one open goal so it can be dragged into a new priority order. Uses a
// render-prop so the drag handle (attributes/listeners) is threaded into the
// GoalCard's grip; completed goals render plain GoalCards outside any DndContext.
function SortableGoalCard({ id, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, setActivatorNodeRef })}
    </div>
  );
}

export default function DashboardPage({ user }) {
  const [currentTimer, setCurrentTimer] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [, setTick] = useState(0); // 1-second tick for real-time goal progress

  const [goals, setGoals] = useState(readGoals);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalLabel, setNewGoalLabel] = useState("");
  const [newGoalHours, setNewGoalHours] = useState("");
  const [newGoalProjectId, setNewGoalProjectId] = useState("");
  const [newGoalCarryOver, setNewGoalCarryOver] = useState(true);
  const [editingGoal, setEditingGoal] = useState(null);
  const [expandedGoals, setExpandedGoals] = useState(() => new Set());
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  // When a break ends, resolve what it was: { gapStart, gapEnd, seconds, driftId }
  const [breakResolve, setBreakResolve] = useState(null);

  const timerInputRef = useRef(null);
  const today = localDayStr();

  // Re-render every second while timer is running so goal progress stays live
  useEffect(() => {
    if (!currentTimer) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [currentTimer]);

  const fetchAll = useCallback(async () => {
    try {
      const [timerRes, dailyRes, entriesRes, allRes, projRes] = await Promise.all([
        fetch(`${API}/timer/current`, { credentials: "include" }),
        fetch(`${API}/analytics/daily?date=${today}`, { credentials: "include" }),
        fetch(`${API}/entries?date=${today}&limit=20`, { credentials: "include" }),
        fetch(`${API}/entries?limit=5000`, { credentials: "include" }),
        fetch(`${API}/projects`, { credentials: "include" }),
      ]);

      const timerData = await timerRes.json();
      setCurrentTimer(timerData.running ? timerData : null);

      const daily = await dailyRes.json();
      setDailyData(daily);

      const entries = await entriesRes.json();
      setTodayEntries(entries);

      const all = await allRes.json();
      setAllEntries(Array.isArray(all) ? all : []);

      const projs = await projRes.json();
      setProjects(projs);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  }, [today]);

  // Refetch when the tab regains focus (browserApi also refreshes its cloud
  // cache on visibility), plus a slow 5-minute safety interval — instead of
  // the old blind 30s full refetch.
  useEffect(() => {
    fetchAll();
    const onVisible = () => {
      if (!document.hidden) fetchAll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const interval = setInterval(fetchAll, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearInterval(interval);
    };
  }, [fetchAll]);

  const handleTimerStart = async (description, projectId) => {
    try {
      const res = await fetch(`${API}/timer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description, project_id: projectId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start timer");
      }
      await fetchAll();
    } catch (err) {
      throw err;
    }
  };

  const handleTimerStop = async () => {
    try {
      await fetch(`${API}/timer/stop`, { method: "POST", credentials: "include" });
      await fetchAll();
    } catch (err) {
      console.error("Failed to stop timer:", err);
    }
  };

  // Pause the running task and start a neutral break, remembering what to
  // return to. desc/projectId let Pomodoro pass the just-finished task in.
  const handleTimerBreak = async (desc, projectId) => {
    try {
      const resumeDesc = desc ?? currentTimer?.description ?? null;
      const resumeProject = projectId ?? currentTimer?.project_id ?? null;
      if (currentTimer) await handleTimerStop();
      const res = await fetch(`${API}/timer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ entry_type: "pause", resume_description: resumeDesc, resume_project_id: resumeProject }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start break");
      }
      await fetchAll();
      toast.success("On a break");
    } catch (err) {
      toast.error(err.message || "Failed to start break");
    }
  };

  // End the break and account for it. The break counts as Drift by default
  // (logged immediately on resume), so walking away never launders the time;
  // the resolve sheet then lets you reclaim it as Recharge — or split a mix.
  const handleTimerResume = async () => {
    const t = currentTimer;
    const resumeDesc = t?.resume_description || null;
    const resumeProject = t?.resume_project_id || null;
    const pauseId = t?.entry_id || null;
    const gapStart = t?.start_time || null;
    try {
      await handleTimerStop();
      const gapEnd = new Date().toISOString();
      const seconds = gapStart ? Math.floor((Date.parse(gapEnd) - Date.parse(gapStart)) / 1000) : 0;

      // Replace the transient pause entry with a real Drift entry — the honest
      // default. Resolving the break later deletes this and writes the real time.
      let driftId = null;
      if (pauseId && seconds >= 1) {
        await fetch(`${API}/entries/${pauseId}`, { method: "DELETE", credentials: "include" });
        const res = await fetch(`${API}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ description: "Drifted", is_break: true, start_time: gapStart, end_time: gapEnd }),
        });
        if (res.ok) { const created = await res.json(); driftId = created.entry_id; }
      }

      if (resumeDesc) {
        await handleTimerStart(resumeDesc, resumeProject);
        toast.success(`Back to: ${resumeDesc}`);
      }
      await fetchAll();

      // Only bother resolving a non-trivial break.
      if (seconds >= 30 && gapStart) setBreakResolve({ gapStart, gapEnd, seconds, driftId });
    } catch (err) {
      toast.error(err.message || "Failed to resume");
    }
  };

  const handleSwitchProject = async (newProjectId) => {
    if (!currentTimer) return;
    const desc = currentTimer.description;
    try {
      await handleTimerStop();
      await handleTimerStart(desc, newProjectId || null);
      toast.success("Project switched");
    } catch (err) {
      toast.error(err.message || "Failed to switch project");
    }
  };

  // Goals — every change goes through saveGoals, which snapshots the prior
  // state so any goal/subtask edit can be undone (⌘Z or the Undo button).
  const goalsUndo = useRef([]);
  const [undoDepth, setUndoDepth] = useState(0);

  const persistGoals = (next) => {
    setGoals(next);
    writeGoals(next);
  };

  // Re-read when the cloud replaced goals (edited on another device / by a friend).
  useEffect(() => {
    const onRefresh = () => setGoals(readGoals());
    window.addEventListener(GOALS_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(GOALS_REFRESH_EVENT, onRefresh);
  }, []);

  const saveGoals = (updated) => {
    goalsUndo.current.push(goals);
    if (goalsUndo.current.length > 50) goalsUndo.current.shift();
    setUndoDepth(goalsUndo.current.length);
    persistGoals(updated);
  };

  const aliasesForRename = (item, nextLabel) => {
    const previous = (item.label || "").trim();
    const next = (nextLabel || "").trim();
    const aliases = Array.isArray(item.aliases) ? item.aliases : [];
    if (!previous || previous === next || aliases.includes(previous)) return aliases;
    return [...aliases, previous];
  };

  const clearGoalUpNext = (goal) => ({
    ...goal,
    upNext: false,
    subgoals: (goal.subgoals || []).map((s) => ({ ...s, upNext: false })),
  });

  // Drag-to-reorder open goals into your own top-down priority. Completed goals
  // keep their doneAt sort, so we just re-append them (their stored order is
  // irrelevant — the render re-sorts them).
  const reorderGoals = (activeId, overId) => {
    if (activeId === overId) return;
    const open = goals.filter((g) => !g.done);
    const done = goals.filter((g) => g.done);
    const from = open.findIndex((g) => g.id === activeId);
    const to = open.findIndex((g) => g.id === overId);
    if (from === -1 || to === -1) return;
    saveGoals([...arrayMove(open, from, to), ...done]);
  };

  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleGoalDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) reorderGoals(active.id, over.id);
  };

  const undoGoals = () => {
    if (!goalsUndo.current.length) return;
    const prev = goalsUndo.current.pop();
    setUndoDepth(goalsUndo.current.length);
    persistGoals(prev);
    toast.success("Change undone");
  };

  // ⌘Z / Ctrl+Z undoes the last goal change (ignored while typing in a field)
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const editable = t && ((t.tagName || "").match(/^(INPUT|TEXTAREA|SELECT)$/) || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey && !editable) {
        if (goalsUndo.current.length) { e.preventDefault(); undoGoals(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals]);

  // Context for goal time math (live elapsed updates via the 1s tick)
  const goalCtx = { allEntries, currentTimer };
  const goalSecondsNow = (goal) => computeGoalProgress(goal, goalCtx).seconds;
  const subgoalSecondsNow = (goal, sub) => computeSubgoalProgress(goal, sub, goalCtx).seconds;

  const addGoal = () => {
    const hrs = parseFloat(newGoalHours);
    if (!newGoalLabel.trim() || !hrs || hrs <= 0) return;
    saveGoals([
      ...goals,
      normalizeGoal({
        id: Date.now().toString(),
        label: newGoalLabel.trim(),
        targetHours: hrs,
        projectId: newGoalProjectId || null,
        carryOver: newGoalCarryOver,
        startDate: todayStr(),
        startAt: new Date().toISOString(),
      }),
    ]);
    setNewGoalLabel(""); setNewGoalHours(""); setNewGoalProjectId(""); setNewGoalCarryOver(true); setShowGoalForm(false);
  };

  // Start timer for a specific goal / subgoal (stops current timer first if running)
  const handleStartForGoal = async (goal) => {
    try {
      if (currentTimer) await handleTimerStop();
      await handleTimerStart(goal.label, goal.projectId || null);
      toast.success(`Working on: ${goal.label}`);
    } catch (err) {
      toast.error(err.message || "Failed to start");
    }
  };

  const startForSubgoal = async (goal, sub) => {
    try {
      if (currentTimer) await handleTimerStop();
      await handleTimerStart(sub.label, goal.projectId || null);
      toast.success(`Working on: ${sub.label}`);
    } catch (err) {
      toast.error(err.message || "Failed to start");
    }
  };

  const saveEditGoal = () => {
    if (!editingGoal || !editingGoal.label.trim() || !editingGoal.targetHours) return;
    const targetHours = parseFloat(editingGoal.targetHours);
    if (!targetHours || targetHours <= 0) return;
    saveGoals(goals.map((g) => g.id === editingGoal.id ? {
      ...g,
      ...editingGoal,
      label: editingGoal.label.trim(),
      targetHours,
      aliases: aliasesForRename(g, editingGoal.label),
    } : g));
    setEditingGoal(null);
  };

  // Subgoal + completion + manual-time helpers (goal state lives in localStorage)
  const mapGoal = (goalId, fn) => saveGoals(goals.map((g) => (g.id === goalId ? fn(g) : g)));
  const mapSubgoal = (goalId, subId, fn) =>
    mapGoal(goalId, (g) => ({ ...g, subgoals: g.subgoals.map((s) => (s.id === subId ? fn(s) : s)) }));

  const addSubgoal = (goalId, label, hours) =>
    mapGoal(goalId, (g) => ({
      ...g,
      subgoals: [...g.subgoals, { id: `${Date.now()}_${g.subgoals.length}`, label, targetHours: hours, aliases: [], upNext: false, done: false, doneAt: null, doneSeconds: null, addedSeconds: 0, startAt: new Date().toISOString() }],
    }));
  const deleteSubgoal = (goalId, subId) =>
    mapGoal(goalId, (g) => ({ ...g, subgoals: g.subgoals.filter((s) => s.id !== subId) }));

  const editSubgoal = (goalId, subId, fields) =>
    mapSubgoal(goalId, subId, (s) => ({
      ...s,
      ...fields,
      label: fields.label.trim(),
      targetHours: parseFloat(fields.targetHours),
      aliases: aliasesForRename(s, fields.label),
    }));

  const deleteGoal = (goalId) =>
    saveGoals(goals.filter((g) => g.id !== goalId));

  const markGoalDone = (goalId) =>
    mapGoal(goalId, (g) => g.done
      ? { ...g, done: false, doneAt: null, doneSeconds: null }
      : { ...clearGoalUpNext(g), done: true, doneAt: new Date().toISOString(), doneSeconds: Math.round(goalSecondsNow(g)) });
  const markSubgoalDone = (goalId, subId) =>
    mapSubgoal(goalId, subId, (s) => s.done
      ? { ...s, done: false, doneAt: null, doneSeconds: null }
      : { ...s, upNext: false, done: true, doneAt: new Date().toISOString(), doneSeconds: Math.round(subgoalSecondsNow(goals.find((g) => g.id === goalId), s)) });

  // Adjust the TARGET time a goal/subgoal needs (extend or shrink). Worked time
  // is added via "Log past time", not here.
  const setGoalTarget = (goalId, hours) =>
    mapGoal(goalId, (g) => ({ ...g, targetHours: hours }));
  const setSubgoalTarget = (goalId, subId, hours) =>
    mapSubgoal(goalId, subId, (s) => ({ ...s, targetHours: hours }));

  const toggleGoalUpNext = (goalId) => {
    const selected = goals.find((g) => g.id === goalId);
    const shouldClear = !!selected?.upNext;
    saveGoals(goals.map((g) => {
      const cleared = clearGoalUpNext(g);
      return g.id === goalId && !shouldClear ? { ...cleared, upNext: true } : cleared;
    }));
  };

  const toggleSubgoalUpNext = (goalId, subId) => {
    const selectedGoal = goals.find((g) => g.id === goalId);
    const selectedSub = selectedGoal?.subgoals?.find((s) => s.id === subId);
    const shouldClear = !!selectedSub?.upNext;
    saveGoals(goals.map((g) => {
      const cleared = clearGoalUpNext(g);
      if (g.id !== goalId || shouldClear) return cleared;
      return {
        ...cleared,
        subgoals: cleared.subgoals.map((s) => (s.id === subId ? { ...s, upNext: true } : s)),
      };
    }));
  };

  const toggleCarryOver = (goalId) =>
    mapGoal(goalId, (g) => ({ ...g, carryOver: !g.carryOver, startDate: g.startDate || todayStr() }));

  const toggleExpand = (goalId) =>
    setExpandedGoals((prev) => {
      const next = new Set(prev);
      next.has(goalId) ? next.delete(goalId) : next.add(goalId);
      return next;
    });

  // Quick-start by project (stops current timer first if one is running)
  const handleQuickStart = async (project) => {
    try {
      if (currentTimer) await handleTimerStop();
      await handleTimerStart(project.name, project.project_id);
      toast.success(`Started: ${project.name}`);
    } catch (err) {
      toast.error(err.message || "Failed to start");
    }
  };

  // Has any finished, non-break work been logged today for this project?
  const projectHasEntriesToday = (projectId) =>
    todayEntries.some((e) => e.project_id === projectId && !e.is_break && !e.is_running);

  // Project rename/recolor + delete (reuses the projects API)
  const updateProject = async (projectId, fields) => {
    try {
      await fetch(`${API}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fields),
      });
      toast.success("Project updated");
      await fetchAll();
    } catch (err) {
      toast.error("Failed to update project");
    }
  };

  const deleteProject = async (projectId) => {
    try {
      await fetch(`${API}/projects/${projectId}`, { method: "DELETE", credentials: "include" });
      toast.success("Project deleted");
      await fetchAll();
    } catch (err) {
      toast.error("Failed to delete project");
    }
  };

  // Reassign a goal's linked project inline
  const setGoalProject = (goalId, projectId) => {
    saveGoals(goals.map((g) => (g.id === goalId ? { ...g, projectId: projectId || null } : g)));
  };

  // Idle alert
  const computeIdleMinutes = () => {
    if (currentTimer) return null;
    const hour = new Date().getHours();
    if (hour < 7 || hour >= 23) return null;
    const completed = todayEntries.filter((e) => e.end_time);
    if (!completed.length) return null;
    const lastEnd = completed.reduce((latest, e) => {
      const t = new Date(e.end_time);
      return t > latest ? t : latest;
    }, new Date(0));
    return Math.floor((Date.now() - lastEnd.getTime()) / 60000);
  };

  const idleMinutes = computeIdleMinutes();
  const showIdleAlert = idleMinutes !== null && idleMinutes >= 10;

  // The "away" window to reconcile: from the last completed entry (or 7am if
  // none) up to now (or the running timer's start). Clamped to the awake day.
  const reconcileWindow = (() => {
    const completed = todayEntries.filter((e) => e.end_time);
    const lastEnd = completed.length
      ? completed.reduce((latest, e) => (new Date(e.end_time) > latest ? new Date(e.end_time) : latest), new Date(0))
      : (() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; })();
    const endMs = currentTimer ? new Date(currentTimer.start_time).getTime() : Date.now();
    const seconds = Math.max(0, Math.min(16 * 3600, Math.floor((endMs - lastEnd.getTime()) / 1000)));
    return { gapStart: lastEnd.toISOString(), gapEnd: new Date(endMs).toISOString(), seconds };
  })();

  // Continue last task
  const lastProductiveEntry = !currentTimer
    ? todayEntries
        .filter((e) => !e.is_break && e.entry_type !== "break" && e.end_time)
        .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))[0]
    : null;

  const handleContinue = async () => {
    if (!lastProductiveEntry) return;
    try {
      await handleTimerStart(lastProductiveEntry.description, lastProductiveEntry.project_id || null);
      toast.success("Continued!");
    } catch (err) {
      toast.error(err.message || "Failed to start");
    }
  };

  // Which goals is the current timer actively contributing to?
  const activeGoals = currentTimer ? goals.filter((g) => isGoalActive(g, currentTimer)) : [];

  // Autocomplete suggestions: unfinished goals + subgoals, each carrying its
  // project so picking one fills description + project in one tap.
  const projectsById = Object.fromEntries(projects.map((p) => [p.project_id, p]));
  const goalSuggestions = goals.flatMap((g) => {
    const items = [];
    if (!g.done) items.push({ label: g.label, projectId: g.projectId || null, project: projectsById[g.projectId], kind: "goal" });
    for (const s of g.subgoals || []) {
      if (!s.done) items.push({ label: s.label, projectId: g.projectId || null, project: projectsById[g.projectId], kind: "subgoal", parent: g.label });
    }
    return items;
  });

  // Aggregate pacing across goals + subgoals, with the over/ahead amount
  const pacing = computePacing(goals, goalCtx);
  const pacingAmount = pacing.status === "over" ? `+${formatGoalTime(pacing.overSeconds)}` : "";
  const pacingMeta = {
    ahead: { text: "⚡ Ahead of pace", color: "#00FF41" },
    over: { text: "⏳ Running over", color: "#FF8C00" },
    onpace: { text: "On pace", color: "#71717A" },
  }[pacing.status];

  // Active goals stay in the main list; finished ones collapse into "Completed".
  const openGoals = goals.filter((g) => !g.done);
  const completedGoals = goals
    .filter((g) => g.done)
    .sort((a, b) => (b.doneAt || "").localeCompare(a.doneAt || ""));
  const completedStats = completedSummary(goals);
  const upNextItem = openGoals.reduce((found, goal) => {
    if (found) return found;
    if (goal.upNext) return { kind: "goal", goal, label: goal.label };
    const sub = (goal.subgoals || []).find((s) => !s.done && s.upNext);
    return sub ? { kind: "subgoal", goal, sub, label: sub.label, parent: goal.label } : null;
  }, null);
  const upNextLabel = currentTimer ? "Up Next" : "Start Next";
  const renderGoalCard = (goal, dragHandle = null, priorityIndex = null) => (
    <GoalCard
      key={goal.id}
      goal={goal}
      priorityIndex={priorityIndex}
      dragHandle={dragHandle}
      projects={projects}
      ctx={goalCtx}
      expanded={expandedGoals.has(goal.id)}
      onToggleExpand={toggleExpand}
      onStartGoal={handleStartForGoal}
      onStartSubgoal={startForSubgoal}
      onMarkGoalDone={markGoalDone}
      onMarkSubgoalDone={markSubgoalDone}
      onSetGoalTarget={setGoalTarget}
      onSetSubgoalTarget={setSubgoalTarget}
      onAddSubgoal={addSubgoal}
      onDeleteSubgoal={deleteSubgoal}
      onEditSubgoal={editSubgoal}
      onEditGoal={(g) => setEditingGoal({ ...g })}
      onDeleteGoal={deleteGoal}
      onSetGoalProject={setGoalProject}
      onToggleCarryOver={toggleCarryOver}
      onToggleGoalUpNext={toggleGoalUpNext}
      onToggleSubgoalUpNext={toggleSubgoalUpNext}
    />
  );

  return (
    <AppShell user={user} activePage="dashboard">
      <div className="space-y-4 md:space-y-6">
        {/* Idle Alert — tap to account for the gap */}
        {showIdleAlert && (
          <button
            onClick={() => setReconcileOpen(true)}
            data-testid="idle-reconcile-bar"
            className="w-full text-left border border-[#FF8C00]/40 bg-[#FF8C00]/5 p-3 font-mono text-xs text-[#FF8C00] hover:bg-[#FF8C00]/10 transition-colors"
          >
            ⚡ Untracked for {idleMinutes}m — tap to account for it.
          </button>
        )}

        {/* Active Timer */}
        <ActiveTimer
          currentTimer={currentTimer}
          projects={projects}
          onStart={handleTimerStart}
          onStop={handleTimerStop}
          onBreak={handleTimerBreak}
          onResume={handleTimerResume}
          onSwitchProject={handleSwitchProject}
          activeGoals={activeGoals}
          inputRef={timerInputRef}
          suggestions={goalSuggestions}
        />

        {/* First-run guide: shows only before anything has ever been tracked */}
        {dailyData && !currentTimer && allEntries.length === 0 && (
          <div className="bg-[#0A0A0A] border border-[#00FF41]/25 p-5" data-testid="onboarding-card">
            <p className="font-mono text-[10px] text-[#00FF41] uppercase tracking-widest mb-3">
              Getting started
            </p>
            <ol className="space-y-2.5 font-mono text-xs text-[#A1A1AA]">
              <li className="flex gap-3">
                <span className="text-[#00FF41] font-bold shrink-0">1.</span>
                <span>Type what you're doing right now in the timer above and hit <span className="text-[#00FF41]">Start</span> — work or life, everything counts.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00FF41] font-bold shrink-0">2.</span>
                <span>Add a <span className="text-[#EDEDED]">goal</span> below with a time target so today has a finish line.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-[#00FF41] font-bold shrink-0">3.</span>
                <span>Put sleep and fixed commitments in <span className="text-[#60A5FA]">Schedules</span> — your Reality Score only judges the hours you actually control.</span>
              </li>
            </ol>
          </div>
        )}

        {/* Goals */}
        <div className="bg-[#0A0A0A] border border-[#333] p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">🎯 Goals</span>
              {(pacing.early > 0 || pacing.over > 0) && (
                <span
                  data-testid="pacing-badge"
                  className="font-mono text-[10px] uppercase tracking-wider shrink-0"
                  style={{ color: pacingMeta.color }}
                >
                  {pacingMeta.text}{pacingAmount && ` ${pacingAmount}`}
                </span>
              )}
              </div>
              {openGoals.length > 1 && (
                <p className="font-mono text-[9px] text-[#52525B]">
                  Drag goals top-to-bottom by priority / what to finish earlier.
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {undoDepth > 0 && (
                <button
                  onClick={undoGoals}
                  title="Undo last change (⌘Z)"
                  data-testid="undo-goals"
                  className="flex items-center gap-1 font-mono text-[10px] text-[#71717A] hover:text-[#EDEDED] uppercase tracking-wider transition-colors"
                >
                  <Undo2 className="w-3 h-3" /> Undo
                </button>
              )}
              <button
                onClick={() => setShowGoalForm(!showGoalForm)}
                className="font-mono text-[10px] text-[#71717A] hover:text-[#00FF41] uppercase tracking-wider transition-colors"
              >
                {showGoalForm ? "— Cancel" : "+ Add Goal"}
              </button>
            </div>
          </div>

          {goals.length === 0 && !showGoalForm && (
            <p className="font-mono text-[11px] text-[#71717A]">No goals set. Add targets to track your progress.</p>
          )}

          {upNextItem && (
            <div className="flex items-center justify-between gap-3 border border-[#FBBF24]/35 bg-[#FBBF24]/5 p-2" data-testid="up-next-row">
              <div className="flex items-center gap-2 min-w-0">
                <Star className="w-3.5 h-3.5 text-[#FBBF24] fill-current shrink-0" />
                <span className="font-mono text-[9px] text-[#FBBF24] uppercase tracking-widest shrink-0">{upNextLabel}</span>
                <span className="font-mono text-xs text-[#EDEDED] truncate">{upNextItem.label}</span>
                {upNextItem.parent && (
                  <span className="font-mono text-[10px] text-[#52525B] truncate">in {upNextItem.parent}</span>
                )}
              </div>
              <button
                onClick={() => upNextItem.kind === "goal" ? handleStartForGoal(upNextItem.goal) : startForSubgoal(upNextItem.goal, upNextItem.sub)}
                className="flex items-center gap-1 border border-[#FBBF24]/50 text-[#FBBF24] font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 hover:bg-[#FBBF24]/10 transition-colors shrink-0"
              >
                <Play className="w-2.5 h-2.5" />
                Start
              </button>
            </div>
          )}

          <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleGoalDragEnd}>
            <SortableContext items={openGoals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
              {openGoals.map((goal, index) => (
                <SortableGoalCard key={goal.id} id={goal.id}>
                  {(dragHandle) => {
                    if (editingGoal?.id === goal.id) {
                      return (
                        <div className="space-y-2 p-2 -mx-2 border border-[#222]">
                          <input
                            type="text"
                            value={editingGoal.label}
                    onChange={(e) => setEditingGoal({ ...editingGoal, label: e.target.value })}
                    autoFocus
                    className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1 font-mono text-xs text-[#EDEDED] outline-none transition-colors"
                  />
                  <div className="flex gap-2 flex-wrap items-center">
                    <input
                      type="number"
                      value={editingGoal.targetHours}
                      onChange={(e) => setEditingGoal({ ...editingGoal, targetHours: parseFloat(e.target.value) })}
                      min="0.25" max="24" step="0.25"
                      className="w-20 bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1 font-mono text-xs text-[#EDEDED] outline-none transition-colors"
                    />
                    <select
                      value={editingGoal.projectId || ""}
                      onChange={(e) => setEditingGoal({ ...editingGoal, projectId: e.target.value || null })}
                      className="flex-1 min-w-[120px] bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#A1A1AA] px-2 py-1 outline-none"
                    >
                      <option value="">Any tracked time</option>
                      {projects.map((p) => (
                        <option key={p.project_id} value={p.project_id}>{p.name}</option>
                      ))}
                    </select>
                    <div className="flex border border-[#222]" title="Until done keeps your time across days; Daily resets each midnight">
                      <button
                        onClick={() => setEditingGoal({ ...editingGoal, carryOver: true })}
                        className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 transition-colors ${
                          editingGoal.carryOver ? "bg-[#60A5FA]/15 text-[#60A5FA]" : "text-[#52525B] hover:text-[#A1A1AA]"
                        }`}
                      >
                        → Until done
                      </button>
                      <button
                        onClick={() => setEditingGoal({ ...editingGoal, carryOver: false })}
                        className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border-l border-[#222] transition-colors ${
                          !editingGoal.carryOver ? "bg-[#00FF41]/15 text-[#00FF41]" : "text-[#52525B] hover:text-[#A1A1AA]"
                        }`}
                      >
                        ↻ Daily
                      </button>
                    </div>
                    <button
                      onClick={saveEditGoal}
                      className="bg-[#00FF41] text-black font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1 hover:bg-[#00CC33] transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingGoal(null)}
                      className="font-mono text-[10px] text-[#A1A1AA] hover:text-[#EDEDED] uppercase tracking-wider px-2 py-1 border border-[#333] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
                      );
                    }
                    return renderGoalCard(goal, dragHandle, index);
                  }}
                </SortableGoalCard>
              ))}
            </SortableContext>
          </DndContext>

          {completedGoals.length > 0 && (
            <div className="pt-2 border-t border-[#1A1A1A]">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  data-testid="toggle-completed"
                  className="font-mono text-[10px] text-[#71717A] hover:text-[#EDEDED] uppercase tracking-wider transition-colors"
                >
                  {showCompleted ? "▾" : "▸"} Completed ({completedGoals.length})
                </button>
                <span className="font-mono text-[10px] text-[#52525B] tabular-nums" data-testid="completed-summary">
                  {completedStats.todayCount > 0 && <span className="text-[#00FF41]">{completedStats.todayCount} today</span>}
                  {completedStats.todayCount > 0 && " · "}
                  {completedStats.weekCount} this week · {formatGoalTime(completedStats.investedSeconds)} invested
                </span>
              </div>
              {showCompleted && (
                <div className="space-y-3 mt-2">
                  {completedGoals.map((g) => renderGoalCard(g))}
                </div>
              )}
            </div>
          )}

          {showGoalForm && (
            <div className="space-y-2 pt-2 border-t border-[#1A1A1A]">
              <input
                type="text"
                value={newGoalLabel}
                onChange={(e) => setNewGoalLabel(e.target.value)}
                placeholder="Goal label (e.g. Deep Work)"
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
                autoFocus
                className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1.5 font-mono text-xs text-[#EDEDED] placeholder:text-[#333] outline-none transition-colors"
              />
              <div className="flex gap-2 flex-wrap">
                <input
                  type="number"
                  value={newGoalHours}
                  onChange={(e) => setNewGoalHours(e.target.value)}
                  placeholder="Hours"
                  min="0.25"
                  max="24"
                  step="0.25"
                  className="w-20 bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1.5 font-mono text-xs text-[#EDEDED] placeholder:text-[#333] outline-none transition-colors"
                />
                <select
                  value={newGoalProjectId}
                  onChange={(e) => setNewGoalProjectId(e.target.value)}
                  className="flex-1 min-w-[150px] bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#A1A1AA] px-2 py-1.5 outline-none"
                >
                  <option value="">Any tracked time</option>
                  {projects.map((p) => (
                    <option key={p.project_id} value={p.project_id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={addGoal}
                  className="flex items-center gap-1 bg-[#00FF41] text-black font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 hover:bg-[#00CC33] transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap" data-testid="new-goal-cadence">
                <div className="flex border border-[#222]">
                  <button
                    onClick={() => setNewGoalCarryOver(true)}
                    className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 transition-colors ${
                      newGoalCarryOver ? "bg-[#60A5FA]/15 text-[#60A5FA]" : "text-[#52525B] hover:text-[#A1A1AA]"
                    }`}
                  >
                    → Until done
                  </button>
                  <button
                    onClick={() => setNewGoalCarryOver(false)}
                    className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 border-l border-[#222] transition-colors ${
                      !newGoalCarryOver ? "bg-[#00FF41]/15 text-[#00FF41]" : "text-[#52525B] hover:text-[#A1A1AA]"
                    }`}
                  >
                    ↻ Daily
                  </button>
                </div>
                <span className="font-mono text-[9px] text-[#52525B]">
                  {newGoalCarryOver ? "keeps your time across days until you finish" : "resets each midnight (a daily habit)"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions — idle only */}
        {!currentTimer && (
          <div className="space-y-2">
            {lastProductiveEntry && (
              <button
                onClick={handleContinue}
                className="w-full flex items-center gap-3 border border-[#333] bg-[#0A0A0A] p-3 hover:border-[#555] transition-colors group"
              >
                <Play className="w-3.5 h-3.5 text-[#00FF41] shrink-0" />
                <span className="font-mono text-xs text-[#A1A1AA] group-hover:text-[#EDEDED] truncate transition-colors">
                  Continue: {lastProductiveEntry.description}
                  {lastProductiveEntry.project_name && (
                    <span className="ml-2" style={{ color: lastProductiveEntry.project_color || "#666" }}>
                      · {lastProductiveEntry.project_name}
                    </span>
                  )}
                </span>
              </button>
            )}
            {projects.length > 0 && (
              <div className="space-y-1.5">
                <span className="font-mono text-[10px] text-[#52525B] uppercase tracking-widest">Projects · click to start or edit</span>
                <div className="flex flex-wrap gap-2">
                  {projects.map((p) => (
                    <ProjectChip
                      key={p.project_id}
                      project={p}
                      startLabel={projectHasEntriesToday(p.project_id) ? "Continue" : "Start"}
                      onStart={handleQuickStart}
                      onUpdate={updateProject}
                      onDelete={deleteProject}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <StatsBar dailyData={dailyData} currentTimer={currentTimer} projects={projects} streak={computeStreak(allEntries)} onReconcile={() => setReconcileOpen(true)} />

        {/* Forgot to track? Backfill a past entry (secondary action) */}
        <LogPastTimeForm projects={projects} suggestions={goalSuggestions} onLogged={fetchAll} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="lg:col-span-2">
            <DailyTimeline entries={dailyData?.entries || []} />
          </div>
          <div>
            <RecentEntries entries={todayEntries} onRefresh={fetchAll} />
          </div>
        </div>
      </div>

      <ReconcileSheet
        open={reconcileOpen}
        awaySeconds={reconcileWindow.seconds}
        gapStart={reconcileWindow.gapStart}
        gapEnd={reconcileWindow.gapEnd}
        onClose={() => setReconcileOpen(false)}
        onLogged={fetchAll}
      />

      {/* Resolve a just-ended break: Recharge (on purpose) or Drift, or split. */}
      <ReconcileSheet
        open={!!breakResolve}
        mode="break"
        replaceEntryId={breakResolve?.driftId}
        awaySeconds={breakResolve?.seconds || 0}
        gapStart={breakResolve?.gapStart}
        gapEnd={breakResolve?.gapEnd}
        onClose={() => setBreakResolve(null)}
        onLogged={fetchAll}
      />
    </AppShell>
  );
}
