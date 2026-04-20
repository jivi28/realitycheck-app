# RealityCheck - PRD

## Original Problem Statement
Time-tracking app for high-achieving individuals (students, entrepreneurs) with radical transparency into daily productivity. Core philosophy: humans overestimate productive time. Default state = distracted. Work must be deliberately logged.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI + Recharts + Framer Motion
- **Backend**: FastAPI (Python) + Motor (async MongoDB driver)
- **Database**: MongoDB (collections: users, user_sessions, projects, time_entries, ai_reports)
- **Auth**: Emergent-managed Google OAuth
- **AI**: OpenAI GPT-4.1 via Emergent LLM Key for weekly reality reports
- **Voice**: Web Speech API (browser built-in)

## User Personas
- Late-night coders wanting honest productivity tracking
- Students studying for exams who need accountability
- Entrepreneurs tracking deep work vs distraction

## Core Requirements
1. Voice-first interface for zero-friction task start/stop
2. Auto-break detection (gaps between tasks auto-fill as "Unaccounted Time")
3. Visual analytics (timeline, bar chart, pie chart)
4. AI-powered "Brutal Reality Report" weekly analysis
5. Google Auth for frictionless login
6. Dark mode with neon green (#00FF41) productive / grey break visual contrast

## What's Been Implemented
### Feb 19, 2026 - MVP
- [x] Full backend API (auth, projects CRUD, timer start/stop, auto-break logic, entries, analytics, AI reports)
- [x] Google OAuth, Dashboard, Reports, AI Report, Projects, History pages
- [x] Voice commands via Web Speech API + Whisper fallback
- [x] Mobile responsive (hamburger menu)

### Apr 20, 2026 - Phase 2: Context-Aware Gap Engine + Committed Time
- [x] Refactored auto-break: 12h max timer cutoff (auto-stops stale timers)
- [x] Recurring Schedules collection + CRUD API + frontend page
- [x] Context-aware gap engine: fills gaps with interleaved break + scheduled + break entries
- [x] Three entry types color-mapped: task (#00FF41), break (#262626), scheduled (#1E40AF)
- [x] Fixed recharts babel-metadata-plugin crash via React.lazy() dynamic imports

## Prioritized Backlog
### P1 (High)
- Keyboard shortcuts (Ctrl+S to start, Ctrl+E to stop)
- Edit existing time entries
- Timezone-aware schedule rendering (currently UTC-only)

### P2 (Medium)
- Custom wake/sleep time for Reality Score
- Export data (CSV/JSON)
- Pomodoro mode

### P3 (Nice to have)
- PWA support for mobile
- Time entry templates
- Calendar integration
