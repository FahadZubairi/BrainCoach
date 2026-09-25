import { useState } from 'react'
import NavLink from '../components/NavLink'
import { Button, Card, Eyebrow, Icon, ScoreBar, cx, scoreTone } from '../components/ui'
import { SessionRecord, formatMinutes, sessionMinutes } from '../lib/api'
import { Habit, doneToday, streakOf } from '../lib/habits'
import type { ParkedThought } from '../lib/prefs'

// The list-style sections of the Today page: habits, parked thoughts, recent sessions.

export function HabitsCard({ habits, onToggle }: { habits: Habit[]; onToggle: (id: number) => void }) {
  const [justChecked, setJustChecked] = useState<number | null>(null)
  return (
    <Card className="p-6 sm:p-8 lg:col-span-2">
      <div className="flex items-baseline justify-between">
        <Eyebrow>Habits</Eyebrow>
        <NavLink href="/habits" className="text-[13px] text-fg-3 hover:text-fg">Manage</NavLink>
      </div>
      <ul className="mt-4 -mx-2">
        {habits.slice(0, 5).map(h => {
          const done = doneToday(h)
          const streak = streakOf(h)
          return (
            <li key={h.id}>
              <button
                type="button" role="checkbox" aria-checked={done}
                onClick={() => { onToggle(h.id); setJustChecked(done ? null : h.id) }}
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition-colors',
                  done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong', justChecked === h.id && done && 'pop')}>
                  {done && <Icon name="check" />}
                </span>
                <span className={cx('flex-1 truncate text-sm', done ? 'text-fg-3 line-through decoration-fg-3/50' : 'text-fg')}>{h.name}</span>
                {streak > 1 && <span className="tabular text-xs text-fg-3">{streak}d</span>}
              </button>
            </li>
          )
        })}
        {habits.length === 0 && (
          <li className="px-2 py-2 text-sm text-fg-3">
            No habits yet. <NavLink href="/habits" className="text-accent underline-offset-4 hover:underline">Add one</NavLink>
          </li>
        )}
      </ul>
    </Card>
  )
}

export function ParkedSection({ items, onHandled }: { items: ParkedThought[]; onHandled: (id: number) => void }) {
  if (items.length === 0) return null
  return (
    <section className="reveal mt-12" aria-labelledby="parked-heading">
      <div className="mb-4 flex items-baseline justify-between">
        <Eyebrow><span id="parked-heading">Parked thoughts</span></Eyebrow>
        <span className="text-[13px] text-fg-3">Captured during sessions. Handle or let go.</span>
      </div>
      <Card className="divide-y divide-line">
        {items.slice(0, 8).map(item => (
          <div key={item.id} className="group flex items-center gap-4 px-6 py-3.5">
            <span className="min-w-0 flex-1 truncate text-[15px] text-fg">{item.text}</span>
            <span className="hidden text-xs text-fg-3 sm:block">{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <Button variant="ghost" className="h-8 px-3 text-xs" onClick={() => onHandled(item.id)} aria-label={`Mark "${item.text}" handled`}>
              <Icon name="check" /> Handled
            </Button>
          </div>
        ))}
      </Card>
    </section>
  )
}

export function RecentSessions({ sessions, error, onRetry }: { sessions: SessionRecord[] | null; error: string; onRetry: () => void }) {
  return (
    <section className="reveal mt-12">
      <div className="mb-4 flex items-baseline justify-between">
        <Eyebrow>Recent sessions</Eyebrow>
        <NavLink href="/history" className="text-[13px] text-fg-3 hover:text-fg">View all</NavLink>
      </div>
      {error ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="text-sm text-fg-3">Couldn&apos;t load your sessions.</p>
          <Button variant="secondary" onClick={onRetry}>Try again</Button>
        </Card>
      ) : sessions === null ? (
        <div className="h-24 animate-pulse rounded-2xl bg-surface" aria-busy="true" aria-label="Loading recent sessions" />
      ) : sessions.length === 0 ? (
        <Card className="px-6 py-10 text-center text-sm text-fg-3">Your sessions will appear here.</Card>
      ) : (
        <Card className="stagger divide-y divide-line">
          {sessions.map(s => (
            <div key={s.id} className="flex items-center gap-6 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] text-fg">{s.taskDescription}</p>
                <p className="mt-0.5 text-[13px] text-fg-3">
                  {new Date(s.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' · '}{formatMinutes(sessionMinutes(s))}
                  {s.status === 'abandoned' && ' · abandoned'}
                </p>
              </div>
              <div className="hidden w-24 sm:block"><ScoreBar value={s.focusScore} /></div>
              <span className={cx('tabular w-12 text-right text-sm', scoreTone(s.focusScore))}>{s.focusScore}%</span>
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}
