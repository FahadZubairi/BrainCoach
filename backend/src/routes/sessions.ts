import { Router, Response } from 'express'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db'
import { focusEvents, sessions } from '../db/schema'
import { parse } from '../http'
import { AuthRequest, requireAuth } from '../middleware/auth'
import { DailyQuery, EndSession, LogEvent, Reflection, SessionIdParams, StartSession } from '../schemas'
import { toEventRecord, toSessionRecord } from '../serializers'
import type { DailyResponse, ErrorResponse, EventsResponse, HistoryResponse, SessionResponse, StatsResponse } from '../../../shared/api'

const router = Router()
router.use(requireAuth)

// Every lookup and write is scoped to the signed-in user: ownership is enforced in the query itself.
const owned = (sessionId: number, userId: number) => and(eq(sessions.id, sessionId), eq(sessions.userId, userId))

async function findOwnedSession(sessionId: number, userId: number) {
  const [session] = await db.select().from(sessions).where(owned(sessionId, userId))
  return session
}

const minutesBetween = (start: Date | null, end: Date | null) =>
  start && end ? Math.max(0, (end.getTime() - start.getTime()) / 60000) : 0

router.post('/start', async (req: AuthRequest, res: Response<SessionResponse | ErrorResponse>) => {
  const body = parse(StartSession, req.body, res)
  if (!body) return

  try {
    const [session] = await db.insert(sessions).values({
      userId: req.user!.userId,
      taskDescription: body.taskDescription,
      energyLevel: body.energyLevel,
      exercisedToday: body.exercisedToday,
      plannedMinutes: body.plannedMinutes ?? null,
      intention: body.intention || null,
      status: 'active',
    }).returning()
    res.status(201).json({ session: toSessionRecord(session) })
  } catch (err) {
    console.error('Failed to start session:', err)
    const schemaOutdated = /column .* does not exist/i.test(String((err as Error)?.message ?? err))
    res.status(500).json({
      error: schemaOutdated ? 'Database schema is out of date. Run `npm run db:push` in the backend folder.' : 'Could not start the session.',
    })
  }
})

// Log a focus event (from the app's camera/screen tracking or the browser extension)
router.post('/:sessionId/event', async (req: AuthRequest, res: Response) => {
  const params = parse(SessionIdParams, req.params, res)
  if (!params) return
  const body = parse(LogEvent, req.body, res)
  if (!body) return

  const session = await findOwnedSession(params.sessionId, req.user!.userId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  if (session.status !== 'active') {
    res.status(409).json({ error: 'Session has already ended' })
    return
  }

  const [event] = await db.insert(focusEvents).values({
    sessionId: session.id,
    type: body.type,
    notes: body.notes || null,
  }).returning()
  res.status(201).json({ event: toEventRecord(event) })
})

router.patch('/:sessionId/end', async (req: AuthRequest, res: Response<SessionResponse | ErrorResponse>) => {
  const params = parse(SessionIdParams, req.params, res)
  if (!params) return
  const body = parse(EndSession, req.body, res)
  if (!body) return
  const userId = req.user!.userId

  const session = await findOwnedSession(params.sessionId, userId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  if (session.status !== 'active') {
    // Idempotent: a retried "end" returns the saved result instead of rewriting the score.
    res.json({ session: toSessionRecord(session) })
    return
  }

  // The client measures attentive time continuously; fall back to the event ratio if it isn't sent.
  let focusScore = body.focusScore !== undefined ? Math.round(body.focusScore) : null
  if (focusScore === null) {
    const events = await db.select().from(focusEvents).where(eq(focusEvents.sessionId, session.id))
    const focused = events.filter(e => e.type === 'focused').length
    const lost = events.filter(e => e.type === 'lost_focus').length
    focusScore = focused + lost > 0 ? Math.round((focused / (focused + lost)) * 100) : 100
  }

  const [updated] = await db.update(sessions)
    .set({ status: body.status, endedAt: new Date(), focusScore })
    .where(owned(session.id, userId))
    .returning()
  res.json({ session: toSessionRecord(updated) })
})

router.patch('/:sessionId/reflection', async (req: AuthRequest, res: Response<SessionResponse | ErrorResponse>) => {
  const params = parse(SessionIdParams, req.params, res)
  if (!params) return
  const body = parse(Reflection, req.body, res)
  if (!body) return

  const [updated] = await db.update(sessions)
    .set({ outcome: body.outcome, reflection: body.reflection || null })
    .where(owned(params.sessionId, req.user!.userId))
    .returning()
  if (!updated) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  res.json({ session: toSessionRecord(updated) })
})

// Session history, newest first
router.get('/history', async (req: AuthRequest, res: Response<HistoryResponse>) => {
  const userSessions = await db.select().from(sessions)
    .where(eq(sessions.userId, req.user!.userId))
    .orderBy(desc(sessions.startedAt))
    .limit(300)
  res.json({ sessions: userSessions.map(toSessionRecord) })
})

// Per-day focus totals for one calendar year (the History heatmap), bucketed in the user's time zone.
router.get('/daily', async (req: AuthRequest, res: Response<DailyResponse | ErrorResponse>) => {
  const query = parse(DailyQuery, req.query, res)
  if (!query) return
  const year = query.year ?? new Date().getFullYear()
  const offsetMs = query.tz * 60_000

  const all = await db.select().from(sessions).where(eq(sessions.userId, req.user!.userId))

  const days: Record<string, { minutes: number; sessions: number }> = {}
  const years = new Set<number>([new Date().getFullYear()])
  for (const s of all) {
    if (!s.startedAt || s.status === 'active') continue
    // Shift UTC into the user's local wall-clock time, then read the UTC fields.
    const local = new Date(s.startedAt.getTime() - offsetMs)
    years.add(local.getUTCFullYear())
    if (local.getUTCFullYear() !== year) continue
    const key = local.toISOString().slice(0, 10)
    days[key] = {
      minutes: (days[key]?.minutes ?? 0) + Math.round(minutesBetween(s.startedAt, s.endedAt)),
      sessions: (days[key]?.sessions ?? 0) + 1,
    }
  }

  res.json({ year, years: [...years].sort((a, b) => b - a), days })
})

router.get('/:sessionId/events', async (req: AuthRequest, res: Response<EventsResponse | ErrorResponse>) => {
  const params = parse(SessionIdParams, req.params, res)
  if (!params) return
  const session = await findOwnedSession(params.sessionId, req.user!.userId)
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return
  }
  const events = await db.select().from(focusEvents)
    .where(eq(focusEvents.sessionId, session.id))
    .orderBy(focusEvents.timestamp)
  res.json({ events: events.map(toEventRecord) })
})

router.get('/stats', async (req: AuthRequest, res: Response<StatsResponse>) => {
  const all = await db.select().from(sessions).where(eq(sessions.userId, req.user!.userId))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todaySessions = all.filter(s => s.startedAt && s.startedAt >= today)
  const completed = all.filter(s => s.status === 'completed')

  res.json({
    sessionsToday: todaySessions.length,
    totalSessions: all.length,
    avgFocusScore: completed.length ? Math.round(completed.reduce((sum, s) => sum + (s.focusScore ?? 0), 0) / completed.length) : 0,
    completedSessions: completed.length,
    focusMinutesToday: Math.round(todaySessions.reduce((sum, s) => sum + minutesBetween(s.startedAt, s.endedAt), 0)),
  })
})

export default router
