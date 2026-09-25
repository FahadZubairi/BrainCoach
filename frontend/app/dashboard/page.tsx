'use client'

import { useCallback, useEffect, useState } from 'react'
import type { HistoryResponse } from '../../../shared/api'
import AppShell from '../components/AppShell'
import NavLink from '../components/NavLink'
import { Icon } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { SessionRecord, Stats, api } from '../lib/api'
import { doneToday, useHabits } from '../lib/habits'
import { useParked, usePrefs } from '../lib/prefs'
import { CheckInCard } from './CheckInCard'
import { GlanceSection } from './GlanceSection'
import { HabitsCard, ParkedSection, RecentSessions } from './Lists'

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  return (
    <AppShell>
      <Today />
    </AppShell>
  )
}

function Today() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<SessionRecord[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const { habits, toggleToday } = useHabits(user?.id)
  const { prefs, update: updatePrefs } = usePrefs(user?.id)
  const parked = useParked(user?.id)

  const load = useCallback(() => {
    setLoadError('')
    Promise.all([api<Stats>('/sessions/stats'), api<HistoryResponse>('/sessions/history')])
      .then(([s, h]) => {
        setStats(s)
        setRecent(h.sessions.filter(x => x.status !== 'active').slice(0, 4))
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Could not load today’s data.'))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    if (user) load()
  }, [user, load])

  const name = user?.email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div>
      <header className="mb-12">
        <p className="text-sm text-fg-3">{date}</p>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.05] text-fg sm:text-[56px]">
          {greeting()}, <span className="italic text-fg-2">{name}</span>.
        </h1>
      </header>

      {loadError && (
        <div role="alert" className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <span>{loadError}</span>
          <button type="button" onClick={load} className="shrink-0 cursor-pointer underline underline-offset-4">Retry</button>
        </div>
      )}

      {/* Primary action — the one thing this screen exists for */}
      <NavLink href="/session" className="group flex items-center justify-between gap-6 rounded-2xl bg-accent px-6 py-6 text-accent-ink transition-colors hover:bg-accent-hover sm:px-8 sm:py-7">
        <span>
          <span className="block font-serif text-3xl leading-tight sm:text-4xl">Start a focus session</span>
          <span className="mt-1 block text-sm opacity-70">Camera and tab tracking keep you honest.</span>
        </span>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-ink/10 text-xl transition-transform group-hover:translate-x-1">
          <Icon name="arrow" />
        </span>
      </NavLink>

      <GlanceSection stats={stats} prefs={prefs} updatePrefs={updatePrefs} habitsDone={habits.filter(doneToday).length} habitsTotal={habits.length} />

      <div className="reveal mt-6 grid gap-6 lg:grid-cols-5">
        <CheckInCard stats={stats} />
        <HabitsCard habits={habits} onToggle={toggleToday} />
      </div>

      <ParkedSection items={parked.items} onHandled={parked.remove} />
      <RecentSessions sessions={recent} error={loadError} onRetry={load} />
    </div>
  )
}
