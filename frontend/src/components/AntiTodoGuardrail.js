import { Ban, Compass } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AntiTodoGuardrail({ plan, onSelectAntiTodo }) {
  const navigate = useNavigate();
  const activeAntiTodos = (plan.antiTodos || []).filter((item) => item.active);
  const selected = activeAntiTodos.find((item) => item.id === plan.selectedAntiTodoId)
    || activeAntiTodos[0]
    || null;

  return (
    <section
      className="flex items-center gap-2 border border-[#333] bg-[#0A0A0A] px-3 py-2 min-w-0"
      data-testid="anti-todo-guardrail"
    >
      <Ban className="w-3.5 h-3.5 text-[#FF8C00] shrink-0" />
      <span className="font-mono text-[9px] text-[#71717A] uppercase tracking-wider shrink-0">Avoid today</span>
      {selected ? (
        <select
          value={selected.id}
          onChange={(event) => onSelectAntiTodo(event.target.value)}
          className="flex-1 min-w-0 bg-transparent border-0 font-mono text-[11px] text-[#FF8C00] outline-none"
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
    </section>
  );
}
