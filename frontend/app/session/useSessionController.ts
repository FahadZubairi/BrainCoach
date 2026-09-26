'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FocusEventType, ExtensionTokenResponse } from '../../../shared/api'
import { useAuth } from '../context/AuthContext'
import { ActiveSession, loadActiveSession, saveActiveSession } from '../lib/activeSession'
import { markActivity, setSessionRunning } from '../lib/idle'
import { absoluteApiBase, api } from '../lib/api'
import { TabLogEntry, TabStatus, useExtension } from '../lib/extension'
import { useParked, usePrefs } from '../lib/prefs'
import * as engine from '../lib/sessionEngine'
import { useFaceTracker } from '../lib/useFaceTracker'
import { useScreenCheck } from '../lib/useScreenCheck'
import { CAMERA_PREF_KEY, Phase, chime, notifyIfHidden } from './constants'
import { createSessionActions } from './sessionActions'
import { toastOnce } from '../lib/toast'

export interface SessionSummary {
  session: ActiveSession
  score: number
  ms: number
  abandoned: boolean
  tabLog: TabLogEntry[]
  endedAt: number
}

// Owns the running session: state, the once-a-second tracking loop, and hand-off to the extension.
// The rules themselves live in lib/sessionEngine.ts; user actions live in sessionActions.ts.
export function useSessionController() {
  const { user } = useAuth()
  const { prefs, update: updatePrefs } = usePrefs(user?.id)
  const parkedStore = useParked(user?.id)

  const [phase, setPhase] = useState<Phase>('setup')
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [coachNote, setCoachNote] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [trackerError, setTrackerError] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)

  const paused = !!session?.pausedAt
  const tracking = prefs.tracking
  const face = useFaceTracker(cameraOn && phase !== 'ended' && !paused)
  // Answers from the extension's break window. Routed through a ref because the actions are created below.
  const actionsRef = useRef<ReturnType<typeof createSessionActions> | null>(null)
  const ext = useExtension(action => {
    const a = actionsRef.current
    if (!a) return
    if (action === 'accept') a.startBreak()
    else if (action === 'dismiss') a.dismissBreak()
    else a.endBreak(false)
  })

  const logEvent = useCallback(async (sessionId: number, type: FocusEventType, notes?: string) => {
    try {
      await api(`/sessions/${sessionId}/event`, { method: 'POST', body: JSON.stringify({ type, notes }) })
    } catch {
      // Losing one event mustn't interrupt the session, but say so if it keeps happening.
      toastOnce('log-event', { tone: 'warn', message: 'Some focus activity couldn’t be saved. Check your connection; your session keeps running.' })
    }
  }, [])

  const screen = useScreenCheck({
    enabled: tracking === 'screen' && phase === 'active',
    paused,
    taskDescription: session?.taskDescription ?? '',
    onEvent: (type, notes) => {
      const s = live.current.session
      if (s) logEvent(s.sessionId, type, notes)
    },
  })

  const tracker: { connected: boolean; status: TabStatus | null } =
    tracking === 'extension' ? { connected: ext.connected, status: ext.status }
    : tracking === 'screen' ? { connected: screen.state === 'active', status: screen.status }
    : { connected: false, status: null }

  // Latest values for the interval and callbacks, without restarting them every render.
  const live = useRef({ face, ext, session, tracker })
  useLayoutEffect(() => {
    live.current = { ...live.current, face, ext, tracker }
  })

  const getLive = useCallback(() => live.current, [])

  // `live` is a latest-values ref: written here and in the layout effect, read only from timers and
  // event callbacks (never during render). The compiler lint can't see that these callbacks only run
  // outside render, hence the two targeted suppressions below.
  const commit = useCallback((next: ActiveSession | null) => {
    // eslint-disable-next-line react-hooks/immutability -- ref write inside a callback, not during render
    live.current = { ...live.current, session: next }
    setSession(next)
    saveActiveSession(next)
  }, [])

  // eslint-disable-next-line react-hooks/refs -- getLive/commit are only invoked from events and timers
  const actions = createSessionActions({
    user, prefs, updatePrefs, parkedStore, get: getLive, commit, logEvent, screen, tracking,
    setPhase, setSummary, setCoachNote, setError, starting, ending, setStarting, setEnding,
  })
  useEffect(() => { actionsRef.current = actions })

  // Restore an in-progress session after a reload, and the camera preference.
  useEffect(() => {
    if (!user) return
    const saved = loadActiveSession(user.id)
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount (pages are prerendered)
      setSession(saved)
      setPhase('active')
    }
    try { setCameraOn(localStorage.getItem(CAMERA_PREF_KEY) === '1') } catch { /* storage blocked */ }
  }, [user])

  const toggleCamera = useCallback((on: boolean) => {
    setCameraOn(on)
    try { localStorage.setItem(CAMERA_PREF_KEY, on ? '1' : '0') } catch { /* storage blocked */ }
  }, [])

  // Hand the session to the extension when it (re)connects, with its own short-lived, scoped token.
  useEffect(() => {
    if (phase !== 'active' || !session || !ext.connected || tracking !== 'extension') return
    let cancelled = false
    api<ExtensionTokenResponse>('/auth/extension-token')
      .then(({ token }) => {
        if (cancelled) return
        setTrackerError('')
        ext.send({
          type: 'START_SESSION', sessionId: session.sessionId, token, taskDescription: session.taskDescription,
          profile: session.profile, apiBase: absoluteApiBase(), strict: prefs.strictMode, intention: session.intention,
        })
        if (session.pausedAt) ext.send({ type: 'PAUSE_SESSION' })
      })
      .catch(() => { if (!cancelled) setTrackerError('Couldn’t connect tab tracking. It will retry when the extension reconnects.') })
    return () => { cancelled = true }
    // Only on connect / session change, not on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.sessionId, session?.profile, ext.connected, prefs.strictMode, tracking])

  // The tracking loop: once a second, attribute elapsed time to focused / away / off-task.
  const lastTick = useRef(0)
  useEffect(() => {
    if (phase !== 'active') return
    lastTick.current = Date.now()
    const id = setInterval(() => {
      const t = Date.now()
      // Real elapsed time, so throttled background-tab timers don't lose seconds.
      const deltaMs = Math.min(t - lastTick.current, 5 * 60_000)
      lastTick.current = t
      setNow(t)

      const { face, session, tracker } = live.current
      if (!session) return
      const result = engine.tick(session, {
        now: t,
        deltaMs,
        camera: { live: face.state === 'present' || face.state === 'absent', away: face.state === 'absent', present: face.state === 'present', absentSince: face.absentSince },
        tracker: {
          live: tracker.connected && !!tracker.status?.active,
          offTask: tracker.connected && !!tracker.status?.active && !!tracker.status.tab && !tracker.status.tab.relevant,
        },
      })

      if (result.breakOver) {
        actionsRef.current?.endBreak(true)
        return
      }
      for (const e of result.events) logEvent(session.sessionId, e.type, e.notes)
      if (result.promptBreak) {
        chime()
        // The extension shows the prompt as a pop-up window over whatever tab you're on.
        live.current.ext.send({ type: 'BREAK_PROMPT', plannedMinutes: session.plannedMinutes ?? 0, breakMinutes: session.breakMinutes, taskDescription: session.taskDescription })
        notifyIfHidden('Timebox complete', `${session.plannedMinutes} minutes on "${session.taskDescription}". Time for a short break.`)
      }
      commit(result.next)
    }, 1000)
    return () => clearInterval(id)
    // actions/commit/logEvent only touch refs and stable setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // A running session is "using the app" even with no clicks: no idle sign-out, and a heartbeat keeps the
  // server-side sign-in fresh too.
  useEffect(() => {
    if (phase !== 'active') return
    setSessionRunning(true)
    const id = setInterval(() => markActivity(), 60_000)
    return () => {
      clearInterval(id)
      setSessionRunning(false)
    }
  }, [phase])

  // Warn before closing the tab mid-session (the session survives a reload, but shouldn't be forgotten).
  useEffect(() => {
    if (phase !== 'active') return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [phase])

  return {
    phase, session, summary, now, paused, error, trackerError, coachNote, setCoachNote,
    prefs, updatePrefs, face, cameraOn, toggleCamera, ext, screen, tracker, tracking, starting, ending,
    ...actions,
  }
}

export type SessionController = ReturnType<typeof useSessionController>
