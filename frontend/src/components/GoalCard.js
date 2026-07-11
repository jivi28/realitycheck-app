import { useState } from "react";
import { Play, Pencil, X, Plus, Check, ChevronDown, ChevronRight, Target, RefreshCw, ArrowRight, GripVertical, Star } from "lucide-react";
import {
  computeGoalProgress,
  computeSubgoalProgress,
  isGoalActive,
  isSubgoalActive,
  formatGoalTime,
  formatDoneStamp,
  goalDeadlineInfo,
} from "@/lib/goals";
import { projectIconComp } from "@/lib/projectIcons";

// Inline editor for the TARGET (time needed), in hours. Prefilled with the
// current target so you can extend or shrink it. (Worked time is logged via
// "Log past time", not here.)
function TargetInline({ current, testid, onSave, onClose }) {
  const [val, setVal] = useState(String(current ?? ""));
  const commit = () => {
    const v = parseFloat(val);
    if (v > 0) onSave(v);
    onClose();
  };
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[9px] text-[#71717A] uppercase tracking-wider">target</span>
      <input
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        min="0.25" max="100" step="0.25"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onClose(); }}
        data-testid={testid}
        className="w-12 bg-transparent border-b border-[#333] focus:border-[#00FF41] py-0.5 font-mono text-[11px] text-[#EDEDED] outline-none"
      />
      <span className="font-mono text-[9px] text-[#71717A]">h</span>
      <button onClick={commit} className="text-[#00FF41] hover:text-[#00CC33]" title="Save target">
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

// A clear, labeled done/not-done button (replaces the bare tick).
function DoneButton({ done, reached, onClick, size = "sm", testid }) {
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]";
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      title={done ? "Mark not done" : "Mark done"}
      className={`flex items-center gap-1 font-mono uppercase tracking-wider border transition-colors ${pad} ${
        done
          ? "bg-[#00FF41] text-black border-[#00FF41] font-bold"
          : reached
          ? "border-[#00FF41] text-[#00FF41] animate-pulse"
          : "border-[#333] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41]"
      }`}
    >
      <Check className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      {done ? "Done" : "Finish"}
    </button>
  );
}

