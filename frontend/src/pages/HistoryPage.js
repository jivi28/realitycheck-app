import { useState, useEffect } from "react";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import { Trash2, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getEntryColor } from "@/lib/entryColors";

export default function HistoryPage({ user }) {
  const [entries, setEntries] = useState([]);
  const [dateFilter, setDateFilter] = useState("");

  const fetchEntries = async () => {
    try {
      const url = dateFilter
        ? `${API}/entries?date=${dateFilter}&limit=100`
        : `${API}/entries?limit=100`;
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      setEntries(data);
    } catch (err) {
      console.error("Failed to fetch entries:", err);
    }
  };

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const deleteEntry = async (entryId) => {
    try {
      await fetch(`${API}/entries/${entryId}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast.success("Entry deleted");
      fetchEntries();
    } catch (err) {
      toast.error("Failed to delete entry");
    }
  };

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

  const formatDate = (isoStr) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  // Group entries by date
  const grouped = entries.reduce((acc, entry) => {
    const date = entry.start_time?.split("T")[0] || "unknown";
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <AppShell user={user} activePage="history">
      <div className="space-y-4 md:space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold tracking-tight uppercase text-[#EDEDED]">
              History
            </h1>
            <p className="font-mono text-xs text-[#52525B] uppercase tracking-wider mt-1">
              Every minute accounted for
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#52525B]" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              data-testid="history-date-filter"
              className="bg-transparent border border-[#333] px-3 py-2 font-mono text-xs text-[#A1A1AA] outline-none focus:border-[#00FF41] transition-colors flex-1 sm:flex-initial"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                data-testid="clear-date-filter"
                className="font-mono text-xs text-[#666] hover:text-[#EDEDED] px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Entries */}
        {Object.keys(grouped).length === 0 && (
          <div className="bg-[#0A0A0A] border border-[#222] p-12 text-center">
            <Clock className="w-8 h-8 text-[#262626] mx-auto mb-3" />
            <p className="font-mono text-sm text-[#333]">No entries yet</p>
          </div>
        )}

        {Object.entries(grouped).map(([date, dayEntries]) => (
          <div key={date} data-testid={`history-group-${date}`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-xs text-[#52525B] uppercase tracking-wider">
                {formatDate(date + "T00:00:00")}
              </span>
              <div className="flex-1 h-px bg-[#222]" />
              <span className="font-mono text-[10px] text-[#52525B]">
                {dayEntries.filter((e) => !e.is_break).length} sessions
              </span>
            </div>

            <div className="space-y-1">
              {dayEntries.map((entry) => (
                <div
                  key={entry.entry_id}
                  data-testid={`entry-${entry.entry_id}`}
                  className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 border group transition-colors duration-75 ${
                    entry.is_break
                      ? "bg-[#080808] border-[#1A1A1A]"
                      : "bg-[#0A0A0A] border-[#222] hover:border-[#444]"
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-3 h-3 shrink-0"
                      style={{
                        backgroundColor: getEntryColor(entry),
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-mono text-sm truncate ${
                          entry.entry_type === "break" || entry.is_break ? "text-[#52525B] italic"
                          : entry.entry_type === "scheduled" ? "text-[#60A5FA]"
                          : "text-[#EDEDED]"
                        }`}
                      >
                        {entry.description}
                      </p>
                      {!entry.is_break && entry.project_name && (
                        <p className="font-mono text-[10px] text-[#52525B] mt-0.5">
                          {entry.project_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 ml-6 sm:ml-0">
                    <div className="font-mono text-xs text-[#52525B] whitespace-nowrap">
                      {formatTime(entry.start_time)} — {formatTime(entry.end_time)}
                    </div>
                    <div
                      className={`font-mono text-xs whitespace-nowrap min-w-[40px] text-right ${
                        entry.entry_type === "break" || entry.is_break ? "text-[#333]"
                        : entry.entry_type === "scheduled" ? "text-[#60A5FA]"
                        : "text-[#00FF41]"
                      }`}
                    >
                      {formatDuration(entry.duration)}
                    </div>
                    {!entry.is_break && (
                      <button
                        onClick={() => deleteEntry(entry.entry_id)}
                        data-testid={`delete-entry-${entry.entry_id}`}
                        className="opacity-0 group-hover:opacity-100 text-[#333] hover:text-[#FF003C] transition-opacity duration-75"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
