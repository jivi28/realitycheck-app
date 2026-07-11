import { useState } from "react";
import { Ban, Check, ChevronDown, ChevronRight, Compass, ListTodo, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { localDayStr } from "@/lib/dates";

const COLLAPSED_KEY = "rc_today_queue_collapsed";
const SLOTS = ["now", "next", "later"];

export default function TodayQueue({
  plan,
  projects,
  currentTimer,
  onUpdateSlot,
  onStartSlot,
  onCompleteSlot,
  onSelectAntiTodo,
}) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => {
    try { return window.localStorage.getItem(COLLAPSED_KEY) === "1"; } catch { return false; }
  });

  const activeAntiTodos = plan.antiTodos.filter((item) => item.active);
  const selectedAntiTodo = activeAntiTodos.find((item) => item.id === plan.selectedAntiTodoId)
    || activeAntiTodos[0]
    || null;
  const hasQueueItems = SLOTS.some((slot) => plan.queue[slot].label.trim());
  const carried = hasQueueItems && plan.lastTouchedDate && plan.lastTouchedDate < localDayStr();

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try { window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <section className="bg-[#0A0A0A] border border-[#333] p-3 space-y-3" data-testid="today-queue">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 min-w-0 text-left"
          title={collapsed ? "Expand Today Queue" : "Collapse Today Queue"}
          aria-expanded={!collapsed}
        >
          <ListTodo className="w-4 h-4 text-[#60A5FA] shrink-0" />
          <span className="font-mono text-[10px] text-[#A1A1AA] uppercase tracking-widest">Today Queue</span>
          {carried && (
            <span className="font-mono text-[8px] text-[#FF8C00] uppercase tracking-wider border border-[#FF8C00]/30 px-1.5 py-0.5">
              Carried forward
            </span>
          )}
        </button>
        <button
          onClick={toggleCollapsed}
          className="text-[#52525B] hover:text-[#EDEDED] transition-colors"
          title={collapsed ? "Expand Today Queue" : "Collapse Today Queue"}
          aria-label={collapsed ? "Expand Today Queue" : "Collapse Today Queue"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="space-y-2">
            {SLOTS.map((slot) => {
              const item = plan.queue[slot];
              const label = item.label.trim();
              const selectedProjectId = projects.some((project) => project.project_id === item.projectId)
                ? item.projectId
                : "";
              return (
                <div
                  key={slot}
                  className="grid grid-cols-[40px_minmax(0,1fr)_28px_28px] sm:grid-cols-[40px_minmax(0,1fr)_150px_28px_28px] items-center gap-2"
                  data-testid={`today-queue-${slot}`}
                >
                  <span className={`font-mono text-[9px] uppercase tracking-widest ${slot === "now" ? "text-[#00FF41]" : slot === "next" ? "text-[#60A5FA]" : "text-[#71717A]"}`}>
                    {slot}
                  </span>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(event) => onUpdateSlot(slot, { label: event.target.value })}
                    placeholder={`${slot} task`}
                    className="min-w-0 bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1 font-mono text-xs text-[#EDEDED] placeholder:text-[#3f3f46] outline-none transition-colors"
                    aria-label={`${slot} queue item`}
                    data-testid={`today-queue-${slot}-label`}
                  />
                  <select
                    value={selectedProjectId}
                    onChange={(event) => onUpdateSlot(slot, { projectId: event.target.value || null })}
                    className="col-start-2 col-span-3 sm:col-start-auto sm:col-span-1 min-w-0 bg-[#050505] border border-[#333] font-mono text-[10px] text-[#A1A1AA] px-2 py-1 outline-none"
                    aria-label={`${slot} project`}
                    title="Project used for scores and tracking"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.project_id} value={project.project_id}>{project.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onStartSlot(slot)}
                    disabled={!label}
                    className="col-start-3 row-start-1 sm:col-start-auto sm:row-start-auto w-7 h-7 flex items-center justify-center border border-[#333] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41] disabled:opacity-30 disabled:hover:border-[#333] disabled:hover:text-[#71717A] transition-colors"
                    title={currentTimer ? `Replace timer with ${label || slot}` : `Start ${label || slot}`}
                    aria-label={`Start ${slot} queue item`}
                    data-testid={`today-queue-${slot}-start`}
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => onCompleteSlot(slot)}
                    disabled={!label}
                    className="col-start-4 row-start-1 sm:col-start-auto sm:row-start-auto w-7 h-7 flex items-center justify-center border border-[#333] text-[#71717A] hover:border-[#00FF41] hover:text-[#00FF41] disabled:opacity-30 disabled:hover:border-[#333] disabled:hover:text-[#71717A] transition-colors"
                    title={`Complete ${slot} and advance the queue`}
                    aria-label={`Complete ${slot} queue item`}
                    data-testid={`today-queue-${slot}-done`}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#1A1A1A] flex items-center gap-2 min-w-0">
            <Ban className="w-3.5 h-3.5 text-[#FF8C00] shrink-0" />
            <span className="font-mono text-[9px] text-[#71717A] uppercase tracking-wider shrink-0">Avoid today</span>
            {selectedAntiTodo ? (
              <select
                value={selectedAntiTodo.id}
                onChange={(event) => onSelectAntiTodo(event.target.value)}
                className="flex-1 min-w-0 bg-transparent border-b border-[#333] focus:border-[#FF8C00] py-1 font-mono text-[11px] text-[#FF8C00] outline-none"
                aria-label="Avoid today"
                data-testid="today-anti-todo"
              >
                {activeAntiTodos.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            ) : (
              <button
                onClick={() => navigate("/life-map")}
                className="flex-1 min-w-0 text-left font-mono text-[11px] text-[#52525B] hover:text-[#FF8C00] transition-colors"
                data-testid="today-anti-todo-empty"
              >
                Set a guardrail
              </button>
            )}
            <button
              onClick={() => navigate("/life-map")}
              className="text-[#52525B] hover:text-[#A1A1AA] transition-colors shrink-0"
              title="Manage Anti-To-Dos in Life Map"
              aria-label="Manage Anti-To-Dos in Life Map"
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
