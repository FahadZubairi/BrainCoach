import { ActiveSession, SAMPLE_MS, Sample, activeMs, focusScore } from './activeSession'
import type { FocusEventType } from '../../../shared/api'

// Pure session rules: every function takes the current session and returns the next one plus the
// side effects the caller should perform. No React, no timers, no network, so it's easy to test.

// Leaving the camera for a moment is normal; only log it once it's a real break in focus.
export const AWAY_LOG_AFTER_MS = 60_000

export interface NewSessionInput {
  sessionId: number
  userId: number
  taskDescription: string
  plannedMinutes: number | null
  intention: string
  breakMinutes: number
  now: number
}

export function createSession(i: NewSessionInput): ActiveSession {
  return {
    sessionId: i.sessionId, userId: i.userId, taskDescription: i.taskDescription, profile: null,
    startedAt: i.now, pausedAt: null, pausedMs: 0,
    attentiveMs: 0, awayMs: 0, offTaskMs: 0, sensed: false, distractions: 0, timeline: [],
    plannedMinutes: i.plannedMinutes, intention: i.intention, parked: [],
    breakPrompted: false, breakMinutes: i.breakMinutes, breakUntil: null, cycleStartMs: 0, promptOpen: false,
    awayLogged: false, sampleAccMs: 0,
  }
}

export interface TickSignals {
  now: number
  deltaMs: number
  camera: { live: boolean; away: boolean; present: boolean; absentSince: number | null }
  tracker: { live: boolean; offTask: boolean }
}

export interface TickResult {
  next: ActiveSession
  events: { type: FocusEventType; notes: string }[]
  /** The timebox just completed: show the break prompt. */
  promptBreak: boolean
  /** A timed break just ended: resume. */
  breakOver: boolean
}

function addSamples(s: ActiveSession, deltaMs: number, sample: Sample): ActiveSession {
  let acc = s.sampleAccMs + deltaMs
  const added: Sample[] = []
  while (acc >= SAMPLE_MS) {
    added.push(sample)
    acc -= SAMPLE_MS
  }
  return { ...s, sampleAccMs: acc, timeline: added.length ? [...s.timeline, ...added] : s.timeline }
}

/** Advances the session by one tick, attributing the elapsed time to focused / away / off-task. */
export function tick(session: ActiveSession, sig: TickSignals): TickResult {
  const none = { events: [], promptBreak: false, breakOver: false }

  if (session.pausedAt) {
    if (session.breakUntil && sig.now >= session.breakUntil) return { next: session, ...none, breakOver: true }
    return { next: addSamples(session, sig.deltaMs, 'paused'), ...none }
  }

  const away = sig.camera.away
  const off = sig.tracker.offTask
  const state: Sample = away ? 'away' : off ? 'off' : 'focus'

  let next: ActiveSession = addSamples({
    ...session,
    sensed: session.sensed || sig.camera.live || sig.tracker.live,
    attentiveMs: session.attentiveMs + (state === 'focus' ? sig.deltaMs : 0),
    awayMs: session.awayMs + (away ? sig.deltaMs : 0),
    offTaskMs: session.offTaskMs + (off && !away ? sig.deltaMs : 0),
  }, sig.deltaMs, state)

  const events: TickResult['events'] = []
  if (away && sig.camera.absentSince && sig.now - sig.camera.absentSince >= AWAY_LOG_AFTER_MS && !next.awayLogged) {
    next = { ...next, awayLogged: true }
    events.push({ type: 'lost_focus', notes: 'Away from the desk (camera)' })
  } else if (sig.camera.present && next.awayLogged) {
    next = { ...next, awayLogged: false }
    events.push({ type: 'focused', notes: 'Back at the desk (camera)' })
  }

  // Timebox reached: prompt a break once per cycle. Scheduled breaks beat "I'll stop when I'm tired"
  // for both fatigue and motivation (Biwer et al., 2023).
  let promptBreak = false
  if (next.plannedMinutes && !next.breakPrompted && activeMs(next, sig.now) - next.cycleStartMs >= next.plannedMinutes * 60_000) {
    next = { ...next, breakPrompted: true, promptOpen: true }
    promptBreak = true
  }

  return { next, events, promptBreak, breakOver: false }
}

export const pause = (s: ActiveSession, now: number): ActiveSession => ({ ...s, pausedAt: now })

export function resume(s: ActiveSession, now: number): ActiveSession {
  if (!s.pausedAt) return s
  return { ...s, pausedMs: s.pausedMs + (now - s.pausedAt), pausedAt: null, breakUntil: null }
}

export const startBreak = (s: ActiveSession, now: number): ActiveSession =>
  ({ ...s, pausedAt: now, breakUntil: now + s.breakMinutes * 60_000, promptOpen: false })

/** Ends a break; a new timebox cycle starts so you're reminded again after another full block. */
export function endBreak(s: ActiveSession, now: number): ActiveSession {
  const resumed = resume(s, now)
  return { ...resumed, breakPrompted: false, promptOpen: false, cycleStartMs: activeMs(resumed, now) }
}

/** "Not now": keep working; remind again after another full block. */
export const dismissBreak = (s: ActiveSession, now: number): ActiveSession =>
  ({ ...s, promptOpen: false, breakPrompted: false, cycleStartMs: activeMs(s, now) })

export function finalize(s: ActiveSession, now: number) {
  const final = resume(s, now)
  return { final, score: focusScore(final, now), ms: activeMs(final, now) }
}
