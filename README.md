# BrainCoach

A focus coach: timed sessions with camera presence + browser-tab tracking, daily habits, and AI pattern analysis.

```
backend/     Express + Drizzle (Neon Postgres) + Gemini — port 5000
frontend/    Next.js app — port 3000
extensions/  Chrome extension (MV3) that classifies the active tab
```

## Run

```bash
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
```

`backend/.env` needs `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL`
(defaults to `gemini-2.5-flash`). Without a Gemini key the app still works: coach messages fall back
to built-in text and tab checks use the built-in site lists.

## Tab tracking extension

1. Open `chrome://extensions` and enable **Developer mode**
2. **Load unpacked** → select the `extensions/` folder
3. Reload the BrainCoach tab — the Focus page shows **Connected**

**How to tell it's working** (during a session):
- The BrainCoach icon in Chrome's toolbar shows a badge on every tab: green **ON**, coral **OFF**, amber **II** when paused.
- The Focus page shows **Tab activity**: every site with its verdict and time, plus a "Checked Xs ago" heartbeat
  that turns amber if the extension stops reporting (reload it from `chrome://extensions`).
- After 2 minutes off task you get a Chrome notification (unless strict mode already paused the site). Click it to jump back.
- Click the toolbar icon for the same status and your recent tabs.
- The session summary shows **Where your time went**, time per site split into on-topic and off-topic.

The app talks to the extension through a content script on `localhost:3000`, so no extension ID is
needed. Time on an off-topic tab counts against your focus score live; a `lost_focus` event is logged
after 2 minutes. Time spent outside Chrome (e.g. your editor) is neutral — the camera judges presence.

## Tab tracking: extension or screen check

Users choose on the Focus page (**Extension / Screen check / Off**).

- **Extension**: most accurate (see above). Choosing it when it isn't installed opens `/extension`, a guided
  setup that detects the extension live and returns to the session. It offers `frontend/public/braincoach-extension.zip`
  (rebuild with `python scripts/pack_extension.py` after changing `extensions/`). Once published, set
  `NEXT_PUBLIC_EXTENSION_URL` to the Chrome Web Store listing and the page becomes one-click "Add to Chrome".
- **Screen check**: no install. The browser shares the screen once per session; every **2 minutes** one ~960px JPEG
  is sent to `POST /coach/evaluate-screen`, judged by Gemini (vision) and discarded. Nothing is stored except the verdict.
  Needs `GEMINI_API_KEY`; desktop browsers only.

## Camera presence

Optional, toggled on the Focus page. Uses face-api.js' tiny face detector entirely in the browser;
only "at desk / away" is recorded. Away for 60s+ logs a `lost_focus` event.

## Discipline features (and the research behind them)

| Feature | Where | Evidence |
|---|---|---|
| **If-then plan** — "If I get distracted, then I will…" set before each session, shown again when you drift and on the pause screen | Focus setup | Implementation intentions: Gollwitzer & Sheeran (2006), meta-analysis of 94 studies, d ≈ 0.65 |
| **Timebox + break prompt** — 25/50/90 min; soft chime, notification and a break suggestion when time's up | Focus | Scheduled breaks beat self-regulated ones for fatigue and motivation: Biwer et al. (2023); brief breaks prevent vigilance decrement: Ariga & Lleras (2011) |
| **Strict mode** — off-topic sites open a 10-second breathing pause first ("Back to work" / "It's for my task" / "5 more minutes") | Extension | Friction before opening distracting apps cut opens by 57%: Grüning et al., *PNAS* (2023); commitment devices: Ariely & Wertenbroch (2002) |
| **Park a thought** — capture stray to-dos mid-session; reviewed later on Today | Focus → Today | Planning unfinished tasks stops them intruding: Masicampo & Baumeister (2011) |
| **Reflection** — "Did you finish?" + what helped / got in the way; feeds the AI insights | Session summary | Monitoring goal progress improves attainment: Harkin et al. (2016) |
| **Daily goal ring + 12-week heatmap** | Today, History | Specific goals: Locke & Latham (2002); visible small wins: Amabile & Kramer's progress principle |

Schema: these add `planned_minutes`, `intention`, `outcome`, `reflection` to `sessions`
(already applied; on a fresh database run `npm run db:push` in `backend/`).

## Focus score

Measured continuously: the share of active (un-paused) session time you were at the desk and on an
on-topic tab. With no sensors connected it falls back to self-reported "I drifted off" check-ins.
