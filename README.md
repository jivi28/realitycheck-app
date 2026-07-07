# RealityCheck

Terminal-styled personal time tracker: track **all** your time (work + life), reconcile untracked gaps honestly, and score your day against a 16-hour awake budget. Deployed on Vercel (`realitycheck-app` and the shared `realitycheck-friends`).

The app is client-side (React, `frontend/`) with a mock API served from localStorage (`frontend/src/lib/browserApi.js`), optional per-record Supabase sync, and two Vercel serverless functions (`api/`): real AI weekly reports (Claude) and web-push nudges.

## Development

```sh
cd frontend
yarn install
yarn start        # http://localhost:3000, localStorage-only mode
yarn build
```

## One-time setup after the 2026-07 enhancement pass

### 1. Supabase: per-record sync tables

Run `supabase/rc_per_record_sync.sql` in the Supabase SQL editor (Dashboard → SQL Editor) of the project referenced by `REACT_APP_SUPABASE_URL`. Until this runs, the app keeps using the legacy `realitycheck_shared_state` blob; once the tables exist, each device migrates the blob automatically on first load, then syncs per record (no more concurrent-write clobbering, and goals finally sync too).

Optional: set `REACT_APP_WORKSPACE` (build-time, per Vercel project) to separate the main and friends deployments inside one Supabase project. Default is `main` — the same dataset the blob used.

### 2. Vercel env vars (per project: Settings → Environment Variables)

| Variable | Side | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | server | Real AI weekly reports (`api/generate-report.js`, `claude-sonnet-5`). Without it the report page falls back to the local template, labeled "offline summary". |
| `SUPABASE_URL`, `SUPABASE_KEY` | server | Same values as the `REACT_APP_SUPABASE_*` vars — used by the push cron to read entries/subscriptions. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT` | server | Web push signing (see `.env.push.local`, not committed). `VAPID_CONTACT` is a `mailto:` address. |
| `REACT_APP_VAPID_PUBLIC_KEY` | build | Same public key, exposed to the frontend subscribe flow. |
| `CRON_SECRET` | server | Recommended — Vercel automatically authenticates cron invocations with it. |

### 3. Push nudges

`vercel.json` schedules `api/push-nudge.js` daily at 18:30 UTC. It sends **at most one** push per device per day: an evening "N hours unaccounted — reconcile" (only if ≥2h is actually unaccounted) or a "streak at risk" alert (streak ≥3 and under 1h on purpose today). Users opt in via the bell toggle in the sidebar; the app must be installed as a PWA on iOS.

## Notes

- `backend/` is the legacy FastAPI/Mongo scaffold — not deployed, kept for reference.
- Data can be exported/imported as JSON from the sidebar (Export / Import).
