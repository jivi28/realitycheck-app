import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Plus, X, Undo2 } from "lucide-react";
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
import { GOALS_KEY, normalizeGoals, normalizeGoal, computePacing, computeGoalProgress, computeSubgoalProgress, isGoalActive, todayStr, formatGoalTime } from "@/lib/goals";

export default function DashboardPage({ user }) {
  const [currentTimer, setCurrentTimer] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [, setTick] = useState(0); // 1-second tick for real-time goal progress

  const [goals, setGoals] = useState(() => {
    try { return normalizeGoals(JSON.parse(localStorage.getItem(GOALS_KEY)) || []); } catch { return []; }
  });
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
  const today = new Date().toISOString().split("T")[0];

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

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
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
    localStorage.setItem(GOALS_KEY, JSON.stringify(next));
  };

  const saveGoals = (updated) => {
    goalsUndo.current.push(goals);
    if (goalsUndo.current.length > 50) goalsUndo.current.shift();
    setUndoDepth(goalsUndo.current.length);
    persistGoals(updated);
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
    saveGoals(goals.map((g) => g.id === editingGoal.id ? { ...g, ...editingGoal } : g));
    setEditingGoal(null);
  };

  // Subgoal + completion + manual-time helpers (goal state lives in localStorage)
  const mapGoal = (goalId, fn) => saveGoals(goals.map((g) => (g.id === goalId ? fn(g) : g)));
  const mapSubgoal = (goalId, subId, fn) =>
    mapGoal(goalId, (g) => ({ ...g, subgoals: g.subgoals.map((s) => (s.id === subId ? fn(s) : s)) }));

  const addSubgoal = (goalId, label, hours) =>
    mapGoal(goalId, (g) => ({
      ...g,
      subgoals: [...g.subgoals, { id: `${Date.now()}_${g.subgoals.length}`, label, targetHours: hours, done: false, doneAt: null, doneSeconds: null, addedSeconds: 0 }],
    }));
  const deleteSubgoal = (goalId, subId) =>
    mapGoal(goalId, (g) => ({ ...g, subgoals: g.subgoals.filter((s) => s.id !== subId) }));

  const markGoalDone = (goalId) =>
    mapGoal(goalId, (g) => g.done
      ? { ...g, done: false, doneAt: null, doneSeconds: null }
      : { ...g, done: true, doneAt: new Date().toISOString(), doneSeconds: Math.round(goalSecondsNow(g)) });
  const markSubgoalDone = (goalId, subId) =>
    mapSubgoal(goalId, subId, (s) => s.done
      ? { ...s, done: false, doneAt: null, doneSeconds: null }
      : { ...s, done: true, doneAt: new Date().toISOString(), doneSeconds: Math.round(subgoalSecondsNow(goals.find((g) => g.id === goalId), s)) });

  // Adjust the TARGET time a goal/subgoal needs (extend or shrink). Worked time
  // is added via "Log past time", not here.
  const setGoalTarget = (goalId, hours) =>
    mapGoal(goalId, (g) => ({ ...g, targetHours: hours }));
  const setSubgoalTarget = (goalId, subId, hours) =>
    mapSubgoal(goalId, subId, (s) => ({ ...s, targetHours: hours }));

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
  const renderGoalCard = (goal) => (
    <GoalCard
      key={goal.id}
      goal={goal}
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
      onEditGoal={(g) => setEditingGoal({ ...g })}
      onDeleteGoal={(id) => saveGoals(goals.filter((g) => g.id !== id))}
      onSetGoalProject={setGoalProject}
      onToggleCarryOver={toggleCarryOver}
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

        {/* Goals */}
        <div className="bg-[#0A0A0A] border border-[#333] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">Goals</span>
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

          {openGoals.map((goal) => {
            if (editingGoal?.id === goal.id) {
              return (
                <div key={goal.id} className="space-y-2 p-2 -mx-2 border border-[#222]">
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
            return renderGoalCard(goal);
          })}

          {completedGoals.length > 0 && (
            <div className="pt-2 border-t border-[#1A1A1A]">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                data-testid="toggle-completed"
                className="font-mono text-[10px] text-[#71717A] hover:text-[#EDEDED] uppercase tracking-wider transition-colors"
              >
                {showCompleted ? "▾" : "▸"} Completed ({completedGoals.length})
              </button>
              {showCompleted && (
                <div className="space-y-3 mt-2">
                  {completedGoals.map(renderGoalCard)}
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
              <div className="flex gap-2">
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
                  className="flex-1 bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#A1A1AA] px-2 py-1.5 outline-none"
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
        <StatsBar dailyData={dailyData} currentTimer={currentTimer} projects={projects} onReconcile={() => setReconcileOpen(true)} />

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
