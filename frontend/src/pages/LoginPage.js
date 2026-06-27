import { useNavigate } from "react-router-dom";
import { Monitor } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const isLocalBackend = BACKEND_URL.includes("localhost") || BACKEND_URL.includes("127.0.0.1");

export default function LoginPage() {
    const navigate = useNavigate();

    const handleLogin = () => {
        if (isLocalBackend) {
            navigate("/dashboard", { replace: true });
            return;
        }

        const redirectUrl = window.location.origin + "/dashboard";
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    };

    return (
        <div className="login-screen min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
            {/* Grid background */}
            <div className="login-grid absolute inset-0" />
            <div className="login-scan absolute inset-0" />
            <div className="login-circuit absolute inset-x-0 top-0 h-px" />
            <div className="login-circuit login-circuit-bottom absolute inset-x-0 bottom-0 h-px" />

            <div className="login-corners absolute inset-6 md:inset-10 pointer-events-none">
                <span className="absolute left-0 top-0" />
                <span className="absolute right-0 top-0" />
                <span className="absolute bottom-0 left-0" />
                <span className="absolute bottom-0 right-0" />
            </div>

            <div className="login-content relative z-10 text-center px-6 w-full max-w-xl">
                {/* Logo */}
                <div className="login-logo flex items-center justify-center gap-3 mb-8">
                    <div className="login-icon-wrap">
                        <Monitor className="w-8 h-8 text-[#00FF41]" />
                    </div>
                    <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tighter uppercase text-[#EDEDED]">
                        Reality<span className="text-[#00FF41]">Check</span>
                    </h1>
                </div>

                {/* Tagline */}
                <p className="font-mono text-sm text-[#A1A1AA] tracking-wide uppercase mb-2">
                    Radical Transparency for High Achievers
                </p>
                <p className="login-support-copy font-mono text-xs text-[#808996] max-w-md mx-auto mb-12 leading-relaxed">
                    You think you live on purpose more than you do. This app shows the truth.
                    <br />
                    Track every minute — work and life. Face the data. Live better.
                </p>

                {/* Login Card */}
                <div className="login-card bg-[#0A0A0A] border border-[#333] p-8 max-w-sm mx-auto" data-testid="login-card">
                    <p className="font-mono text-xs text-[#A1A1AA] uppercase tracking-widest mb-6">
                        Sign in to begin
                    </p>

                    <button
                        onClick={handleLogin}
                        data-testid="continue-login-button"
                        className="login-button w-full flex items-center justify-center gap-3 bg-white text-black font-mono text-sm font-bold uppercase tracking-wider py-3 px-6 border-none hover:bg-[#E0E0E0] transition-colors duration-75"
                    >
                        {isLocalBackend ? "Continue" : "Sign in with Google"}
                    </button>
                </div>

                {/* Footer */}
                <p className="login-footer-copy font-mono text-[10px] text-[#6B7280] mt-12 uppercase tracking-widest">
                    Your default state is distracted. Prove otherwise.
                </p>
            </div>
        </div>
    );
}
