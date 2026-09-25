'use client'

import { useEffect, useRef, useState } from 'react'
import type { DailyResponse } from '../../../shared/api'
import { api, errorMessage, formatMinutes } from '../lib/api'
import { dayKey } from '../lib/habits'
import { cx } from './ui'

type Daily = DailyResponse

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] // GitHub-style: weeks start on Sunday, label every other row
const TONES = ['bg-surface-2', 'bg-accent/25', 'bg-accent/45', 'bg-accent/70', 'bg-accent']

const level = (m: number) => (m === 0 ? 0 : m < 25 ? 1 : m < 60 ? 2 : m < 120 ? 3 : 4)

// GitHub-style year of focus: each month is its own labelled block of exactly its days, so
// September shows 30 boxes. Seeing an unbroken run of small wins is itself motivating
// (Amabile & Kramer's "progress principle").
export default function Heatmap() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [data, setData] = useState<Daily | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const wrapper = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    api<Daily>(`/sessions/daily?year=${year}&tz=${new Date().getTimezoneOffset()}`)
      .then(d => { if (!cancelled) { setData(d); setError('') } })
      .catch((err: unknown) => { if (!cancelled) setError(errorMessage(err, 'Couldn’t load your focus calendar.')) })
    return () => { cancelled = true }
  }, [year, attempt])

  // On small screens the year scrolls sideways; start with the current month in view.
  useEffect(() => {
    const el = scroller.current
    if (!el || !data) return
    const current = el.querySelector<HTMLElement>('[data-current-month]')
    el.scrollLeft = current ? Math.max(0, current.offsetLeft - el.clientWidth + current.offsetWidth + 16) : el.scrollWidth
  }, [data])

  const today = new Date()
  const todayKey = dayKey(today)
  const loaded = data?.year === year
  const days = loaded ? data.days : {}
  const years = data?.years ?? [year]

  const totals = Object.values(days).reduce((acc, d) => ({ minutes: acc.minutes + d.minutes, sessions: acc.sessions + d.sessions }), { minutes: 0, sessions: 0 })
  const activeDays = Object.values(days).filter(d => d.sessions > 0).length

  let streak = 0
  if (year === today.getFullYear()) {
    const d = new Date(today)
    if (!days[dayKey(d)]) d.setDate(d.getDate() - 1) // today not done yet doesn't break the streak
    while (d.getFullYear() === year && days[dayKey(d)]) {
      streak++
      d.setDate(d.getDate() - 1)
    }
  }

  function showTip(e: React.MouseEvent<HTMLDivElement>, date: Date) {
    const box = wrapper.current?.getBoundingClientRect()
    const cell = e.currentTarget.getBoundingClientRect()
    if (!box) return
    const d = days[dayKey(date)]
    const when = date.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })
    setTip({
      x: cell.left - box.left + cell.width / 2,
      y: cell.top - box.top,
      text: d ? `${d.sessions} ${d.sessions === 1 ? 'session' : 'sessions'} · ${formatMinutes(d.minutes)} on ${when}` : `No sessions on ${when}`,
    })
  }

  return (
    <div ref={wrapper} className="relative">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-lg text-fg">
            {totals.sessions} {totals.sessions === 1 ? 'session' : 'sessions'} in {year}
            {totals.minutes > 0 && <span className="text-fg-3"> · {formatMinutes(totals.minutes)} focused</span>}
          </p>
          <p className="mt-1 text-[13px] text-fg-3">
            {activeDays} focused {activeDays === 1 ? 'day' : 'days'}
            {streak > 1 && <> · <span className="text-accent">{streak}-day streak</span></>}
          </p>
        </div>
        <div role="radiogroup" aria-label="Year" className="flex gap-1">
          {years.map(y => (
            <button
              key={y}
              type="button"
              role="radio"
              aria-checked={y === year}
              onClick={() => setYear(y)}
              className={cx('tabular h-8 cursor-pointer rounded-lg px-3 text-[13px] transition-colors',
                y === year ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-fg-3 hover:text-fg')}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 text-sm text-danger">
          {error}{' '}
          <button type="button" onClick={() => { setError(''); setAttempt(a => a + 1) }} className="cursor-pointer underline underline-offset-4">Retry</button>
        </p>
      )}
      {!error && loaded && totals.sessions === 0 && (
        <p className="mb-4 text-sm text-fg-3">No sessions in {year} yet. Each focused day will light up a square here.</p>
      )}

      <div
        ref={scroller}
        className={cx('overflow-x-auto pb-2 transition-opacity', !loaded && 'opacity-40')}
        aria-busy={!loaded}
        onScroll={() => setTip(null)}
      >
        <div
          className="flex w-max gap-2"
          role="img"
          aria-label={`Focus calendar for ${year}: ${totals.sessions} sessions on ${activeDays} days${streak > 1 ? `, current streak ${streak} days` : ''}`}
          onMouseLeave={() => setTip(null)}
        >
          {/* Weekday labels */}
          <div className="grid grid-rows-[auto_repeat(7,10px)] gap-[3px] pr-1" aria-hidden="true">
            <span className="h-4" />
            {WEEKDAYS.map((d, i) => (
              <span key={i} className="text-[10px] leading-[10px] text-fg-3">{d}</span>
            ))}
          </div>

          {MONTHS.map((label, m) => {
            const first = new Date(year, m, 1)
            const count = new Date(year, m + 1, 0).getDate()
            const lead = first.getDay()
            const isCurrent = year === today.getFullYear() && m === today.getMonth()
            return (
              <div
                key={label}
                data-current-month={isCurrent || undefined}
                className="flex flex-col gap-[3px]"
                style={{ animation: `fade-up 0.45s var(--ease-out) ${m * 30}ms both` }}
              >
                <span className={cx('h-4 text-[11px] leading-4', isCurrent ? 'text-fg' : 'text-fg-3')}>{label}</span>
                <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
                  {Array.from({ length: lead }, (_, i) => <span key={`pad-${i}`} className="h-[10px] w-[10px]" />)}
                  {Array.from({ length: count }, (_, i) => {
                    const date = new Date(year, m, i + 1)
                    const key = dayKey(date)
                    const future = key > todayKey
                    const minutes = days[key]?.minutes ?? 0
                    return (
                      <div
                        key={key}
                        onMouseEnter={future ? undefined : e => showTip(e, date)}
                        className={cx(
                          'h-[10px] w-[10px] rounded-[2px] transition-transform duration-150',
                          future ? 'border border-line/70' : cx(TONES[level(minutes)], 'hover:scale-125'),
                          key === todayKey && 'ring-1 ring-fg-2 ring-offset-1 ring-offset-surface',
                        )}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-fg-3" aria-hidden="true">
        Less {TONES.map(t => <span key={t} className={cx('h-[10px] w-[10px] rounded-[2px]', t)} />)} More
      </div>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs text-fg shadow-lg"
          style={{ left: tip.x, top: tip.y - 6 }}
          aria-hidden="true"
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}
