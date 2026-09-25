import { useState } from 'react'
import { CountUp, ProgressRing } from '../components/motion'
import { Stat } from '../components/ui'
import { Stats, formatMinutes } from '../lib/api'
import type { Prefs } from '../lib/prefs'
import { GoalEditor } from './GoalEditor'

// Daily goal ring + today's numbers. A specific, visible target beats "do your best" (Locke & Latham, 2002).
export function GlanceSection({ stats, prefs, updatePrefs, habitsDone, habitsTotal }: {
  stats: Stats | null
  prefs: Prefs
  updatePrefs: (p: Partial<Prefs>) => void
  habitsDone: number
  habitsTotal: number
}) {
  const [editing, setEditing] = useState(false)
  const goal = prefs.dailyGoalMinutes
  const done = stats?.focusMinutesToday ?? 0

  return (
    <section aria-label="Today at a glance" className="reveal mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
      <div className="flex items-center gap-6 bg-surface p-6">
        <ProgressRing
          value={stats ? done / goal : 0}
          size={104}
          stroke={7}
          label={`Daily focus goal: ${done} of ${goal} minutes`}
          barClass={done >= goal ? 'stroke-accent' : 'stroke-accent/80'}
        >
          <span className="text-xl font-light tracking-[-0.03em]">
            <CountUp value={stats ? Math.min(999, Math.round((done / goal) * 100)) : 0} format={n => `${n}%`} />
          </span>
        </ProgressRing>
        <div className="min-w-0">
          <p className="text-[13px] text-fg-3">Daily focus goal</p>
          <p className="mt-1 text-[15px] text-fg">
            {stats ? formatMinutes(done) : '—'} <span className="text-fg-3">of {formatMinutes(goal)}</span>
          </p>
          {editing ? (
            <GoalEditor current={goal} onSave={m => { updatePrefs({ dailyGoalMinutes: m }); setEditing(false) }} onClose={() => setEditing(false)} />
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="mt-2 cursor-pointer text-[13px] text-accent underline-offset-4 hover:underline">
              {stats && done >= goal ? 'Goal reached — raise it?' : 'Change goal'}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px">
        {[
          { label: 'Sessions today', node: stats ? <CountUp value={stats.sessionsToday} /> : '—' },
          { label: 'Average focus', node: stats?.avgFocusScore ? <CountUp value={stats.avgFocusScore} format={n => `${n}%`} /> : '—' },
          { label: 'Habits done', node: habitsTotal ? <><CountUp value={habitsDone} />/{habitsTotal}</> : '—' },
        ].map(s => (
          <div key={s.label} className="bg-surface p-6"><Stat label={s.label} value={s.node} /></div>
        ))}
      </div>
    </section>
  )
}
