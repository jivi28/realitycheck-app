import { useState, useRef, useEffect } from "react";
import { Play, Pencil, Trash2, Check, X, ChevronDown } from "lucide-react";
import { CATEGORIES, projectCategory } from "@/lib/categories";
import { PROJECT_ICONS, projectIconComp } from "@/lib/projectIcons";

const PRESET_COLORS = [
  "#00FF41", "#00CC33", "#33FF66", "#FFD600", "#00BFFF",
  "#FF003C", "#FF6B00", "#B388FF", "#00E5FF", "#FFFFFF",
];

/**
 * A project pill that opens a small menu: start/continue tracking,
 * inline rename + recolor, and delete (with inline confirm — never a
 * browser confirm dialog, which would freeze the page).
 */
export default function ProjectChip({ project, startLabel, onStart, onUpdate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color);
  const [category, setCategory] = useState(projectCategory(project));
  const [icon, setIcon] = useState(project.icon || null);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) closeAll();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeAll = () => {
    setOpen(false);
    setEditing(false);
    setConfirmDelete(false);
  };

  const beginEdit = () => {
    setName(project.name);
    setColor(project.color);
    setCategory(projectCategory(project));
    setIcon(project.icon || null);
    setEditing(true);
    setConfirmDelete(false);
  };

  const saveEdit = () => {
    if (!name.trim()) return;
    onUpdate(project.project_id, { name: name.trim(), color, category, icon });
    closeAll();
  };

  const ChipIcon = projectIconComp(project.icon);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid={`project-chip-${project.project_id}`}
        className={`flex items-center gap-1.5 border bg-[#0A0A0A] px-3 py-1.5 font-mono text-xs transition-colors ${
          open ? "border-[#555] text-[#EDEDED]" : "border-[#333] text-[#A1A1AA] hover:border-[#555] hover:text-[#EDEDED]"
        }`}
      >
        {ChipIcon
          ? <ChipIcon className="w-3 h-3 shrink-0" style={{ color: project.color }} />
          : <div className="w-2 h-2 shrink-0" style={{ backgroundColor: project.color }} />}
        {project.name}
        <ChevronDown className="w-3 h-3 text-[#52525B]" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-[#0A0A0A] border border-[#333] z-50 shadow-lg" data-testid={`project-menu-${project.project_id}`}>
          {editing ? (
            <div className="p-3 space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] py-1 font-mono text-xs text-[#EDEDED] outline-none transition-colors"
              />
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 transition-transform ${color === c ? "scale-110 ring-1 ring-white" : "hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((cat) => {
                  const CatIcon = cat.Icon;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setCategory(cat.id)}
                      title={cat.hint}
                      className={`flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${
                        category === cat.id ? "" : "border-[#222] text-[#52525B] hover:text-[#A1A1AA]"
                      }`}
                      style={category === cat.id ? { borderColor: cat.color, color: cat.color } : undefined}
                    >
                      <CatIcon className="w-2.5 h-2.5" style={{ color: cat.color }} />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-1" data-testid="chip-icon-picker">
                {PROJECT_ICONS.map(({ key, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setIcon(icon === key ? null : key)}
                    title={key}
                    className={`w-5 h-5 flex items-center justify-center border transition-colors ${icon === key ? "border-current" : "border-[#222] text-[#52525B] hover:text-[#A1A1AA]"}`}
                    style={icon === key ? { color } : undefined}
                  >
                    <Icon className="w-3 h-3" />
                  </button>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={saveEdit}
                  className="flex items-center gap-1 bg-[#00FF41] text-black font-mono text-[10px] font-bold uppercase tracking-wider px-3 py-1 hover:bg-[#00CC33] transition-colors"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1 font-mono text-[10px] text-[#A1A1AA] hover:text-[#EDEDED] uppercase tracking-wider px-2 py-1 border border-[#333] transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => { onStart(project); closeAll(); }}
                data-testid={`chip-start-${project.project_id}`}
                className="w-full flex items-center gap-2 px-3 py-2.5 font-mono text-xs text-[#EDEDED] hover:bg-[#1A1A1A] transition-colors"
              >
                <Play className="w-3 h-3 text-[#00FF41]" />
                {startLabel} tracking
              </button>
              <button
                onClick={beginEdit}
                data-testid={`chip-edit-${project.project_id}`}
                className="w-full flex items-center gap-2 px-3 py-2.5 font-mono text-xs text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-[#EDEDED] transition-colors border-t border-[#1A1A1A]"
              >
                <Pencil className="w-3 h-3" /> Rename / recolor
              </button>
              <button
                onClick={() => {
                  if (confirmDelete) { onDelete(project.project_id); closeAll(); }
                  else setConfirmDelete(true);
                }}
                data-testid={`chip-delete-${project.project_id}`}
                className={`w-full flex items-center gap-2 px-3 py-2.5 font-mono text-xs transition-colors border-t border-[#1A1A1A] ${
                  confirmDelete ? "text-[#FF003C] bg-[#FF003C]/10" : "text-[#A1A1AA] hover:bg-[#1A1A1A] hover:text-[#FF003C]"
                }`}
              >
                <Trash2 className="w-3 h-3" />
                {confirmDelete ? "Click again to confirm" : "Delete"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
