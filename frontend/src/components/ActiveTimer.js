import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Square, Play, ChevronDown } from "lucide-react";
import { toast } from "sonner";

export default function ActiveTimer({ currentTimer, projects, onStart, onStop }) {
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const recognitionRef = useRef(null);
  const intervalRef = useRef(null);
  const dropdownRef = useRef(null);

  // Timer elapsed calculation
  useEffect(() => {
    if (currentTimer) {
      const startTime = new Date(currentTimer.start_time).getTime();
      const tick = () => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      };
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => clearInterval(intervalRef.current);
    } else {
      setElapsed(0);
    }
  }, [currentTimer]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const formatElapsed = (s) => {
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

  // Voice recognition
  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast.error("Voice not supported in this browser");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      setIsListening(false);

      // Parse voice commands
      if (transcript.includes("stop") || transcript.includes("end") || transcript.includes("finish")) {
        if (currentTimer) {
          handleStop();
        } else {
          toast.error("No timer running");
        }
      } else if (transcript.includes("start")) {
        const desc = transcript
          .replace(/^(computer[,.]?\s*)?/, "")
          .replace(/^start\s*(working on|doing|task|studying|coding)?\s*/, "")
          .trim();
        if (desc) {
          setDescription(desc);
          onStart(desc, selectedProjectId || null)
            .then(() => {
              setDescription("");
              toast.success(`Started: ${desc}`);
            })
            .catch((err) => toast.error(err.message));
        } else {
          toast.error("Say what you want to start, e.g., 'Start studying biology'");
        }
      } else {
        // If no command keyword, treat as description and start
        setDescription(transcript);
        onStart(transcript, selectedProjectId || null)
          .then(() => {
            setDescription("");
            toast.success(`Started: ${transcript}`);
          })
          .catch((err) => toast.error(err.message));
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error("Voice recognition failed. Try again.");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [currentTimer, selectedProjectId, onStart]);

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId);

  return (
    <div
      className={`border p-6 transition-colors duration-200 ${
        currentTimer
          ? "bg-[#0A0A0A] border-[#00FF41]/30 neon-border"
          : "bg-[#0A0A0A] border-[#333]"
      }`}
      data-testid="active-timer"
    >
      {currentTimer ? (
        /* === RUNNING STATE === */
        <div className="flex items-center gap-6">
          {/* Status indicator */}
          <div className="w-3 h-3 bg-[#00FF41] timer-pulse shrink-0" />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-mono text-lg text-[#EDEDED] truncate" data-testid="timer-description">
              {currentTimer.description}
            </p>
            <div className="flex items-center gap-3 mt-1">
              {currentTimer.project_name && (
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: currentTimer.project_color || "#666" }}>
                  {currentTimer.project_name}
                </span>
              )}
            </div>
          </div>

          {/* Timer display */}
          <div className="font-heading text-4xl font-bold text-[#00FF41] tabular-nums tracking-tight neon-glow" data-testid="timer-display">
            {formatElapsed(elapsed)}
          </div>

          {/* Voice button */}
          <button
            onClick={isListening ? stopListening : startListening}
            data-testid="voice-btn"
            className={`p-3 border transition-colors duration-75 ${
              isListening
                ? "border-[#FF003C] text-[#FF003C] bg-[#FF003C]/10"
                : "border-[#333] text-[#666] hover:text-[#EDEDED] hover:border-[#555]"
            }`}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Stop button */}
          <button
            onClick={handleStop}
            data-testid="stop-timer-btn"
            className="flex items-center gap-2 bg-[#FF003C] text-white font-mono text-xs font-bold uppercase tracking-wider px-5 py-3 hover:bg-[#CC0030] transition-colors duration-75"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </div>
      ) : (
        /* === IDLE STATE === */
        <div className="flex items-center gap-4">
          {/* Voice waveform / mic */}
          <button
            onClick={isListening ? stopListening : startListening}
            data-testid="voice-btn-idle"
            className={`p-4 border transition-colors duration-75 shrink-0 ${
              isListening
                ? "border-[#00FF41] bg-[#00FF41]/10"
                : "border-[#333] hover:border-[#00FF41] hover:bg-[#00FF41]/5"
            }`}
          >
            {isListening ? (
              <div className="flex items-center gap-0.5 h-6 w-8">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="voice-bar w-1 bg-[#00FF41]"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            ) : (
              <Mic className="w-6 h-6 text-[#666]" />
            )}
          </button>

          {/* Description input */}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you working on?"
            data-testid="task-description-input"
            className="flex-1 bg-transparent border-b border-[#333] focus:border-[#00FF41] px-0 py-3 font-mono text-sm text-[#EDEDED] placeholder:text-[#333] outline-none transition-colors"
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
          />

          {/* Project selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              data-testid="project-selector"
              className="flex items-center gap-2 px-3 py-2.5 border border-[#333] font-mono text-xs text-[#A1A1AA] hover:border-[#555] transition-colors duration-75 min-w-[120px]"
            >
              {selectedProject && (
                <div className="w-2.5 h-2.5" style={{ backgroundColor: selectedProject.color }} />
              )}
              <span className="truncate">{selectedProject?.name || "Project"}</span>
              <ChevronDown className="w-3 h-3 ml-auto shrink-0" />
            </button>

            {showProjectDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[#0A0A0A] border border-[#333] z-50 shadow-lg" data-testid="project-dropdown">
                <button
                  onClick={() => {
                    setSelectedProjectId("");
                    setShowProjectDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 font-mono text-xs text-[#666] hover:bg-[#1A1A1A] transition-colors"
                >
                  No project
                </button>
                {projects.map((p) => (
                  <button
                    key={p.project_id}
                    onClick={() => {
                      setSelectedProjectId(p.project_id);
                      setShowProjectDropdown(false);
                    }}
                    data-testid={`select-project-${p.project_id}`}
                    className="w-full flex items-center gap-2 px-3 py-2 font-mono text-xs text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
                  >
                    <div className="w-2.5 h-2.5" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Start button */}
          <button
            onClick={handleStart}
            data-testid="start-timer-btn"
            className="flex items-center gap-2 bg-[#00FF41] text-black font-mono text-xs font-bold uppercase tracking-wider px-5 py-3 hover:bg-[#00CC33] hover:shadow-[0_0_15px_rgba(0,255,65,0.5)] transition-colors duration-75"
          >
            <Play className="w-4 h-4" />
            Start
          </button>
        </div>
      )}

      {/* Voice hint */}
      {isListening && (
        <div className="mt-3 font-mono text-[10px] text-[#00FF41] uppercase tracking-widest animate-pulse">
          Listening... say "start studying biology" or "stop task"
        </div>
      )}
    </div>
  );
}
