'use client'

import { useCallback, useEffect, useState } from 'react'
import { toastOnce } from './toast'

export interface Habit {
  id: number
  name: string
  history: string[] // local dates (YYYY-MM-DD) the habit was completed
}

interface LegacyHabit {
  id: number
  name: string
  streak?: number
  lastCompleted?: string | null
}

const DEFAULTS = ['Move for 30 minutes', 'Sleep 7+ hours', 'No phone in the first hour', 'Drink 2L of water', 'Read for 20 minutes']

export function dayKey(d: Date = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysAgo(n: number, from: Date = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() - n)
  return d
}

// Consecutive days ending today — or yesterday, so a streak isn't shown as broken before you've had the chance today.
export function streakOf(habit: Habit) {
  const done = new Set(habit.history)
  let start = done.has(dayKey()) ? 0 : 1
  let streak = 0
  while (done.has(dayKey(daysAgo(start)))) {
    streak++
    start++
  }
  return streak
}

export function doneToday(habit: Habit) {
  return habit.history.includes(dayKey())
}

// Older versions stored { streak, lastCompleted: Date.toDateString() }. Rebuild a history from that.
function migrate(raw: (Habit | LegacyHabit)[]): Habit[] {
  return raw.map(h => {
    if ('history' in h && Array.isArray(h.history)) return h as Habit
    const legacy = h as LegacyHabit
    const history: string[] = []
    if (legacy.lastCompleted) {
      const last = new Date(legacy.lastCompleted)
      if (!isNaN(last.getTime())) {
        for (let i = 0; i < Math.max(1, legacy.streak || 1); i++) history.push(dayKey(daysAgo(i, last)))
      }
    }
    return { id: legacy.id, name: legacy.name, history }
  })
}

export function useHabits(userId: number | undefined) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loaded, setLoaded] = useState(false)
  const key = userId ? `braincoach_habits_${userId}` : null

  useEffect(() => {
    if (!key) return
    let initial: Habit[]
    try {
      const saved = localStorage.getItem(key)
      initial = saved ? migrate(JSON.parse(saved)) : DEFAULTS.map((name, i) => ({ id: i + 1, name, history: [] }))
    } catch {
      initial = []
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount (pages are prerendered)
    setHabits(initial)
    setLoaded(true)
  }, [key])

  const save = useCallback((next: Habit[]) => {
    setHabits(next)
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // Keep the in-memory state, but tell the user it won't survive a reload.
      toastOnce('storage', { tone: 'warn', message: 'This browser isn’t letting BrainCoach save data on this device (storage full or blocked). Changes may be lost when you close the tab.' })
    }
  }, [key])

  const toggleToday = useCallback((id: number) => {
    const today = dayKey()
    save(habits.map(h => {
      if (h.id !== id) return h
      return doneToday(h)
        ? { ...h, history: h.history.filter(d => d !== today) }
        : { ...h, history: [...h.history, today] }
    }))
  }, [habits, save])

  const add = useCallback((name: string) => {
    save([...habits, { id: Date.now(), name, history: [] }])
  }, [habits, save])

  const remove = useCallback((id: number) => {
    save(habits.filter(h => h.id !== id))
  }, [habits, save])

  const rename = useCallback((id: number, name: string) => {
    save(habits.map(h => (h.id === id ? { ...h, name } : h)))
  }, [habits, save])

  return { habits, loaded, toggleToday, add, remove, rename }
}
