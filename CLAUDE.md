@AGENTS.md

# BrainCoach — project guide

A focus coach: timed sessions tracked by camera presence and browser-tab relevance, daily habits,
and AI pattern analysis. See `ARCHITECTURE.md` for data models, endpoints and flows.

## Tech stack

| Part | Stack |
|---|---|
| `frontend/` | Next.js 16.3 (App Router, Turbopack), React 19.2, TypeScript 5 (strict), Tailwind CSS v4, face-api.js |
| `backend/` | Express 5, TypeScript (strict, CommonJS), Drizzle ORM on Neon Postgres, JWT auth (jsonwebtoken + bcryptjs), Google Gemini (`@google/generative-ai`) |
| `extensions/` | Chrome MV3 extension, plain JavaScript (no build step) |
| `scripts/` | Python helper scripts |

`frontend/` is its own git repository (nested). The repo root also holds leftover create-next-app
files (`app/`, `public/`, `next.config.ts`, root `package.json`); they are not used by the app.

## Commands

Run from the folder shown. Windows PowerShell or Git Bash both work.

| Task | Folder | Command |
|---|---|---|
| Install | `frontend/`, `backend/` | `npm install` |
| Dev server (web, port 3000) | `frontend/` | `npm run dev` |
| Dev server (API, port 5000) | `backend/` | `npm run dev` (production: `npm run build && npm start`) |
| Typecheck web | `frontend/` | `npx tsc --noEmit -p .` |
| Lint web | `frontend/` | `npx eslint app` |
| Build web | `frontend/` | `npm run build` |
| Typecheck / build API | `backend/` | `npx tsc --noEmit -p .` / `npm run build` |
| Apply schema changes | `backend/` | `npm run db:push` (additive changes only without asking first) |
| Check extension syntax | repo root | `node --check extensions/background.js` (and the other `.js` files) |
| Repackage extension zip | repo root | `python scripts/pack_extension.py` |
| Tests | — | No automated test suite yet. Verify with typecheck + lint + build and a manual run. |

Definition of done for any change: frontend typecheck, lint and build pass; backend typecheck passes;
extension files pass `node --check`.

Only one `next dev` may run per folder. If port 3000 is taken, find and stop the stale `node` process
instead of letting Next fall back to 3001 (the extension only talks to `localhost:3000`).

## Environment

`backend/.env` (never commit, never expose to the client), validated at startup by `backend/src/config.ts`:
`DATABASE_URL`, `JWT_SECRET` (32+ chars), `GEMINI_API_KEY`, optional `GEMINI_MODEL` (default `gemini-2.5-flash`), optional `PORT`,
optional `CORS_ORIGINS` (comma-separated; default `http://localhost:3000,http://127.0.0.1:3000`),
optional `TRUST_PROXY` (proxy hops in front of the API; 2 behind Vercel rewrite + Render). Read env only through `config`, never `process.env` directly.

Frontend (public, safe to expose): `NEXT_PUBLIC_API_URL` (default `http://localhost:5000`),
`NEXT_PUBLIC_EXTENSION_URL` (Chrome Web Store listing, once published).
Server-only build setting: `BACKEND_URL` — when set, `/api/*` is proxied to it (set `NEXT_PUBLIC_API_URL=/api`) so the
session cookie stays first-party. Production extension zip: `python scripts/pack_extension.py --app-url https://<app>`.
Nothing secret may ever use the `NEXT_PUBLIC_` prefix.

## Directory layout

