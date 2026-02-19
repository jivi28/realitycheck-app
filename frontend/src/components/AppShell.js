import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Brain,
  FolderOpen,
  History,
  LogOut,
  Monitor,
} from "lucide-react";
import { API } from "@/App";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { id: "reports", label: "Reports", icon: BarChart3, path: "/reports" },
  { id: "ai-report", label: "AI Report", icon: Brain, path: "/ai-report" },
  { id: "projects", label: "Projects", icon: FolderOpen, path: "/projects" },
  { id: "history", label: "History", icon: History, path: "/history" },
];

export default function AppShell({ children, user, activePage }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-[#1A1A1A] bg-[#050505] flex flex-col h-screen sticky top-0" data-testid="sidebar">
        {/* Logo */}
        <div className="p-5 border-b border-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-[#00FF41]" />
            <span className="font-heading text-lg font-bold tracking-tighter uppercase text-[#EDEDED]">
              Reality<span className="text-[#00FF41]">Check</span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1" data-testid="nav-menu">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                data-testid={`nav-${item.id}`}
                className={`w-full flex items-center gap-3 px-3 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors duration-75 ${
                  isActive
                    ? "text-[#00FF41] bg-[#00FF41]/5 border-l-2 border-[#00FF41]"
                    : "text-[#666] hover:text-[#A1A1AA] hover:bg-[#0A0A0A] border-l-2 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-[#1A1A1A]" data-testid="user-section">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-7 h-7">
              <AvatarImage src={user?.picture} />
              <AvatarFallback className="bg-[#262626] text-[#EDEDED] font-mono text-[10px]">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-mono text-xs text-[#EDEDED] truncate">
                {user?.name || "User"}
              </p>
              <p className="font-mono text-[10px] text-[#52525B] truncate">
                {user?.email || ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            className="w-full flex items-center gap-2 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-[#52525B] hover:text-[#FF003C] transition-colors duration-75"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 md:p-10 overflow-auto">
        {children}
      </main>
    </div>
  );
}
