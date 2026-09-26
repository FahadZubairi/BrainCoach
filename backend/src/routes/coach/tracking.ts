import { Router, Response } from 'express'
import { SchemaType } from '@google/generative-ai'
import { z } from 'zod'
import type { ErrorResponse, ScreenVerdict, SessionProfileResponse, TabRules, TabVerdict } from '../../../../shared/api'
import { parse } from '../../http'
import { AuthRequest } from '../../middleware/auth'
import { EvaluateScreen, EvaluateTab, SessionProfile, SessionProfileRequest } from '../../schemas'
import { aiAvailable, generateJson } from '../../services/gemini'
import { TAB_RULES, hostOf, keywordsFromTask, quickTabVerdict } from '../../services/tabRules'

// Everything the tab tracker (extension) and screen check need to judge "on task or not".
const router = Router()

// The extension downloads these once per session to judge obvious sites instantly.
router.get('/tab-rules', (_req: AuthRequest, res: Response<TabRules>) => {
  res.json(TAB_RULES)
})

router.post('/session-profile', async (req: AuthRequest, res: Response<SessionProfileResponse>) => {
  const body = parse(SessionProfileRequest, req.body, res)
  if (!body) return

  const raw = await generateJson(`Analyse this work task and produce a browsing profile for a focus tracker.

Task: "${body.taskDescription}"

allowedKeywords: 10-25 lowercase keywords or domains that relevant tabs would contain (e.g. for coding:
github, stackoverflow, localhost, mdn, npm, docs, and the framework names in the task).
forbiddenCategories: lowercase domains or words for clearly unrelated browsing (e.g. youtube.com, reddit.com, netflix).
taskSummary: one sentence describing what focused work looks like.`, {
    type: SchemaType.OBJECT,
    properties: {
      sessionType: { type: SchemaType.STRING },
      allowedKeywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      forbiddenCategories: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      strictness: { type: SchemaType.STRING },
      taskSummary: { type: SchemaType.STRING },
    },
    required: ['sessionType', 'allowedKeywords', 'forbiddenCategories', 'strictness', 'taskSummary'],
  })

  const profile = SessionProfile.safeParse(raw)
  res.json({
    profile: profile.success ? profile.data : {
      sessionType: 'general',
      allowedKeywords: keywordsFromTask(body.taskDescription),
      forbiddenCategories: [],
      strictness: 'medium',
      taskSummary: body.taskDescription,
    },
  })
})

// Tier 1: rules (instant). Tier 2: AI for ambiguous tabs, cached. Unknown → assume on task.
const tabCache = new Map<string, TabVerdict>()
const AiTabVerdict = z.object({ relevant: z.boolean(), reason: z.string().max(120) })

router.post('/evaluate-tab', async (req: AuthRequest, res: Response<TabVerdict>) => {
  const body = parse(EvaluateTab, req.body, res)
  if (!body) return

  const quick = quickTabVerdict({
    tabTitle: body.tabTitle,
    tabUrl: body.tabUrl,
    taskDescription: body.taskDescription,
    allowedKeywords: body.sessionProfile?.allowedKeywords ?? [],
    forbiddenCategories: body.sessionProfile?.forbiddenCategories ?? [],
  })
  if (quick) {
    res.json(quick)
    return
  }

  const cacheKey = `${body.taskDescription}|${hostOf(body.tabUrl)}|${body.tabTitle}`
  const cached = tabCache.get(cacheKey)
  if (cached) {
    res.json(cached)
    return
  }

  const raw = await generateJson(`Decide whether a browser tab is relevant to a focused work session.

Task: "${body.taskDescription}"
Tab: "${body.tabTitle}" (${body.tabUrl})

Be strict with entertainment and social media, lenient with reference material, documentation and search.
reason is a short phrase (max 8 words).`, {
    type: SchemaType.OBJECT,
    properties: { relevant: { type: SchemaType.BOOLEAN }, reason: { type: SchemaType.STRING } },
    required: ['relevant', 'reason'],
  }, undefined, true)

  const verdict = AiTabVerdict.safeParse(raw)
  if (!verdict.success) {
    // Don't penalise the user for an AI hiccup, but say so rather than claiming "on task". Not cached,
    // so the next look at this tab tries again.
    res.json({ relevant: true, reason: 'Couldn’t classify', neutral: true })
    return
  }
  if (tabCache.size > 500) tabCache.clear()
  tabCache.set(cacheKey, verdict.data)
  res.json(verdict.data)
})

// Screen check: frames are analysed in memory and never written anywhere; only the verdict is returned.
const lastScreenCheck = new Map<number, number>()
const SCREEN_MIN_INTERVAL_MS = 4_000 // the client snapshots every 5 s and skips unchanged screens
const AiScreenVerdict = z.object({ relevant: z.boolean(), activity: z.string(), app: z.string() })

router.post('/evaluate-screen', async (req: AuthRequest, res: Response<ScreenVerdict | ErrorResponse>) => {
  const body = parse(EvaluateScreen, req.body, res)
  if (!body) return
  const userId = req.user!.userId

  const now = Date.now()
  if (now - (lastScreenCheck.get(userId) ?? 0) < SCREEN_MIN_INTERVAL_MS) {
    res.status(429).json({ error: 'Too many screen checks' })
    return
  }
  lastScreenCheck.set(userId, now)

  if (!aiAvailable()) {
    res.status(503).json({ error: 'Screen check needs GEMINI_API_KEY on the server' })
    return
  }

  const raw = await generateJson(`You judge whether someone's screen shows work on their stated task.

Task: "${body.taskDescription}"

Look at the screenshot. "app" is the site or application in focus (e.g. "youtube.com", "VS Code", "Google Docs").
"activity" is what they appear to be doing, max 6 words, neutral wording, no personal details, never quote on-screen text.
relevant = true if it plausibly serves the task (docs, code, notes, search, research, communication about the task).
Be strict with entertainment, social feeds, shopping and games unless clearly about the task.`, {
    type: SchemaType.OBJECT,
    properties: {
      relevant: { type: SchemaType.BOOLEAN },
      activity: { type: SchemaType.STRING },
      app: { type: SchemaType.STRING },
    },
    required: ['relevant', 'activity', 'app'],
  }, body.image.slice('data:image/jpeg;base64,'.length), true)

  const verdict = AiScreenVerdict.safeParse(raw)
  if (!verdict.success) {
    res.json({ relevant: true, activity: 'Could not analyse', app: '', unavailable: true })
    return
  }
  res.json({ relevant: verdict.data.relevant, activity: verdict.data.activity.slice(0, 60), app: verdict.data.app.slice(0, 40) })
})

export default router
