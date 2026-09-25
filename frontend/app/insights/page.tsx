'use client'

import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import NavLink from '../components/NavLink'
import { Button, Card, Eyebrow, Icon, PageHeader, buttonClass, cx, scoreTone } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import type { InsightAnalysis } from '../../../shared/api'
import { SessionRecord, api, errorMessage } from '../lib/api'
import { ErrorState, SkeletonBlock } from '../components/states'
import { BarList, InsightCard } from './parts'

type Analysis = InsightAnalysis

const MIN_SESSIONS = 3

export default function InsightsPage() {
  return (
    <AppShell>
      <Insights />
    </AppShell>
  )
}

function avgScore(list: SessionRecord[]) {
  return list.length ? Math.round(list.reduce((a, s) => a + s.focusScore, 0) / list.length) : null
}

function Insights() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<SessionRecord[] | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')

  const [loadError, setLoadError] = useState('')
  const load = useCallback(() => {
    setLoadError('')
    api<{ sessions: SessionRecord[] }>('/sessions/history')
      .then(d => setSessions(d.sessions.filter(s => s.status !== 'active')))
      .catch((err: unknown) => setLoadError(errorMessage(err, 'Couldn’t load your sessions.')))
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    if (user) load()
  }, [user, load])

  async function analyse() {
    setAnalysing(true)
    setError('')
    try {
      const data = await api<{ patterns: Analysis | null }>('/coach/insights')
      setAnalysis(data.patterns)
    } catch (err) {
      setError(errorMessage(err, 'The coach couldn’t analyse your sessions right now.'))
    } finally {
      setAnalysing(false)
    }
  }

  if (sessions === null) {
    return loadError
      ? <ErrorState message={loadError} onRetry={load} />
      : (
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonBlock className="h-64" label="Loading insights" />
          <SkeletonBlock className="h-64" label="Loading insights" />
        </div>
      )
  }

  const remaining = Math.max(0, MIN_SESSIONS - sessions.length)

  if (remaining > 0) {
    return (
      <div>
        <PageHeader eyebrow="Insights" title="Patterns need a little history." />
        <Card className="p-8 sm:p-10">
          <div className="flex gap-2" aria-hidden="true">
            {Array.from({ length: MIN_SESSIONS }, (_, i) => (
              <span key={i} className={cx('h-1.5 flex-1 rounded-full', i < sessions.length ? 'bg-accent' : 'bg-line')} />
            ))}
          </div>
          <p className="mt-6 text-lg text-fg">
            {remaining} more {remaining === 1 ? 'session' : 'sessions'} to unlock your first analysis.
          </p>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-fg-3">
            Your coach looks at when you focus best, how energy and exercise change your score, and where sessions tend to fall apart.
          </p>
          <NavLink href="/session" className={buttonClass('primary', 'lg', 'mt-8')}>Start a session <Icon name="arrow" /></NavLink>
        </Card>
      </div>
    )
  }

  // ── Local patterns, computed instantly from history ──
  const byPeriod = [
    { label: 'Morning', hint: '5–12', match: (h: number) => h >= 5 && h < 12 },
    { label: 'Afternoon', hint: '12–17', match: (h: number) => h >= 12 && h < 17 },
    { label: 'Evening', hint: '17–22', match: (h: number) => h >= 17 && h < 22 },
    { label: 'Night', hint: '22–5', match: (h: number) => h >= 22 || h < 5 },
  ].map(p => {
    const list = sessions.filter(s => p.match(new Date(s.startedAt).getHours()))
    return { ...p, count: list.length, avg: avgScore(list) }
  })

  const byEnergy = [1, 2, 3, 4, 5].map(e => {
    const list = sessions.filter(s => s.energyLevel === e)
    return { energy: e, count: list.length, avg: avgScore(list) }
  })

  const withEx = avgScore(sessions.filter(s => s.exercisedToday))
  const withoutEx = avgScore(sessions.filter(s => !s.exercisedToday))
  const best = byPeriod.filter(p => p.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0))[0]

  return (
    <div>
      <PageHeader eyebrow="Insights" title="How your attention works.">
        <Button onClick={analyse} disabled={analysing} variant={analysis ? 'secondary' : 'primary'}>
          <Icon name="spark" />
          {analysing ? 'Analysing…' : analysis ? 'Refresh analysis' : 'Ask the coach'}
        </Button>
      </PageHeader>

      {error && <p role="alert" className="mb-8 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}

      {analysing && !analysis && (
        <Card className="mb-6 space-y-3 p-8" aria-busy="true">
          <div className="h-5 w-3/4 animate-pulse rounded bg-surface-2" />
          <div className="h-5 w-1/2 animate-pulse rounded bg-surface-2" />
        </Card>
      )}

      {analysis && (
        <div className="mb-12 space-y-6">
          <Card className="slide-down p-8 sm:p-10">
            <Eyebrow>Coach’s read</Eyebrow>
            <p className="mt-4 font-serif text-[28px] leading-snug text-fg sm:text-[32px]">{analysis.coach_message}</p>
          </Card>
          <div className="stagger grid gap-6 md:grid-cols-2">
            <InsightCard title="What’s working" body={analysis.strengths} tone="accent" />
            <InsightCard title="Where it slips" body={analysis.weaknesses} tone="danger" />
            <InsightCard title="Exercise" body={analysis.exercise_impact} tone="muted" />
            <InsightCard title="Try next" body={analysis.recommendation} tone="warn" />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="reveal p-6 sm:p-8">
          <Eyebrow>Time of day</Eyebrow>
          <p className="mt-2 text-lg text-fg">
            {best ? <>You focus best in the <span className="italic">{best.label.toLowerCase()}</span>.</> : 'Not enough data yet.'}
          </p>
          <BarList rows={byPeriod.map(p => ({ label: p.label, hint: p.hint, value: p.avg, count: p.count }))} />
        </Card>

        <Card className="reveal p-6 sm:p-8">
          <Eyebrow>Energy</Eyebrow>
          <p className="mt-2 text-lg text-fg">Focus score by starting energy.</p>
          <BarList rows={byEnergy.map(e => ({ label: ['Drained', 'Low', 'Steady', 'Good', 'Sharp'][e.energy - 1], value: e.avg, count: e.count }))} />
        </Card>

        <Card className="reveal p-6 sm:p-8 lg:col-span-2">
          <Eyebrow>Movement</Eyebrow>
          <div className="mt-4 grid gap-8 sm:grid-cols-[1fr_1fr_2fr] sm:items-end">
            <div>
              <p className="text-[13px] text-fg-3">After exercise</p>
              <p className={cx('tabular mt-2 text-[32px] font-light leading-none tracking-[-0.03em]', withEx !== null ? scoreTone(withEx) : 'text-fg-3')}>{withEx !== null ? `${withEx}%` : '—'}</p>
            </div>
            <div>
              <p className="text-[13px] text-fg-3">Without</p>
              <p className={cx('tabular mt-2 text-[32px] font-light leading-none tracking-[-0.03em]', withoutEx !== null ? scoreTone(withoutEx) : 'text-fg-3')}>{withoutEx !== null ? `${withoutEx}%` : '—'}</p>
            </div>
            <p className="text-sm leading-relaxed text-fg-3">
              {withEx !== null && withoutEx !== null
                ? withEx > withoutEx
                  ? `Sessions on days you move score ${withEx - withoutEx} points higher.`
                  : withEx < withoutEx
                    ? 'So far, exercise days haven’t lifted your focus. Worth watching as more data comes in.'
                    : 'No difference yet between days with and without exercise.'
                : 'Log sessions both with and without exercise to see the difference.'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
