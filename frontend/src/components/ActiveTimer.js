import { useState, useEffect, useRef } from "react";
import { Square, Play, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import TaskSuggestionDropdown from "@/components/TaskSuggestionDropdown";

const POMODORO_SECONDS = 25 * 60;

export default function ActiveTimer({ currentTimer, projects, onStart, onStop, onSwitchProject, activeGoals = [], inputRef, suggestions = [] }) {
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState(false);
  const intervalRef = useRef(null);
  const dropdownRef = useRef(null);
  const pomodoroFiredRef = useRef(false);

  useEffect(() => {
    if (currentTimer) {
      pomodoroFiredRef.current = false;
      const startTime = new Date(currentTimer.start_time).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => clearInterval(intervalRef.current);
    } else {
      setElapsed(0);
    }
  }, [currentTimer]);

  useEffect(() => {
    if (pomodoroMode && currentTimer && elapsed >= POMODORO_SECONDS && !pomodoroFiredRef.current) {
      pomodoroFiredRef.current = true;
      onStop().then(() => toast.success("Pomodoro complete! Take a 5-minute break.", { duration: 6000 }));
    }
  }, [pomodoroMode, elapsed, currentTimer, onStop]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId);
  const displayTime = pomodoroMode && currentTimer
    ? formatTime(Math.max(0, POMODORO_SECONDS - elapsed))
    : formatTime(elapsed);

  return (
    <div
      className={`border p-6 transition-colors duration-200 ${
        currentTimer
          ? pomodoroMode
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
              <div className={`w-3 h-3 shrink-0 timer-pulse ${pomodoroMode ? "bg-[#FF8C00]" : "bg-[#00FF41]"}`} />
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
                    <span className="font-mono text-[10px] uppercase tracking-wider text-[#FF8C00]">🍅 Pomodoro</span>
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
                pomodoroMode ? "text-[#FF8C00]" : "text-[#00FF41] neon-glow"
              }`}
              data-testid="timer-display"
            >
              {displayTime}
            </div>
          </div>
          <div className="flex items-center justify-end">
            <button
              onClick={handleStop}
              data-testid="stop-timer-btn"
              className="flex items-center gap-2 bg-[#FF003C] text-white font-mono text-xs font-bold uppercase tracking-wider px-4 md:px-5 py-2.5 md:py-3 hover:bg-[#CC0030] transition-colors duration-75"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setShowSuggest(true); }}
              onFocus={() => setShowSuggest(true)}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              placeholder="What are you working on?"
              data-testid="task-description-input"
              className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] px-0 py-2.5 md:py-3 font-mono text-sm text-[#EDEDED] placeholder:text-[#333] outline-none transition-colors"
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
            <button
              onClick={() => setPomodoroMode(!pomodoroMode)}
              title="Toggle Pomodoro mode (25-minute sessions)"
              className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border transition-colors duration-75 ${
                pomodoroMode
                  ? "border-[#FF8C00] text-[#FF8C00] bg-[#FF8C00]/10"
                  : "border-[#333] text-[#555] hover:border-[#555] hover:text-[#888]"
              }`}
            >
              🍅 25m
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                data-testid="project-selector"
                className="flex items-center gap-2 px-3 py-2.5 border border-[#333] font-mono text-xs text-[#A1A1AA] hover:border-[#555] transition-colors duration-75 min-w-[100px] md:min-w-[120px]"
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
              className="flex items-center gap-2 bg-[#00FF41] text-black font-mono text-xs font-bold uppercase tracking-wider px-4 md:px-5 py-2.5 md:py-3 hover:bg-[#00CC33] hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] transition-colors duration-75"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
