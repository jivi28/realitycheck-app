import { useState, useEffect } from "react";
import { API } from "@/App";
import AppShell from "@/components/AppShell";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, categoryMeta, projectCategory } from "@/lib/categories";
import { PROJECT_ICONS, projectIconComp } from "@/lib/projectIcons";

const PRESET_COLORS = [
  "#00FF41", "#00CC33", "#33FF66", "#FFD600", "#00BFFF",
  "#FF003C", "#FF6B00", "#B388FF", "#00E5FF", "#FFFFFF",
];

export default function ProjectsPage({ user }) {
  const [projects, setProjects] = useState([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#00FF41");
  const [newCategory, setNewCategory] = useState("focus");
  const [newIcon, setNewIcon] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editCategory, setEditCategory] = useState("focus");
  const [editIcon, setEditIcon] = useState(null);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/projects`, { credentials: "include" });
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  const createProject = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch(`${API}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName.trim(), color: newColor, category: newCategory, icon: newIcon }),
      });
      if (!res.ok) throw new Error("Failed to create");
      setNewName(""); setNewCategory("focus"); setNewIcon(null);
      toast.success("Project created");
      fetchProjects();
    } catch (err) {
      toast.error("Failed to create project");
    }
  };

  const updateProject = async (id) => {
    try {
      await fetch(`${API}/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName, color: editColor, category: editCategory, icon: editIcon }),
      });
      setEditingId(null);
      toast.success("Project updated");
      fetchProjects();
    } catch (err) {
      toast.error("Failed to update project");
    }
  };

  const deleteProject = async (id) => {
    try {
      await fetch(`${API}/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      toast.success("Project deleted");
      fetchProjects();
    } catch (err) {
      toast.error("Failed to delete project");
    }
  };

  const startEdit = (project) => {
    setEditingId(project.project_id);
    setEditName(project.name);
    setEditColor(project.color);
    setEditCategory(projectCategory(project));
    setEditIcon(project.icon || null);
  };

  return (
    <AppShell user={user} activePage="projects">
      <div className="space-y-4 md:space-y-6 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="font-heading text-xl md:text-2xl lg:text-3xl font-bold tracking-tight uppercase text-[#EDEDED]">
            Projects
          </h1>
          <p className="font-mono text-xs text-[#52525B] uppercase tracking-wider mt-1">
            Categorize your work
          </p>
        </div>

        {/* Create new */}
        <div className="bg-[#0A0A0A] border border-[#333] p-4 md:p-6" data-testid="create-project-form">
          <p className="font-mono text-[10px] text-[#52525B] uppercase tracking-widest mb-4">
            New Project
          </p>
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name..."
              data-testid="new-project-name-input"
              className="w-full bg-transparent border-b border-[#333] focus:border-[#00FF41] px-0 py-3 font-mono text-sm text-[#EDEDED] placeholder:text-[#333] outline-none transition-colors"
              onKeyDown={(e) => e.key === "Enter" && createProject()}
            />
            <div className="flex flex-wrap gap-1.5" data-testid="new-project-category">
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.Icon;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setNewCategory(cat.id)}
                    title={cat.hint}
                    className={`flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                      newCategory === cat.id ? "text-[#EDEDED]" : "border-[#222] text-[#52525B] hover:text-[#A1A1AA]"
                    }`}
                    style={newCategory === cat.id ? { borderColor: cat.color, color: cat.color } : undefined}
                  >
                    <CatIcon className="w-3 h-3" style={{ color: cat.color }} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
            {/* Icon picker */}
            <div className="flex flex-wrap gap-1.5" data-testid="new-project-icon">
              {PROJECT_ICONS.map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => setNewIcon(newIcon === key ? null : key)}
                  title={key}
                  className={`w-7 h-7 flex items-center justify-center border transition-colors ${
                    newIcon === key ? "border-current" : "border-[#222] text-[#52525B] hover:text-[#A1A1AA]"
                  }`}
                  style={newIcon === key ? { color: newColor } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    data-testid={`color-${c}`}
                    className={`w-6 h-6 transition-transform duration-75 ${
                      newColor === c ? "scale-125 ring-1 ring-white" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={createProject}
                data-testid="create-project-btn"
                className="flex items-center gap-2 bg-[#00FF41] text-black font-mono text-xs font-bold uppercase tracking-wider px-4 py-2.5 hover:bg-[#00CC33] transition-colors duration-75 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-2" data-testid="project-list">
          {projects.map((project) => (
            <div
              key={project.project_id}
              className="bg-[#0A0A0A] border border-[#222] p-4 flex items-center gap-4 group hover:border-[#444] transition-colors duration-75"
              data-testid={`project-item-${project.project_id}`}
            >
              {editingId === project.project_id ? (
                <>
                  <div
                    className="w-4 h-4 shrink-0"
                    style={{ backgroundColor: editColor }}
                  />
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-transparent border-b border-[#00FF41] px-0 py-1 font-mono text-sm text-[#EDEDED] outline-none"
                    data-testid="edit-project-name-input"
                  />
                  <div className="flex gap-1">
                    {PRESET_COLORS.slice(0, 5).map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditColor(c)}
                        className={`w-4 h-4 ${editColor === c ? "ring-1 ring-white" : ""}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    data-testid="edit-project-category"
                    className="bg-[#0A0A0A] border border-[#333] font-mono text-[11px] text-[#A1A1AA] px-2 py-1 outline-none"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                  <div className="flex gap-1 max-w-[160px] overflow-x-auto" data-testid="edit-project-icon">
                    {PROJECT_ICONS.map(({ key, Icon }) => (
                      <button
                        key={key}
                        onClick={() => setEditIcon(editIcon === key ? null : key)}
                        title={key}
                        className={`w-6 h-6 shrink-0 flex items-center justify-center border ${editIcon === key ? "border-current" : "border-[#222] text-[#52525B] hover:text-[#A1A1AA]"}`}
                        style={editIcon === key ? { color: editColor } : undefined}
                      >
                        <Icon className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => updateProject(project.project_id)}
                    data-testid="save-project-btn"
                    className="text-[#00FF41] hover:text-[#00CC33]"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    data-testid="cancel-edit-btn"
                    className="text-[#666] hover:text-[#999]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  {(() => {
                    const PIcon = projectIconComp(project.icon);
                    return PIcon
                      ? <PIcon className="w-4 h-4 shrink-0" style={{ color: project.color }} />
                      : <div className="w-4 h-4 shrink-0" style={{ backgroundColor: project.color }} />;
                  })()}
                  <span className="font-mono text-sm text-[#EDEDED]">
                    {project.name}
                  </span>
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border"
                    style={{ color: categoryMeta(projectCategory(project)).color, borderColor: `${categoryMeta(projectCategory(project)).color}40` }}
                  >
                    {categoryMeta(projectCategory(project)).label}
                  </span>
                  <span className="flex-1" />
                  {project.is_default && (
                    <span className="font-mono text-[10px] text-[#00FF41] uppercase tracking-wider border border-[#00FF41]/30 px-2 py-0.5">
                      Default
                    </span>
                  )}
                  <button
                    onClick={() => startEdit(project)}
                    data-testid={`edit-project-${project.project_id}`}
                    className="opacity-0 group-hover:opacity-100 text-[#666] hover:text-[#EDEDED] transition-opacity duration-75"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteProject(project.project_id)}
                    data-testid={`delete-project-${project.project_id}`}
                    className="opacity-0 group-hover:opacity-100 text-[#666] hover:text-[#FF003C] transition-opacity duration-75"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
