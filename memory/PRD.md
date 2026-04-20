# RealityCheck - PRD

## Original Problem Statement
Time-tracking app for high-achieving individuals (students, entrepreneurs) with radical transparency into daily productivity. Core philosophy: humans overestimate productive time. Default state = distracted. Work must be deliberately logged.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + Recharts (React.lazy) + Framer Motion
- **Backend**: FastAPI (Python) + Motor (async MongoDB driver)
- **Database**: MongoDB (collections: users, user_sessions, projects, time_entries, recurring_schedules, ai_reports)
- **Auth**: Emergent-managed Google OAuth
- **AI**: OpenAI GPT-4.1 via Emergent LLM Key for weekly reality reports
- **Voice**: Web Speech API (browser) + OpenAI Whisper fallback

## User Personas
- Late-night coders wanting honest productivity tracking
- Students studying for exams who need accountability
- Entrepreneurs tracking deep work vs distraction

## Core Requirements
1. Voice-first interface for zero-friction task start/stop
2. Auto-break detection (gaps between tasks auto-fill as "Unaccounted Time")
3. Context-aware gap engine (schedules like Sleep, Lectures fill gaps with entry_type='scheduled')
4. Visual analytics (timeline, bar chart, pie chart)
5. AI-powered "Brutal Reality Report" weekly analysis — MUST distinguish productive (task) vs scheduled (sleep) vs unaccounted (break)
6. Google Auth for frictionless login
7. Dark mode with neon green (#00FF41) productive / grey break / deep blue scheduled visual contrast

## What's Been Implemented

### Feb 19, 2026 — MVP
- Full backend API (auth, projects CRUD, timer start/stop, auto-break logic, entries, analytics, AI reports)
- Google OAuth, Dashboard, Reports, AI Report, Projects, History pages
- Voice commands via Web Speech API + Whisper fallback
- Mobile responsive (hamburger menu)

### Apr 20, 2026 — Phase 2: Context-Aware Gap Engine + Committed Time
- Refactored auto-break: 12h max timer cutoff (auto-stops stale timers)
- Recurring Schedules collection + CRUD API + frontend page
- Context-aware gap engine: fills gaps with interleaved break + scheduled + break entries
- Three entry types color-mapped: task (#00FF41), break (#262626), scheduled (#1E40AF)
- Fixed recharts babel-metadata-plugin crash via React.lazy() dynamic imports

### Apr 20, 2026 — Phase 3: AI Accuracy + Code Quality (this session)
- **CRITICAL FIX**: `/api/analytics/weekly` and `/api/reports/weekly` were treating `entry_type='scheduled'` as productive — meaning 8h/night of Sleep was being reported as "productive hours". Introduced `_categorize_entry()` helper + 3-bucket split (productive / scheduled / unaccounted). AI prompt now explicitly instructs the LLM not to call scheduled hours "productive". Verified end-to-end: 2h task + 8h sleep + 2h break now yields productive=2h, scheduled=8h, break=2h (was productive=10h).
- Refactored `server.py`: extracted `_build_weekly_summary`, `_format_weekly_prompt`, `_audio_suffix_for_content_type` helpers; cleaned up temp-file handling in `transcribe_voice`.
- Fixed React array-index-as-key in `WeeklyBarChart`, `ProjectPieChart`, `SchedulesPage`.
- Fixed silent `catch {}` blocks in `App.js` and `AppShell.js`.
- Wrapped `SchedulesPage.fetchSchedules` in `useCallback` for correct hook deps.
- Added `AIReportPage` report-list card to show "Xh productive · Yh scheduled" for at-a-glance bucket awareness.
- Regression tests: `/app/backend/tests/test_ai_bucketing.py` (unit) and `/app/backend/tests/test_bucketing_e2e.py` (e2e, created by testing agent) — 13/13 passing.

## Prioritized Backlog

### P1 (High)
- Keyboard shortcuts (Ctrl+S to start, Ctrl+E to stop)
- Edit existing time entries
- Timezone-aware schedule rendering (currently UTC-only)
- `server.py` split into routers (auth/projects/schedules/timer/analytics/reports) — approaching 1100 lines
- `_fill_gap_with_context` should cap gap iteration at 14 days

### P2 (Medium)
- Query params for past-week analytics/reports (`?week_start=YYYY-MM-DD`)
- Custom wake/sleep time for Reality Score
- Export data (CSV/JSON)
- Pomodoro mode
- `ActiveTimer.js` split into smaller components / custom useVoiceInput hook

### P3 (Nice to have)
- PWA support for mobile
- Time entry templates
- Calendar integration

## Critical Implementation Notes (for any future agent)
- `babel-metadata-plugin` in `/app/frontend/plugins/visual-edits` is very fragile: do NOT use standard ES6 imports for `recharts` (use `React.lazy()`). Do NOT add certain console.warn statements in `ActiveTimer.js` inside `try/catch` blocks — triggers cross-file prop tracing crash. Keep edits to ActiveTimer minimal.
- Python `is None` / `tzinfo is None` is the CORRECT idiom — do not replace with `==`.
- Entry categorization uses `_categorize_entry()` which checks `entry_type` first (`task` | `scheduled` | `break`) then falls back to `is_break` for legacy entries. Never sum durations by just "not is_break" — that includes scheduled entries.
