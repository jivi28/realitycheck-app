import { useState } from "react";
import { Play, Pencil, X, Plus, Check, ChevronDown, ChevronRight, Clock, RefreshCw, ArrowRight } from "lucide-react";
import {
  computeGoalProgress,
  computeSubgoalProgress,
  isGoalActive,
  isSubgoalActive,
  formatGoalTime,
} from "@/lib/goals";

// Small inline "+ add time" control (minutes) — used for goals and subgoals.
function AddTimeInline({ testid, onAdd, onClose }) {
  const [mins, setMins] = useState("");
  const commit = () => {
    const v = parseFloat(mins);
    if (v > 0) onAdd(Math.round(v * 60));
    onClose();
  };
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={mins}
        onChange={(e) => setMins(e.target.value)}
        placeholder="min"
        min="1"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onClose(); }}
        data-testid={testid}
        className="w-14 bg-transparent border-b border-[#333] focus:border-[#00FF41] py-0.5 font-mono text-[11px] text-[#EDEDED] outline-none"
      />
      <button onClick={commit} className="text-[#00FF41] hover:text-[#00CC33]" title="Add time">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={onClose} className="text-[#52525B] hover:text-[#EDEDED]" title="Cancel">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function statusTag(prog, done) {
  if (done) {
    if (prog.seconds < prog.target - 1) return { text: `saved ${formatGoalTime(prog.target - prog.seconds)}`, color: "#00FF41" };
    if (prog.seconds > prog.target + 1) return { text: `+${formatGoalTime(prog.over)} over`, color: "#FF8C00" };
    return { text: "on target", color: "#71717A" };
  }
  if (prog.over > 0) return { text: `+${formatGoalTime(prog.over)} over`, color: "#FF8C00" };
  return null;
}