export default function GoalCard({
  goal,
  priorityIndex = null,
  hierarchyState = null,
  nextSubgoalId = null,
  projects,
  ctx,
  dragHandle = null,
  expanded,
  onToggleExpand,
  onStartGoal,
  onStartSubgoal,
  onMarkGoalDone,
  onMarkSubgoalDone,
  onSetGoalTarget,
  onSetSubgoalTarget,
  onAddSubgoal,
  onDeleteSubgoal,
  onEditGoal,
  onEditSubgoal,
  onDeleteGoal,
  onSetGoalProject,
  onToggleCarryOver,
  onToggleGoalUpNext,
  onToggleSubgoalUpNext,
}) {
  const [projMenu, setProjMenu] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [targetSub, setTargetSub] = useState(null); // subgoal id being retargeted
  const [subLabel, setSubLabel] = useState("");
  const [subHours, setSubHours] = useState("");
  const [editingSub, setEditingSub] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const prog = computeGoalProgress(goal, ctx);
  const active = isGoalActive(goal, ctx.currentTimer);
  const linkedProject = projects.find((p) => p.project_id === goal.projectId);
  const barColor = goal.done ? "#00FF41" : prog.over > 0 ? "#FF8C00" : linkedProject?.color || "#00FF41";
  const tag = statusTag(prog, goal.done);
  const deadline = goalDeadlineInfo(goal, prog.seconds);
  const hasEntries = prog.seconds > 0;
  const workLabel = hasEntries ? "Continue" : "Work";
  const isNext = hierarchyState === "next" || hierarchyState === "start";
  const isNow = hierarchyState === "now";
  const isLater = hierarchyState === "later";
  const hasCollapsedNext = !!nextSubgoalId && !expanded;
  const nextLabel = hierarchyState === "start" ? "Start Next" : "Next";

  // Keep the secondary cluster visible while one of its controls is in use.
  const forceShow = projMenu || targetOpen || confirmDel;
  const secondaryCls = `${expanded ? "flex" : "hidden"} sm:flex items-center gap-2 transition-opacity opacity-100 ${
    forceShow ? "sm:opacity-100" : "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100"
  }`;

  const addSubgoal = () => {
    const hrs = parseFloat(subHours);
    if (!subLabel.trim() || !hrs || hrs <= 0) return;
    onAddSubgoal(goal.id, subLabel.trim(), hrs);
    setSubLabel(""); setSubHours("");
  };

  const saveSubEdit = () => {
    const hrs = parseFloat(editingSub?.targetHours);
    if (!editingSub || !editingSub.label.trim() || !hrs || hrs <= 0) return;
    onEditSubgoal(goal.id, editingSub.id, {
      label: editingSub.label.trim(),
      targetHours: hrs,
    });
    setEditingSub(null);
  };

  return (
    <div
      className={`group border-l-2 border-y border-r p-2.5 -mx-2 transition-colors ${
        active
          ? "bg-[#00FF41]/5 border-[#00FF41]/20 border-l-[#00FF41]"
          : isNext || hasCollapsedNext
          ? "bg-[#60A5FA]/5 border-[#60A5FA]/25 border-l-[#60A5FA]"
          : goal.done
          ? "border-[#1A1A1A] opacity-90"
          : "border-transparent hover:border-[#1A1A1A]"
      }`}
      data-testid={`goal-card-${goal.id}`}
    >
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
          {dragHandle && (
            <button
              ref={dragHandle.setActivatorNodeRef}
              {...dragHandle.attributes}
              {...dragHandle.listeners}
              data-testid={`goal-drag-${goal.id}`}
              title="Drag to reorder"
              aria-label="Drag to reorder goal"
              className="shrink-0 touch-none cursor-grab active:cursor-grabbing text-[#52525B] hover:text-[#A1A1AA] transition-colors"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          {priorityIndex != null && !goal.done && (
            <span
              title={isNow ? "Current task" : isNext ? "Next task in priority order" : isLater ? "Third task in this sprint" : "Priority rank: top goals should finish earlier"}
              className={`font-mono text-[9px] border px-1.5 py-0.5 shrink-0 ${
                isNow
                  ? "text-[#00FF41] border-[#00FF41]/35 bg-[#00FF41]/10"
                  : isNext
                  ? "text-[#60A5FA] border-[#60A5FA]/40 bg-[#60A5FA]/10"
                  : "text-[#00FF41] border-[#00FF41]/35 bg-[#00FF41]/10"
              }`}
            >
              P{priorityIndex + 1}{isNow ? " · Now" : isNext ? ` · ${nextLabel}` : isLater ? " · Later" : ""}
            </span>
          )}
          {goal.upNext && !goal.done && (
            <button
              onClick={() => onToggleGoalUpNext(goal.id)}
              className="text-[#60A5FA] shrink-0"
              title="Remove from Up Next"
            >
              <Star className="w-3 h-3 fill-current" />
            </button>
          )}
          <button
            onClick={() => onToggleExpand(goal.id)}
            data-testid={`goal-expand-${goal.id}`}
            className="text-[#52525B] hover:text-[#EDEDED] transition-colors shrink-0"
            title={expanded ? "Collapse" : "Expand subtasks"}
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {active && (
            <span className="font-mono text-[9px] text-[#00FF41] uppercase tracking-widest shrink-0 animate-pulse">● live</span>
          )}
          {!active && goal.done && <span className="text-[#00FF41] text-xs shrink-0">✓</span>}
          {!isNext && hasCollapsedNext && !goal.done && (
            <span className="font-mono text-[9px] text-[#60A5FA] uppercase tracking-widest shrink-0">Next inside</span>
          )}
          {linkedProject && (() => {
            const PIcon = projectIconComp(linkedProject.icon);
            return PIcon
              ? <PIcon className="w-3 h-3 shrink-0" style={{ color: linkedProject.color }} />
              : <div className="w-2 h-2 shrink-0" style={{ backgroundColor: linkedProject.color }} />;
          })()}
          <span className={`font-mono text-xs truncate ${goal.done ? "text-[#00FF41] line-through" : active ? "text-[#EDEDED]" : "text-[#A1A1AA]"}`}>
            {goal.label}
          </span>
          {goal.subgoals.length > 0 && (
            <span className="font-mono text-[9px] text-[#52525B] shrink-0">
              {goal.subgoals.filter((s) => s.done).length}/{goal.subgoals.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto sm:shrink-0">
          {goal.done && goal.doneAt && (
            <span className="font-mono text-[9px] text-[#52525B] tabular-nums hidden sm:inline" title={`Completed ${formatDoneStamp(goal.doneAt)}`}>
              done {formatDoneStamp(goal.doneAt)}
            </span>
          )}
          {tag && <span className="font-mono text-[9px] uppercase tracking-wider" style={{ color: tag.color }}>{tag.text}</span>}
          {deadline && (
            <span
              className="hidden sm:inline font-mono text-[9px] uppercase tracking-wider border px-1.5 py-0.5"
              style={{ color: deadline.color, borderColor: `${deadline.color}66`, backgroundColor: `${deadline.color}12` }}
              title={`${formatGoalTime(deadline.remainingSeconds)} remaining · ${formatGoalTime(deadline.dailySeconds)} per day`}
              data-testid={`goal-deadline-${goal.id}`}
            >
              {deadline.label} · {formatGoalTime(deadline.dailySeconds)}/day
            </span>
          )}
          <span className={`font-mono text-[10px] tabular-nums ${active ? "text-[#00FF41]" : "text-[#71717A]"}`}>
            {formatGoalTime(prog.seconds)} / {goal.targetHours}h
          </span>

          {/* Primary actions (always visible) */}
          {!goal.done && !active && (
            <button
              onClick={() => onStartGoal(goal)}
              data-testid={`goal-work-${goal.id}`}
              className="flex items-center gap-1 px-2 py-0.5 border border-[#333] font-mono text-[9px] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41] transition-colors uppercase tracking-wider"
            >
              <Play className="w-2.5 h-2.5" />
              {workLabel}
            </button>
          )}
          <DoneButton done={goal.done} reached={prog.reached} onClick={() => onMarkGoalDone(goal.id)} testid={`mark-done-${goal.id}`} />

          {/* Secondary actions (revealed on hover) */}
          <div className={secondaryCls}>
            {/* project dropdown */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setProjMenu((o) => !o)}
                title="Change linked project"
                className="flex items-center gap-1 font-mono text-[10px] text-[#71717A] hover:text-[#EDEDED] transition-colors"
              >
                {linkedProject ? `via ${linkedProject.name}` : "any time"}
                <ChevronDown className="w-2.5 h-2.5" />
              </button>
              {projMenu && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-[#0A0A0A] border border-[#333] z-50 shadow-lg max-h-56 overflow-y-auto">
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

            {/* cadence toggle */}
            {!goal.done && !goal.upNext && (
              <button
                onClick={() => onToggleGoalUpNext(goal.id)}
                data-testid={`up-next-goal-${goal.id}`}
                title={goal.upNext ? "Remove from Up Next" : "Mark as Up Next"}
                className={`transition-colors ${goal.upNext || isNext ? "text-[#60A5FA] opacity-100" : "text-[#52525B] hover:text-[#60A5FA]"}`}
              >
                <Star className={`w-3 h-3 ${goal.upNext || isNext ? "fill-current" : ""}`} />
              </button>
            )}

            <button
              onClick={() => onToggleCarryOver(goal.id)}
              data-testid={`carryover-toggle-${goal.id}`}
              title={goal.carryOver ? "Runs until done — keeps your time across days. Click to make it a daily habit." : "Resets each midnight. Click to make it run until done."}
              className={`hidden md:flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border transition-colors ${
                goal.carryOver ? "border-[#60A5FA]/40 text-[#60A5FA]" : "border-[#222] text-[#52525B] hover:text-[#71717A]"
              }`}
            >
              {goal.carryOver ? <ArrowRight className="w-2.5 h-2.5" /> : <RefreshCw className="w-2.5 h-2.5" />}
              {goal.carryOver ? "Until done" : "Daily"}
            </button>

            {targetOpen ? (
              <TargetInline current={goal.targetHours} testid={`target-input-${goal.id}`} onSave={(h) => onSetGoalTarget(goal.id, h)} onClose={() => setTargetOpen(false)} />
            ) : (
              <button
                onClick={() => setTargetOpen(true)}
                data-testid={`adjust-target-${goal.id}`}
                title="Adjust target (time this goal needs)"
                className="text-[#52525B] hover:text-[#A1A1AA] transition-colors"
              >
                <Target className="w-3 h-3" />
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
      </div>

      {/* progress bar */}
      <div className="w-full h-1 bg-[#1A1A1A] mt-1.5">
        <div className="h-full transition-all duration-1000" style={{ width: `${prog.pct}%`, backgroundColor: barColor }} />
      </div>

      {deadline && (
        <p className="sm:hidden font-mono text-[9px] uppercase tracking-wider mt-1" style={{ color: deadline.color }}>
          {deadline.label} · {formatGoalTime(deadline.remainingSeconds)} left · {formatGoalTime(deadline.dailySeconds)}/day
        </p>
      )}

      {/* carry-over breakdown */}
      {goal.carryOver && prog.beforeSeconds > 0 && (
        <p className="font-mono text-[9px] text-[#52525B] mt-1">
          {formatGoalTime(prog.beforeSeconds)} before today + {formatGoalTime(prog.todaySeconds)} today
        </p>
      )}

      {/* Subtasks panel */}
      {expanded && (
        <div className="mt-2 ml-5 pl-3 border-l border-[#1A1A1A] space-y-2" data-testid={`subgoals-${goal.id}`}>
          {goal.subgoals.length === 0 && (
            <p className="font-mono text-[10px] text-[#52525B]">No subtasks yet. Break this goal into steps below.</p>
          )}
          {goal.subgoals.map((sub) => {
            const sp = computeSubgoalProgress(goal, sub, ctx);
            const sActive = isSubgoalActive(sub, ctx.currentTimer);
            const sTag = statusTag(sp, sub.done);
            const sHasEntries = sp.seconds > 0;
            const sWork = sHasEntries ? "Continue" : "Work";
            const subForce = targetSub === sub.id || editingSub?.id === sub.id;
            const subIsNext = nextSubgoalId === sub.id;
            if (editingSub?.id === sub.id) {
              return (
                <div key={sub.id} className="space-y-2 border border-[#222] p-2" data-testid={`subgoal-${sub.id}`}>
                  <input
                    type="text"
                    value={editingSub.label}
                    onChange={(e) => setEditingSub({ ...editingSub, label: e.target.value })}
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Enter") saveSubEdit(); if (e.key === "Escape") setEditingSub(null); }}
                    className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1 font-mono text-[11px] text-[#EDEDED] outline-none transition-colors"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="number"
                      value={editingSub.targetHours}
                      onChange={(e) => setEditingSub({ ...editingSub, targetHours: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") saveSubEdit(); if (e.key === "Escape") setEditingSub(null); }}
                      min="0.25"
                      max="24"
                      step="0.25"
                      className="w-16 bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1 font-mono text-[11px] text-[#EDEDED] outline-none transition-colors"
                    />
                    <button
                      onClick={saveSubEdit}
                      className="bg-[#00FF41] text-black font-mono text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 hover:bg-[#00CC33] transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingSub(null)}
                      className="font-mono text-[9px] text-[#A1A1AA] hover:text-[#EDEDED] uppercase tracking-wider px-2 py-1 border border-[#333] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div
                key={sub.id}
                className={`space-y-1 group/sub border-l-2 pl-2 -ml-2 transition-colors ${
                  subIsNext ? "border-l-[#60A5FA] bg-[#60A5FA]/5" : "border-l-transparent"
                }`}
                data-testid={`subgoal-${sub.id}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {sActive && <span className="font-mono text-[8px] text-[#00FF41] uppercase tracking-widest shrink-0 animate-pulse">●</span>}
                    {!sActive && sub.done && <span className="text-[#00FF41] text-[10px] shrink-0">✓</span>}
                    {subIsNext && !sub.done && (
                      <span className="font-mono text-[8px] text-[#60A5FA] uppercase tracking-widest shrink-0">Next</span>
                    )}
                    {sub.upNext && !sub.done && (
                      <button
                        onClick={() => onToggleSubgoalUpNext(goal.id, sub.id)}
                        className="text-[#60A5FA] shrink-0"
                        title="Remove from Up Next"
                      >
                        <Star className="w-2.5 h-2.5 fill-current" />
                      </button>
                    )}
                    <span className={`font-mono text-[11px] truncate ${sub.done ? "text-[#00FF41] line-through" : sActive ? "text-[#EDEDED]" : "text-[#A1A1AA]"}`}>
                      {sub.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {sTag && <span className="font-mono text-[8px] uppercase tracking-wider" style={{ color: sTag.color }}>{sTag.text}</span>}
                    <span className={`font-mono text-[9px] tabular-nums ${sActive ? "text-[#00FF41]" : "text-[#71717A]"}`}>
                      {formatGoalTime(sp.seconds)} / {sub.targetHours}h
                    </span>
                    {!sub.done && !sActive && (
                      <button
                        onClick={() => onStartSubgoal(goal, sub)}
                        className="flex items-center gap-1 px-1.5 py-0.5 border border-[#333] font-mono text-[8px] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41] transition-colors uppercase tracking-wider"
                      >
                        <Play className="w-2 h-2" />
                        {sWork}
                      </button>
                    )}
                    <DoneButton done={sub.done} reached={sp.reached} onClick={() => onMarkSubgoalDone(goal.id, sub.id)} size="xs" />
                    <div className={`flex items-center gap-1.5 transition-opacity ${subForce ? "opacity-100" : "opacity-0 group-hover/sub:opacity-100 focus-within:opacity-100"}`}>
                      {!sub.done && !sub.upNext && (
                        <button
                          onClick={() => onToggleSubgoalUpNext(goal.id, sub.id)}
                          data-testid={`up-next-subgoal-${sub.id}`}
                          title={sub.upNext ? "Remove from Up Next" : "Mark as Up Next"}
                          className={`transition-colors ${subIsNext ? "text-[#60A5FA]" : "text-[#52525B] hover:text-[#60A5FA]"}`}
                        >
                          <Star className={`w-2.5 h-2.5 ${subIsNext ? "fill-current" : ""}`} />
                        </button>
                      )}
                      {targetSub === sub.id ? (
                        <TargetInline current={sub.targetHours} testid={`target-input-${sub.id}`} onSave={(h) => onSetSubgoalTarget(goal.id, sub.id, h)} onClose={() => setTargetSub(null)} />
                      ) : (
                        <button onClick={() => setTargetSub(sub.id)} title="Adjust target (time this subtask needs)" className="text-[#52525B] hover:text-[#A1A1AA] transition-colors">
                          <Target className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setEditingSub({ ...sub, targetHours: String(sub.targetHours) })}
                        className="text-[#52525B] hover:text-[#A1A1AA] transition-colors"
                        title="Edit subtask"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                      <button onClick={() => onDeleteSubgoal(goal.id, sub.id)} className="text-[#52525B] hover:text-[#FF003C] transition-colors" title="Delete subtask">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="w-full h-0.5 bg-[#1A1A1A]">
                  <div className="h-full transition-all duration-1000" style={{ width: `${sp.pct}%`, backgroundColor: sub.done ? "#00FF41" : sp.over > 0 ? "#FF8C00" : linkedProject?.color || "#00FF41" }} />
                </div>
              </div>
            );
          })}

          {/* add subtask */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={subLabel}
              onChange={(e) => setSubLabel(e.target.value)}
              placeholder="Subtask step"
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
