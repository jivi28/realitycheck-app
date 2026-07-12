import { useEffect, useState } from "react";
import { Ban, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/App";
import { CATEGORIES, NOT_PURPOSEFUL, categoryMeta } from "@/lib/categories";
import { formatGoalTime } from "@/lib/goals";

const RECHARGE = CATEGORIES.find((category) => category.id === "rest");
const PRODUCTIVE = CATEGORIES.filter((category) => category.id !== "rest");
const BREAK_CATEGORIES = [NOT_PURPOSEFUL, RECHARGE];
const GAP_CATEGORIES = [RECHARGE, NOT_PURPOSEFUL, ...PRODUCTIVE];

const categoryKey = (id) => `category:${id}`;

export default function ReconcileSheet({
  open,
  awaySeconds,
  gapStart,
  gapEnd,
  onClose,
  onLogged,
  mode = "gap",
  replaceEntryId = null,
  antiTodos = [],
}) {
  const isBreakMode = mode === "break";
  const categories = isBreakMode ? BREAK_CATEGORIES : GAP_CATEGORIES;
  const categoryChoices = categories.map((category) => ({
    key: categoryKey(category.id),
    category: category.id,
    label: category.label,
    color: category.color,
    Icon: category.Icon,
    kind: "category",
  }));
  const antiChoices = antiTodos.map((item) => ({
    key: `anti:${item.id}`,
    category: NOT_PURPOSEFUL.id,
    label: item.label,
    color: "#FF8C00",
    Icon: Ban,
    kind: "anti",
  }));
  const choices = [...categoryChoices, ...antiChoices];
  const defaultKey = isBreakMode ? categoryKey(NOT_PURPOSEFUL.id) : null;

  const [selected, setSelected] = useState(defaultKey);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [parts, setParts] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected(isBreakMode ? categoryKey(NOT_PURPOSEFUL.id) : null);
    setNote("");
    setShowNote(false);
    setSplitMode(false);
    setParts([]);
  }, [open, gapStart, isBreakMode]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const choiceFor = (key) => choices.find((choice) => choice.key === key);
  const entryDescription = (choice) => {
    const detail = note.trim();
    if (choice.kind === "anti") {
      const base = `Anti-To-Do: ${choice.label}`;
      return detail ? `${base} - ${detail}` : base;
    }
    return detail || choice.label || categoryMeta(choice.category).label;
  };

  const postEntry = async ({ category, start, end, description }) => {
    const response = await fetch(`${API}/entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        description,
        category,
        is_break: category === NOT_PURPOSEFUL.id,
        start_time: start,
        end_time: end,
      }),
    });
    if (!response.ok) throw new Error("Failed to create entry");
  };

  const enterSplit = () => {
    setParts([{ choiceKey: selected || categoryChoices[0].key, percent: 100 }]);
    setSplitMode(true);
  };
  const updatePart = (index, patch) => {
    setParts((current) => current.map((part, partIndex) => (
      partIndex === index ? { ...part, ...patch } : part
    )));
  };
  const addPart = () => {
    setParts((current) => {
      const largestIndex = current.reduce((best, part, index) => (
        Number(part.percent) > Number(current[best]?.percent || 0) ? index : best
      ), 0);
      const largest = Number(current[largestIndex]?.percent || 0);
      const allocation = Math.floor((largest / 2) / 5) * 5;
      if (allocation < 5) return current;
      const next = current.map((part, index) => (
        index === largestIndex ? { ...part, percent: largest - allocation } : part
      ));
      return [...next, { choiceKey: categoryChoices[0].key, percent: allocation }];
    });
  };
  const removePart = (index) => {
    setParts((current) => {
      if (current.length === 1) return current;
      const removed = Number(current[index]?.percent || 0);
      const remaining = current.filter((_, partIndex) => partIndex !== index);
      return remaining.map((part, partIndex) => (
        partIndex === 0 ? { ...part, percent: Number(part.percent || 0) + removed } : part
      ));
    });
  };

  const splitTotal = parts.reduce((total, part) => total + (Number(part.percent) || 0), 0);
  const splitDifference = 100 - splitTotal;
  const validParts = parts.map((part) => ({ ...part, choice: choiceFor(part.choiceKey) }));
  const canSubmit = splitMode
    ? validParts.length > 0 && validParts.every((part) => part.choice && Number(part.percent) > 0) && splitTotal === 100
    : !!choiceFor(selected);

  const removePending = async () => {
    if (!replaceEntryId) return;
    const response = await fetch(`${API}/entries/${replaceEntryId}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) throw new Error("Failed to replace break entry");
  };

  const submit = async () => {
    if (!canSubmit) return;
    const startMs = Date.parse(gapStart);
    const endMs = Date.parse(gapEnd);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      toast.error("This time window is no longer valid");
      return;
    }

    setSubmitting(true);
    try {
      await removePending();
      if (splitMode) {
        let cursor = startMs;
        for (let index = 0; index < validParts.length; index += 1) {
          const part = validParts[index];
          const isFinal = index === validParts.length - 1;
          const partEnd = isFinal
            ? endMs
            : Math.min(endMs, cursor + Math.round((endMs - startMs) * (Number(part.percent) / 100)));
          await postEntry({
            category: part.choice.category,
            start: new Date(cursor).toISOString(),
            end: new Date(partEnd).toISOString(),
            description: entryDescription(part.choice),
          });
          cursor = partEnd;
        }
      } else {
        const choice = choiceFor(selected);
        await postEntry({
          category: choice.category,
          start: gapStart,
          end: gapEnd,
          description: entryDescription(choice),
        });
      }
      toast.success(`Accounted for ${formatGoalTime(awaySeconds)}`);
      onLogged?.();
      onClose();
    } catch (_error) {
      toast.error("Failed to log");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}
      data-testid="reconcile-sheet"
    >
      <div className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[#0A0A0A] border border-[#333] sm:rounded-sm shadow-2xl p-5 space-y-4 animate-in slide-in-from-bottom-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">
              {isBreakMode ? "Be honest" : "Account for your time"}
            </p>
            <p className="font-heading text-lg font-bold text-[#EDEDED] mt-0.5">
              {isBreakMode ? "On a break for" : "You were away"} {formatGoalTime(awaySeconds)}
            </p>
            <p className="font-mono text-[10px] text-[#52525B] mt-0.5">
              {splitMode
                ? "Estimate what share went to each."
                : isBreakMode ? "Did you drift, recharge, or cross a guardrail?" : "What were you doing? Pick one."}
            </p>
          </div>
          <button onClick={onClose} className="text-[#52525B] hover:text-[#EDEDED] transition-colors shrink-0" title="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!splitMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {categoryChoices.map((choice) => {
                const active = selected === choice.key;
                const Icon = choice.Icon;
                return (
                  <button
                    key={choice.key}
                    onClick={() => setSelected(choice.key)}
                    data-testid={`reconcile-cat-${choice.category}`}
                    className={`flex items-center gap-2 border px-3 py-2.5 font-mono text-xs transition-colors ${active ? "bg-white/5" : "border-[#222] text-[#A1A1AA] hover:border-[#444]"}`}
                    style={active ? { borderColor: choice.color, color: choice.color } : undefined}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: choice.color }} />
                    <span className="truncate">{choice.label}</span>
                  </button>
                );
              })}
            </div>
            {antiChoices.length > 0 && (
              <div className="space-y-1.5" data-testid="reconcile-anti-todos">
                <p className="font-mono text-[9px] text-[#71717A] uppercase tracking-widest">Anti-To-Do</p>
                <div className="grid grid-cols-2 gap-2">
                  {antiChoices.map((choice) => {
                    const active = selected === choice.key;
                    return (
                      <button
                        key={choice.key}
                        onClick={() => setSelected(choice.key)}
                        data-testid={`reconcile-anti-${choice.key.slice(5)}`}
                        className={`flex items-center gap-2 border px-3 py-2.5 font-mono text-xs transition-colors ${active ? "bg-[#FF8C00]/5 border-[#FF8C00] text-[#FF8C00]" : "border-[#222] text-[#A1A1AA] hover:border-[#FF8C00]/50"}`}
                      >
                        <Ban className="w-3.5 h-3.5 text-[#FF8C00] shrink-0" />
                        <span className="truncate">{choice.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {parts.map((part, index) => (
              <div key={index} className="flex items-center gap-2" data-testid={`reconcile-part-${index}`}>
                <select
                  value={part.choiceKey}
                  onChange={(event) => updatePart(index, { choiceKey: event.target.value })}
                  className="flex-1 min-w-0 appearance-none bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#A1A1AA] px-2.5 py-2 outline-none focus:border-[#555]"
                  aria-label={`Part ${index + 1} activity`}
                >
                  <optgroup label="Activities">
                    {categoryChoices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
                  </optgroup>
                  {antiChoices.length > 0 && (
                    <optgroup label="Anti-To-Dos">
                      {antiChoices.map((choice) => <option key={choice.key} value={choice.key}>Anti-To-Do: {choice.label}</option>)}
                    </optgroup>
                  )}
                </select>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={part.percent}
                  onChange={(event) => updatePart(index, {
                    percent: event.target.value === "" ? "" : Math.min(100, Math.max(0, Number(event.target.value))),
                  })}
                  onBlur={() => updatePart(index, {
                    percent: Math.min(100, Math.max(0, Math.round((Number(part.percent) || 0) / 5) * 5)),
                  })}
                  className="w-16 bg-[#0A0A0A] border border-[#333] font-mono text-xs text-[#EDEDED] px-2 py-2 outline-none focus:border-[#555] tabular-nums"
                  aria-label={`Part ${index + 1} percentage`}
                />
                <span className="font-mono text-[10px] text-[#52525B]">%</span>
                <button
                  onClick={() => removePart(index)}
                  disabled={parts.length === 1}
                  className="text-[#52525B] hover:text-[#FF003C] disabled:opacity-30 transition-colors shrink-0"
                  title="Remove part"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <button
                onClick={addPart}
                disabled={!parts.some((part) => Number(part.percent) >= 10)}
                className="flex items-center gap-1 font-mono text-[10px] text-[#71717A] hover:text-[#00FF41] disabled:opacity-30 uppercase tracking-wider transition-colors"
              >
                <Plus className="w-3 h-3" /> Add part
              </button>
              <span className={`font-mono text-[10px] tabular-nums ${splitDifference === 0 ? "text-[#00FF41]" : "text-[#FF003C]"}`}>
                {splitTotal}% total
                {splitDifference > 0 ? ` - ${splitDifference}% remaining` : splitDifference < 0 ? ` - ${Math.abs(splitDifference)}% over` : ""}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={splitMode ? () => setSplitMode(false) : enterSplit}
          className="font-mono text-[10px] text-[#71717A] hover:text-[#FF8C00] uppercase tracking-wider transition-colors"
        >
          {splitMode ? "Back to single" : "+ split by percentage"}
        </button>

        {showNote ? (
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
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

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={submit}
            disabled={submitting || !canSubmit}
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