export default function GoalCard({
  goal,
  projects,
  ctx,
  expanded,
  onToggleExpand,
  onStartGoal,
  onStartSubgoal,
  onMarkGoalDone,
  onMarkSubgoalDone,
  onAddTimeGoal,
  onAddTimeSubgoal,
  onAddSubgoal,
  onDeleteSubgoal,
  onEditGoal,
  onDeleteGoal,
  onSetGoalProject,
  onToggleCarryOver,
}) {
  const [projMenu, setProjMenu] = useState(false);
  const [addTimeOpen, setAddTimeOpen] = useState(false);
  const [addTimeSub, setAddTimeSub] = useState(null); // subgoal id
  const [subLabel, setSubLabel] = useState("");
  const [subHours, setSubHours] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  const prog = computeGoalProgress(goal, ctx);
  const active = isGoalActive(goal, ctx.currentTimer);
  const linkedProject = projects.find((p) => p.project_id === goal.projectId);
  const barColor = goal.done ? "#00FF41" : prog.over > 0 ? "#FF8C00" : linkedProject?.color || "#00FF41";
  const tag = statusTag(prog, goal.done);
  const hasEntries = prog.seconds > 0;
  const workLabel = active ? null : ctx.currentTimer ? "Switch" : hasEntries ? "Continue" : "Work";

  const addSubgoal = () => {
    const hrs = parseFloat(subHours);
    if (!subLabel.trim() || !hrs || hrs <= 0) return;
    onAddSubgoal(goal.id, subLabel.trim(), hrs);
    setSubLabel(""); setSubHours("");
  };

  return (
    <div
      className={`border p-2.5 -mx-2 transition-colors ${
        active ? "bg-[#00FF41]/5 border-[#00FF41]/20" : goal.done ? "border-[#1A1A1A] opacity-90" : "border-transparent"
      }`}
      data-testid={`goal-card-${goal.id}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => onToggleExpand(goal.id)}
            data-testid={`goal-expand-${goal.id}`}
            className="text-[#52525B] hover:text-[#EDEDED] transition-colors shrink-0"
            title={expanded ? "Collapse" : "Expand subgoals"}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {active && (
            <span className="font-mono text-[9px] text-[#00FF41] uppercase tracking-widest shrink-0 animate-pulse">● live</span>
          )}
          {!active && goal.done && <span className="text-[#00FF41] text-xs shrink-0">✓</span>}
          {linkedProject && <div className="w-2 h-2 shrink-0" style={{ backgroundColor: linkedProject.color }} />}
          <span className={`font-mono text-xs truncate ${goal.done ? "text-[#00FF41] line-through" : active ? "text-[#EDEDED]" : "text-[#A1A1AA]"}`}>
            {goal.label}
          </span>
          {goal.subgoals.length > 0 && (
            <span className="font-mono text-[9px] text-[#52525B] shrink-0">
              {goal.subgoals.filter((s) => s.done).length}/{goal.subgoals.length}
            </span>
          )}

          {/* project dropdown */}
          <div className="relative shrink-0 hidden sm:block">
            <button
              onClick={() => setProjMenu((o) => !o)}
              title="Change linked project"
              className="flex items-center gap-1 font-mono text-[10px] text-[#71717A] hover:text-[#EDEDED] transition-colors"
            >
              {linkedProject ? `via ${linkedProject.name}` : "any time"}
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {projMenu && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-[#0A0A0A] border border-[#333] z-50 shadow-lg max-h-56 overflow-y-auto">
                <button
                  onClick={() => { onSetGoalProject(goal.id, null); setProjMenu(false); }}
                  className="w-full text-left px-3 py-2 font-mono text-[11px] text-[#A1A1AA] hover:bg-[#1A1A1A] transition-colors"
                >
                  Any tracked time
                </button>
                {projects.map((p) => (
                  <button
                    key={p.project_id}
                    onClick={() => { onSetGoalProject(goal.id, p.project_id); setProjMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 font-mono text-[11px] text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
                  >
                    <div className="w-2 h-2 shrink-0" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* cadence chip */}
          <button
            onClick={() => onToggleCarryOver(goal.id)}
            data-testid={`carryover-toggle-${goal.id}`}
            title={goal.carryOver ? "Runs until done — keeps your time across days. Click to make it a daily habit." : "Resets each midnight. Click to make it run until done."}
            className={`hidden md:flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border shrink-0 transition-colors ${
              goal.carryOver ? "border-[#60A5FA]/40 text-[#60A5FA]" : "border-[#222] text-[#52525B] hover:text-[#71717A]"
            }`}
          >
            {goal.carryOver ? <ArrowRight className="w-2.5 h-2.5" /> : <RefreshCw className="w-2.5 h-2.5" />}
            {goal.carryOver ? "Until done" : "Daily"}
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tag && <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: tag.color }}>{tag.text}</span>}
          <span className={`font-mono text-[10px] tabular-nums ${active ? "text-[#00FF41]" : "text-[#71717A]"}`}>
            {formatGoalTime(prog.seconds)} / {goal.targetHours}h
          </span>
          {!goal.done && workLabel && (
            <button
              onClick={() => onStartGoal(goal)}
              className="flex items-center gap-1 px-2 py-0.5 border border-[#333] font-mono text-[9px] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41] transition-colors uppercase tracking-wider"
            >
              <Play className="w-2.5 h-2.5" />
              {workLabel}
            </button>
          )}
          <button
            onClick={() => onMarkGoalDone(goal.id)}
            data-testid={`mark-done-${goal.id}`}
            title={goal.done ? "Mark not done" : "Mark done"}
            className={`transition-colors ${goal.done ? "text-[#00FF41]" : prog.reached ? "text-[#00FF41] animate-pulse" : "text-[#52525B] hover:text-[#00FF41]"}`}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          {addTimeOpen ? (
            <AddTimeInline testid={`add-time-input-${goal.id}`} onAdd={(s) => onAddTimeGoal(goal.id, s)} onClose={() => setAddTimeOpen(false)} />
          ) : (
            <button
              onClick={() => setAddTimeOpen(true)}
              data-testid={`add-time-${goal.id}`}
              title="Add untracked time"
              className="text-[#52525B] hover:text-[#A1A1AA] transition-colors"
            >
              <Clock className="w-3 h-3" />
            </button>
          )}
          <button onClick={() => onEditGoal(goal)} className="text-[#52525B] hover:text-[#A1A1AA] transition-colors" title="Edit goal">
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => { if (confirmDel) onDeleteGoal(goal.id); else setConfirmDel(true); }}
            onMouseLeave={() => setConfirmDel(false)}
            className={`transition-colors ${confirmDel ? "text-[#FF003C]" : "text-[#52525B] hover:text-[#FF003C]"}`}
            title={confirmDel ? "Click again to confirm" : "Delete goal"}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* progress bar */}
      <div className="w-full h-1 bg-[#1A1A1A] mt-1.5">
        <div className="h-full transition-all duration-1000" style={{ width: `${prog.pct}%`, backgroundColor: barColor }} />
      </div>

      {/* carry-over breakdown */}
      {goal.carryOver && prog.beforeSeconds > 0 && (
        <p className="font-mono text-[9px] text-[#52525B] mt-1">
          {formatGoalTime(prog.beforeSeconds)} before today + {formatGoalTime(prog.todaySeconds)} today
        </p>
      )}

      {/* Subgoals panel */}
      {expanded && (
        <div className="mt-2 ml-5 pl-3 border-l border-[#1A1A1A] space-y-2" data-testid={`subgoals-${goal.id}`}>
          {goal.subgoals.length === 0 && (
            <p className="font-mono text-[10px] text-[#52525B]">No subgoals yet. Break this goal into steps below.</p>
          )}
          {goal.subgoals.map((sub) => {
            const sp = computeSubgoalProgress(goal, sub, ctx);
            const sActive = isSubgoalActive(sub, ctx.currentTimer);
            const sTag = statusTag(sp, sub.done);
            const sHasEntries = sp.seconds > 0;
            const sWork = sActive ? null : ctx.currentTimer ? "Switch" : sHasEntries ? "Continue" : "Work";
            return (
              <div key={sub.id} className="space-y-1" data-testid={`subgoal-${sub.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {sActive && <span className="font-mono text-[8px] text-[#00FF41] uppercase tracking-widest shrink-0 animate-pulse">●</span>}
                    {!sActive && sub.done && <span className="text-[#00FF41] text-[10px] shrink-0">✓</span>}
                    <span className={`font-mono text-[11px] truncate ${sub.done ? "text-[#00FF41] line-through" : sActive ? "text-[#EDEDED]" : "text-[#A1A1AA]"}`}>
                      {sub.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sTag && <span className="font-mono text-[8px] uppercase tracking-wider" style={{ color: sTag.color }}>{sTag.text}</span>}
                    <span className={`font-mono text-[9px] tabular-nums ${sActive ? "text-[#00FF41]" : "text-[#71717A]"}`}>
                      {formatGoalTime(sp.seconds)} / {sub.targetHours}h
                    </span>
                    {!sub.done && sWork && (
                      <button
                        onClick={() => onStartSubgoal(goal, sub)}
                        className="flex items-center gap-1 px-1.5 py-0.5 border border-[#333] font-mono text-[8px] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41] transition-colors uppercase tracking-wider"
                      >
                        <Play className="w-2 h-2" />
                        {sWork}
                      </button>
                    )}
                    <button
                      onClick={() => onMarkSubgoalDone(goal.id, sub.id)}
                      title={sub.done ? "Mark not done" : "Mark done"}
                      className={`transition-colors ${sub.done ? "text-[#00FF41]" : sp.reached ? "text-[#00FF41] animate-pulse" : "text-[#52525B] hover:text-[#00FF41]"}`}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    {addTimeSub === sub.id ? (
                      <AddTimeInline testid={`add-time-input-${sub.id}`} onAdd={(s) => onAddTimeSubgoal(goal.id, sub.id, s)} onClose={() => setAddTimeSub(null)} />
                    ) : (
                      <button onClick={() => setAddTimeSub(sub.id)} title="Add untracked time" className="text-[#52525B] hover:text-[#A1A1AA] transition-colors">
                        <Clock className="w-2.5 h-2.5" />
                      </button>
                    )}
                    <button onClick={() => onDeleteSubgoal(goal.id, sub.id)} className="text-[#52525B] hover:text-[#FF003C] transition-colors" title="Delete subgoal">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
                <div className="w-full h-0.5 bg-[#1A1A1A]">
                  <div className="h-full transition-all duration-1000" style={{ width: `${sp.pct}%`, backgroundColor: sub.done ? "#00FF41" : sp.over > 0 ? "#FF8C00" : linkedProject?.color || "#00FF41" }} />
                </div>
              </div>
            );
          })}

          {/* add subgoal */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={subLabel}
              onChange={(e) => setSubLabel(e.target.value)}
              placeholder="Subgoal step"
              onKeyDown={(e) => e.key === "Enter" && addSubgoal()}
              data-testid={`add-subgoal-label-${goal.id}`}
              className="flex-1 min-w-0 bg-transparent border-b border-[#222] focus:border-[#00FF41] py-1 font-mono text-[11px] text-[#EDEDED] placeholder:text-[#3f3f46] outline-none transition-colors"
            />
            <input
              type="number"
              value={subHours}
              onChange={(e) => setSubHours(e.target.value)}
              placeholder="hrs"
              min="0.25" max="24" step="0.25"
              onKeyDown={(e) => e.key === "Enter" && addSubgoal()}
              className="w-12 bg-transparent border-b border-[#222] focus:border-[#00FF41] py-1 font-mono text-[11px] text-[#EDEDED] placeholder:text-[#3f3f46] outline-none transition-colors"
            />
            <button
              onClick={addSubgoal}
              data-testid={`add-subgoal-btn-${goal.id}`}
              className="flex items-center gap-1 border border-[#333] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41] font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-colors"
            >
              <Plus className="w-2.5 h-2.5" /> Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
