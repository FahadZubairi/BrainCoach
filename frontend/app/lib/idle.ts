'use client'

import { useEffect, useRef } from 'react'
import { api } from './api'

// Idle sign-out: after 30 minutes without using BrainCoach (no clicks, typing, scrolling), the user is
// signed out and has to sign in again. A running focus session calls keepAlive(), so it never times out.
//
// Two layers: this timer signs out an open tab promptly, and the server's session cookie expires on its
// own after 30 idle minutes, which covers closed tabs and sleeping laptops. Activity also pings the
// server now and then so someone reading a page for a while isn't signed out server-side.

export const IDLE_LIMIT_MS = 30 * 60_000
const PING_EVERY_MS = 10 * 60_000
const STORE_EVERY_MS = 15_000
// Shared through localStorage so activity in one BrainCoach tab keeps the others signed in too.
const KEY = 'braincoach:last-activity'

let lastActivity = Date.now()
let lastStored = 0
let lastPing = Date.now()

function stored() {
  try {
    return Number(localStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}

export function markActivity(now = Date.now()) {
  lastActivity = now
  if (now - lastStored >= STORE_EVERY_MS) {
    lastStored = now
    try { localStorage.setItem(KEY, String(now)) } catch { /* storage blocked: this tab still tracks itself */ }
  }
  if (now - lastPing >= PING_EVERY_MS) {
    lastPing = now
    // Renews the server's idle deadline. If it fails, the next real request reports the problem.
    api('/auth/me').catch(() => {})
  }
}

let sessionRunning = false

/**
 * A focus session is running (or stopped). While it runs the app never idles out, even if the laptop
 * slept and the idle check wakes up before the session's own heartbeat does.
 */
export function setSessionRunning(on: boolean) {
  sessionRunning = on
  if (on) markActivity()
}

export const idleFor = (now = Date.now()) => now - Math.max(lastActivity, stored())

const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove', 'scroll'] as const

export function useIdleTimeout(enabled: boolean, onTimeout: () => void) {
  const timeoutRef = useRef(onTimeout)
  useEffect(() => { timeoutRef.current = onTimeout })

  useEffect(() => {
    if (!enabled) return
    markActivity()
    let timedOut = false
    // Checked on a timer and whenever the tab comes back, since background timers can be delayed
    // for a long time (or the laptop slept).
    const check = () => {
      if (sessionRunning) {
        markActivity()
        return false
      }
      if (timedOut || idleFor() < IDLE_LIMIT_MS) return false
      timedOut = true
      timeoutRef.current()
      return true
    }
    let throttle = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - throttle < 1000) return
      throttle = now
      // Check first: the mouse move that greets a returning user mustn't count as having stayed active.
      if (!check()) markActivity(now)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') check() }

    EVENTS.forEach(e => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    const id = setInterval(check, 30_000)
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
      clearInterval(id)
    }
  }, [enabled])
}
