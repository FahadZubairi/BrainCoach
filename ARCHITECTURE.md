# BrainCoach architecture

```
 Browser (Chrome)                                         Server
┌───────────────────────────────┐   HTTPS + Bearer JWT   ┌──────────────────────────┐    ┌──────────────┐
│ Next.js app  (localhost:3000) │ ─ httpOnly cookie ───► │ Express API (:5000)      │ ─► │ Neon Postgres│
│  - sessions, habits, insights │                        │  /auth /sessions /coach  │    └──────────────┘
│  - camera presence (on-device)│                        │                          │    ┌──────────────┐
│  - screen check (optional)    │                        │                          │ ─► │ Google Gemini│
└──────────────▲────────────────┘                        └────────────▲─────────────┘    └──────────────┘
               │ window.postMessage                                    │ Bearer JWT (extension-scoped, 24 h)
┌──────────────┴────────────────┐                                      │
│ Extension content.js (bridge) │ ◄── chrome.runtime ──► background.js ┘  classifies tabs, logs events
└───────────────────────────────┘                        (service worker)
```

## Data models (`backend/src/db/schema.ts`, Postgres via Drizzle)

| Table | Columns | Notes |
|---|---|---|
| `users` | `id` serial PK, `email` unique, `hashed_password` (bcrypt, cost 10), `coach_name`, `total_sessions`, `longest_streak`, `created_at` | `coach_name`, `total_sessions`, `longest_streak` are currently unused |
| `sessions` | `id`, `user_id`, `task_description`, `energy_level` 1–5, `exercised_today`, `focus_score` 0–100, `status` active/completed/abandoned, `started_at`, `ended_at`, `planned_minutes`, `intention`, `outcome` done/partly/not_done, `reflection` | `user_id` has no FK constraint; ownership enforced in queries |
| `focus_events` | `id`, `session_id`, `type` focused/lost_focus/break, `timestamp`, `notes` | written by the app (camera, screen check, self-report, breaks) and the extension (tabs) |
| `patterns` | `id`, `user_id`, `analysis`, `key_insights` (JSON string), `generated_at` | append-only log of AI insight runs; not read back yet |

Data kept **only in the browser** (`localStorage`, per user):

| Key | Contents |
|---|---|
| `braincoach_active_session` | the running session (timer, attentive/away/off-task ms, timeline, timebox cycle, break state). Survives reloads |
| `braincoach_habits_<userId>` | habits with a `history` of completed dates |
| `braincoach_prefs_<userId>` | daily goal, timebox, break length, tracking mode, strict mode, last intention |
| `braincoach_parked_<userId>` | parked thoughts |
| `braincoach_checkin`, `braincoach_camera` | today's energy check-in, camera on/off |

## API endpoints (`backend/src/routes/*`)

All responses are JSON; errors are `{ error }`. Every route except `/auth/*` and `/health` requires `Authorization: Bearer <jwt>`.

| Method | Path | Body / query | Purpose |
|---|---|---|---|
| GET | `/health` | — | liveness |
| POST | `/auth/signup` | `email, password` (≥8 chars) | create user, set session cookie, returns `{ user }` |
| POST | `/auth/login` | `email, password` | set session cookie, returns `{ user }` |
| POST | `/auth/logout` | — | clear session cookie |
| GET | `/auth/me` | — | current user from the cookie |
| GET | `/auth/extension-token` | — | 24 h Bearer token scoped to the extension's endpoints |
| GET | `/coach/tab-rules` | — | allow/distract lists the extension uses for instant verdicts |
| POST | `/sessions/start` | `taskDescription, energyLevel, exercisedToday?, plannedMinutes?, intention?` | create an active session |
| POST | `/sessions/:id/event` | `type, notes?` | log a focus event (session must be owned and active) |
| PATCH | `/sessions/:id/end` | `status, focusScore?` | complete/abandon; client-measured score, else event ratio |
| PATCH | `/sessions/:id/reflection` | `outcome, reflection?` | end-of-session self-report |
| GET | `/sessions/history` | — | last 300 sessions, newest first |
| GET | `/sessions/daily` | `year, tz` | per-day minutes/sessions for the heatmap |
| GET | `/sessions/:id/events` | — | events for one session |
| GET | `/sessions/stats` | — | today's count/minutes, averages |
| POST | `/coach/pre-session` | `taskDescription, energyLevel, exercisedToday` | short AI briefing (fallback text on failure) |
| POST | `/coach/daily-checkin` | `energyLevel, sessionsToday, avgFocusScore, completedSessions` | AI day plan |
| GET | `/coach/insights` | — | AI pattern analysis (needs ≥3 finished sessions); stored in `patterns` |
| POST | `/coach/session-profile` | `taskDescription` | AI keyword profile used by the tab classifier |
| POST | `/coach/evaluate-tab` | `tabTitle, tabUrl, taskDescription, sessionProfile` | tab relevance: site lists → keywords → Gemini; cached |
| POST | `/coach/evaluate-screen` | `image` (JPEG data URL ≤1 MB), `taskDescription` | screen-check verdict via Gemini vision; frame not stored; ≥4 s apart per user; uses `GEMINI_FAST_MODEL` |

## Authentication

