import { useState, useEffect, lazy, Suspense } from "react";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import { Calendar } from "lucide-react";

// Dynamic imports to avoid babel-metadata-plugin crash on recharts
const WeeklyBarChart = lazy(() => import("@/components/WeeklyBarChart"));
const ProjectPieChart = lazy(() => import("@/components/ProjectPieChart"));

export default function ReportsPage({ user }) {
  const [weeklyData, setWeeklyData] = useState(null);
  const [projectData, setProjectData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [weeklyRes, projectRes] = await Promise.all([
          fetch(`${API}/analytics/weekly`, { credentials: "include" }),
          fetch(`${API}/analytics/projects?date=${selectedDate}`, {
            credentials: "include",
          }),
        ]);
        const weekly = await weeklyRes.json();
        setWeeklyData(weekly);
        const projects = await projectRes.json();
        setProjectData(projects);
      } catch (err) {
        console.error("Failed to fetch reports:", err);
      }
    };
    fetchData();
  }, [selectedDate]);

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
              Today
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
      </div>
    </AppShell>
  );
}
