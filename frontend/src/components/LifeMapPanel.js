import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Compass, Link2, Plus, Target, Trash2, X } from "lucide-react";
import {
  ENERGY_MODES,
  LIFE_AREAS,
  LIFE_GOAL_STATUSES,
  areaMeta,
  energyMeta,
  formatPlanTime,
  newAntiTodo,
  newLifeGoal,
  newMilestone,
  newPriority,
  persistLifePlan,
  readLifePlan,
  trackedSecondsForProjects,
} from "@/lib/lifePlan";

function FieldLabel({ children }) {
  return <span className="font-mono text-[9px] uppercase tracking-widest text-[#52525B]">{children}</span>;
}

function AreaDot({ area }) {
  const meta = areaMeta(area);
  return <span className="w-2 h-2 shrink-0" style={{ backgroundColor: meta.color }} />;
}

function MiniButton({ children, onClick, title, danger = false, disabled = false, testid }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      data-testid={testid}
      className={`inline-flex items-center gap-1 border px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "border-[#333] text-[#71717A] hover:border-[#FF003C] hover:text-[#FF003C]"
          : "border-[#333] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41]"
      }`}
    >
      {children}
    </button>
  );
}

function TextInput({ value, onChange, placeholder, onEnter, className = "", testid }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) onEnter();
      }}
      placeholder={placeholder}
      data-testid={testid}
      className={`bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1 font-mono text-xs text-[#EDEDED] placeholder:text-[#3f3f46] outline-none transition-colors ${className}`}
    />
  );
}

