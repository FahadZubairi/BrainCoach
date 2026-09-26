'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ScreenVerdict } from '../../../shared/api'
import { ApiError, api } from './api'
import { toastOnce } from './toast'
import { TabLogEntry, TabStatus } from './extension'
import { frameDistance, grabFrame } from './screenFrame'

// Screen check: the no-extension alternative to tab tracking. The user shares their screen once per
// session. While they're away from BrainCoach a snapshot is taken every 5 s. It's only sent for an AI
// verdict when the screen has visibly changed (or the last verdict is a minute old); otherwise the last
// verdict still applies. Frames are never stored.

export type ScreenState = 'off' | 'requesting' | 'active' | 'denied' | 'stopped' | 'unsupported'
/** What was shared. Anything but the whole screen only shows that one tab/window. */
export type SharedSurface = 'monitor' | 'window' | 'browser' | 'unknown'

const CHECK_EVERY_MS = 5_000
const CHECK_AFTER_LEAVING_MS = 1_000
// Mean greyscale difference (0–255) below which two snapshots count as the same screen.
const SAME_SCREEN_DISTANCE = 6
const REUSE_VERDICT_MS = 60_000
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
    let busy = false // never overlap checks: a slow AI answer just delays the next snapshot
    let offSince: number | null = null
    let lostLogged = false
    let log: TabLogEntry[] = []
    let timer: ReturnType<typeof setTimeout> | undefined
    let last: { print: Uint8ClampedArray; verdict: ScreenVerdict; at: number } | null = null

    const record = (entry: Omit<TabLogEntry, 'start' | 'end'>, now: number) => {
      const prev = log[log.length - 1]
      if (prev && prev.end === null && prev.host === entry.host && prev.relevant === entry.relevant) return
      if (prev && prev.end === null) prev.end = now
      log = [...log, { ...entry, start: now, end: null }].slice(-LOG_LIMIT)
    }
    const publish = (tab: TabStatus['tab'], now: number) =>
      setStatus({ active: true, paused: live.current.paused, tab, offTaskSince: offSince, log: log.map(e => ({ ...e })), lastCheckedAt: now })

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(check, ms)
    }

    const apply = (verdict: ScreenVerdict, at: number) => {
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

    async function check() {
      if (cancelled) return
      schedule(CHECK_EVERY_MS)
      if (busy || live.current.paused) return
      const now = Date.now()

      // On BrainCoach itself there's nothing to judge, and no need to send a frame.
      if (onBrainCoach()) {
        offSince = null
        last = null
        record({ host: 'BrainCoach', title: 'BrainCoach', relevant: true, neutral: true, reason: 'This tab' }, now)
        publish({ url: '', host: 'BrainCoach', title: 'BrainCoach', relevant: true, reason: 'This tab', neutral: true }, now)
        return
      }

      busy = true
      try {
        const track = trackRef.current
        const frame = track ? await grabFrame(track) : null
        if (!frame || cancelled) return

        // Same screen as the last analysed one: the verdict still holds, so skip the upload.
        if (last && !last.verdict.unavailable && now - last.at < REUSE_VERDICT_MS
          && frameDistance(frame.print, last.print) < SAME_SCREEN_DISTANCE) {
          apply(last.verdict, now)
          return
        }

        let verdict: ScreenVerdict
        try {
          verdict = await api<ScreenVerdict>('/coach/evaluate-screen', {
            method: 'POST',
            body: JSON.stringify({ image: frame.image, taskDescription: live.current.taskDescription }),
          })
        } catch (err) {
          // No penalty either way; the next snapshot tries again. Rate limits are expected, outages aren't.
          if (!(err instanceof ApiError && err.status === 429)) {
            toastOnce('screen-check', { tone: 'warn', message: 'Screen check couldn’t reach BrainCoach. It will keep trying.' })
          }
          return
        }
        if (cancelled) return
        const at = Date.now()
        last = { print: frame.print, verdict, at }
        apply(verdict, at)
      } finally {
        busy = false
      }
    }

    // Leaving BrainCoach is the moment drift usually starts: look right away instead of waiting a round.
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
