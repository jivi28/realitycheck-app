import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/App";
import { CATEGORIES, NOT_PURPOSEFUL, categoryMeta } from "@/lib/categories";
import { formatGoalTime } from "@/lib/goals";

const CHIPS = [...CATEGORIES, NOT_PURPOSEFUL];

/**
 * "Account for the gap" sheet. Opens when you tap the untracked bar/row after
 * being away. Tag the away-time to one or more categories (time splits equally),
 * optionally add a note, and Log it — or Dismiss. Writes normal entries so the
 * rest of the app (score, timeline, breakdown) updates for free.
 */
export default function ReconcileSheet({ open, awaySeconds, gapStart, gapEnd, onClose, onLogged }) {
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setSelected([]); setNote(""); setShowNote(false); }
  }, [open, gapStart]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !submitting) onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const toggle = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const perShare = selected.length ? awaySeconds / selected.length : 0;

  const submit = async () => {
    if (!selected.length) { toast.error("Pick at least one"); return; }
    setSubmitting(true);
    try {
      const startMs = new Date(gapStart).getTime();
      const totalMs = new Date(gapEnd).getTime() - startMs;
      const sliceMs = totalMs / selected.length;
      // Sequential (not Promise.all): the mock backend does read-modify-write on
      // the whole state, so concurrent POSTs would clobber each other.
      for (let i = 0; i < selected.length; i++) {
        const id = selected[i];
        const s = new Date(startMs + i * sliceMs).toISOString();
        const e = new Date(startMs + (i + 1) * sliceMs).toISOString();
        await fetch(`${API}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            description: note.trim() || categoryMeta(id).label,
            category: id,
            is_break: id === NOT_PURPOSEFUL.id,
            start_time: s,
            end_time: e,
          }),
        });
      }
      toast.success(`Accounted for ${formatGoalTime(awaySeconds)}`);
      onLogged && onLogged();
      onClose();
    } catch (err) {
      toast.error("Failed to log");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
      data-testid="reconcile-sheet"
    >
      <div className="w-full sm:max-w-md bg-[#0A0A0A] border border-[#333] sm:rounded-sm shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">Account for your time</p>
            <p className="font-heading text-lg font-bold text-[#EDEDED] mt-0.5">
              You were away {formatGoalTime(awaySeconds)}
            </p>
            <p className="font-mono text-[10px] text-[#52525B] mt-0.5">What were you up to? Tap any that apply.</p>
          </div>
          <button onClick={onClose} className="text-[#52525B] hover:text-[#EDEDED] transition-colors shrink-0" title="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Category chips */}
        <div className="grid grid-cols-2 gap-2">
          {CHIPS.map((c) => {
            const on = selected.includes(c.id);
            const Icon = c.Icon;
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                data-testid={`reconcile-cat-${c.id}`}
                className={`flex items-center gap-2 border px-3 py-2.5 font-mono text-xs transition-colors ${
                  on ? "bg-white/5" : "border-[#222] text-[#A1A1AA] hover:border-[#444]"
                }`}
                style={on ? { borderColor: c.color, color: c.color } : undefined}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: c.color }} />
                <span className="truncate">{c.label}</span>
                {on && selected.length > 1 && (
                  <span className="ml-auto text-[10px] tabular-nums opacity-80">{formatGoalTime(perShare)}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Optional note */}
        {showNote ? (
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What exactly? (optional)"
            autoFocus
            data-testid="reconcile-note"
            className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1.5 font-mono text-xs text-[#EDEDED] placeholder:text-[#52525B] outline-none transition-colors"
          />
        ) : (
          <button
            onClick={() => setShowNote(true)}
            className="font-mono text-[10px] text-[#71717A] hover:text-[#00FF41] uppercase tracking-wider transition-colors"
          >
            + add detail (optional)
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={submit}
            disabled={submitting || !selected.length}
            data-testid="reconcile-log"
            className="flex-1 bg-[#00FF41] text-black font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 hover:bg-[#00CC33] transition-colors disabled:opacity-40"
          >
            Log {formatGoalTime(awaySeconds)}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="font-mono text-[10px] text-[#71717A] hover:text-[#EDEDED] uppercase tracking-wider px-3 py-2.5 border border-[#333] transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
