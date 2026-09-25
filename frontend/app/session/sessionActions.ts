'use client'

import { Dispatch, SetStateAction } from 'react'
import type {
  FocusEventType, MessageResponse, PublicUser, SessionProfileResponse, SessionResponse, StartSessionRequest,
} from '../../../shared/api'
import { ActiveSession } from '../lib/activeSession'
import { api } from '../lib/api'
import { TabStatus, useExtension } from '../lib/extension'
import { Prefs, useParked } from '../lib/prefs'
import * as engine from '../lib/sessionEngine'
import { useScreenCheck } from '../lib/useScreenCheck'
import { Phase, chime, notifyIfHidden } from './constants'
import type { SessionSummary } from './useSessionController'

export interface StartInput {
  taskDescription: string
  energyLevel: number
  exercisedToday: boolean
  intention: string
}

interface Deps {
  user: PublicUser | null
  prefs: Prefs
  updatePrefs: (patch: Partial<Prefs>) => void
  parkedStore: ReturnType<typeof useParked>
  /** Latest values at call time (actions run from timers and extension messages, not just renders). */
  get: () => { session: ActiveSession | null; ext: ReturnType<typeof useExtension>; tracker: { status: TabStatus | null } }
  commit: (next: ActiveSession | null) => void
  logEvent: (sessionId: number, type: FocusEventType, notes?: string) => Promise<void>
  screen: ReturnType<typeof useScreenCheck>
  tracking: Prefs['tracking']
  setPhase: Dispatch<SetStateAction<Phase>>
  setSummary: Dispatch<SetStateAction<SessionSummary | null>>
  setCoachNote: Dispatch<SetStateAction<string>>
  setError: Dispatch<SetStateAction<string>>
  starting: boolean
  ending: boolean
  setStarting: Dispatch<SetStateAction<boolean>>
  setEnding: Dispatch<SetStateAction<boolean>>
}

// Everything the user can do to a session. Each action applies an engine rule, then its side effects.
// A plain factory (not a hook): it only closes over callbacks, so it can be rebuilt every render.
export function createSessionActions(d: Deps) {
  const { starting, ending, setStarting, setEnding } = d
  const ext = () => d.get().ext
  const current = () => d.get().session

  async function start(input: StartInput) {
    if (!input.taskDescription.trim() || !d.user || starting) return
    // Screen sharing must be requested straight from the click, before any other await.
    if (d.tracking === 'screen' && d.screen.state !== 'active') await d.screen.request()
    setStarting(true)
    d.setError('')
    const plannedMinutes = d.prefs.plannedMinutes || null
    const body: StartSessionRequest = { ...input, taskDescription: input.taskDescription.trim(), plannedMinutes, intention: input.intention.trim() || null }

    try {
      const profileReq = api<SessionProfileResponse>('/coach/session-profile', {
        method: 'POST', body: JSON.stringify({ taskDescription: body.taskDescription }),
      }).then(r => r.profile).catch(() => null)
      const { session: created } = await api<SessionResponse>('/sessions/start', { method: 'POST', body: JSON.stringify(body) })

      // Ask for notification permission in context (right after a deliberate click), only when timeboxed.
      if (plannedMinutes && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
      if (body.intention) d.updatePrefs({ lastIntention: body.intention })

      const s = engine.createSession({
        sessionId: created.id, userId: d.user.id, taskDescription: body.taskDescription, plannedMinutes,
        intention: body.intention ?? '', breakMinutes: d.prefs.breakMinutes, now: Date.now(),
      })
      d.commit(s)
      d.setCoachNote('')
      d.setPhase('active')

      // Non-blocking: the tab profile and the coach's note arrive while you're already working.
      profileReq.then(profile => {
        const cur = current()
        if (profile && cur?.sessionId === s.sessionId) d.commit({ ...cur, profile })
      })
      api<MessageResponse>('/coach/pre-session', {
        method: 'POST', body: JSON.stringify({ taskDescription: body.taskDescription, energyLevel: body.energyLevel, exercisedToday: body.exercisedToday }),
      }).then(r => d.setCoachNote(r.message)).catch(() => { /* optional; the session works without it */ })
    } catch (err) {
      d.setError(err instanceof Error ? err.message : 'Could not start the session.')
    } finally {
      setStarting(false)
    }
  }

  function startBreak() {
    const s = current()
    if (!s || s.pausedAt) return
    const next = engine.startBreak(s, Date.now())
    d.commit(next)
    ext().send({ type: 'PAUSE_SESSION' })
    ext().send({ type: 'BREAK_STARTED', breakUntil: next.breakUntil ?? Date.now() })
    d.logEvent(s.sessionId, 'break', `Break (${s.breakMinutes} min)`)
  }

  function endBreak(auto: boolean) {
    const s = current()
    if (!s?.pausedAt) return
    d.commit(engine.endBreak(s, Date.now()))
    ext().send({ type: 'RESUME_SESSION' })
    ext().send({ type: 'BREAK_CLOSE', reason: auto ? 'over' : 'resumed' })
    if (auto) {
      chime()
      notifyIfHidden('Break’s over', `Back to: ${s.taskDescription}`)
    }
  }

  function dismissBreak() {
    const s = current()
    if (s) d.commit(engine.dismissBreak(s, Date.now()))
    ext().send({ type: 'BREAK_CLOSE', reason: 'dismissed' })
  }

  function togglePause() {
    const s = current()
    if (!s) return
    if (s.pausedAt) {
      if (s.breakUntil) return endBreak(false)
      d.commit(engine.resume(s, Date.now()))
      ext().send({ type: 'RESUME_SESSION' })
    } else {
      d.commit(engine.pause(s, Date.now()))
      ext().send({ type: 'PAUSE_SESSION' })
      d.logEvent(s.sessionId, 'break', 'Paused')
    }
  }

  function parkThought(text: string) {
    const s = current()
    if (s && text.trim()) d.commit({ ...s, parked: [...s.parked, text.trim()] })
  }

  function markDistracted() {
    const s = current()
    if (!s) return
    d.commit({ ...s, distractions: s.distractions + 1 })
    d.logEvent(s.sessionId, 'lost_focus', 'Self-reported')
  }

  async function finish(abandoned: boolean) {
    const s = current()
    if (!s || ending) return
    setEnding(true)
    d.setError('')
    const t = Date.now()
    const { final, score, ms } = engine.finalize(s, t)
    try {
      await api<SessionResponse>(`/sessions/${final.sessionId}/end`, {
        method: 'PATCH', body: JSON.stringify({ status: abandoned ? 'abandoned' : 'completed', focusScore: score }),
      })
      ext().send({ type: 'END_SESSION' })
      d.parkedStore.addMany(final.parked)
      d.commit(null)
      d.setSummary({ session: final, score, ms, abandoned, tabLog: d.get().tracker.status?.log ?? [], endedAt: t })
      d.screen.stop()
      d.setPhase('ended')
    } catch (err) {
      d.setError(`${err instanceof Error ? err.message : 'Could not save the session.'} Your session is still running and saved on this device.`)
    } finally {
      setEnding(false)
    }
  }

  function reset() {
    d.setSummary(null)
    d.setPhase('setup')
  }

  return { start, startBreak, endBreak, dismissBreak, togglePause, parkThought, markDistracted, finish, reset }
}
