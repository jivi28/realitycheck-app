/**
 * Autocomplete dropdown shown under a description input. When the typed text
 * Shows the open goal hierarchy on focus, then ranks prefix matches before
 * substring matches as the user types.
 */
export default function TaskSuggestionDropdown({ query, suggestions = [], onPick, anchor = "top" }) {
  const q = (query || "").trim().toLowerCase();
  const seen = new Set();
  const unique = suggestions.filter((suggestion) => {
    if (!suggestion.label) return false;
    const key = `${suggestion.kind}:${suggestion.label.trim().toLowerCase()}:${suggestion.parent || ""}:${suggestion.projectId || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const matches = unique
    .map((suggestion, index) => {
      const label = suggestion.label.toLowerCase();
      const rank = !q || label.startsWith(q) ? 0 : label.includes(q) ? 1 : 2;
      return { suggestion, index, rank };
    })
    .filter(({ rank }) => rank < 2)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, 10)
    .map(({ suggestion }) => suggestion);
  if (!matches.length) return null;

  const pos = anchor === "bottom" ? "bottom-full mb-1" : "top-full mt-1";

  return (
    <div
      className={`absolute left-0 ${pos} w-full bg-[#0A0A0A] border border-[#333] z-50 shadow-lg max-h-60 overflow-y-auto`}
      data-testid="task-suggestions"
    >
      {matches.map((m, i) => (
        <button
          key={`${m.kind}-${m.label}-${m.projectId || "none"}`}
          // onMouseDown (not onClick) so selection fires before the input blurs
          onMouseDown={(e) => { e.preventDefault(); onPick(m); }}
          data-testid={`task-suggestion-${i}`}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#1A1A1A] transition-colors"
        >
          {m.project && <span className="w-2 h-2 shrink-0" style={{ backgroundColor: m.project.color }} />}
          <span className="font-mono text-xs text-[#EDEDED] truncate">{m.label}</span>
          {m.kind === "subgoal" && m.parent && (
            <span className="font-mono text-[9px] text-[#52525B] truncate">in {m.parent}</span>
          )}
          {m.project && (
            <span className="ml-auto font-mono text-[9px] shrink-0" style={{ color: m.project.color }}>
              {m.project.name}
            </span>
          )}
          <span className={`font-mono text-[8px] uppercase tracking-wider shrink-0 ${m.project ? "" : "ml-auto"} text-[#52525B]`}>
            {m.kind === "subgoal" ? "subtask" : "goal"}
          </span>
        </button>
      ))}
    </div>
  );
}
