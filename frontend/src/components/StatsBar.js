import { Clock, Heart, MinusCircle, Moon, MoonStar } from "lucide-react";
import { CATEGORIES, projectCategory } from "@/lib/categories";

const AWAKE_HOURS = 16;

export default function StatsBar({ dailyData, currentTimer, projects = [] }) {
  const baseProductive = dailyData?.productive_seconds || 0;
  const breakTime = dailyData?.break_seconds || 0;
  const scheduled = dailyData?.scheduled_seconds || 0;

  // Live elapsed: while a real (non-break) timer runs, count it toward
  // "on purpose" in real time. StatsBar re-renders each second via its parent.
  const liveElapsed =
    currentTimer && !currentTimer.is_break
      ? Math.max(0, Math.floor((Date.now() - new Date(currentTimer.start_time).getTime()) / 1000))
      : 0;
  const onPurpose = baseProductive + liveElapsed;

  const tracked = onPurpose + breakTime + scheduled;
  const awakeSeconds = AWAKE_HOURS * 3600;
  const untracked = Math.max(0, awakeSeconds - tracked);

  // Per-category breakdown of "on purpose" time (today's task entries + live timer)
  const projectsById = Object.fromEntries(projects.map((p) => [p.project_id, p]));
  const catSeconds = {};
  for (const e of dailyData?.entries || []) {
    if (e.is_break || e.entry_type === "break" || e.entry_type === "scheduled") continue;
    const cat = projectCategory(projectsById[e.project_id]);
    catSeconds[cat] = (catSeconds[cat] || 0) + (e.duration || 0);
  }
  if (liveElapsed > 0) {
    const cat = projectCategory(projectsById[currentTimer.project_id]);
    catSeconds[cat] = (catSeconds[cat] || 0) + liveElapsed;
  }
  const breakdown = CATEGORIES.filter((c) => catSeconds[c.id] > 0);

  const formatHours = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    if (s > 0) return `${s}s`;
    return "0m";
  };

  const realityScore = AWAKE_HOURS > 0 ? Math.round((onPurpose / 3600 / AWAKE_HOURS) * 100) : 0;
  const scoreColor = realityScore >= 50 ? "#00FF41" : realityScore >= 25 ? "#FFD600" : "#FF003C";
  const isLive = liveElapsed > 0;

  return (
    <div className="space-y-3" data-testid="stats-bar">
      {/* Reality Score Headline */}
      <div className="bg-[#0A0A0A] border border-[#333] p-5 text-center" data-testid="stat-reality-score">
        <div className="flex items-center justify-center gap-2 mb-1">
          <p className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">Reality Score</p>
          {isLive && (
            <span className="font-mono text-[9px] text-[#00FF41] uppercase tracking-widest animate-pulse">● live</span>
          )}
        </div>
        <p className="font-heading text-5xl font-bold" style={{ color: scoreColor }}>
          {realityScore}%
        </p>
        <p className="font-mono text-[10px] text-[#71717A] mt-1.5">
          {formatHours(onPurpose)} lived on purpose of {AWAKE_HOURS}h awake
        </p>
        <div className="w-full h-1.5 bg-[#1A1A1A] mt-3 max-w-xs mx-auto">
          <div
            className="h-full transition-all duration-500"
            style={{ width: `${Math.min(realityScore, 100)}%`, backgroundColor: scoreColor }}
          />
        </div>
      </div>

      {/* 4 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-[#0A0A0A] border border-[#333] p-3 md:p-4" data-testid="stat-productive">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <Heart className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#00FF41]" />
            <span className="font-mono text-[9px] md:text-[10px] text-[#71717A] uppercase tracking-widest">On purpose</span>
          </div>
          <p className="font-heading text-xl md:text-2xl font-bold text-[#00FF41]">{formatHours(onPurpose)}</p>
          <p className="font-mono text-[9px] text-[#52525B] mt-1">tracked, on purpose</p>
        </div>

        <div className="bg-[#0A0A0A] border border-[#333] p-3 md:p-4" data-testid="stat-break">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <MinusCircle className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#71717A]" />
            <span className="font-mono text-[9px] md:text-[10px] text-[#71717A] uppercase tracking-widest">Drifted</span>
          </div>
          <p className="font-heading text-xl md:text-2xl font-bold text-[#A1A1AA]">{formatHours(breakTime)}</p>
          <p className="font-mono text-[9px] text-[#52525B] mt-1">untracked gaps</p>
        </div>

        <div className="bg-[#0A0A0A] border border-[#333] p-3 md:p-4" data-testid="stat-scheduled">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <Moon className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#60A5FA]" />
            <span className="font-mono text-[9px] md:text-[10px] text-[#71717A] uppercase tracking-widest">Committed</span>
          </div>
          <p className="font-heading text-xl md:text-2xl font-bold text-[#60A5FA]">{formatHours(scheduled)}</p>
          <p className="font-mono text-[9px] text-[#52525B] mt-1">scheduled commitments</p>
        </div>

        <div className="bg-[#0A0A0A] border border-[#333] p-3 md:p-4" data-testid="stat-total">
          <div className="flex items-center gap-2 mb-1.5 md:mb-2">
            <Clock className="w-3 h-3 md:w-3.5 md:h-3.5 text-[#EDEDED]" />
            <span className="font-mono text-[9px] md:text-[10px] text-[#71717A] uppercase tracking-widest">Tracked</span>
          </div>
          <p className="font-heading text-xl md:text-2xl font-bold text-[#EDEDED]">{formatHours(tracked)}</p>
          <p className="font-mono text-[9px] text-[#52525B] mt-1">on purpose + gaps + committed</p>
        </div>
      </div>

      {/* Category breakdown of on-purpose time */}
      {breakdown.length > 0 && (
        <div className="bg-[#0A0A0A] border border-[#333] px-4 py-2.5 flex items-center gap-x-4 gap-y-1.5 flex-wrap" data-testid="category-breakdown">
          <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">On purpose</span>
          {breakdown.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums" style={{ color: c.color }}>
              <span className="w-2 h-2" style={{ backgroundColor: c.color }} />
              {c.label} {formatHours(catSeconds[c.id])}
            </span>
          ))}
        </div>
      )}

      {/* Untracked remainder of the awake day */}
      <div className="bg-[#0A0A0A] border border-[#333] px-4 py-2.5 flex items-center justify-between" data-testid="stat-untracked">
        <div className="flex items-center gap-2">
          <MoonStar className="w-3 h-3 text-[#52525B]" />
          <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">
            Untracked of {AWAKE_HOURS}h awake
          </span>
        </div>
        <span className="font-mono text-xs font-bold text-[#A1A1AA] tabular-nums">{formatHours(untracked)}</span>
      </div>
    </div>
  );
}
