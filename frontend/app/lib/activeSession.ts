import { toastOnce } from './toast'

export const ACTIVE_SESSION_KEY = 'braincoach_active_session'
// Fired when a session starts or ends, so the nav indicator updates without a route change.
export const ACTIVE_SESSION_EVENT = 'braincoach:active-session'

// One sample every SAMPLE_MS of active time; drives the session timeline strip.
export const SAMPLE_MS = 10_000
export type Sample = 'focus' | 'away' | 'off' | 'paused'

export interface ActiveSession {
  sessionId: number
  userId: number
  taskDescription: string
  profile: unknown
  startedAt: number
  pausedAt: number | null
  pausedMs: number
  attentiveMs: number
  awayMs: number
  offTaskMs: number
  sensed: boolean // was the camera or extension ever available?
  distractions: number // manual "I drifted" presses
  timeline: Sample[]
  plannedMinutes: number | null
  intention: string
  parked: string[] // thoughts captured mid-session so they stop nagging
  breakPrompted: boolean
  breakMinutes: number
  breakUntil: number | null // set while on a timed break; auto-resumes at this time
  cycleStartMs: number // active time at which the current timebox cycle began (resets after each break)
  promptOpen: boolean // break prompt is showing and hasn't been answered
  awayLogged: boolean // a camera "away" event has been logged and not yet matched by "back"
  sampleAccMs: number // active time not yet turned into a timeline sample
}

export function loadActiveSession(userId: number): ActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<ActiveSession>
    if (s.userId !== userId) return null
    // Sessions saved by an older version lack the newer fields.
    return { plannedMinutes: null, intention: '', parked: [], breakPrompted: false, breakMinutes: 5, breakUntil: null, cycleStartMs: 0, promptOpen: false, awayLogged: false, sampleAccMs: 0, ...s } as ActiveSession
  } catch {
    return null
  }
}

export function saveActiveSession(s: ActiveSession | null) {
  try {
    const wasActive = localStorage.getItem(ACTIVE_SESSION_KEY) !== null
    if (s) localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(ACTIVE_SESSION_KEY)
    if (wasActive !== !!s) window.dispatchEvent(new Event(ACTIVE_SESSION_EVENT))
  } catch {
    // The session still runs in memory, but a reload would lose it.
    toastOnce('storage-session', { tone: 'warn', message: 'Your session can’t be saved on this device, so don’t reload or close this tab until you finish it.' })
  }
}

export function activeMs(s: ActiveSession, now = Date.now()) {
  const pausedNow = s.pausedAt ? now - s.pausedAt : 0
  return Math.max(0, now - s.startedAt - s.pausedMs - pausedNow)
}

export function focusScore(s: ActiveSession, now = Date.now()) {
  const total = activeMs(s, now)
  if (!s.sensed) return Math.max(0, 100 - s.distractions * 10)
  if (total < 1000) return 100
  return Math.round((s.attentiveMs / total) * 100)
}

export function formatClock(ms: number) {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatDuration(ms: number) {
  const mins = Math.round(ms / 60000)
  if (mins < 1) return `${Math.round(ms / 1000)}s`
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}
