import { useState, useEffect, useCallback } from "react";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import ActiveTimer from "@/components/ActiveTimer";
import DailyTimeline from "@/components/DailyTimeline";
import StatsBar from "@/components/StatsBar";
import RecentEntries from "@/components/RecentEntries";

export default function DashboardPage({ user }) {
  const [currentTimer, setCurrentTimer] = useState(null);
  const [dailyData, setDailyData] = useState(null);
  const [todayEntries, setTodayEntries] = useState([]);
  const [projects, setProjects] = useState([]);

  const today = new Date().toISOString().split("T")[0];

  const fetchAll = useCallback(async () => {
    try {
      const [timerRes, dailyRes, entriesRes, projRes] = await Promise.all([
        fetch(`${API}/timer/current`, { credentials: "include" }),
        fetch(`${API}/analytics/daily?date=${today}`, { credentials: "include" }),
        fetch(`${API}/entries?date=${today}&limit=20`, { credentials: "include" }),
        fetch(`${API}/projects`, { credentials: "include" }),
      ]);

      const timerData = await timerRes.json();
      setCurrentTimer(timerData.running ? timerData : null);

      const daily = await dailyRes.json();
      setDailyData(daily);

      const entries = await entriesRes.json();
      setTodayEntries(entries);

      const projs = await projRes.json();
      setProjects(projs);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  }, [today]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const handleTimerStart = async (description, projectId) => {
    try {
      const res = await fetch(`${API}/timer/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description, project_id: projectId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start timer");
      }
      await fetchAll();
    } catch (err) {
      throw err;
    }
  };

  const handleTimerStop = async () => {
    try {
      await fetch(`${API}/timer/stop`, {
        method: "POST",
        credentials: "include",
      });
      await fetchAll();
    } catch (err) {
      console.error("Failed to stop timer:", err);
    }
  };

  return (
    <AppShell user={user} activePage="dashboard">
      <div className="space-y-4 md:space-y-6">
        {/* Active Timer */}
        <ActiveTimer
          currentTimer={currentTimer}
          projects={projects}
          onStart={handleTimerStart}
          onStop={handleTimerStop}
        />

        {/* Stats */}
        <StatsBar dailyData={dailyData} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Timeline - 2 cols on lg */}
          <div className="lg:col-span-2">
            <DailyTimeline entries={dailyData?.entries || []} />
          </div>

          {/* Recent entries - 1 col */}
          <div>
            <RecentEntries entries={todayEntries} onRefresh={fetchAll} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
