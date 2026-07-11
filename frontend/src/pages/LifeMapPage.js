import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import LifeMapPanel from "@/components/LifeMapPanel";
import { normalizeGoal, persistGoals, readGoals, todayStr } from "@/lib/goals";

export default function LifeMapPage({ user }) {
  const [projects, setProjects] = useState([]);
  const [entries, setEntries] = useState([]);
  const [currentTimer, setCurrentTimer] = useState(null);
  const [, setTick] = useState(0);

  const fetchContext = useCallback(async () => {
    try {
      const [projectsRes, entriesRes, timerRes] = await Promise.all([
        fetch(`${API}/projects`, { credentials: "include" }),
        fetch(`${API}/entries?limit=5000`, { credentials: "include" }),
        fetch(`${API}/timer/current`, { credentials: "include" }),
      ]);
      const [projectData, entryData, timerData] = await Promise.all([
        projectsRes.json(),
        entriesRes.json(),
        timerRes.json(),
      ]);
      setProjects(Array.isArray(projectData) ? projectData : []);
      setEntries(Array.isArray(entryData) ? entryData : []);
      setCurrentTimer(timerData.running ? timerData : null);
    } catch (error) {
      console.error("Failed to load Life Map context:", error);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  useEffect(() => {
    if (!currentTimer) return undefined;
    const interval = window.setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(interval);
  }, [currentTimer]);

  const createDashboardGoal = (label, projectId = null) => {
    const cleanLabel = label.trim();
    if (!cleanLabel) return;
    const goals = readGoals();
    persistGoals([
      ...goals,
      normalizeGoal({
        id: `life_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: cleanLabel,
        targetHours: 1,
        projectId: projectId || null,
        carryOver: true,
        startDate: todayStr(),
        startAt: new Date().toISOString(),
      }),
    ]);
    toast.success("Added to dashboard Goals");
  };

  return (
    <AppShell user={user} activePage="life-map">
      <div className="space-y-4 md:space-y-6 max-w-6xl">
        <div>
          <h1 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold tracking-tight uppercase text-[#EDEDED]">
            Life Map
          </h1>
          <p className="font-mono text-[11px] text-[#52525B] mt-1">
            Direction and milestones live here. Your dashboard stays focused on what to do today.
          </p>
        </div>
        <LifeMapPanel
          projects={projects}
          entries={entries}
          currentTimer={currentTimer}
          onCreateGoal={createDashboardGoal}
        />
      </div>
    </AppShell>
  );
}
