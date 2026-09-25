'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// The extension's content script (extensions/content.js) relays window.postMessage traffic to its
// service worker, so the app doesn't need the extension ID.

export interface TabInfo {
  url: string
  host: string
  title: string
  relevant: boolean
  reason: string
  neutral?: boolean
  /** The extension is still asking the backend about this site. */
  pending?: boolean
}

// One stretch of time on a site with the same verdict, recorded by the extension.
export interface TabLogEntry {
  host: string
  title: string
  relevant: boolean
  neutral: boolean
  reason: string
  start: number
  end: number | null
}

export interface TabStatus {
  active: boolean
  paused: boolean
  tab: TabInfo | null
  offTaskSince: number | null
  log: TabLogEntry[]
  lastCheckedAt: number | null
}

type Outgoing =
  | { type: 'START_SESSION'; sessionId: number; token: string; taskDescription: string; profile: unknown; apiBase: string; strict: boolean; intention: string }
  | { type: 'BREAK_PROMPT'; plannedMinutes: number; breakMinutes: number; taskDescription: string }
  | { type: 'BREAK_STARTED'; breakUntil: number }
  | { type: 'BREAK_CLOSE'; reason: 'dismissed' | 'over' | 'resumed' }
  | { type: 'PAUSE_SESSION' | 'RESUME_SESSION' | 'END_SESSION' | 'GET_STATUS' | 'PING' }

export function sendToExtension(message: Outgoing) {
  window.postMessage({ source: 'braincoach-app', ...message }, window.location.origin)
}

export type BreakAction = 'accept' | 'dismiss' | 'continue'

// onBreakAction: the user answered the break window the extension opened over another tab.
export function useExtension(onBreakAction?: (action: BreakAction) => void) {
  const actionRef = useRef(onBreakAction)
  useEffect(() => { actionRef.current = onBreakAction })
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState<TabStatus | null>(null)

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== 'braincoach-extension') return
      const data = event.data
      if (data.type === 'EXTENSION_READY') setConnected(true)
      if (data.type === 'EXTENSION_GONE') setConnected(false)
      if (data.type === 'BREAK_ACTION') actionRef.current?.(data.action)
      if (data.type === 'TAB_STATUS') {
        setConnected(true)
        setStatus({
          active: data.active, paused: data.paused, tab: data.tab, offTaskSince: data.offTaskSince,
          log: Array.isArray(data.log) ? data.log : [], lastCheckedAt: data.lastCheckedAt ?? null,
        })
      }
    }
    window.addEventListener('message', onMessage)
    sendToExtension({ type: 'PING' })
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const send = useCallback((message: Outgoing) => sendToExtension(message), [])

  return { connected, status, send }
}