- **Web app → httpOnly cookie.** Login/signup set `bc_session` (HS256 JWT `{ userId, email, scope: 'session' }`, 7 days,
  `HttpOnly; SameSite=Lax; Secure` in production). JavaScript can never read it, so an XSS bug can't steal it.
  The app calls `GET /auth/me` on load to learn who is signed in; `lib/api.ts` sends `credentials: 'include'`.
- **CSRF.** Cookie-authenticated writes (POST/PATCH) and login/signup must carry an `Origin` in `CORS_ORIGINS`; otherwise 403.
- **Extension → scoped Bearer token.** The app fetches `GET /auth/extension-token` (cookie-authenticated) and hands the
  result to the extension. That token has `scope: 'extension'`, lasts 24 h, and `requireAuth` only accepts it on
  `GET /coach/tab-rules`, `POST /coach/evaluate-tab` and `POST /sessions/:id/event`. Full-access Bearer tokens don't exist.
- **Passwords.** bcrypt (cost 10), emails matched case-insensitively, a dummy compare for unknown emails (no timing leak),
  `/auth/signup` and `/auth/login` rate-limited to 10 per IP per 15 min.
- **Verification.** `middleware/auth.ts` pins HS256, validates the payload shape, enforces scope, and sets `req.user`.
- **Input validation.** Every body, param and query is parsed with Zod (`backend/src/schemas.ts`, `parse()` in `src/http.ts`).
  Extension-supplied strings (URLs, titles, AI keyword lists) are clamped rather than rejected. AI output is validated too.
- **Transport.** CORS allows only `CORS_ORIGINS` with credentials; `X-Powered-By` off; `nosniff`/`no-referrer`;
  JSON-only errors without stack traces; 32 KB body limit (1 MB for screen-check frames).
- **Authorization.** No database RLS; every read and write on `sessions` filters by `req.user.userId` in the query itself.
- **Contract.** Request/response shapes live in `shared/api.ts`, imported with `import type` by both apps.
  `backend/src/serializers.ts` maps DB rows onto those shapes (no nulls or free-text enums leak through).

## Key flows

**Focus session**
1. Setup: task, energy, timebox (+ break length), if-then plan, camera toggle, tab-tracking mode.
2. `POST /sessions/start`. In parallel: `/coach/session-profile` (for tab rules) and `/coach/pre-session` (coach note).
3. A 1-second loop (`session/useSessionController.ts`, rules in `lib/sessionEngine.ts`) splits elapsed active time into *focused / away / off-task* using the
   camera state and the tracker verdict. It samples the timeline every 10 s and persists the session to `localStorage`.
4. Events: camera away ≥60 s, off-task ≥2 min (extension or screen check), self-reported drift, and breaks → `POST /sessions/:id/event`.
5. Timebox reached → break prompt (in-app modal + extension pop-up window). Accept = timed pause that auto-resumes.
   A new timebox cycle starts after each break or "Not now".
6. Finish → `PATCH /sessions/:id/end` with the measured focus score → summary → optional reflection.

**Tab tracking (user chooses one)**
- *Extension* (`extensions/background.js` → `lib/*.js`, ES modules): re-checks on tab switch, URL/title change
  (catches in-page navigation), window focus and a 30 s alarm. `classify.js` decides known sites instantly from the rules
  downloaded at session start; only unknown sites go to `/coach/evaluate-tab` (badge shows "…" meanwhile). State writes are
  serialised (`withState`) so a slow check can't overwrite a newer pause. Strict mode redirects off-topic tabs to `pause.html`.
- *Screen check* (`useScreenCheck` + `screenFrame.ts`): holds a `getDisplayMedia` track, grabs live frames with
  `ImageCapture.grabFrame()` (a background-tab `<video>` returns stale frames), snapshots right after the user leaves BrainCoach and
  then every 5 s, never while BrainCoach is focused, and warns if only a tab/window was shared. A 32×18 greyscale
  fingerprint is compared locally; an unchanged screen reuses the last verdict (for up to 60 s) instead of uploading.
- *Guided setup:* choosing Extension without it installed opens `/extension`, which offers the packaged zip
  (or the store link) and detects the connection live.

**Camera presence:** `useFaceTracker` runs face-api.js tiny face detector on-device once per second; video never leaves the browser.

**Insights:** local statistics (time of day, energy, exercise) computed from history in the browser; AI analysis on demand.

**Habits:** fully client-side in `localStorage` (not synced across devices).

## Known gaps
- No database-level row-level security (Neon/Postgres RLS); isolation relies on the query filters above.
- `drizzle-kit` (dev-only) pulls in an esbuild version with a moderate dev-server advisory; not shipped to production.

## Privacy

- Every tracker is off by default. The first time one is turned on, `PrivacyConsent` explains what it uses, where it goes,
  what's kept and how to stop; consent is remembered per tracker in prefs (`consent`). `/privacy` is the public version.
- Camera frames never leave the browser. Screen snapshots are analysed and discarded. The extension strips query strings,
  fragments, email addresses and long numbers from tab URLs and titles before calling `/coach/evaluate-tab`.
- Face detection checks the whole 640×480 frame, then overlapping tiles, so small or off-centre faces are still found.
