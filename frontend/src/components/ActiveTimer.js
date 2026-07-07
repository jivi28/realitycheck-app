import { useState, useEffect, useRef } from "react";
import { Square, Play, ChevronDown, Coffee, Repeat } from "lucide-react";
import { toast } from "sonner";
import TaskSuggestionDropdown from "@/components/TaskSuggestionDropdown";
import { ensureNotifyPermission, notify, beep } from "@/lib/notify";

const BREAK_COLOR = "#2DD4BF";

// Focus/break presets in seconds. "Custom" is entered inline in the menu.
const PRESETS = [
  { id: "sprint", label: "15/3", work: 15 * 60, rest: 3 * 60 },
  { id: "focus", label: "25/5", work: 25 * 60, rest: 5 * 60 },
  { id: "deep", label: "50/10", work: 50 * 60, rest: 10 * 60 },
];
const PRESET_KEY = "rc_timer_preset";
const AUTOREPEAT_KEY = "rc_timer_autorepeat";

function loadPreset() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRESET_KEY));
    if (saved && saved.work > 0 && saved.rest > 0) return saved;
  } catch (_error) { /* fall through */ }
  return PRESETS[1];
}

export default function ActiveTimer({ currentTimer, projects, onStart, onStop, onBreak, onResume, onSwitchProject, activeGoals = [], inputRef, suggestions = [] }) {
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState(false);
  const [preset, setPreset] = useState(loadPreset);
  const [autoRepeat, setAutoRepeat] = useState(() => {
    try { return localStorage.getItem(AUTOREPEAT_KEY) === "1"; } catch { return false; }
  });
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [customWork, setCustomWork] = useState("50");
  const [customRest, setCustomRest] = useState("10");
  const intervalRef = useRef(null);
  const dropdownRef = useRef(null);
  const presetMenuRef = useRef(null);
  const pomodoroFiredRef = useRef(false);
  const breakFiredRef = useRef(false);

  useEffect(() => {
    if (currentTimer) {
      pomodoroFiredRef.current = false;
      breakFiredRef.current = false;
      const startTime = new Date(currentTimer.start_time).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => clearInterval(intervalRef.current);
    } else {
      setElapsed(0);
    }
  }, [currentTimer]);

  // Focus block finished → notify (works in a background tab) and start the break.
  useEffect(() => {
    const isTask = currentTimer && currentTimer.entry_type !== "pause";
    if (pomodoroMode && isTask && elapsed >= preset.work && !pomodoroFiredRef.current) {
      pomodoroFiredRef.current = true;
      const restMin = Math.round(preset.rest / 60);
      notify("Focus block done", `Take a ${restMin}-minute break.`);
      beep();
      toast.success(`Focus block complete! Starting a ${restMin}-minute break.`, { duration: 6000 });
      onBreak && onBreak(currentTimer.description, currentTimer.project_id || null);
    }
  }, [pomodoroMode, elapsed, currentTimer, preset, onBreak]);

  // Break finished → notify; with auto-repeat on, jump straight into the next block.
  useEffect(() => {
    const isPause = currentTimer && currentTimer.entry_type === "pause";
    if (pomodoroMode && isPause && elapsed >= preset.rest && !breakFiredRef.current) {
      breakFiredRef.current = true;
      const canRepeat = autoRepeat && currentTimer.resume_description && onResume;
      notify("Break over", canRepeat ? "Starting the next focus block." : "Time to get back to it.");
      beep();
      if (canRepeat) {
        onResume();
        toast.success("Auto-repeat: next focus block started", { duration: 5000 });
      } else {
        toast("Break over — resume when ready.", { duration: 6000 });
      }
    }
  }, [pomodoroMode, elapsed, currentTimer, preset, autoRepeat, onResume]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProjectDropdown(false);
      }
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target)) {
        setShowPresetMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyPreset = (p) => {
    setPreset(p);
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(p)); } catch (_error) { /* ignore */ }
    setShowPresetMenu(false);
    setPomodoroMode(true);
    ensureNotifyPermission();
  };

  const applyCustomPreset = () => {
    const work = Math.round(parseFloat(customWork) * 60);
    const rest = Math.round(parseFloat(customRest) * 60);
    if (!work || work <= 0 || !rest || rest <= 0) {
      toast.error("Enter focus and break minutes");
      return;
    }
    applyPreset({ id: "custom", label: `${Math.round(work / 60)}/${Math.round(rest / 60)}`, work, rest });
  };

  const toggleAutoRepeat = () => {
    setAutoRepeat((current) => {
      const next = !current;
      try { localStorage.setItem(AUTOREPEAT_KEY, next ? "1" : "0"); } catch (_error) { /* ignore */ }
      return next;
    });
  };

  const formatTime = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, "0");
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const handleStart = async () => {
    if (!description.trim()) {
      toast.error("Describe what you're working on");
      return;
    }
    try {
      await onStart(description.trim(), selectedProjectId || null);
      setDescription("");
      toast.success("Timer started");
    } catch (err) {
      toast.error(err.message || "Failed to start timer");
    }
  };

  const handleStop = async () => {
    await onStop();
    toast.success("Timer stopped");
  };

  const isPaused = currentTimer?.entry_type === "pause";

  const handleBreak = async () => {
    if (onBreak) await onBreak();
  };

  const handleEndBreak = async () => {
    await onStop();
    toast.success("Break ended");
  };

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId);
  const displayTime = pomodoroMode && currentTimer
    ? formatTime(Math.max(0, (isPaused ? preset.rest : preset.work) - elapsed))
    : formatTime(elapsed);

  return (
    <div
      className={`border p-6 transition-colors duration-200 ${
        currentTimer
          ? isPaused
            ? "bg-[#0A0A0A] border-[#2DD4BF]/40"
            : pomodoroMode
            ? "bg-[#0A0A0A] border-[#FF8C00]/40"
            : "bg-[#0A0A0A] border-[#00FF41]/30 neon-border"
          : "bg-[#0A0A0A] border-[#333]"
      }`}
      data-testid="active-timer"
    >
      {currentTimer ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={`w-3 h-3 shrink-0 timer-pulse ${isPaused ? "bg-[#2DD4BF]" : pomodoroMode ? "bg-[#FF8C00]" : "bg-[#00FF41]"}`} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm md:text-lg text-[#EDEDED] truncate" data-testid="timer-description">
                  {currentTimer.description}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                      data-testid="running-project-selector"
                      className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider hover:opacity-70 transition-opacity"
                      style={{ color: currentTimer.project_color || "#555" }}
                    >
                      {currentTimer.project_name || "No project"}
                      <ChevronDown className="w-2.5 h-2.5" />
                    </button>
                    {showProjectDropdown && (
                      <div className="absolute left-0 top-full mt-1 w-48 bg-[#0A0A0A] border border-[#333] z-50 shadow-lg max-h-60 overflow-y-auto">
                        <button
                          onClick={() => { setShowProjectDropdown(false); onSwitchProject && onSwitchProject(null); }}
                          className="w-full text-left px-3 py-2.5 font-mono text-xs text-[#666] hover:bg-[#1A1A1A] transition-colors"
                        >
                          No project
                        </button>
                        {projects.map((p) => (
                          <button
                            key={p.project_id}
                            onClick={() => { setShowProjectDropdown(false); onSwitchProject && onSwitchProject(p.project_id); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 font-mono text-xs text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
                          >
                            <div className="w-2.5 h-2.5" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {pomodoroMode && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#FF8C00]">
                      🍅 {preset.label}{autoRepeat ? " ↻" : ""}
                    </span>
                  )}
                  {activeGoals.length > 0 && (
                    <span className="font-mono text-[9px] text-[#555] uppercase tracking-wider truncate">
                      → {activeGoals.map((g) => g.label).join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div
              className={`font-heading text-2xl md:text-4xl font-bold tabular-nums tracking-tight shrink-0 ${
                isPaused ? "text-[#2DD4BF]" : pomodoroMode ? "text-[#FF8C00]" : "text-[#00FF41] neon-glow"
              }`}
              data-testid="timer-display"
            >
              {displayTime}
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            {isPaused ? (
              <>
                <button
                  onClick={() => onResume && onResume()}
                  data-testid="resume-timer-btn"
                  className="flex items-center gap-2 bg-[#00FF41] text-black font-mono text-xs font-bold uppercase tracking-wider px-4 md:px-5 py-2.5 md:py-3 hover:bg-[#00CC33] transition-colors duration-75"
                >
                  <Play className="w-4 h-4" />
                  Resume
                </button>
                <button
                  onClick={handleEndBreak}
                  data-testid="end-break-btn"
                  className="flex items-center gap-2 border border-[#333] text-[#A1A1AA] font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 md:py-3 hover:border-[#555] hover:text-[#EDEDED] transition-colors duration-75"
                >
                  <Square className="w-4 h-4" />
                  End break
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleBreak}
                  data-testid="break-timer-btn"
                  className="flex items-center gap-2 border font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 md:py-3 transition-colors duration-75"
                  style={{ borderColor: BREAK_COLOR, color: BREAK_COLOR }}
                >
                  <Coffee className="w-4 h-4" />
                  Break
                </button>
                <button
                  onClick={handleStop}
                  data-testid="stop-timer-btn"
                  className="flex items-center gap-2 bg-[#FF003C] text-white font-mono text-xs font-bold uppercase tracking-wider px-4 md:px-5 py-2.5 md:py-3 hover:bg-[#CC0030] transition-colors duration-75"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              placeholder="Track something else…"
              data-testid="task-description-input"
              className="w-full bg-transparent border-b border-[#222] focus:border-[#00FF41] px-0 py-1.5 font-mono text-xs text-[#EDEDED] placeholder:text-[#3A3A3A] outline-none transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter") handleStart(); if (e.key === "Escape") setShowSuggest(false); }}
            />
            {showSuggest && (
              <TaskSuggestionDropdown
                query={description}
                suggestions={suggestions}
                onPick={(m) => { setDescription(m.label); setSelectedProjectId(m.projectId || ""); setShowSuggest(false); }}
              />
            )}
          </div>
          <div className="flex items-center gap-3 justify-end">
            <div className="relative flex items-center" ref={presetMenuRef}>
              <button
                onClick={() => {
                  const next = !pomodoroMode;
                  setPomodoroMode(next);
                  if (next) ensureNotifyPermission();
                }}
                title={`Toggle focus timer (${preset.label.replace("/", " min focus / ")} min break)`}
                data-testid="pomodoro-toggle"
                className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border border-r-0 transition-colors duration-75 ${
                  pomodoroMode
                    ? "border-[#FF8C00] text-[#FF8C00] bg-[#FF8C00]/10"
                    : "border-[#333] text-[#555] hover:border-[#555] hover:text-[#888]"
                }`}
              >
                🍅 {preset.label}
              </button>
              <button
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                title="Choose focus/break lengths"
                data-testid="preset-menu-toggle"
                className={`px-1.5 py-[7px] border transition-colors duration-75 ${
                  pomodoroMode
                    ? "border-[#FF8C00] text-[#FF8C00]"
                    : "border-[#333] text-[#555] hover:border-[#555] hover:text-[#888]"
                }`}
              >
                <ChevronDown className="w-3 h-3" />
              </button>
              {pomodoroMode && (
                <button
                  onClick={toggleAutoRepeat}
                  title={autoRepeat ? "Auto-repeat on: next focus block starts when the break ends" : "Auto-repeat off"}
                  data-testid="autorepeat-toggle"
                  className={`ml-1.5 px-1.5 py-[7px] border transition-colors duration-75 ${
                    autoRepeat
                      ? "border-[#FF8C00] text-[#FF8C00] bg-[#FF8C00]/10"
                      : "border-[#333] text-[#555] hover:border-[#555] hover:text-[#888]"
                  }`}
                >
                  <Repeat className="w-3 h-3" />
                </button>
              )}
              {showPresetMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 max-h-[min(18rem,calc(100vh-8rem))] overflow-y-auto bg-[#0A0A0A] border border-[#333] z-50 shadow-lg p-1" data-testid="preset-menu">
                  {PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      data-testid={`preset-${p.id}`}
                      className={`w-full flex items-center justify-between px-3 py-2 font-mono text-xs hover:bg-[#1A1A1A] transition-colors ${
                        preset.id === p.id ? "text-[#FF8C00]" : "text-[#EDEDED]"
                      }`}
                    >
                      <span className="capitalize">{p.id}</span>
                      <span className="text-[#666]">{p.label}</span>
                    </button>
                  ))}
                  <div className="flex items-center gap-1 px-3 py-2 border-t border-[#1A1A1A]">
                    <input
                      type="number"
                      min="1"
                      value={customWork}
                      onChange={(e) => setCustomWork(e.target.value)}
                      title="Focus minutes"
                      className="w-11 bg-transparent border border-[#333] px-1 py-0.5 font-mono text-xs text-[#EDEDED] outline-none focus:border-[#FF8C00]"
                    />
                    <span className="font-mono text-xs text-[#666]">/</span>
                    <input
                      type="number"
                      min="1"
                      value={customRest}
                      onChange={(e) => setCustomRest(e.target.value)}
                      title="Break minutes"
                      className="w-11 bg-transparent border border-[#333] px-1 py-0.5 font-mono text-xs text-[#EDEDED] outline-none focus:border-[#FF8C00]"
                    />
                    <button
                      onClick={applyCustomPreset}
                      data-testid="preset-custom-set"
                      className="ml-auto font-mono text-[10px] uppercase tracking-wider text-[#FF8C00] hover:bg-[#FF8C00]/10 px-2 py-1 transition-colors"
                    >
                      Set
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                data-testid="project-selector"
                className="flex items-center gap-2 px-3 py-2 border border-[#333] font-mono text-xs text-[#A1A1AA] hover:border-[#555] transition-colors duration-75 min-w-[100px] md:min-w-[120px]"
              >
                {selectedProject && (
                  <div className="w-2.5 h-2.5" style={{ backgroundColor: selectedProject.color }} />
                )}
                <span className="truncate">{selectedProject?.name || "Project"}</span>
                <ChevronDown className="w-3 h-3 ml-auto shrink-0" />
              </button>
              {showProjectDropdown && (
                <div className="absolute right-0 bottom-full mb-1 md:bottom-auto md:top-full md:mt-1 w-48 bg-[#0A0A0A] border border-[#333] z-50 shadow-lg max-h-60 overflow-y-auto" data-testid="project-dropdown">
                  <button
                    onClick={() => { setSelectedProjectId(""); setShowProjectDropdown(false); }}
                    className="w-full text-left px-3 py-2.5 font-mono text-xs text-[#666] hover:bg-[#1A1A1A] transition-colors"
                  >
                    No project
                  </button>
                  {projects.map((p) => (
                    <button
                      key={p.project_id}
                      onClick={() => { setSelectedProjectId(p.project_id); setShowProjectDropdown(false); }}
                      data-testid={`select-project-${p.project_id}`}
                      className="w-full flex items-center gap-2 px-3 py-2.5 font-mono text-xs text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
                    >
                      <div className="w-2.5 h-2.5" style={{ backgroundColor: p.color }} />
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleStart}
              data-testid="start-timer-btn"
              className="flex items-center gap-2 bg-[#00FF41] text-black font-mono text-xs font-bold uppercase tracking-wider px-4 py-2 hover:bg-[#00CC33] hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] transition-colors duration-75"
            >
              <Play className="w-3.5 h-3.5" />
              Start
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