```
shared/api.ts           request/response contract used by both apps (type-only; no runtime code)
frontend/app/
  <route>/page.tsx      thin route files; the route's pieces live beside it (e.g. session/ActiveView.tsx, dashboard/Lists.tsx)
  components/           shared UI: ui.tsx + forms.tsx (primitives), AppShell, NavLink, Logo, Timeline, Heatmap, TabActivity, motion
  context/              AuthContext (user from GET /auth/me; the credential is an httpOnly cookie)
  lib/                  non-visual logic: api client, sessionEngine (pure rules), hooks, local stores
  globals.css           design tokens (CSS variables) + motion system
backend/src/
  app.ts                app setup, middleware, router mounting      config.ts   validated env
  index.ts              local/server entry (listen)                 ../api/index.ts   Vercel serverless entry
  routes/               auth.ts, sessions.ts, coach/{briefings,insights,tracking}.ts
  services/             gemini.ts (AI calls, null on failure), tabRules.ts (single source of site rules)
  schemas.ts, http.ts   Zod request schemas + parse()               serializers.ts   DB rows → shared types
  middleware/           auth (cookie + scoped Bearer, CSRF), rateLimit, errors
  db/                   Drizzle client + schema
extensions/             background.js (entry) + lib/ (state, classify, tracker, ui, api, breakWindow), content.js, pages
```

## Conventions

**General**
- Target files under ~200 lines. Split by responsibility (a hook, a component, a route group) rather than by size alone.
- Strict TypeScript everywhere. No `any`; use `unknown` and narrow. No non-null `!` except on values guaranteed by middleware (`req.user!` after `requireAuth`).
- Shared request/response shapes live in one place and are imported, never redeclared per file.
- Explicit error handling: every network call and DB call has a failure path that the user can see or that degrades safely. Never swallow errors silently; `console.error` is for logs, not user feedback.
- Comments explain *why*, not what. Match the surrounding code's style.

**Backend**
- Every route except `/auth/*` and `/health` sits behind `requireAuth`.
- Validate `req.body`, `req.params` and `req.query` with a Zod schema from `src/schemas.ts` via `parse()` before use.
- Every query touching user data filters by `req.user.userId` (ownership check), including reads.
- Errors return JSON `{ error: string }` with a correct status code. AI failures fall back to safe defaults and never penalise the user.
- Schema changes via Drizzle + `db:push`. Additive only unless the user explicitly approves a destructive change.

**Frontend**
- All HTTP goes through `lib/api.ts` (`api()`), which sends the cookie (`credentials: 'include'`), maps errors to `ApiError`, and signs out on 401.
- Types that cross the wire come from `shared/api.ts` via `import type`. Never redeclare them locally.
- Session rules belong in `lib/sessionEngine.ts` (pure functions), not in components or hooks.
- Every data load has four states: loading (skeleton from `components/states.tsx`), error (`ErrorState` with Retry),
  empty (say what to do next), and loaded. A failed load must never render as "no data".
- Failed mutations or background saves tell the user: inline next to the control, or `toast()` / `toastOnce()` from
  `lib/toast.ts` for things with no nearby UI. Never only `console.*`.
- "Server unreachable" (`ApiError.unreachable`) is not "signed out"; AuthContext exposes `status: 'unreachable'`.
  `api()` already retries GETs twice with backoff and times out after 20 s, so don't add ad-hoc retry loops.
- Client components only (`'use client'`); pages are prerendered, so read `localStorage` in effects, not during render.
- Style with Tailwind utilities backed by the tokens in `globals.css` (`bg-surface`, `text-fg-2`, `text-accent`…). No raw hex colours in components.
- Colour carries meaning: accent = focused/primary, warn = caution/away, danger = off-task/destructive.
- Accessibility is required: labelled controls, visible focus, ≥40px targets, `role`/`aria-*` on custom widgets, and `prefers-reduced-motion` respected.
- In-app navigation uses `NavLink` (drives page transitions), not a bare `Link`.
- Next.js 16 differs from older versions: check `frontend/node_modules/next/dist/docs/` before using a Next API.

**Extension**
- Minimum permissions. It may read only the active tab's URL and title during a session; never cookies, page content or history.
- Persist all state in `chrome.storage` (MV3 service workers are killed when idle).
- Talk to the web app only through `content.js` + `window.postMessage`; never hard-code the extension ID.
- After changing `extensions/`, bump `manifest.json` `version` and rerun `scripts/pack_extension.py`.

## Safety rules
- Never commit `.env` files or print secret values.
- No destructive database operations (drops, column removals, data deletes) without explicit confirmation.
- Don't leave dev servers running after verifying something; on Windows, check the port is actually freed.
