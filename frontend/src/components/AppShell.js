import { useEffect, useRef, useState } from "react";
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
  CalendarClock,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Upload,
  Bell,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";
import { API } from "@/App";
import { exportAllData, importAllData } from "@/lib/dataExport";
import { pushAvailable, isPushEnabled, enablePush, disablePush } from "@/lib/push";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { id: "reports", label: "Reports", icon: BarChart3, path: "/reports" },
  { id: "ai-report", label: "AI Report", icon: Brain, path: "/ai-report" },
  { id: "projects", label: "Projects", icon: FolderOpen, path: "/projects" },
  { id: "schedules", label: "Schedules", icon: CalendarClock, path: "/schedules" },
  { id: "history", label: "History", icon: History, path: "/history" },
];

const SIDEBAR_KEY = "rc_sidebar_collapsed";

export default function AppShell({ children, user, activePage }) {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      // Logout is best-effort — if the network fails we still navigate to /login
      console.warn("Logout request failed:", err);
    }
    navigate("/login");
  };

  const handleNav = (path) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const importInputRef = useRef(null);

  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    if (pushAvailable()) isPushEnabled().then(setPushOn);
  }, []);

  const togglePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
        toast.success("Push nudges off");
      } else {
        await enablePush();
        setPushOn(true);
        toast.success("Push nudges on — evening reconcile + streak alerts");
      }
    } catch (err) {
      toast.error(err.message || "Push setup failed");
    }
    setPushBusy(false);
  };

  const pushButton = (testPrefix) =>
    pushAvailable() ? (
      <button
        onClick={togglePush}
        disabled={pushBusy}
        data-testid={`${testPrefix}-push-toggle`}
        title={pushOn ? "Disable push nudges on this device" : "Get an evening reconcile nudge and streak-at-risk alerts, even with the app closed"}
        className={`w-full flex items-center justify-center gap-2 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors duration-75 disabled:opacity-50 ${
          pushOn ? "text-[#00FF41] hover:text-[#00CC33]" : "text-[#52525B] hover:text-[#A1A1AA]"
        }`}
      >
        {pushOn ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
        {pushOn ? "Nudges on" : "Nudges off"}
      </button>
    ) : null;

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (!window.confirm("Importing replaces ALL current data (including cloud sync). Continue?")) return;
    try {
      await importAllData(file); // reloads the page on success
    } catch (err) {
      toast.error(err.message || "Import failed");
    }
  };

  const dataButtons = (testPrefix) => (
    <div className="flex items-center gap-1">
      <button
        onClick={exportAllData}
        data-testid={`${testPrefix}-export-btn`}
        title="Download all data as JSON"
        className="flex-1 flex items-center justify-center gap-2 py-2 font-mono text-[10px] uppercase tracking-widest text-[#52525B] hover:text-[#00FF41] transition-colors duration-75"
      >
        <Download className="w-3 h-3" />
        Export
      </button>
      <button
        onClick={() => importInputRef.current?.click()}
        data-testid={`${testPrefix}-import-btn`}
        title="Restore from a JSON export (replaces all data)"
        className="flex-1 flex items-center justify-center gap-2 py-2 font-mono text-[10px] uppercase tracking-widest text-[#52525B] hover:text-[#00FF41] transition-colors duration-75"
      >
        <Upload className="w-3 h-3" />
        Import
      </button>
    </div>
  );

  return (
    <div className="app-shell-bg min-h-screen bg-[#050505] flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="app-mobile-header md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-50" data-testid="mobile-header">
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
        <div className="app-mobile-menu md:hidden fixed inset-0 top-[49px] z-40 backdrop-blur-sm" data-testid="mobile-menu-overlay">
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
              <div className="px-4 mb-2">
                {pushButton("mobile")}
                {dataButtons("mobile")}
              </div>
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
      <aside className={`app-sidebar hidden md:flex shrink-0 border-r flex-col h-screen sticky top-0 transition-[width] duration-150 ${collapsed ? "w-16" : "w-56"}`} data-testid="sidebar">
        {/* Logo + collapse toggle */}
        <div className={`border-b border-[#12301D] flex items-center ${collapsed ? "justify-center p-4" : "justify-between p-5"}`}>
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-[#00FF41]" />
              <span className="font-heading text-lg font-bold tracking-tighter uppercase text-[#EDEDED]">
                Reality<span className="text-[#00FF41]">Check</span>
              </span>
            </div>
          )}
          <button
            onClick={toggleCollapsed}
            data-testid="sidebar-toggle"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-[#52525B] hover:text-[#EDEDED] transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
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
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors duration-75 ${
                  collapsed ? "justify-center px-0" : "px-3 border-l-2"
                } ${
                  isActive
                    ? `text-[#00FF41] ${collapsed ? "" : "bg-[#00FF41]/5 border-[#00FF41]"}`
                    : `text-[#666] hover:text-[#A1A1AA] ${collapsed ? "" : "hover:bg-[#0A0A0A] border-transparent"}`
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>

        {/* User */}
        <div className={`border-t border-[#12301D] ${collapsed ? "p-3" : "p-4"}`} data-testid="user-section">
          <div className={`flex items-center mb-3 ${collapsed ? "justify-center" : "gap-3"}`}>
            <Avatar className="w-7 h-7">
              <AvatarImage src={user?.picture} />
              <AvatarFallback className="bg-[#262626] text-[#EDEDED] font-mono text-[10px]">
                {user?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-[#EDEDED] truncate">
                  {user?.name || "User"}
                </p>
                <p className="font-mono text-[10px] text-[#52525B] truncate">
                  {user?.email || ""}
                </p>
              </div>
            )}
          </div>
          {!collapsed && pushButton("sidebar")}
          {!collapsed && dataButtons("sidebar")}
          <button
            onClick={handleLogout}
            data-testid="logout-btn"
            title={collapsed ? "Logout" : undefined}
            className={`w-full flex items-center gap-2 py-2 font-mono text-[10px] uppercase tracking-widest text-[#52525B] hover:text-[#FF003C] transition-colors duration-75 ${collapsed ? "justify-center px-0" : "px-3"}`}
          >
            <LogOut className="w-3 h-3" />
            {!collapsed && "Logout"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 lg:p-10 overflow-auto min-w-0">
        {children}
      </main>

      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        className="hidden"
        data-testid="import-file-input"
      />
    </div>
  );
}
