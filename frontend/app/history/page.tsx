'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import NavLink from '../components/NavLink'
import Heatmap from '../components/Heatmap'
import { CountUp } from '../components/motion'
import { buttonClass, Card, Eyebrow, Icon, PageHeader, ScoreBar, Stat, cx, scoreTone } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import type { FocusEventRecord } from '../../../shared/api'
import { SessionRecord, api, errorMessage, formatMinutes, sessionMinutes } from '../lib/api'
import { ErrorState, SkeletonList } from '../components/states'

type FocusEvent = FocusEventRecord

const ENERGY_LABEL = ['', 'Drained', 'Low', 'Steady', 'Good', 'Sharp']
const OUTCOME_LABEL = { done: 'finished', partly: 'partly finished', not_done: 'not finished' } as const

export default function HistoryPage() {
  return (
    <AppShell>
      <History />
    </AppShell>
  )
}

function History() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)

  const load = useCallback(() => {
    setError('')
    api<{ sessions: SessionRecord[] }>('/sessions/history')
      .then(d => setSessions(d.sessions.filter(s => s.status !== 'active')))
      .catch((err: unknown) => setError(errorMessage(err, 'Couldn’t load your history.')))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    if (user) load()
  }, [user, load])

  const finished = sessions ?? []
  const completed = finished.filter(s => s.status === 'completed')
  const totalMinutes = finished.reduce((sum, s) => sum + sessionMinutes(s), 0)
  const avg = completed.length ? Math.round(completed.reduce((a, s) => a + s.focusScore, 0) / completed.length) : 0
  const completion = finished.length ? Math.round((completed.length / finished.length) * 100) : 0

  const groups = finished.reduce<{ label: string; items: SessionRecord[] }[]>((acc, s) => {
    const label = relativeDay(new Date(s.startedAt))
    const last = acc[acc.length - 1]
    if (last?.label === label) last.items.push(s)
    else acc.push({ label, items: [s] })
    return acc
  }, [])

  return (
    <div>
      <PageHeader eyebrow="History" title="Every session, reviewed." />


      <section aria-label="Totals" className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        {[
          { label: 'Sessions', value: sessions ? <CountUp value={finished.length} /> : '—' },
          { label: 'Time focused', value: sessions ? <CountUp value={totalMinutes} format={formatMinutes} /> : '—' },
          { label: 'Average focus', value: avg ? <CountUp value={avg} format={n => `${n}%`} /> : '—' },
          { label: 'Completion rate', value: finished.length ? <CountUp value={completion} format={n => `${n}%`} /> : '—' },
        ].map(s => (
          <div key={s.label} className="bg-surface p-6"><Stat label={s.label} value={s.value} /></div>
        ))}
      </section>

      {sessions && finished.length > 0 && (
        <Card className="reveal mb-12 p-6 sm:p-8">
          <Heatmap />
        </Card>
      )}

      {error && !sessions && <ErrorState message={error} onRetry={load} />}
      {sessions === null && !error && <SkeletonList rows={4} label="Loading your sessions" />}

      {sessions && finished.length === 0 && (
        <Card className="flex flex-col items-center px-6 py-16 text-center">
          <p className="font-serif text-2xl text-fg">Nothing here yet.</p>
          <p className="mt-2 text-sm text-fg-3">Finish your first session and it will show up here.</p>
          <NavLink href="/session" className={buttonClass('primary', 'md', 'mt-6')}>Start a session <Icon name="arrow" /></NavLink>
        </Card>
      )}

      <div className="space-y-10">
        {groups.map(g => (
          <section key={g.label} className="reveal">
            <Eyebrow className="mb-3">{g.label}</Eyebrow>
            <Card className="divide-y divide-line">
              {g.items.map(s => (
                <SessionRow key={s.id} session={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} />
              ))}
            </Card>
          </section>
        ))}
      </div>
    </div>
  )
}

function SessionRow({ session: s, open, onToggle }: { session: SessionRecord; open: boolean; onToggle: () => void }) {
  const [events, setEvents] = useState<FocusEvent[] | null>(null)
  const [eventsError, setEventsError] = useState(false)

  const loadEvents = useCallback(() => {
    setEventsError(false)
    api<{ events: FocusEvent[] }>(`/sessions/${s.id}/events`)
      .then(d => setEvents(d.events))
      // A failed load must not masquerade as "no interruptions".
      .catch(() => setEventsError(true))
  }, [s.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch when the row first opens
    if (open && !events) loadEvents()
  }, [open, events, loadEvents])

  const time = new Date(s.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2/50 sm:gap-6 sm:px-6"
      >
        <span className="tabular hidden w-16 shrink-0 text-[13px] text-fg-3 sm:block">{time}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-fg">{s.taskDescription}</span>
          <span className="mt-0.5 block text-[13px] text-fg-3">
            <span className="sm:hidden">{time} · </span>
            {formatMinutes(sessionMinutes(s))} · {ENERGY_LABEL[s.energyLevel]} energy
            {s.exercisedToday && ' · exercised'}
            {s.status === 'abandoned' && <span className="text-warn"> · abandoned</span>}
            {s.outcome && <span> · {OUTCOME_LABEL[s.outcome]}</span>}
          </span>
        </span>
        <span className="hidden w-28 md:block"><ScoreBar value={s.focusScore} /></span>
        <span className={cx('tabular w-12 text-right text-[15px]', scoreTone(s.focusScore))}>{s.focusScore}%</span>
      </button>

      {open && (
        <div className="slide-down border-t border-line bg-bg/40 px-5 py-4 sm:px-6 sm:pl-[6.5rem]">
          {(s.plannedMinutes || s.intention || s.reflection) && (
            <dl className="mb-4 space-y-1.5 text-[13px]">
              {s.plannedMinutes && <div className="flex gap-2"><dt className="text-fg-3">Timebox</dt><dd className="text-fg-2">{s.plannedMinutes} min planned, {formatMinutes(sessionMinutes(s))} worked</dd></div>}
              {s.intention && <div className="flex gap-2"><dt className="shrink-0 text-fg-3">Plan</dt><dd className="text-fg-2">If distracted, {s.intention}</dd></div>}
              {s.reflection && <div className="flex gap-2"><dt className="shrink-0 text-fg-3">Reflection</dt><dd className="text-fg-2">{s.reflection}</dd></div>}
            </dl>
          )}
          {eventsError ? (
            <p role="alert" className="text-[13px] text-danger">
              Couldn&apos;t load this session&apos;s timeline.{' '}
              <button type="button" onClick={loadEvents} className="cursor-pointer underline underline-offset-4">Retry</button>
            </p>
          ) : events === null ? (
            <p className="text-[13px] text-fg-3" aria-busy="true">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-[13px] text-fg-3">No interruptions were recorded in this session.</p>
          ) : (
            <ol className="space-y-2">
              {events.map(e => (
                <li key={e.id} className="flex items-center gap-3 text-[13px]">
                  <span className={cx('h-1.5 w-1.5 rounded-full', e.type === 'focused' ? 'bg-accent' : e.type === 'break' ? 'bg-fg-3' : 'bg-danger')} />
                  <span className="tabular w-16 text-fg-3">{new Date(e.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                  <span className="text-fg-2">
                    {e.notes || (e.type === 'focused' ? 'Focused' : e.type === 'break' ? 'Break' : 'Lost focus')}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}

function relativeDay(d: Date) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const day = new Date(d)
  day.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' })
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: today.getFullYear() === d.getFullYear() ? undefined : 'numeric' })
}
