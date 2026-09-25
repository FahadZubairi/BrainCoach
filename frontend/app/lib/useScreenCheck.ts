'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScreenVerdict } from '../../../shared/api'
import { ApiError, api } from './api'
import { toastOnce } from './toast'
import { TabLogEntry, TabStatus } from './extension'
import { grabFrame } from './screenFrame'

// Screen check: the no-extension alternative to tab tracking. The user shares their screen once per
// session. A check runs ~5 s after they leave the BrainCoach tab, then every 2 minutes while away.
// Each check sends one downscaled frame for an on-task verdict; frames are never stored.

export type ScreenState = 'off' | 'requesting' | 'active' | 'denied' | 'stopped' | 'unsupported'
/** What was shared. Anything but the whole screen only shows that one tab/window. */
export type SharedSurface = 'monitor' | 'window' | 'browser' | 'unknown'

const CHECK_EVERY_MS = 2 * 60_000
const CHECK_AFTER_LEAVING_MS = 5_000
const OFF_TASK_LOG_MS = 2 * 60_000
const LOG_LIMIT = 60

export function screenCheckSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia
}

const onBrainCoach = () => document.visibilityState === 'visible' && document.hasFocus()

export function useScreenCheck({ enabled, paused, taskDescription, onEvent }: {
  enabled: boolean // tracking mode is "screen" and a session is running
  paused: boolean
  taskDescription: string
  onEvent: (type: 'focused' | 'lost_focus', notes: string) => void
}) {
  const [state, setState] = useState<ScreenState>('off')
  const [surface, setSurface] = useState<SharedSurface>('unknown')
  const [status, setStatus] = useState<TabStatus | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const live = useRef({ paused, taskDescription, onEvent })
  useEffect(() => { live.current = { paused, taskDescription, onEvent } })

  const releaseStream = useCallback(() => {
    trackRef.current?.stop()
    trackRef.current = null
  }, [])

  const stop = useCallback(() => {
    releaseStream()
    setState(s => (s === 'active' ? 'off' : s))
  }, [releaseStream])

  // Must be called from a click: browsers require a user gesture for screen sharing.
  const request = useCallback(async () => {
    if (!screenCheckSupported()) {
      setState('unsupported')
      return false
    }
    setState('requesting')
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        // Hints: offer the whole screen first and hide this tab from the picker.
        video: { displaySurface: 'monitor', frameRate: 1 },
        audio: false,
        selfBrowserSurface: 'exclude',
        monitorTypeSurfaces: 'include',
      } as DisplayMediaStreamOptions)
      const track = stream.getVideoTracks()[0]
      trackRef.current?.stop()
      trackRef.current = track
      const shared = (track.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface
      setSurface(shared === 'monitor' || shared === 'window' || shared === 'browser' ? shared : 'unknown')
      // The user can end sharing from the browser's own "Stop sharing" bar.
      track.addEventListener('ended', () => {
        trackRef.current = null
        setState('stopped')
      })
      setState('active')
      return true
    } catch {
      setState('denied')
      return false
    }
  }, [])

  useEffect(() => {
    if (!enabled) releaseStream()
  }, [enabled, releaseStream])

  useEffect(() => () => releaseStream(), [releaseStream])

  // The checking loop
  useEffect(() => {
    if (!enabled || state !== 'active') return
    let cancelled = false
    let offSince: number | null = null
    let lostLogged = false
    let log: TabLogEntry[] = []
    let timer: ReturnType<typeof setTimeout> | undefined

    const record = (entry: Omit<TabLogEntry, 'start' | 'end'>, now: number) => {
      const last = log[log.length - 1]
      if (last && last.end === null && last.host === entry.host && last.relevant === entry.relevant) return
      if (last && last.end === null) last.end = now
      log = [...log, { ...entry, start: now, end: null }].slice(-LOG_LIMIT)
    }
    const publish = (tab: TabStatus['tab'], now: number) =>
      setStatus({ active: true, paused: live.current.paused, tab, offTaskSince: offSince, log: log.map(e => ({ ...e })), lastCheckedAt: now })

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(check, ms)
    }

    async function check() {
      if (cancelled) return
      schedule(CHECK_EVERY_MS)
      if (live.current.paused) return
      const now = Date.now()

      // On BrainCoach itself there's nothing to judge, and no need to send a frame.
      if (onBrainCoach()) {
        offSince = null
        record({ host: 'BrainCoach', title: 'BrainCoach', relevant: true, neutral: true, reason: 'This tab' }, now)
        publish({ url: '', host: 'BrainCoach', title: 'BrainCoach', relevant: true, reason: 'This tab', neutral: true }, now)
        return
      }

      const track = trackRef.current
      const image = track ? await grabFrame(track) : null
      if (!image || cancelled) return

      let verdict: ScreenVerdict
      try {
        verdict = await api<ScreenVerdict>('/coach/evaluate-screen', {
          method: 'POST',
          body: JSON.stringify({ image, taskDescription: live.current.taskDescription }),
        })
      } catch (err) {
        // No penalty either way; we just try again next round. Only surface real outages, not rate limits.
        if (!(err instanceof ApiError && err.status === 429)) {
          toastOnce('screen-check', { tone: 'warn', message: 'Screen check couldn’t reach BrainCoach. It will keep trying.' })
        }
        return
      }
      if (cancelled) return

      const at = Date.now()
      const host = verdict.app || verdict.activity || 'Screen'
      const neutral = !!verdict.unavailable
      if (verdict.relevant) {
        if (lostLogged) live.current.onEvent('focused', `Back on task (${host})`)
        offSince = null
        lostLogged = false
      } else {
        offSince = offSince ?? at
        if (!lostLogged && at - offSince >= OFF_TASK_LOG_MS) {
          lostLogged = true
          live.current.onEvent('lost_focus', `Off task on ${host} for 2+ min (screen check)`)
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(`2 minutes on ${host}`, { body: `Back to: ${live.current.taskDescription}`, silent: true })
          }
        }
      }
      record({ host, title: verdict.activity, relevant: verdict.relevant, neutral, reason: verdict.activity }, at)
      publish({ url: '', host, title: verdict.activity, relevant: verdict.relevant, reason: verdict.activity, neutral }, at)
    }

    // Leaving BrainCoach is the moment drift usually starts: check shortly after, then every 2 min.
    const onLeave = () => { if (!onBrainCoach()) schedule(CHECK_AFTER_LEAVING_MS) }
    document.addEventListener('visibilitychange', onLeave)
    window.addEventListener('blur', onLeave)
    schedule(onBrainCoach() ? CHECK_EVERY_MS : CHECK_AFTER_LEAVING_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [enabled, state])

  const supported = screenCheckSupported()
  // When disabled, report "off" regardless of the last live state.
  return enabled
    ? { state, surface, status, request, stop, supported }
    : { state: (state === 'unsupported' ? 'unsupported' : 'off') as ScreenState, surface, status: null, request, stop, supported }
}
