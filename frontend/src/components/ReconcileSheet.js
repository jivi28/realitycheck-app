import { useState, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/App";
import { CATEGORIES, NOT_PURPOSEFUL, categoryMeta } from "@/lib/categories";
import { formatGoalTime } from "@/lib/goals";

const CHIPS = [...CATEGORIES, NOT_PURPOSEFUL];

/**
 * "Account for the gap" sheet. Opens when you tap the untracked bar/row after
 * being away. By default you pick the ONE thing you were doing and it logs a
 * single clean entry for the whole gap. If it was actually more than one thing,
 * flip on "split into parts" and set the minutes per part yourself. Writes normal
 * entries so the rest of the app (score, timeline, breakdown) updates for free.
 */
export default function ReconcileSheet({ open, awaySeconds, gapStart, gapEnd, onClose, onLogged }) {
  const [selected, setSelected] = useState(null); // single category id
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [parts, setParts] = useState([]); // [{ category, minutes }]
  const [submitting, setSubmitting] = useState(false);

  const gapMinutes = Math.max(1, Math.round(awaySeconds / 60));

  useEffect(() => {
    if (open) {
      setSelected(null);
      setNote("");
      setShowNote(false);
      setSplitMode(false);
      setParts([]);
    }
  }, [open, gapStart]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !submitting) onClose(); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  // POST one entry. Sequential callers only: the mock backend does
  // read-modify-write on the whole state, so concurrent POSTs would clobber.
  const postEntry = ({ category, start, end, description }) =>
    fetch(`${API}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        description: description || categoryMeta(category).label,
        category,
        is_break: category === NOT_PURPOSEFUL.id,
        start_time: start,
        end_time: end,
      }),
    });

  const enterSplit = () => {
    setParts([{ category: selected || CATEGORIES[0].id, minutes: gapMinutes }]);
    setSplitMode(true);
  };
  const exitSplit = () => setSplitMode(false);

  const updatePart = (i, patch) =>
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPart = () =>
    setParts((prev) => [...prev, { category: CATEGORIES[0].id, minutes: Math.max(0, gapMinutes - splitTotalMin) }]);
  const removePart = (i) => setParts((prev) => prev.filter((_, idx) => idx !== i));

  const splitTotalMin = parts.reduce((sum, p) => sum + (Number(p.minutes) || 0), 0);
  const splitRemainingMin = gapMinutes - splitTotalMin;

  const submit = async () => {
    setSubmitting(true);
    try {
      if (splitMode) {
        const valid = parts.filter((p) => p.category && Number(p.minutes) > 0);
        if (!valid.length) { toast.error("Add at least one part"); setSubmitting(false); return; }
        if (splitTotalMin > gapMinutes) { toast.error("Parts add up to more than the gap"); setSubmitting(false); return; }
        const gapEndMs = new Date(gapEnd).getTime();
        let cursor = new Date(gapStart).getTime();
        for (const p of valid) {
          const start = cursor;
          const end = Math.min(cursor + Number(p.minutes) * 60000, gapEndMs);
          await postEntry({
            category: p.category,
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            description: note.trim() || categoryMeta(p.category).label,
          });
          cursor = end;
        }
        toast.success(`Accounted for ${formatGoalTime(splitTotalMin * 60)}`);
      } else {
        if (!selected) { toast.error("Pick what you were doing"); setSubmitting(false); return; }
        await postEntry({
          category: selected,
          start: gapStart,
          end: gapEnd,
          description: note.trim() || categoryMeta(selected).label,
        });
        toast.success(`Accounted for ${formatGoalTime(awaySeconds)}`);
      }
      onLogged && onLogged();
      onClose();
    } catch (err) {
      toast.error("Failed to log");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = splitMode
    ? parts.some((p) => p.category && Number(p.minutes) > 0) && splitTotalMin <= gapMinutes
    : !!selected;
  const logLabel = splitMode ? formatGoalTime(splitTotalMin * 60) : formatGoalTime(awaySeconds);

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
            <p className="font-mono text-[10px] text-[#52525B] mt-0.5">
              {splitMode ? "Set how long each thing took." : "What were you doing? Pick one."}
            </p>
          </div>
          <button onClick={onClose} className="text-[#52525B] hover:text-[#EDEDED] transition-colors shrink-0" title="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!splitMode ? (
          /* Single-select category chips */
          <div className="grid grid-cols-2 gap-2">
            {CHIPS.map((c) => {
              const on = selected === c.id;
              const Icon = c.Icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  data-testid={`reconcile-cat-${c.id}`}
                  className={`flex items-center gap-2 border px-3 py-2.5 font-mono text-xs transition-colors ${
                    on ? "bg-white/5" : "border-[#222] text-[#A1A1AA] hover:border-[#444]"
                  }`}
                  style={on ? { borderColor: c.color, color: c.color } : undefined}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: c.color }} />
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          /* Split into parts — you choose category + minutes per part */
          <div className="space-y-2">
            {parts.map((p, i) => (
              <div key={i} className="flex items-center gap-2" data-testid={`reconcile-part-${i}`}>
                <select
                  value={p.category}
                  onChange={(e) => updatePart(i, { category: e.target.value })}
                  className="flex-1 min-w-0 appearance-none bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#A1A1AA] px-2.5 py-2 outline-none focus:border-[#555]"
                >
                  {CHIPS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  max={gapMinutes}
                  step="5"
                  value={p.minutes}
                  onChange={(e) => updatePart(i, { minutes: e.target.value === "" ? "" : Math.max(0, Number(e.target.value)) })}
                  className="w-16 bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#EDEDED] px-2 py-2 outline-none focus:border-[#555] tabular-nums"
                />
                <span className="font-mono text-[10px] text-[#52525B]">min</span>
                <button
                  onClick={() => removePart(i)}
                  disabled={parts.length === 1}
                  className="text-[#52525B] hover:text-[#FF003C] disabled:opacity-30 transition-colors shrink-0"
                  title="Remove part"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between pt-0.5">
              <button
                onClick={addPart}
                className="flex items-center gap-1 font-mono text-[10px] text-[#71717A] hover:text-[#00FF41] uppercase tracking-wider transition-colors"
              >
                <Plus className="w-3 h-3" /> Add part
              </button>
              <span
                className={`font-mono text-[10px] tabular-nums ${splitRemainingMin < 0 ? "text-[#FF003C]" : "text-[#52525B]"}`}
              >
                {splitTotalMin}/{gapMinutes}m
                {splitRemainingMin > 0 ? ` · ${splitRemainingMin}m left untracked` : splitRemainingMin < 0 ? " · over the gap" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Toggle split mode */}
        <button
          onClick={splitMode ? exitSplit : enterSplit}
          className="font-mono text-[10px] text-[#71717A] hover:text-[#FF8C00] uppercase tracking-wider transition-colors"
        >
          {splitMode ? "← back to single" : "+ split into parts"}
        </button>

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
            className="block font-mono text-[10px] text-[#71717A] hover:text-[#00FF41] uppercase tracking-wider transition-colors"
          >
            + add detail (optional)
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={submit}
            disabled={submitting || !canSubmit}
            data-testid="reconcile-log"
            className="flex-1 bg-[#00FF41] text-black font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 hover:bg-[#00CC33] transition-colors disabled:opacity-40"
          >
            Log {logLabel}
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