export default function LifeMapPanel({ projects = [], entries = [], currentTimer = null, onCreateGoal }) {
  const [plan, setPlan] = useState(readLifePlan);
  const [collapsed, setCollapsed] = useState(false);
  const [newPriorityLabel, setNewPriorityLabel] = useState("");
  const [newPriorityArea, setNewPriorityArea] = useState("life");
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalArea, setNewGoalArea] = useState("career");
  const [newGoalTimeframe, setNewGoalTimeframe] = useState("Next 90 days");
  const [newAntiLabel, setNewAntiLabel] = useState("");
  const [milestoneDrafts, setMilestoneDrafts] = useState({});
  const [projectMenus, setProjectMenus] = useState({});
  const [collapsedGoals, setCollapsedGoals] = useState({});

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.project_id, p])), [projects]);

  const save = (next) => {
    setPlan(next);
    persistLifePlan(next);
  };

  const updatePlan = (fn) => save(fn(plan));
  const activeLifeGoals = plan.longTermGoals.filter((goal) => !["complete", "paused", "someday"].includes(goal.status));
  const seasonProjectIds = [...new Set(activeLifeGoals.flatMap((goal) => goal.projectIds || []))];
  const seasonTracked = trackedSecondsForProjects(entries, currentTimer, seasonProjectIds);
  const milestoneTotal = plan.longTermGoals.reduce((sum, goal) => sum + goal.milestones.length, 0);
  const milestoneDone = plan.longTermGoals.reduce((sum, goal) => sum + goal.milestones.filter((m) => m.done).length, 0);

  const addPriority = () => {
    if (!newPriorityLabel.trim() || plan.season.priorities.length >= 3) return;
    updatePlan((prev) => ({
      ...prev,
      season: {
        ...prev.season,
        priorities: [...prev.season.priorities.slice(0, 2), newPriority(newPriorityLabel, newPriorityArea)],
      },
    }));
    setNewPriorityLabel("");
  };

  const addLifeGoal = () => {
    if (!newGoalTitle.trim()) return;
    updatePlan((prev) => ({
      ...prev,
      longTermGoals: [
        newLifeGoal({ title: newGoalTitle, area: newGoalArea, timeframe: newGoalTimeframe }),
        ...prev.longTermGoals,
      ],
    }));
    setNewGoalTitle("");
  };

  const addAntiTodo = () => {
    if (!newAntiLabel.trim()) return;
    updatePlan((prev) => ({ ...prev, antiTodos: [...prev.antiTodos, newAntiTodo(newAntiLabel)] }));
    setNewAntiLabel("");
  };

  const updateLifeGoal = (goalId, updater) =>
    updatePlan((prev) => ({
      ...prev,
      longTermGoals: prev.longTermGoals.map((goal) => (
        goal.id === goalId ? { ...updater(goal), updatedAt: new Date().toISOString() } : goal
      )),
    }));

  const addMilestone = (goalId) => {
    const label = milestoneDrafts[goalId] || "";
    if (!label.trim()) return;
    updateLifeGoal(goalId, (goal) => ({ ...goal, milestones: [...goal.milestones, newMilestone(label)] }));
    setMilestoneDrafts((prev) => ({ ...prev, [goalId]: "" }));
  };

  const setQueue = (key, value) => updatePlan((prev) => ({ ...prev, queue: { ...prev.queue, [key]: value } }));

  const createGoalFromText = (label, projectId = null) => {
    if (!label.trim() || !onCreateGoal) return;
    onCreateGoal(label.trim(), projectId);
  };

  return (
    <div className="bg-[#0A0A0A] border border-[#333] p-4 space-y-4" data-testid="life-map-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#60A5FA]" />
            <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">Life Map</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 font-mono text-[10px] text-[#52525B]">
            <span>{plan.season.priorities.length}/3 season priorities</span>
            <span>{plan.longTermGoals.length} long-term goals</span>
            <span>{milestoneDone}/{milestoneTotal} milestones</span>
            {seasonProjectIds.length > 0 && <span className="text-[#60A5FA]">{formatPlanTime(seasonTracked.todaySeconds)} aligned today</span>}
          </div>
        </div>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-[#52525B] hover:text-[#EDEDED] transition-colors"
          title={collapsed ? "Expand Life Map" : "Collapse Life Map"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <section className="space-y-2">
              <FieldLabel>North Star</FieldLabel>
              <textarea
                value={plan.northStar}
                onChange={(e) => updatePlan((prev) => ({ ...prev, northStar: e.target.value }))}
                placeholder="Who are you trying to become?"
                rows={4}
                className="w-full resize-none bg-[#050505] border border-[#222] focus:border-[#00FF41] p-3 font-mono text-xs text-[#EDEDED] placeholder:text-[#3f3f46] outline-none transition-colors"
                data-testid="north-star-input"
              />
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>{plan.season.label}</FieldLabel>
                <input
                  value={plan.season.timeframe}
                  onChange={(e) => updatePlan((prev) => ({ ...prev, season: { ...prev.season, timeframe: e.target.value } }))}
                  className="w-28 bg-transparent border-b border-[#222] focus:border-[#60A5FA] py-0.5 font-mono text-[10px] text-[#71717A] outline-none"
                  title="Season timeframe"
                />
              </div>
              <div className="space-y-1.5 min-h-20">
                {plan.season.priorities.length === 0 && (
                  <p className="font-mono text-[11px] text-[#52525B] border border-dashed border-[#222] p-3">Pick 1-3 priorities for this season.</p>
                )}
                {plan.season.priorities.map((priority, index) => {
                  const meta = areaMeta(priority.area);
                  return (
                    <div key={priority.id} className="flex items-center gap-2 border border-[#222] bg-[#050505] px-2 py-2">
                      <span className="font-mono text-[9px] text-[#60A5FA] shrink-0">S{index + 1}</span>
                      <AreaDot area={priority.area} />
                      <span className="font-mono text-xs text-[#A1A1AA] flex-1 truncate">{priority.label}</span>
                      <span className="font-mono text-[8px] uppercase tracking-wider shrink-0" style={{ color: meta.color }}>{meta.label}</span>
                      <button
                        onClick={() => updatePlan((prev) => ({
                          ...prev,
                          season: { ...prev.season, priorities: prev.season.priorities.filter((p) => p.id !== priority.id) },
                        }))}
                        className="text-[#52525B] hover:text-[#FF003C]"
                        title="Remove priority"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <TextInput value={newPriorityLabel} onChange={setNewPriorityLabel} onEnter={addPriority} placeholder="Season priority" className="flex-1 min-w-0" />
                <select
                  value={newPriorityArea}
                  onChange={(e) => setNewPriorityArea(e.target.value)}
                  className="bg-[#050505] border border-[#333] font-mono text-[10px] text-[#A1A1AA] px-2 py-1 outline-none"
                  title="Life area"
                >
                  {LIFE_AREAS.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
                </select>
                <MiniButton onClick={addPriority} title="Add season priority" disabled={plan.season.priorities.length >= 3}>
                  <Plus className="w-3 h-3" /> Add
                </MiniButton>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel>Today Queue</FieldLabel>
                <div className="flex items-center gap-1">
                  {ENERGY_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => updatePlan((prev) => ({ ...prev, energyMode: mode.id }))}
                      title={`${mode.label} energy`}
                      className={`font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 border transition-colors ${
                        plan.energyMode === mode.id ? "border-current" : "border-[#222] text-[#52525B] hover:text-[#A1A1AA]"
                      }`}
                      style={plan.energyMode === mode.id ? { color: mode.color, backgroundColor: `${mode.color}18` } : undefined}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
              {["now", "next", "later"].map((slot) => (
                <div key={slot} className="flex items-center gap-2">
                  <span className="w-10 font-mono text-[9px] text-[#71717A] uppercase tracking-widest">{slot}</span>
                  <TextInput value={plan.queue[slot]} onChange={(value) => setQueue(slot, value)} placeholder={`${slot} task`} className="flex-1 min-w-0" testid={`life-queue-${slot}`} />
                  <button
                    onClick={() => createGoalFromText(plan.queue[slot])}
                    disabled={!plan.queue[slot].trim()}
                    className="text-[#52525B] hover:text-[#00FF41] disabled:opacity-40 disabled:hover:text-[#52525B]"
                    title="Add to Goals"
                  >
                    <Target className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="pt-2 border-t border-[#1A1A1A] space-y-2">
                <div className="flex items-center justify-between">
                  <FieldLabel>Anti-To-Do</FieldLabel>
                  <span className="font-mono text-[9px]" style={{ color: energyMeta(plan.energyMode).color }}>
                    {energyMeta(plan.energyMode).label} energy
                  </span>
                </div>
                <div className="space-y-1">
                  {plan.antiTodos.map((item) => (
                    <div key={item.id} className={`flex items-center gap-2 ${item.active ? "" : "opacity-50"}`}>
                      <button
                        onClick={() => updatePlan((prev) => ({
                          ...prev,
                          antiTodos: prev.antiTodos.map((anti) => anti.id === item.id ? { ...anti, active: !anti.active } : anti),
                        }))}
                        className={`border w-3.5 h-3.5 flex items-center justify-center ${item.active ? "border-[#FF8C00] text-[#FF8C00]" : "border-[#333] text-[#52525B]"}`}
                        title={item.active ? "Active anti-to-do" : "Inactive"}
                      >
                        {!item.active && <Check className="w-2.5 h-2.5" />}
                      </button>
                      <span className="font-mono text-[11px] text-[#A1A1AA] flex-1 truncate">{item.label}</span>
                      <button
                        onClick={() => updatePlan((prev) => ({ ...prev, antiTodos: prev.antiTodos.filter((anti) => anti.id !== item.id) }))}
                        className="text-[#52525B] hover:text-[#FF003C]"
                        title="Remove anti-to-do"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <TextInput value={newAntiLabel} onChange={setNewAntiLabel} onEnter={addAntiTodo} placeholder="Avoid this loop" className="flex-1 min-w-0" />
                  <MiniButton onClick={addAntiTodo} title="Add anti-to-do"><Plus className="w-3 h-3" /></MiniButton>
                </div>
              </div>
            </section>
          </div>

          <section className="border-t border-[#1A1A1A] pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#00FF41]" />
                <FieldLabel>Long-Term Goals</FieldLabel>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <TextInput value={newGoalTitle} onChange={setNewGoalTitle} onEnter={addLifeGoal} placeholder="Long-term goal" className="w-48" testid="new-life-goal-title" />
                <select
                  value={newGoalArea}
                  onChange={(e) => setNewGoalArea(e.target.value)}
                  className="bg-[#050505] border border-[#333] font-mono text-[10px] text-[#A1A1AA] px-2 py-1 outline-none"
                  title="Life area"
                >
                  {LIFE_AREAS.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
                </select>
                <TextInput value={newGoalTimeframe} onChange={setNewGoalTimeframe} placeholder="Timeframe" className="w-28" />
                <MiniButton onClick={addLifeGoal} title="Add long-term goal"><Plus className="w-3 h-3" /> Add</MiniButton>
              </div>
            </div>

            {plan.longTermGoals.length === 0 ? (
              <div className="border border-dashed border-[#222] p-4">
                <p className="font-mono text-xs text-[#52525B]">Add one big outcome, then break it into milestones.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {plan.longTermGoals.map((goal) => {
                  const area = areaMeta(goal.area);
                  const tracked = trackedSecondsForProjects(entries, currentTimer, goal.projectIds || []);
                  const doneCount = goal.milestones.filter((m) => m.done).length;
                  const availableProjects = projects.filter((p) => !(goal.projectIds || []).includes(p.project_id));
                  const goalCollapsed = !!collapsedGoals[goal.id];
                  return (
                    <div key={goal.id} className="border border-[#222] bg-[#050505] p-3 space-y-3" data-testid={`life-goal-${goal.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <AreaDot area={goal.area} />
                            <TextInput
                              value={goal.title}
                              onChange={(value) => updateLifeGoal(goal.id, (g) => ({ ...g, title: value }))}
                              placeholder="Goal title"
                              className="flex-1 min-w-0 text-[#EDEDED]"
                            />
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <select
                              value={goal.status}
                              onChange={(e) => updateLifeGoal(goal.id, (g) => ({ ...g, status: e.target.value }))}
                              className="bg-[#0A0A0A] border border-[#333] font-mono text-[9px] text-[#A1A1AA] px-2 py-1 outline-none uppercase tracking-wider"
                              title="Goal status"
                            >
                              {LIFE_GOAL_STATUSES.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                            </select>
                            <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: area.color }}>{area.label}</span>
                            <TextInput
                              value={goal.timeframe}
                              onChange={(value) => updateLifeGoal(goal.id, (g) => ({ ...g, timeframe: value }))}
                              placeholder="Timeframe"
                              className="w-28 text-[10px]"
                            />
                            <span className="font-mono text-[9px] text-[#71717A] tabular-nums">{goal.confidence}% confidence</span>
                          </div>
                        </div>
                        <button
                          onClick={() => updatePlan((prev) => ({ ...prev, longTermGoals: prev.longTermGoals.filter((item) => item.id !== goal.id) }))}
                          className="text-[#52525B] hover:text-[#FF003C]"
                          title="Delete long-term goal"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCollapsedGoals((prev) => ({ ...prev, [goal.id]: !prev[goal.id] }))}
                          className="text-[#52525B] hover:text-[#EDEDED]"
                          title={goalCollapsed ? "Expand goal details" : "Collapse goal details"}
                        >
                          {goalCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {!goalCollapsed && <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={goal.confidence}
                        onChange={(e) => updateLifeGoal(goal.id, (g) => ({ ...g, confidence: parseInt(e.target.value, 10) }))}
                        className="w-full accent-[#00FF41]"
                        title="Confidence"
                      />}

                      {!goalCollapsed && <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <FieldLabel>Projects</FieldLabel>
                          {goal.projectIds.length > 0 && (
                            <span className="font-mono text-[9px] text-[#60A5FA] tabular-nums">
                              {formatPlanTime(tracked.todaySeconds)} today · {formatPlanTime(tracked.totalSeconds)} all
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {goal.projectIds.map((projectId) => {
                            const project = projectsById[projectId];
                            if (!project) return null;
                            return (
                              <button
                                key={projectId}
                                onClick={() => updateLifeGoal(goal.id, (g) => ({ ...g, projectIds: g.projectIds.filter((id) => id !== projectId) }))}
                                className="flex items-center gap-1 border border-[#333] px-2 py-1 font-mono text-[9px] text-[#A1A1AA] hover:border-[#FF003C] transition-colors"
                                title="Unlink project"
                              >
                                <span className="w-2 h-2" style={{ backgroundColor: project.color }} />
                                {project.name}
                                <X className="w-2.5 h-2.5" />
                              </button>
                            );
                          })}
                          {availableProjects.length > 0 && (
                            <div className="relative">
                              <button
                                onClick={() => setProjectMenus((prev) => ({ ...prev, [goal.id]: !prev[goal.id] }))}
                                className="flex items-center gap-1 border border-[#333] px-2 py-1 font-mono text-[9px] text-[#71717A] hover:border-[#60A5FA] hover:text-[#60A5FA] transition-colors uppercase tracking-wider"
                                title="Link project"
                              >
                                <Link2 className="w-3 h-3" /> Link
                              </button>
                              {projectMenus[goal.id] && (
                                <div className="absolute left-0 top-full mt-1 w-44 bg-[#0A0A0A] border border-[#333] z-40 shadow-lg max-h-52 overflow-y-auto">
                                  {availableProjects.map((project) => (
                                    <button
                                      key={project.project_id}
                                      onClick={() => {
                                        updateLifeGoal(goal.id, (g) => ({ ...g, projectIds: [...g.projectIds, project.project_id] }));
                                        setProjectMenus((prev) => ({ ...prev, [goal.id]: false }));
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-[#EDEDED] transition-colors"
                                    >
                                      <span className="w-2 h-2" style={{ backgroundColor: project.color }} />
                                      {project.name}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>}

                      {!goalCollapsed && <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <FieldLabel>Milestones</FieldLabel>
                          <span className="font-mono text-[9px] text-[#52525B]">{doneCount}/{goal.milestones.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {goal.milestones.map((milestone) => (
                            <div key={milestone.id} className="flex items-center gap-2">
                              <button
                                onClick={() => updateLifeGoal(goal.id, (g) => ({
                                  ...g,
                                  milestones: g.milestones.map((item) => item.id === milestone.id
                                    ? { ...item, done: !item.done, doneAt: item.done ? null : new Date().toISOString() }
                                    : item),
                                }))}
                                className={`w-4 h-4 border flex items-center justify-center shrink-0 ${
                                  milestone.done ? "bg-[#00FF41] border-[#00FF41] text-black" : "border-[#333] text-[#52525B] hover:border-[#00FF41]"
                                }`}
                                title={milestone.done ? "Mark milestone open" : "Complete milestone"}
                              >
                                {milestone.done && <Check className="w-3 h-3" />}
                              </button>
                              <input
                                value={milestone.label}
                                onChange={(e) => updateLifeGoal(goal.id, (g) => ({
                                  ...g,
                                  milestones: g.milestones.map((item) => item.id === milestone.id ? { ...item, label: e.target.value } : item),
                                }))}
                                className={`flex-1 min-w-0 bg-transparent border-b border-[#222] focus:border-[#00FF41] py-1 font-mono text-[11px] outline-none ${
                                  milestone.done ? "text-[#00FF41] line-through" : "text-[#A1A1AA]"
                                }`}
                              />
                              <button
                                onClick={() => createGoalFromText(milestone.label, goal.projectIds[0] || null)}
                                className="text-[#52525B] hover:text-[#00FF41]"
                                title="Add milestone to Goals"
                              >
                                <Target className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => updateLifeGoal(goal.id, (g) => ({ ...g, milestones: g.milestones.filter((item) => item.id !== milestone.id) }))}
                                className="text-[#52525B] hover:text-[#FF003C]"
                                title="Delete milestone"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <TextInput
                            value={milestoneDrafts[goal.id] || ""}
                            onChange={(value) => setMilestoneDrafts((prev) => ({ ...prev, [goal.id]: value }))}
                            onEnter={() => addMilestone(goal.id)}
                            placeholder="Next checkpoint"
                            className="flex-1 min-w-0"
                          />
                          <MiniButton onClick={() => addMilestone(goal.id)} title="Add milestone"><Plus className="w-3 h-3" /></MiniButton>
                        </div>
                      </div>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
