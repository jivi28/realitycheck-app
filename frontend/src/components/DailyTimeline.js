export default function DailyTimeline({ entries }) {
  if (!entries || entries.length === 0) {
    return (
      <div className="bg-[#0A0A0A] border border-[#333] p-6" data-testid="daily-timeline">
        <p className="font-mono text-xs text-[#52525B] uppercase tracking-widest mb-4">
          Today's Timeline
        </p>
        <div className="flex items-center justify-center h-40">
          <p className="font-mono text-sm text-[#262626]">
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

  return (
    <div className="bg-[#0A0A0A] border border-[#333] p-6" data-testid="daily-timeline">
      <p className="font-mono text-xs text-[#52525B] uppercase tracking-widest mb-4">
        Today's Timeline
      </p>

      {/* Bar visualization */}
      <div className="flex h-12 border border-[#222] overflow-hidden mb-6" data-testid="timeline-bar">
        {entries.map((entry) => {
          const width = totalDuration > 0
            ? Math.max(((entry.duration || 0) / totalDuration) * 100, 1)
            : 0;
          return (
            <div
              key={entry.entry_id}
              className="h-full relative group"
              style={{
                width: `${width}%`,
                backgroundColor: entry.is_break ? "#1A1A1A" : (entry.project_color || "#00FF41"),
                minWidth: "2px",
              }}
              data-testid={`timeline-block-${entry.entry_id}`}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20 pointer-events-none">
                <div className="bg-black border border-[#00FF41] px-3 py-2 whitespace-nowrap">
                  <p className="font-mono text-[10px] text-[#EDEDED]">
                    {entry.description}
                  </p>
                  <p className="font-mono text-[10px] text-[#52525B]">
                    {formatTime(entry.start_time)} — {formatTime(entry.end_time)} ({formatDuration(entry.duration)})
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Entry list */}
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.entry_id}
            className={`flex items-center gap-3 py-2 px-2 ${
              entry.is_break ? "opacity-40" : ""
            }`}
            data-testid={`timeline-entry-${entry.entry_id}`}
          >
            <div
              className="w-2.5 h-2.5 shrink-0"
              style={{
                backgroundColor: entry.is_break
                  ? "#262626"
                  : entry.project_color || "#00FF41",
              }}
            />
            <span className="font-mono text-xs text-[#52525B] w-24 shrink-0">
              {formatTime(entry.start_time)} — {formatTime(entry.end_time)}
            </span>
            <span
              className={`font-mono text-xs flex-1 truncate ${
                entry.is_break ? "text-[#52525B] italic" : "text-[#EDEDED]"
              }`}
            >
              {entry.description}
            </span>
            <span
              className={`font-mono text-xs ${
                entry.is_break ? "text-[#333]" : "text-[#00FF41]"
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
