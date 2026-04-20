import { useEffect, useRef, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import AuthCallback from "@/pages/AuthCallback";
import DashboardPage from "@/pages/DashboardPage";
import ReportsPage from "@/pages/ReportsPage";
import AIReportPage from "@/pages/AIReportPage";
import ProjectsPage from "@/pages/ProjectsPage";
import HistoryPage from "@/pages/HistoryPage";
import SchedulesPage from "@/pages/SchedulesPage";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export { API, BACKEND_URL };

function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.user) {
      setUser(location.state.user);
      setIsAuthenticated(true);
      return;
    }
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API}/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error("Not authenticated");
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } catch (err) {
        // Not authenticated — silently redirect to login
        console.warn("Auth check failed, redirecting to login:", err?.message);
        setIsAuthenticated(false);
        navigate("/login");
      }
    };
    checkAuth();
  }, [navigate, location.state]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-[#00FF41] font-mono text-sm tracking-widest uppercase animate-pulse">
          Initializing...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return typeof children === "function" ? children({ user }) : children;
}

function AppRouter() {
  const location = useLocation();

  // CRITICAL: Detect session_id synchronously during render
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {({ user }) => <DashboardPage user={user} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {({ user }) => <DashboardPage user={user} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            {({ user }) => <ReportsPage user={user} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-report"
        element={
          <ProtectedRoute>
            {({ user }) => <AIReportPage user={user} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            {({ user }) => <ProjectsPage user={user} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            {({ user }) => <HistoryPage user={user} />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedules"
        element={
          <ProtectedRoute>
            {({ user }) => <SchedulesPage user={user} />}
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <div className="min-h-screen bg-[#050505]">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#0A0A0A",
            border: "1px solid #333",
            color: "#EDEDED",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "13px",
          },
        }}
      />
    </div>
  );
}

export default App;
