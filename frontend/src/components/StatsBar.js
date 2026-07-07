import { useState } from "react";
import { Heart, MinusCircle, Moon, MoonStar } from "lucide-react";
import { CATEGORIES, projectCategory } from "@/lib/categories";

const AWAKE_HOURS = 16;

// Resolve an entry's category: an explicit (reconciled) category wins, else fall
// back to its project's category.
function entryCategory(entry, projectsById) {
  return entry.category || projectCategory(projectsById[entry.project_id]);
}

function scoreColor(score) {
  if (score >= 50) return "#00FF41";
  if (score >= 25) return "#FFD600";
  return "#FF003C";
}

export default function StatsBar({ dailyData, currentTimer, projects = [], streak = null, onReconcile }) {
  const [activeBreakdown, setActiveBreakdown] = useState(null);
  const baseProductive = dailyData?.productive_seconds || 0;
  const breakTime = dailyData?.break_seconds || 0;
  const scheduled = dailyData?.scheduled_seconds || 0; // daytime commitments (in the awake day)
  const sleep = dailyData?.sleep_seconds || 0;          // overnight — outside the awake day
  const basePaused = dailyData?.paused_seconds || 0;

  // Live elapsed: the running entry's seconds, routed to the right bucket.
  const liveSeconds = currentTimer
    ? Math.max(0, Math.floor((Date.now() - new Date(currentTimer.start_time).getTime()) / 1000))
    : 0;
  const liveType = currentTimer ? (currentTimer.entry_type || (currentTimer.is_break ? "break" : "task")) : null;
  const liveElapsed = liveType === "task" ? liveSeconds : 0; // only real work counts as on purpose
  const livePaused = liveType === "pause" ? liveSeconds : 0;
  const onPurpose = baseProductive + liveElapsed;
  const paused = basePaused + livePaused;

  // Sleep stays outside the 16h awake day; daytime commitments count against it.
  const tracked = onPurpose + breakTime + paused + scheduled;
  const awakeSeconds = AWAKE_HOURS * 3600;
  const untracked = Math.max(0, awakeSeconds - tracked);
  const committed = scheduled + sleep;

  // Per-category breakdown of "on purpose" time (today's task entries + live timer)
  const projectsById = Object.fromEntries(projects.map((p) => [p.project_id, p]));
  const catSeconds = {};
  for (const e of dailyData?.entries || []) {
    if (e.is_break || e.entry_type === "break" || e.entry_type === "scheduled" || e.entry_type === "pause") continue;
    const cat = entryCategory(e, projectsById);
    catSeconds[cat] = (catSeconds[cat] || 0) + (e.duration || 0);
  }
  if (liveElapsed > 0) {
    const cat = entryCategory(currentTimer, projectsById);
    catSeconds[cat] = (catSeconds[cat] || 0) + liveElapsed;
  }
  const breakdown = CATEGORIES.filter((c) => catSeconds[c.id] > 0);
  const focusMeta = CATEGORIES.find((c) => c.id === "focus");

  const formatHours = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m`;
    if (s > 0) return `${s}s`;
    return "0m";
  };

  const isLive = liveElapsed > 0;
  const liveCategory = currentTimer && liveElapsed > 0 ? entryCategory(currentTimer, projectsById) : null;
  const focusSeconds = catSeconds.focus || 0;
  const realityScore = AWAKE_HOURS > 0 ? Math.round((onPurpose / 3600 / AWAKE_HOURS) * 100) : 0;
  const focusScore = AWAKE_HOURS > 0 ? Math.round((focusSeconds / 3600 / AWAKE_HOURS) * 100) : 0;
  const realityColor = scoreColor(realityScore);
  const focusColor = focusMeta?.color || "#00FF41";

  const ScoreCard = ({ title, score, seconds, color, subtitle, live, testid, streakSlot }) => (
    <div className="bg-[#0A0A0A] border border-[#333] p-5 text-center min-w-0" data-testid={testid}>
      <div className="flex items-center justify-center gap-2 mb-1 min-h-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#71717A]">{title}</span>
        {live && (
          <span className="font-mono text-[9px] text-[#00FF41] uppercase tracking-widest animate-pulse">● live</span>
        )}
      </div>
      <p className="font-heading text-5xl font-bold tabular-nums" style={{ color }}>
        {score}%
      </p>
      <p className="font-mono text-[10px] text-[#52525B] mt-1.5">
        <span className="text-[13px] font-bold tabular-nums" style={{ color }}>{formatHours(seconds)}</span>
        {" "}{subtitle} of {AWAKE_HOURS}h awake
      </p>
      <div className="w-full h-1.5 bg-[#1A1A1A] mt-3 max-w-xs mx-auto">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }}
        />
      </div>
      {streakSlot}
    </div>
  );

  return (
    <div className="space-y-3" data-testid="stats-bar">
      {/* Headline scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <ScoreCard
          title="Reality Score"
          score={realityScore}
          seconds={onPurpose}
          color={realityColor}
          subtitle="lived on purpose"
          live={isLive}
          testid="stat-reality-score"
          streakSlot={streak && streak.streak > 0 ? (
            <p
              className="font-mono text-[10px] tracking-widest uppercase mt-2.5"
              title={streak.todayEarned ? "Today already counts (1h+ on purpose)" : "Track 1h+ on purpose today to keep the streak"}
              data-testid="streak-badge"
            >
              <span className={streak.todayEarned ? "text-[#FF8C00]" : "text-[#71717A]"}>
                🔥 {streak.streak}-day streak{streak.todayEarned ? "" : " — at risk"}
              </span>
            </p>
          ) : null}
        />
        <ScoreCard
          title="Focus Score"
          score={focusScore}
          seconds={focusSeconds}
          color={focusColor}
          subtitle="focus"
          live={liveCategory === "focus"}
          testid="stat-focus-score"
        />
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
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
          <p className="font-heading text-xl md:text-2xl font-bold text-[#60A5FA]">{formatHours(committed)}</p>
          <p className="font-mono text-[9px] text-[#52525B] mt-1">{sleep > 0 ? `incl. ${formatHours(sleep)} sleep` : "scheduled commitments"}</p>
        </div>
      </div>

      {/* Category breakdown of on-purpose time */}
      {breakdown.length > 0 && (
        <div className="bg-[#0A0A0A] border border-[#333] px-4 py-2.5 flex items-center gap-x-4 gap-y-1.5 flex-wrap" data-testid="category-breakdown">
          <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">On purpose</span>
          {breakdown.map((c) => {
            const Icon = c.Icon;
            const active = activeBreakdown === c.id;
            const dim = activeBreakdown && !active;
            return (
              <button
                key={c.id}
                onClick={() => setActiveBreakdown(active ? null : c.id)}
                data-testid={`breakdown-cat-${c.id}`}
                className={`flex items-center gap-1.5 font-mono text-[11px] tabular-nums transition-all ${active ? "font-bold underline underline-offset-4" : "hover:opacity-80"} ${dim ? "opacity-40" : ""}`}
                style={{ color: c.color }}
                title={active ? "Clear highlight" : `Highlight ${c.label}`}
              >
                <Icon className="w-3 h-3" />
                {c.label} {formatHours(catSeconds[c.id])}
              </button>
            );
          })}
        </div>
      )}

      {/* Untracked remainder of the awake day — tap to account for it */}
      <button
        onClick={onReconcile}
        data-testid="stat-untracked"
        className="w-full bg-[#0A0A0A] border border-[#333] px-4 py-2.5 flex items-center justify-between hover:border-[#FF8C00]/40 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <MoonStar className="w-3 h-3 text-[#52525B]" />
          <span className="font-mono text-[10px] text-[#71717A] uppercase tracking-widest">
            Untracked of {AWAKE_HOURS}h awake
          </span>
          <span className="font-mono text-[9px] text-[#52525B] group-hover:text-[#FF8C00] uppercase tracking-wider transition-colors">· tap to account</span>
        </div>
        <span className="font-mono text-xs font-bold text-[#A1A1AA] tabular-nums">{formatHours(untracked)}</span>
      </button>
    </div>
  );
}
