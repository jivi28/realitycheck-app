import { useNavigate } from "react-router-dom";
import { Monitor } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "linear-gradient(#00FF41 1px, transparent 1px), linear-gradient(90deg, #00FF41 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative z-10 text-center px-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Monitor className="w-8 h-8 text-[#00FF41]" />
          <h1 className="font-heading text-4xl md:text-5xl font-bold tracking-tighter uppercase text-[#EDEDED]">
            Reality<span className="text-[#00FF41]">Check</span>
          </h1>
        </div>

        {/* Tagline */}
        <p className="font-mono text-sm text-[#A1A1AA] tracking-wide uppercase mb-2">
          Radical Transparency for High Achievers
        </p>
        <p className="font-mono text-xs text-[#52525B] max-w-md mx-auto mb-12 leading-relaxed">
          You overestimate your productive time. This app proves it.
          <br />
          Track every minute. Face the data. Get better.
        </p>

        {/* Login Card */}
        <div className="bg-[#0A0A0A] border border-[#333] p-8 max-w-sm mx-auto" data-testid="login-card">
          <p className="font-mono text-xs text-[#A1A1AA] uppercase tracking-widest mb-6">
            Sign in to begin
          </p>

          <button
            onClick={handleGoogleLogin}
            data-testid="google-login-button"
            className="w-full flex items-center justify-center gap-3 bg-white text-black font-mono text-sm font-bold uppercase tracking-wider py-3 px-6 border-none hover:bg-[#E0E0E0] transition-colors duration-75"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Footer */}
        <p className="font-mono text-[10px] text-[#333] mt-12 uppercase tracking-widest">
          Your default state is distracted. Prove otherwise.
        </p>
      </div>
    </div>
  );
}
