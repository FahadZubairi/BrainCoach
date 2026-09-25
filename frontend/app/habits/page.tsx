'use client'

import { useState } from 'react'
import AppShell from '../components/AppShell'
import { Button, Card, Icon, PageHeader, cx, inputClass } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { dayKey, daysAgo, doneToday, streakOf, useHabits } from '../lib/habits'

export default function HabitsPage() {
  return (
    <AppShell width="narrow">
      <Habits />
    </AppShell>
  )
}

function Habits() {
  const { user } = useAuth()
  const { habits, loaded, toggleToday, add, remove } = useHabits(user?.id)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [justChecked, setJustChecked] = useState<number | null>(null)

  const done = habits.filter(doneToday).length
  const pct = habits.length ? Math.round((done / habits.length) * 100) : 0
  const week = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    add(name)
    setNewName('')
  }

  return (
    <div>
      <PageHeader eyebrow="Habits" title="Small things, daily.">
        <div className="sm:text-right">
          <p className="tabular text-[32px] font-light leading-none tracking-[-0.03em] text-fg">{done}<span className="text-fg-3">/{habits.length}</span></p>
          <p className="mt-1 text-[13px] text-fg-3">done today</p>
        </div>
      </PageHeader>

      <div
        className="mb-8 h-1 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Habits completed today"
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>

      <Card>
        {/* Week header */}
        <div className="flex items-center gap-4 border-b border-line px-5 py-3 sm:px-6">
          <span className="flex-1 text-xs text-fg-3">Habit</span>
          <div className="hidden gap-1.5 sm:flex" aria-hidden="true">
            {week.map(d => (
              <span key={dayKey(d)} className={cx('w-4 text-center text-[11px]', dayKey(d) === dayKey() ? 'text-fg-2' : 'text-fg-3')}>
                {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
              </span>
            ))}
          </div>
          <span className="w-12 text-right text-xs text-fg-3">Streak</span>
          <span className="w-9" />
        </div>

        {!loaded && (
          <div className="divide-y divide-line" aria-busy="true" aria-label="Loading habits">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 sm:px-6">
                <div className="h-6 w-6 animate-pulse rounded-full bg-surface-2" />
                <div className="h-3.5 flex-1 animate-pulse rounded bg-surface-2" />
              </div>
            ))}
          </div>
        )}

        {loaded && habits.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-fg-3">Add your first habit below.</p>
        )}

        <ul className="stagger divide-y divide-line">
          {habits.map(h => {
            const isDone = doneToday(h)
            const streak = streakOf(h)
            const history = new Set(h.history)
            return (
              <li key={h.id} className="group flex items-center gap-4 px-5 py-3 sm:px-6">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isDone}
                  onClick={() => { toggleToday(h.id); setJustChecked(isDone ? null : h.id) }}
                  className="-ml-2 flex min-w-0 flex-1 cursor-pointer items-center gap-4 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-sm transition-colors duration-200',
                    isDone ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong group-hover:border-fg-3', isDone && justChecked === h.id && 'pop')}>
                    {isDone && <Icon name="check" />}
                  </span>
                  <span className={cx('truncate text-[15px] transition-colors', isDone ? 'text-fg-3' : 'text-fg')}>{h.name}</span>
                </button>

                <div className="hidden gap-1.5 sm:flex" aria-label={`Last 7 days: ${week.filter(d => history.has(dayKey(d))).length} of 7 done`}>
                  {week.map(d => (
                    <span
                      key={dayKey(d)}
                      className={cx('h-4 w-4 rounded-[4px] transition-colors duration-300', history.has(dayKey(d)) ? 'bg-accent/80' : 'bg-surface-2')}
                    />
                  ))}
                </div>

                <span className={cx('tabular w-12 text-right text-sm', streak > 0 ? 'text-fg' : 'text-fg-3')}>
                  {streak > 0 ? `${streak}d` : '—'}
                </span>

                {confirmDelete === h.id ? (
                  <div className="flex items-center gap-1">
                    <Button variant="danger" className="h-9 px-3" onClick={() => { remove(h.id); setConfirmDelete(null) }}>Delete</Button>
                    <Button variant="ghost" className="h-9 px-3" onClick={() => setConfirmDelete(null)}>Cancel</Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(h.id)}
                    aria-label={`Delete ${h.name}`}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-fg-3 opacity-60 transition hover:bg-danger-soft hover:text-danger hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <Icon name="trash" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>

        <form onSubmit={submit} className="flex gap-2 border-t border-line p-4 sm:p-5">
          <label htmlFor="new-habit" className="sr-only">New habit</label>
          <input
            id="new-habit"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Add a habit…"
            maxLength={60}
            autoComplete="off"
            className={cx(inputClass, 'h-11')}
          />
          <Button type="submit" variant="secondary" className="h-11 shrink-0" disabled={!newName.trim()}>
            <Icon name="plus" /> Add
          </Button>
        </form>
      </Card>

      <p className="mt-6 text-center text-[13px] text-fg-3">
        A streak stays alive until the end of the day after you last completed it.
      </p>
    </div>
  )
}
