import { Clock, Trash2 } from "lucide-react";
import { API } from "@/App";
import { toast } from "sonner";
import { getEntryColor } from "@/lib/entryColors";

export default function RecentEntries({ entries, onRefresh }) {
  const formatTime = (isoStr) => {
    if (!isoStr) return "--:--";
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

  const deleteEntry = async (entryId) => {
    try {
      await fetch(`${API}/entries/${entryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast.success("Entry deleted");
      onRefresh();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div className="bg-[#0A0A0A] border border-[#333] p-6" data-testid="recent-entries">
      <p className="font-mono text-xs text-[#52525B] uppercase tracking-widest mb-4">
        Recent Activity
      </p>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32">
          <Clock className="w-6 h-6 text-[#262626] mb-2" />
          <p className="font-mono text-xs text-[#333]">No activity today</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {entries.map((entry) => (
            <div
              key={entry.entry_id}
              className={`flex items-center gap-3 py-2 px-2 group ${
                entry.is_break ? "opacity-40" : ""
              }`}
              data-testid={`recent-entry-${entry.entry_id}`}
            >
              <div
                className="w-2 h-2 shrink-0"
                style={{
                  backgroundColor: getEntryColor(entry),
                }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`font-mono text-xs truncate ${
                    entry.is_break ? "text-[#52525B] italic" : "text-[#EDEDED]"
                  }`}
                >
                  {entry.description}
                </p>
                <p className="font-mono text-[10px] text-[#333]">
                  {formatTime(entry.start_time)} — {formatTime(entry.end_time)}
                </p>
              </div>
              <span
                className={`font-mono text-[10px] shrink-0 ${
                  entry.is_break ? "text-[#333]" : "text-[#00FF41]"
                }`}
              >
                {formatDuration(entry.duration)}
              </span>
              {!entry.is_break && !entry.is_running && (
                <button
                  onClick={() => deleteEntry(entry.entry_id)}
                  data-testid={`delete-recent-${entry.entry_id}`}
                  className="opacity-0 group-hover:opacity-100 text-[#333] hover:text-[#FF003C] transition-opacity duration-75"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
