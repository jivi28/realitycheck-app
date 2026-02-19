import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Brain,
  FolderOpen,
  History,
  LogOut,
  Monitor,
  Menu,
  X,
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    navigate("/login");
  };

  const handleNav = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#1A1A1A] bg-[#050505] sticky top-0 z-50" data-testid="mobile-header">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-[#00FF41]" />
          <span className="font-heading text-base font-bold tracking-tighter uppercase text-[#EDEDED]">
            Reality<span className="text-[#00FF41]">Check</span>
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          data-testid="mobile-menu-toggle"
          className="p-2 text-[#A1A1AA] hover:text-[#EDEDED]"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Overlay Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-[49px] z-40 bg-[#050505]/95 backdrop-blur-sm" data-testid="mobile-menu-overlay">
          <nav className="flex flex-col p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNav(item.path)}
                  data-testid={`mobile-nav-${item.id}`}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-mono text-sm uppercase tracking-wider transition-colors duration-75 ${
                    isActive
                      ? "text-[#00FF41] bg-[#00FF41]/5 border-l-2 border-[#00FF41]"
                      : "text-[#A1A1AA] hover:text-[#EDEDED] hover:bg-[#0A0A0A] border-l-2 border-transparent"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
            <div className="border-t border-[#1A1A1A] pt-4 mt-4">
              <div className="flex items-center gap-3 px-4 mb-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user?.picture} />
                  <AvatarFallback className="bg-[#262626] text-[#EDEDED] font-mono text-xs">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-[#EDEDED] truncate">{user?.name || "User"}</p>
                  <p className="font-mono text-[10px] text-[#52525B] truncate">{user?.email || ""}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                data-testid="mobile-logout-btn"
                className="w-full flex items-center gap-3 px-4 py-3 font-mono text-sm uppercase tracking-wider text-[#52525B] hover:text-[#FF003C]"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 border-r border-[#1A1A1A] bg-[#050505] flex-col h-screen sticky top-0" data-testid="sidebar">
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
      <main className="flex-1 p-4 md:p-6 lg:p-10 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
