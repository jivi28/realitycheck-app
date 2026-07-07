import { getEntryColor, getEntryLabel } from "@/lib/entryColors";

export default function DailyTimeline({ entries, title = "Today's Timeline" }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-[#0A0A0A] border border-[#333] p-6" data-testid="daily-timeline">
        <p className="font-mono text-xs text-[#71717A] uppercase tracking-widest mb-4">
          {title}
        </p>
        <div className="flex items-center justify-center h-40">
          <p className="font-mono text-sm text-[#52525B]">
            No entries yet. Start working to see your timeline.
          </p>
        </div>
      </div>
    );
  }

  const formatTime = (isoStr) => {
    if (!isoStr) return "";
    const d = new Date(isoStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Calculate total duration for proportional widths
  const totalDuration = entries.reduce((sum, e) => sum + (e.duration || 0), 0);

  // Span of the day actually covered (first start → last end) for axis labels
  const sorted = [...entries].sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  const dayStart = sorted[0]?.start_time;
  const dayEnd = sorted[sorted.length - 1]?.end_time || sorted[sorted.length - 1]?.start_time;

  return (
    <div className="bg-[#0A0A0A] border border-[#333] p-4 md:p-6" data-testid="daily-timeline">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-xs text-[#71717A] uppercase tracking-widest">
          {title}
        </p>
        <p className="font-mono text-[10px] text-[#71717A] tabular-nums">
          {formatDuration(totalDuration)} tracked
        </p>
      </div>

      {/* Bar visualization */}
      <div className="flex h-12 md:h-14 rounded-sm overflow-hidden mb-1.5 ring-1 ring-[#222]" data-testid="timeline-bar">
        {entries.map((entry) => {
          const width = totalDuration > 0
            ? Math.max(((entry.duration || 0) / totalDuration) * 100, 1)
            : 0;
          return (
            <div
              key={entry.entry_id}
              className="h-full relative group border-r border-black/40 last:border-r-0 hover:brightness-125 transition-[filter]"
              style={{
                width: `${width}%`,
                backgroundColor: getEntryColor(entry),
                minWidth: "2px",
              }}
              data-testid={`timeline-block-${entry.entry_id}`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                <div className="bg-black border border-[#00FF41] px-3 py-2 whitespace-nowrap shadow-lg">
                  <p className="font-mono text-[11px] text-[#EDEDED]">
                    {entry.description}
                  </p>
                  <p className="font-mono text-[10px] text-[#A1A1AA]">
                    {formatTime(entry.start_time)} — {formatTime(entry.end_time)} ({formatDuration(entry.duration)})
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time axis: span of tracked day */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <span className="font-mono text-[10px] text-[#52525B] tabular-nums">{formatTime(dayStart)}</span>
        <span className="font-mono text-[10px] text-[#52525B] tabular-nums">{formatTime(dayEnd)}</span>
      </div>

      {/* Entry list */}
      <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.entry_id}
            className={`flex items-center gap-3 py-2 px-2 rounded-sm hover:bg-[#111] transition-colors ${
              entry.is_break ? "opacity-60" : ""
            }`}
            data-testid={`timeline-entry-${entry.entry_id}`}
          >
            <div
              className="w-2.5 h-2.5 shrink-0"
              style={{
                backgroundColor: getEntryColor(entry),
              }}
            />
            <span className="font-mono text-xs text-[#71717A] w-24 shrink-0 tabular-nums">
              {formatTime(entry.start_time)} — {formatTime(entry.end_time)}
            </span>
            <span
              className={`font-mono text-xs flex-1 truncate ${
                entry.entry_type === "break" || entry.is_break ? "text-[#71717A] italic"
                : entry.entry_type === "scheduled" ? "text-[#60A5FA]"
                : "text-[#EDEDED]"
              }`}
            >
              {entry.description}
            </span>
            <span className="font-mono text-[10px] text-[#52525B] uppercase tracking-wider shrink-0 hidden sm:inline">
              {getEntryLabel(entry)}
            </span>
            <span
              className={`font-mono text-xs shrink-0 tabular-nums ${
                entry.entry_type === "break" || entry.is_break ? "text-[#52525B]"
                : entry.entry_type === "scheduled" ? "text-[#60A5FA]"
                : "text-[#00FF41]"
              }`}
            >
              {formatDuration(entry.duration)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
