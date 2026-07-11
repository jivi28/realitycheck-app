import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import AuthCallback from "@/pages/AuthCallback";
import DashboardPage from "@/pages/DashboardPage";
import ReportsPage from "@/pages/ReportsPage";
import AIReportPage from "@/pages/AIReportPage";
import ProjectsPage from "@/pages/ProjectsPage";
import HistoryPage from "@/pages/HistoryPage";
import SchedulesPage from "@/pages/SchedulesPage";
import LifeMapPage from "@/pages/LifeMapPage";
import { installBrowserApi } from "@/lib/browserApi";

// Treat Vercel's auto-injected internal service path as no backend
const RAW_BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const BACKEND_URL = RAW_BACKEND_URL.startsWith("/_/") ? "" : RAW_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

if (!BACKEND_URL) {
    installBrowserApi();
}

export { API, BACKEND_URL };

const devUser = {
    user_id: "shared-workspace",
    email: "friends@realitycheck.app",
    name: "Shared Workspace",
    picture: "",
};

function ProtectedRoute({ children }) {
    return typeof children === "function" ? children({ user: devUser }) : children;
}

function AppRouter() {
    const location = useLocation();

    if (location.hash?.includes("session_id=")) {
        return <AuthCallback />;
    }

    return (
        <Routes>
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />

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
                path="/life-map"
                element={
                    <ProtectedRoute>
                        {({ user }) => <LifeMapPage user={user} />}
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

            <Toaster position="bottom-right" />
        </div>
    );
}

export default App;
