import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "@/App";

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      const hash = window.location.hash;
      const sessionId = hash.split("session_id=")[1];
      if (!sessionId) {
        navigate("/login");
        return;
      }

      try {
        const response = await fetch(`${API}/auth/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ session_id: sessionId }),
        });

        if (!response.ok) throw new Error("Session exchange failed");

        const user = await response.json();
        navigate("/dashboard", { state: { user }, replace: true });
      } catch (err) {
        console.error("Auth callback error:", err);
        navigate("/login");
      }
    };

    processSession();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-[#00FF41] font-mono text-sm tracking-widest uppercase animate-pulse">
        Authenticating...
      </div>
    </div>
  );
}
