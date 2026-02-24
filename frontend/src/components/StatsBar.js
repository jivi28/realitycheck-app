import { Clock, Zap, Coffee, Moon } from "lucide-react";

export default function StatsBar({ dailyData }) {
  const productive = dailyData?.productive_seconds || 0;
  const breakTime = dailyData?.break_seconds || 0;
  const scheduled = dailyData?.scheduled_seconds || 0;
  const total = productive + breakTime + scheduled;
  const awakeHours = 16;

  const formatHours = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    if (s > 0) return `${s}s`;
    return "0m";
  };

  const realityScore =
    awakeHours > 0
      ? Math.round((productive / 3600 / awakeHours) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4" data-testid="stats-bar">
      {/* Productive Time */}
      <div className="bg-[#0A0A0A] border border-[#333] p-3 md:p-4" data-testid="stat-productive">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          <Zap className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#00FF41]" />
          <span className="font-mono text-[9px] md:text-[10px] text-[#52525B] uppercase tracking-widest">
            Productive
          </span>
        </div>
        <p className="font-heading text-xl md:text-2xl font-bold text-[#00FF41]">
          {formatHours(productive)}
        </p>
      </div>

      {/* Break Time */}
      <div className="bg-[#0A0A0A] border border-[#333] p-3 md:p-4" data-testid="stat-break">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          <Coffee className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#52525B]" />
          <span className="font-mono text-[9px] md:text-[10px] text-[#52525B] uppercase tracking-widest">
            Unaccounted
          </span>
        </div>
        <p className="font-heading text-xl md:text-2xl font-bold text-[#52525B]">
          {formatHours(breakTime)}
        </p>
      </div>

      {/* Total Logged */}
      <div className="bg-[#0A0A0A] border border-[#333] p-3 md:p-4" data-testid="stat-total">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#A1A1AA]" />
          <span className="font-mono text-[9px] md:text-[10px] text-[#52525B] uppercase tracking-widest">
            Total
          </span>
        </div>
        <p className="font-heading text-xl md:text-2xl font-bold text-[#EDEDED]">
          {formatHours(total)}
        </p>
      </div>

      {/* Reality Score */}
      <div className="bg-[#0A0A0A] border border-[#333] p-3 md:p-4" data-testid="stat-reality-score">
        <div className="flex items-center gap-2 mb-1.5 md:mb-2">
          <span className="font-mono text-[9px] md:text-[10px] text-[#52525B] uppercase tracking-widest">
            Reality
          </span>
        </div>
        <p
          className={`font-heading text-2xl font-bold ${
            realityScore >= 50
              ? "text-[#00FF41]"
              : realityScore >= 25
              ? "text-[#FFD600]"
              : "text-[#FF003C]"
          }`}
        >
          {realityScore}%
        </p>
        <div className="w-full h-1 bg-[#1A1A1A] mt-2">
          <div
            className="h-full bg-[#00FF41] transition-all duration-500"
            style={{ width: `${Math.min(realityScore, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
