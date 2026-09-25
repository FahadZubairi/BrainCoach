'use client'

import { TabLogEntry } from '../lib/extension'
import { Eyebrow, StatusDot, cx } from './ui'

// If no report arrives in this long, something is wrong. The extension checks every 30s;
// screen check every 2 minutes.
const STALE_AFTER_MS = { extension: 75_000, screen: 5 * 60_000 }

function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function ago(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`
}

const tone = (e: TabLogEntry): 'muted' | 'accent' | 'danger' => (e.neutral ? 'muted' : e.relevant ? 'accent' : 'danger')

// Live proof that tab tracking is working: a heartbeat plus every site the extension has judged.
export function TabActivity({ log, lastCheckedAt, now, paused, mode = 'extension' }: {
  log: TabLogEntry[]
  lastCheckedAt: number | null
  now: number
  paused: boolean
  mode?: 'extension' | 'screen'
}) {
  const stale = !paused && lastCheckedAt !== null && now - lastCheckedAt > STALE_AFTER_MS[mode]
  const recent = log.slice(-8).reverse()

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Tab activity</Eyebrow>
        <span className={cx('flex items-center gap-2 text-xs', stale ? 'text-warn' : 'text-fg-3')} aria-live="polite">
          {paused ? (
            'Paused'
          ) : lastCheckedAt ? (
            <>
              <StatusDot tone={stale ? 'warn' : 'accent'} pulse={!stale} />
              {stale
                ? mode === 'screen' ? `No check for ${ago(lastCheckedAt, now).replace(' ago', '')}. Is sharing still on?` : `No report for ${ago(lastCheckedAt, now).replace(' ago', '')}. Reload the extension`
                : `Checked ${ago(lastCheckedAt, now)}`}
            </>
          ) : (
            'Waiting for the first check…'
          )}
        </span>
      </div>

      {recent.length === 0 ? (
        <p className="mt-3 text-[13px] text-fg-3">
          {mode === 'screen' ? 'The first screen check runs a few seconds after you leave this tab, then every 2 minutes.' : 'Switch to another tab and it will appear here within a second.'}
        </p>
      ) : (
        <ol className="mt-3 space-y-0.5" aria-label="Sites visited this session, newest first">
          {recent.map((e, i) => (
            <li key={`${e.start}-${e.host}`} className={cx('flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px]', i === 0 && e.end === null && 'bg-bg', i === 0 && 'slide-down')}>
              <StatusDot tone={tone(e)} />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-fg-2">{e.host || e.title}</span>
                {e.reason && <span className="text-fg-3"> · {e.reason}</span>}
              </span>
              <span className="tabular shrink-0 text-fg-3">
                {e.end === null ? <span className="text-fg-2">{duration(now - e.start)} · now</span> : duration(e.end - e.start)}
              </span>
            </li>
          ))}
        </ol>
      )}

      {mode === 'screen' ? (
        <p className="mt-3 text-xs leading-relaxed text-fg-3">
          Screen check looks once every 2 minutes. Snapshots are analysed and discarded, never stored. After 2 minutes off task you&apos;ll get a notification.
        </p>
      ) : (
      <p className="mt-3 text-xs leading-relaxed text-fg-3">
        The BrainCoach icon in Chrome&apos;s toolbar shows <span className="font-medium text-accent">ON</span> or{' '}
        <span className="font-medium text-danger">OFF</span> on every tab, and you&apos;ll get a notification after 2 minutes off task.
      </p>
      )}
    </div>
  )
}

// End-of-session breakdown: total time per site, split into on-task and off-task.
export function TabBreakdown({ log, endedAt }: { log: TabLogEntry[]; endedAt: number }) {
  const bySite = new Map<string, { ms: number; relevant: boolean; neutral: boolean }>()
  for (const e of log) {
    const ms = (e.end ?? endedAt) - e.start
    if (ms <= 0) continue
    const key = `${e.host}|${e.relevant}`
    const prev = bySite.get(key)
    bySite.set(key, { ms: (prev?.ms ?? 0) + ms, relevant: e.relevant, neutral: e.neutral })
  }
  const rows = [...bySite.entries()]
    .map(([key, v]) => ({ host: key.split('|')[0], ...v }))
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 6)
  if (rows.length === 0) return null

  const total = rows.reduce((a, r) => a + r.ms, 0)
  const offMs = rows.filter(r => !r.relevant).reduce((a, r) => a + r.ms, 0)

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Eyebrow>Where your time went</Eyebrow>
        <span className="text-xs text-fg-3">
          {offMs > 0 ? `${duration(offMs)} on off-topic sites` : 'No off-topic sites. Nice.'}
        </span>
      </div>
      <ul className="mt-4 space-y-3">
        {rows.map(r => (
          <li key={`${r.host}-${r.relevant}`} className="grid grid-cols-[minmax(0,140px)_1fr_64px] items-center gap-3 text-[13px]">
            <span className="truncate text-fg-2">{r.host}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
              <span
                className={cx('block h-full origin-left rounded-full [animation:grow-x_0.8s_var(--ease-out)_both]', r.neutral ? 'bg-fg-3' : r.relevant ? 'bg-accent' : 'bg-danger')}
                style={{ width: `${Math.max(3, (r.ms / total) * 100)}%` }}
              />
            </span>
            <span className="tabular text-right text-fg-3">{duration(r.ms)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
