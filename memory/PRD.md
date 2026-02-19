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

## What's Been Implemented (Feb 19, 2026)
- [x] Full backend API (auth, projects CRUD, timer start/stop, auto-break logic, entries, analytics, AI reports)
- [x] Google OAuth via Emergent Auth
- [x] Login page with Google Auth button
- [x] Dashboard with active timer, voice input, stats bar, daily timeline, recent entries
- [x] Reports page with weekly bar chart + project pie chart + reality score
- [x] AI Report page with GPT-powered weekly analysis + typewriter effect
- [x] Projects management page with color coding
- [x] History page with date filtering and entry management
- [x] Auto-break gap detection (>60s gaps create break entries automatically)
- [x] Voice commands via Web Speech API (start/stop tasks by voice)
- [x] Neo-Brutalist Cyber-Terminal dark theme (Space Grotesk + JetBrains Mono)

## Prioritized Backlog
### P0 (Critical)
- All core features implemented

### P1 (High)
- Mobile responsive sidebar (hamburger menu)
- Keyboard shortcuts (Ctrl+S to start, Ctrl+E to stop)
- Edit existing time entries (change description, project, times)

### P2 (Medium)
- Custom wake/sleep time configuration for Reality Score accuracy
- Export data (CSV/JSON)
- Daily/weekly goal setting with progress tracking
- Pomodoro mode integration
- Browser notifications for long breaks

### P3 (Nice to have)
- PWA support for mobile
- Dark/light theme toggle
- Time entry templates / favorites
- Integration with calendar apps
