import { useState, useEffect, useCallback, useRef } from "react";
import { Play, Plus, X, Pencil, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import ActiveTimer from "@/components/ActiveTimer";
import DailyTimeline from "@/components/DailyTimeline";
import StatsBar from "@/components/StatsBar";
import RecentEntries from "@/components/RecentEntries";
import ProjectChip from "@/components/ProjectChip";
import LogPastTimeForm from "@/components/LogPastTimeForm";

const GOALS_KEY = "rc_goals";

export default function DashboardPage({ user }) {
  const [currentTimer, setCurrentTimer] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [, setTick] = useState(0); // 1-second tick for real-time goal progress

  const [goals, setGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem(GOALS_KEY)) || []; } catch { return []; }
  });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [newGoalLabel, setNewGoalLabel] = useState("");
  const [newGoalHours, setNewGoalHours] = useState("");
  const [newGoalProjectId, setNewGoalProjectId] = useState("");
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalProjectMenuId, setGoalProjectMenuId] = useState(null);

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
      const [timerRes, dailyRes, entriesRes, projRes] = await Promise.all([
        fetch(`${API}/timer/current`, { credentials: "include" }),
        fetch(`${API}/analytics/daily?date=${today}`, { credentials: "include" }),
        fetch(`${API}/entries?date=${today}&limit=20`, { credentials: "include" }),
        fetch(`${API}/projects`, { credentials: "include" }),
      ]);

      const timerData = await timerRes.json();
      setCurrentTimer(timerData.running ? timerData : null);

      const daily = await dailyRes.json();
      setDailyData(daily);

      const entries = await entriesRes.json();
      setTodayEntries(entries);

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

  // Goals
  const saveGoals = (updated) => {
    setGoals(updated);
    localStorage.setItem(GOALS_KEY, JSON.stringify(updated));
  };

  const addGoal = () => {
    const hrs = parseFloat(newGoalHours);
    if (!newGoalLabel.trim() || !hrs || hrs <= 0) return;
    saveGoals([
      ...goals,
      { id: Date.now().toString(), label: newGoalLabel.trim(), targetHours: hrs, projectId: newGoalProjectId || null },
    ]);
    setNewGoalLabel(""); setNewGoalHours(""); setNewGoalProjectId(""); setShowGoalForm(false);
  };

  // Returns seconds logged toward a goal, including live elapsed if timer matches
  const getGoalSeconds = (goal) => {
    if (goal.projectId) {
      const completed = todayEntries
        .filter((e) => e.project_id === goal.projectId && !e.is_break && !e.is_running)
        .reduce((s, e) => s + (e.duration || 0), 0);
      if (currentTimer && currentTimer.project_id === goal.projectId) {
        const elapsed = Math.floor((Date.now() - new Date(currentTimer.start_time).getTime()) / 1000);
        return completed + elapsed;
      }
      return completed;
    }
    // No project: use total productive seconds from analytics
    const base = dailyData?.productive_seconds || 0;
    if (currentTimer && !currentTimer.is_break) {
      const elapsed = Math.floor((Date.now() - new Date(currentTimer.start_time).getTime()) / 1000);
      return base + elapsed;
    }
    return base;
  };

  // Start timer for a specific goal (stops current timer first if running)
  const handleStartForGoal = async (goal) => {
    try {
      if (currentTimer) await handleTimerStop();
      await handleTimerStart(goal.label, goal.projectId || null);
      toast.success(`Working on: ${goal.label}`);
    } catch (err) {
      toast.error(err.message || "Failed to start");
    }
  };

  const saveEditGoal = () => {
    if (!editingGoal || !editingGoal.label.trim() || !editingGoal.targetHours) return;
    saveGoals(goals.map((g) => g.id === editingGoal.id ? { ...editingGoal } : g));
    setEditingGoal(null);
  };

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

  // Has any finished, non-break work been logged today matching this goal?
  const goalHasEntriesToday = (goal) =>
    goal.projectId
      ? projectHasEntriesToday(goal.projectId)
      : todayEntries.some((e) => e.description === goal.label && !e.is_break && !e.is_running);

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
    setGoalProjectMenuId(null);
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

  // Continue last task
  const lastProductiveEntry = !currentTimer
    ? todayEntries
        .filter((e) => e.description !== "Unaccounted Time" && e.end_time)
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

  const formatGoalTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    return `${s}s`;
  };

  // Which goals is the current timer actively contributing to?
  const activeGoals = currentTimer
    ? goals.filter((g) => g.projectId ? g.projectId === currentTimer.project_id : true)
    : [];
  const activeGoalIds = new Set(activeGoals.map((g) => g.id));

  return (
    <AppShell user={user} activePage="dashboard">
      <div className="space-y-4 md:space-y-6">
        {/* Idle Alert */}
        {showIdleAlert && (
          <button
            onClick={() => timerInputRef.current?.focus()}
            className="w-full text-left border border-[#FF8C00]/40 bg-[#FF8C00]/5 p-3 font-mono text-xs text-[#FF8C00] animate-pulse hover:bg-[#FF8C00]/10 transition-colors"
          >
            ⚡ Untracked for {idleMinutes}m — what are you working on? Click to start tracking.
          </button>
        )}

        {/* Active Timer */}
        <ActiveTimer
          currentTimer={currentTimer}
          projects={projects}
          onStart={handleTimerStart}
          onStop={handleTimerStop}
          onSwitchProject={handleSwitchProject}
          activeGoals={activeGoals}
          inputRef={timerInputRef}
        />

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
        <StatsBar dailyData={dailyData} currentTimer={currentTimer} />

        {/* Daily Goals */}
        <div className="bg-[#0A0A0A] border border-[#333] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">Daily Goals</span>
            <button
              onClick={() => setShowGoalForm(!showGoalForm)}
              className="font-mono text-[10px] text-[#71717A] hover:text-[#00FF41] uppercase tracking-wider transition-colors"
            >
              {showGoalForm ? "— Cancel" : "+ Add Goal"}
            </button>
          </div>

          {goals.length === 0 && !showGoalForm && (
            <p className="font-mono text-[11px] text-[#71717A]">No goals set. Add targets to track your progress.</p>
          )}

          {goals.map((goal) => {
            const seconds = getGoalSeconds(goal);
            const progressPct = Math.min((seconds / (goal.targetHours * 3600)) * 100, 100);
            const done = seconds >= goal.targetHours * 3600;
            const isActive = activeGoalIds.has(goal.id);
            const linkedProject = projects.find((p) => p.project_id === goal.projectId);
            const barColor = done ? "#00FF41" : linkedProject?.color || "#00FF41";
            const isEditing = editingGoal?.id === goal.id;

            return (
              <div
                key={goal.id}
                className={`space-y-1.5 p-2 -mx-2 transition-colors ${
                  isActive ? "bg-[#00FF41]/5 ring-1 ring-[#00FF41]/20" : ""
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingGoal.label}
                      onChange={(e) => setEditingGoal({ ...editingGoal, label: e.target.value })}
                      autoFocus
                      className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1 font-mono text-xs text-[#EDEDED] outline-none transition-colors"
                    />
                    <div className="flex gap-2">
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
                        className="flex-1 bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#A1A1AA] px-2 py-1 outline-none"
                      >
                        <option value="">Any productive time</option>
                        {projects.map((p) => (
                          <option key={p.project_id} value={p.project_id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={saveEditGoal}
                        className="bg-[#00FF41] text-black font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1 hover:bg-[#00CC33] transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingGoal(null)}
                        className="font-mono text-[10px] text-[#555] hover:text-[#EDEDED] uppercase tracking-wider px-2 py-1 border border-[#333] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isActive && (
                          <span className="font-mono text-[9px] text-[#00FF41] uppercase tracking-widest shrink-0 animate-pulse">
                            ● live
                          </span>
                        )}
                        {!isActive && done && <span className="text-[#00FF41] text-xs shrink-0">✓</span>}
                        {linkedProject && (
                          <div className="w-2 h-2 shrink-0" style={{ backgroundColor: linkedProject.color }} />
                        )}
                        <span className={`font-mono text-xs truncate ${done ? "text-[#00FF41]" : isActive ? "text-[#EDEDED]" : "text-[#A1A1AA]"}`}>
                          {goal.label}
                        </span>
                        <div className="relative shrink-0 hidden sm:block">
                          <button
                            onClick={() => setGoalProjectMenuId(goalProjectMenuId === goal.id ? null : goal.id)}
                            title="Change linked project"
                            className="flex items-center gap-1 font-mono text-[10px] text-[#71717A] hover:text-[#EDEDED] transition-colors"
                          >
                            {linkedProject ? `via ${linkedProject.name}` : "any time"}
                            <ChevronDown className="w-2.5 h-2.5" />
                          </button>
                          {goalProjectMenuId === goal.id && (
                            <div className="absolute left-0 top-full mt-1 w-44 bg-[#0A0A0A] border border-[#333] z-50 shadow-lg max-h-56 overflow-y-auto">
                              <button
                                onClick={() => setGoalProject(goal.id, null)}
                                className="w-full text-left px-3 py-2 font-mono text-[11px] text-[#A1A1AA] hover:bg-[#1A1A1A] transition-colors"
                              >
                                Any productive time
                              </button>
                              {projects.map((p) => (
                                <button
                                  key={p.project_id}
                                  onClick={() => setGoalProject(goal.id, p.project_id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
                                >
                                  <div className="w-2 h-2 shrink-0" style={{ backgroundColor: p.color }} />
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`font-mono text-[10px] tabular-nums ${isActive ? "text-[#00FF41]" : "text-[#71717A]"}`}>
                          {formatGoalTime(seconds)} / {goal.targetHours}h
                        </span>
                        {!isActive && (
                          <button
                            onClick={() => handleStartForGoal(goal)}
                            title={currentTimer ? `Switch to: ${goal.label}` : `${goalHasEntriesToday(goal) ? "Continue" : "Work on"}: ${goal.label}`}
                            className="flex items-center gap-1 px-2 py-0.5 border border-[#333] font-mono text-[9px] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41] transition-colors uppercase tracking-wider"
                          >
                            <Play className="w-2.5 h-2.5" />
                            {currentTimer ? "Switch" : goalHasEntriesToday(goal) ? "Continue" : "Work"}
                          </button>
                        )}
                        <button
                          onClick={() => setEditingGoal({ ...goal })}
                          className="text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                          title="Edit goal"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => saveGoals(goals.filter((g) => g.id !== goal.id))}
                          className="text-[#52525B] hover:text-[#FF003C] transition-colors"
                          title="Delete goal"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <div className="w-full h-1 bg-[#1A1A1A]">
                      <div
                        className="h-full transition-all duration-1000"
                        style={{ width: `${progressPct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}

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
                  <option value="">Any productive time</option>
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
            </div>
          )}
        </div>

        {/* Forgot to track? Backfill a past entry (secondary action) */}
        <LogPastTimeForm projects={projects} onLogged={fetchAll} />

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
    </AppShell>
  );
}
