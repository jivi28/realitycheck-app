import { useState, useEffect } from "react";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import { Plus, Trash2, Edit2, Check, X, CalendarClock } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PRESET_COLORS = ["#1E40AF", "#2563EB", "#7C3AED", "#DB2777", "#059669", "#D97706"];

export default function SchedulesPage({ user }) {
  const [schedules, setSchedules] = useState([]);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("23:00");
  const [endTime, setEndTime] = useState("07:00");
  const [selectedDays, setSelectedDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [color, setColor] = useState("#1E40AF");
  const [editingId, setEditingId] = useState(null);

  const fetchSchedules = async () => {
    try {
      const res = await fetch(`${API}/schedules`, { credentials: "include" });
      const data = await res.json();
      setSchedules(data);
    } catch (err) {
      console.error("Failed to fetch schedules:", err);
    }
  };

  useEffect(() => { fetchSchedules(); }, []);

  const toggleDay = (dayIdx) => {
    setSelectedDays((prev) =>
      prev.includes(dayIdx) ? prev.filter((d) => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const createSchedule = async () => {
    if (!title.trim()) { toast.error("Title required"); return; }
    if (selectedDays.length === 0) { toast.error("Select at least one day"); return; }
    try {
      const res = await fetch(`${API}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim(),
          day_of_week: selectedDays,
          start_time: startTime,
          end_time: endTime,
          color,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setTitle("");
      toast.success("Schedule created");
      fetchSchedules();
    } catch (err) {
      toast.error("Failed to create schedule");
    }
  };

  const deleteSchedule = async (id) => {
    try {
      await fetch(`${API}/schedules/${id}`, { method: "DELETE", credentials: "include" });
      toast.success("Schedule deleted");
      fetchSchedules();
    } catch (err) {
      toast.error("Failed to delete schedule");
    }
  };

  return (
    <AppShell user={user} activePage="schedules">
      <div className="space-y-4 md:space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <CalendarClock className="w-5 h-5 text-[#60A5FA]" />
          <div>
            <h1 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold tracking-tight uppercase text-[#EDEDED]">
              Committed Time
            </h1>
            <p className="font-mono text-xs text-[#52525B] uppercase tracking-wider mt-1">
              Schedule recurring blocks (sleep, lectures, gym)
            </p>
          </div>
        </div>

        {/* Create form */}
        <div className="bg-[#0A0A0A] border border-[#333] p-4 md:p-6 space-y-4" data-testid="create-schedule-form">
          <p className="font-mono text-[10px] text-[#52525B] uppercase tracking-widest">
            New Schedule
          </p>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sleep, Lecture, Gym..."
            data-testid="schedule-title-input"
            className="w-full bg-transparent border-b border-[#333] focus:border-[#60A5FA] px-0 py-3 font-mono text-sm text-[#EDEDED] placeholder:text-[#333] outline-none transition-colors"
          />

          {/* Days */}
          <div>
            <p className="font-mono text-[10px] text-[#52525B] uppercase tracking-widest mb-2">Days</p>
            <div className="flex gap-2 flex-wrap">
              {DAYS.map((day, idx) => (
                <button
                  key={idx}
                  onClick={() => toggleDay(idx)}
                  data-testid={`day-toggle-${idx}`}
                  className={`px-3 py-1.5 font-mono text-xs uppercase tracking-wider border transition-colors ${
                    selectedDays.includes(idx)
                      ? "border-[#60A5FA] text-[#60A5FA] bg-[#60A5FA]/10"
                      : "border-[#333] text-[#52525B] hover:border-[#555]"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Time + Color */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="font-mono text-[10px] text-[#52525B] uppercase tracking-widest mb-2">Start</p>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                data-testid="schedule-start-time"
                className="bg-transparent border border-[#333] px-3 py-2 font-mono text-xs text-[#EDEDED] outline-none focus:border-[#60A5FA]"
              />
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#52525B] uppercase tracking-widest mb-2">End</p>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                data-testid="schedule-end-time"
                className="bg-transparent border border-[#333] px-3 py-2 font-mono text-xs text-[#EDEDED] outline-none focus:border-[#60A5FA]"
              />
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#52525B] uppercase tracking-widest mb-2">Color</p>
              <div className="flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 transition-transform ${color === c ? "scale-125 ring-1 ring-white" : "hover:scale-110"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={createSchedule}
              data-testid="create-schedule-btn"
              className="flex items-center gap-2 bg-[#60A5FA] text-black font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 hover:bg-[#3B82F6] transition-colors ml-auto"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>

        {/* Schedule list */}
        <div className="space-y-2" data-testid="schedule-list">
          {schedules.length === 0 && (
            <p className="font-mono text-xs text-[#333] py-4">No schedules yet. Add Sleep, Lectures, or Gym blocks.</p>
          )}
          {schedules.map((sched) => (
            <div
              key={sched.schedule_id}
              className="bg-[#0A0A0A] border border-[#222] p-4 flex items-center gap-4 group hover:border-[#444] transition-colors"
              data-testid={`schedule-item-${sched.schedule_id}`}
            >
              <div className="w-4 h-4 shrink-0" style={{ backgroundColor: sched.color }} />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm text-[#EDEDED]">{sched.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] text-[#60A5FA]">
                    {sched.start_time} — {sched.end_time}
                  </span>
                  <span className="font-mono text-[10px] text-[#52525B]">
                    {sched.day_of_week.map((d) => DAYS[d]).join(", ")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => deleteSchedule(sched.schedule_id)}
                data-testid={`delete-schedule-${sched.schedule_id}`}
                className="opacity-0 group-hover:opacity-100 text-[#666] hover:text-[#FF003C] transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
