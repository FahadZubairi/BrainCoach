'use client'

import { useCallback, useEffect, useState } from 'react'
import { toastOnce } from './toast'

// Small per-user preferences kept in localStorage.
export interface Prefs {
  dailyGoalMinutes: number
  plannedMinutes: number | null // last timebox chosen; null = open-ended
  breakMinutes: number // 1–15
  strictMode: boolean
  tracking: 'extension' | 'screen' | 'off' // how browser activity is tracked during sessions
  lastIntention: string
}

const DEFAULTS: Prefs = {
  dailyGoalMinutes: 120,
  plannedMinutes: 50,
  breakMinutes: 5,
  strictMode: false,
  tracking: 'extension',
  lastIntention: '',
}

export function usePrefs(userId: number | undefined) {
  const key = userId ? `braincoach_prefs_${userId}` : null
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)

  useEffect(() => {
    if (!key) return
    try {
      const saved = JSON.parse(localStorage.getItem(key) || 'null')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount (pages are prerendered)
      if (saved) setPrefs({ ...DEFAULTS, ...saved })
    } catch { /* ignore */ }
  }, [key])

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      if (key) {
        try { localStorage.setItem(key, JSON.stringify(next)) } catch { toastOnce('storage', { tone: 'warn', message: 'This browser isn’t letting BrainCoach save data on this device (storage full or blocked). Changes may be lost when you close the tab.' }) }
      }
      return next
    })
  }, [key])

  return { prefs, update }
}

// ── Parked thoughts: captured during a session, reviewed afterwards ──
export interface ParkedThought {
  id: number
  text: string
  createdAt: number
}

export function useParked(userId: number | undefined) {
  const key = userId ? `braincoach_parked_${userId}` : null
  const [items, setItems] = useState<ParkedThought[]>([])

  useEffect(() => {
    if (!key) return
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount (pages are prerendered)
      setItems(JSON.parse(localStorage.getItem(key) || '[]'))
    } catch { /* ignore */ }
  }, [key])

  const save = useCallback((next: ParkedThought[]) => {
    setItems(next)
    if (key) {
      try { localStorage.setItem(key, JSON.stringify(next)) } catch { toastOnce('storage', { tone: 'warn', message: 'This browser isn’t letting BrainCoach save data on this device (storage full or blocked). Changes may be lost when you close the tab.' }) }
    }
  }, [key])

  const addMany = useCallback((texts: string[]) => {
    if (!key || texts.length === 0) return
    let current: ParkedThought[] = []
    try { current = JSON.parse(localStorage.getItem(key) || '[]') } catch { /* ignore */ }
    const now = Date.now()
    save([...texts.map((text, i) => ({ id: now + i, text, createdAt: now })), ...current])
  }, [key, save])

  const remove = useCallback((id: number) => save(items.filter(i => i.id !== id)), [items, save])

  return { items, addMany, remove }
}
