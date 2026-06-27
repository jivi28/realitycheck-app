import { useState } from "react";
import { Plus, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/App";
import TaskSuggestionDropdown from "@/components/TaskSuggestionDropdown";

/**
 * Secondary, tucked-away way to backfill time you forgot to track.
 * Collapsed by default — a small "+ Log past time" link. Not a primary action.
 */
export default function LogPastTimeForm({ projects = [], suggestions = [], onLogged }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const reset = () => {
    setDescription(""); setProjectId(""); setStart(""); setEnd("");
  };

  // Combine an "HH:MM" value with today's date into a local ISO timestamp
  const toISO = (hhmm) => {
    if (!hhmm) return null;
    const d = new Date(`${today}T${hhmm}:00`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  const submit = async () => {
    if (!description.trim()) { toast.error("Describe what you did"); return; }
    const startISO = toISO(start);
    const endISO = toISO(end);
    if (!startISO || !endISO) { toast.error("Set start and end times"); return; }
    if (new Date(endISO) <= new Date(startISO)) { toast.error("End must be after start"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          description: description.trim(),
          project_id: projectId || null,
          start_time: startISO,
          end_time: endISO,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to log time");
      }
      toast.success("Time logged");
      reset();
      setOpen(false);
      onLogged && onLogged();
    } catch (err) {
      toast.error(err.message || "Failed to log time");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          data-testid="log-past-time-toggle"
          className="flex items-center gap-1 font-mono text-[10px] text-[#71717A] hover:text-[#00FF41] uppercase tracking-wider transition-colors"
        >
          <Plus className="w-3 h-3" /> Log past time
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0A0A0A] border border-[#333] p-4 space-y-2" data-testid="log-past-time-form">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">Log forgotten time</span>
        <button onClick={() => { reset(); setOpen(false); }} className="text-[#52525B] hover:text-[#EDEDED] transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={description}
          onChange={(e) => { setDescription(e.target.value); setShowSuggest(true); }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
          onKeyDown={(e) => e.key === "Escape" && setShowSuggest(false)}
          placeholder="What did you work on? (type a goal to link it)"
          autoFocus
          className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1.5 font-mono text-xs text-[#EDEDED] placeholder:text-[#52525B] outline-none transition-colors"
        />
        {showSuggest && (
          <TaskSuggestionDropdown
            query={description}
            suggestions={suggestions}
            onPick={(m) => { setDescription(m.label); setProjectId(m.projectId || ""); setShowSuggest(false); }}
          />
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[120px]">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full appearance-none bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#A1A1AA] pl-2.5 pr-7 py-2 outline-none focus:border-[#555]"
          >
            <option value="">No project</option>
            {projects.map((p) => (
              <option key={p.project_id} value={p.project_id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-[#52525B] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="font-mono text-[10px] text-[#71717A] uppercase tracking-wider w-10">Start</label>
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#EDEDED] px-2 py-1.5 outline-none focus:border-[#555] [color-scheme:dark]"
        />
        <label className="font-mono text-[10px] text-[#71717A] uppercase tracking-wider w-8 text-right">End</label>
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#EDEDED] px-2 py-1.5 outline-none focus:border-[#555] [color-scheme:dark]"
        />
        <button
          onClick={submit}
          disabled={submitting}
          data-testid="log-past-time-submit"
          className="ml-auto flex items-center gap-1 bg-[#00FF41] text-black font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 hover:bg-[#00CC33] transition-colors disabled:opacity-50"
        >
          <Plus className="w-3 h-3" /> Log
        </button>
      </div>
    </div>
  );
}
