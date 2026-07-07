import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import DailyTimeline from "@/components/DailyTimeline";
import RecentEntries from "@/components/RecentEntries";
import { Calendar } from "lucide-react";
import { readGoals, completedByDay, completedSummary, formatGoalTime } from "@/lib/goals";
import { localDayStr } from "@/lib/dates";

// Dynamic imports to avoid babel-metadata-plugin crash on recharts
const WeeklyBarChart = lazy(() => import("@/components/WeeklyBarChart"));
const ProjectPieChart = lazy(() => import("@/components/ProjectPieChart"));

// "Wed Jul 2" from a YYYY-MM-DD key (parsed as local midnight to avoid tz drift).
function formatDayHeader(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatClock(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function ReportsPage({ user }) {
  const [weeklyData, setWeeklyData] = useState(null);
  const [projectData, setProjectData] = useState([]);
  const [dailyData, setDailyData] = useState(null);
  const [dayEntries, setDayEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    localDayStr()
  );

  // Goals are read from localStorage (synced via cloudSync elsewhere). Read
  // once per render for the completed-history section.
  const goals = readGoals();
  const completedDays = completedByDay(goals);
  const cSummary = completedSummary(goals);

  const fetchData = useCallback(async () => {
    try {
      const [weeklyRes, projectRes, dailyRes, entriesRes] = await Promise.all([
        fetch(`${API}/analytics/weekly`, { credentials: "include" }),
        fetch(`${API}/analytics/projects?date=${selectedDate}`, { credentials: "include" }),
        fetch(`${API}/analytics/daily?date=${selectedDate}`, { credentials: "include" }),
        fetch(`${API}/entries?date=${selectedDate}&limit=50`, { credentials: "include" }),
      ]);
      setWeeklyData(await weeklyRes.json());
      setProjectData(await projectRes.json());
      setDailyData(await dailyRes.json());
      setDayEntries(await entriesRes.json());
    } catch (err) {
      console.error("Failed to fetch reports:", err);
    }
  }, [selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const awakeHours = 16;
  const productiveHours = weeklyData?.total_productive_hours || 0;
  const todayProductive = weeklyData?.days?.find(
    (d) => d.date === selectedDate
  );
  const todayProdHours = todayProductive?.productive_hours || 0;
  const realityScore =
    awakeHours > 0 ? Math.round((todayProdHours / awakeHours) * 100) : 0;

  return (
    <AppShell user={user} activePage="reports">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold tracking-tight uppercase text-[#EDEDED]">
              Reports
            </h1>
            <p className="font-mono text-xs text-[#52525B] uppercase tracking-wider mt-1">
              The numbers don't lie
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#52525B]" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              data-testid="report-date-picker"
              className="bg-transparent border border-[#333] px-3 py-2 font-mono text-xs text-[#A1A1AA] outline-none focus:border-[#00FF41] transition-colors"
            />
          </div>
        </div>

        {/* Top metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
          <div className="bg-[#0A0A0A] border border-[#333] p-4 md:p-6" data-testid="metric-weekly-productive">
            <p className="font-mono text-[9px] md:text-[10px] text-[#52525B] uppercase tracking-widest mb-2">
              Week Total
            </p>
            <p className="font-heading text-2xl md:text-3xl font-bold text-[#00FF41]">
              {productiveHours}h
            </p>
            <p className="font-mono text-xs text-[#52525B] mt-1">on purpose</p>
          </div>
          <div className="bg-[#0A0A0A] border border-[#333] p-4 md:p-6" data-testid="metric-today-productive">
            <p className="font-mono text-[9px] md:text-[10px] text-[#52525B] uppercase tracking-widest mb-2">
              Selected Day
            </p>
            <p className="font-heading text-2xl md:text-3xl font-bold text-[#EDEDED]">
              {todayProdHours}h
            </p>
            <p className="font-mono text-xs text-[#52525B] mt-1">
              of ~{awakeHours}h awake
            </p>
          </div>
          <div className="bg-[#0A0A0A] border border-[#333] p-4 md:p-6" data-testid="metric-reality-score">
            <p className="font-mono text-[9px] md:text-[10px] text-[#52525B] uppercase tracking-widest mb-2">
              Reality Score
            </p>
            <p
              className={`font-heading text-2xl md:text-3xl font-bold ${
                realityScore >= 50
                  ? "text-[#00FF41]"
                  : realityScore >= 25
                  ? "text-[#FFD600]"
                  : "text-[#FF003C]"
              }`}
            >
              {realityScore}%
            </p>
            <p className="font-mono text-xs text-[#52525B] mt-1">
              lived on purpose / awake
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-[#0A0A0A] border border-[#333] p-6" data-testid="weekly-bar-chart">
            <p className="font-mono text-xs text-[#52525B] uppercase tracking-widest mb-4">
              Weekly Overview
            </p>
            <Suspense fallback={<div className="flex items-center justify-center h-[300px]"><p className="font-mono text-xs text-[#333]">Loading chart...</p></div>}>
              <WeeklyBarChart data={weeklyData?.days || []} />
            </Suspense>
          </div>
          <div className="bg-[#0A0A0A] border border-[#333] p-6" data-testid="project-pie-chart">
            <p className="font-mono text-xs text-[#52525B] uppercase tracking-widest mb-4">
              Time by Project — {selectedDate}
            </p>
            <Suspense fallback={<div className="flex items-center justify-center h-[300px]"><p className="font-mono text-xs text-[#333]">Loading chart...</p></div>}>
              <ProjectPieChart data={projectData} />
            </Suspense>
          </div>
        </div>

        {/* Day review — the timeline that used to vanish after midnight, for any date */}
        <DailyTimeline entries={dailyData?.entries || []} title={`Timeline — ${selectedDate}`} />

        {/* Activity list + completed goals for the selected day / history */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <RecentEntries
            entries={dayEntries || []}
            onRefresh={fetchData}
            title={`Activity — ${selectedDate}`}
            emptyText="No activity logged this day"
          />

          <div className="bg-[#0A0A0A] border border-[#333] p-6" data-testid="goals-completed">
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="font-mono text-xs text-[#52525B] uppercase tracking-widest">
                Goals Completed
              </p>
              <p className="font-mono text-[10px] text-[#52525B] tabular-nums text-right">
                {cSummary.total} total · {cSummary.weekCount} this week
                <br />
                {formatGoalTime(cSummary.investedSeconds)} invested
              </p>
            </div>

            {completedDays.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="font-mono text-xs text-[#333]">No goals finished yet</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto">
                {completedDays.map((day) => (
                  <div key={day.date} data-testid={`completed-day-${day.date}`}>
                    <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-1 mb-2">
                      <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">
                        {formatDayHeader(day.date)}
                      </span>
                      <span className="font-mono text-[10px] text-[#52525B] tabular-nums">
                        {day.count} {day.count === 1 ? "goal" : "goals"} · {formatGoalTime(day.investedSeconds)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {day.goals.map((g) => (
                        <div key={g.id} className="flex items-center gap-3 py-1" data-testid={`completed-goal-${g.id}`}>
                          <span className="text-[#00FF41] text-xs shrink-0">✓</span>
                          <span className="font-mono text-xs text-[#A1A1AA] flex-1 truncate">{g.label}</span>
                          <span className="font-mono text-[10px] text-[#00FF41] tabular-nums shrink-0">{formatGoalTime(g.doneSeconds || 0)}</span>
                          <span className="font-mono text-[10px] text-[#3f3f46] tabular-nums shrink-0 hidden sm:inline">{formatClock(g.doneAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
