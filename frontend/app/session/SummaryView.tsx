import { useState } from 'react'
import type { SessionOutcome, SessionResponse } from '../../../shared/api'
import NavLink from '../components/NavLink'
import { TabBreakdown } from '../components/TabActivity'
import Timeline from '../components/Timeline'
import { Button, Card, Eyebrow, Icon, Segmented, buttonClass, cx, inputClass, scoreTone } from '../components/ui'
import { api } from '../lib/api'
import { formatDuration } from '../lib/activeSession'
import type { SessionSummary } from './useSessionController'

// After a session: results, where the time went, a short reflection, and parked thoughts.

const OUTCOMES: { value: SessionOutcome; label: string }[] = [
  { value: 'done', label: 'Done' },
  { value: 'partly', label: 'Partly' },
  { value: 'not_done', label: 'Not yet' },
]

function verdictFor(score: number, abandoned: boolean) {
  if (abandoned) return 'Session set aside.'
  if (score >= 85) return 'Deep, steady work.'
  if (score >= 65) return 'Solid session.'
  if (score >= 40) return 'Some drift, but you showed up.'
  return 'A scattered one. That happens.'
}

export function SummaryView({ summary, onAgain }: { summary: SessionSummary; onAgain: () => void }) {
  const { session, score, ms, abandoned } = summary

  return (
    <div className="animate-in mx-auto max-w-2xl">
      <Eyebrow>{abandoned ? 'Abandoned' : 'Complete'}</Eyebrow>
      <h1 className="mt-3 font-serif text-[40px] leading-[1.05] text-fg sm:text-5xl">{verdictFor(score, abandoned)}</h1>
      <p className="mt-4 text-fg-2">{session.taskDescription}</p>

      <Card className="stagger mt-10 p-6 sm:p-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <Stat label="Duration" value={formatDuration(ms)} />
          <Stat label="Focus" value={`${score}%`} className={scoreTone(score)} />
          <Stat label="Away" value={session.sensed ? formatDuration(session.awayMs) : '—'} />
          <Stat label="Off-topic" value={session.sensed ? formatDuration(session.offTaskMs) : '—'} />
        </div>
        <div className="mt-8 border-t border-line pt-6"><Timeline samples={session.timeline} /></div>
        {summary.tabLog.length > 0 && (
          <div className="mt-8 border-t border-line pt-6"><TabBreakdown log={summary.tabLog} endedAt={summary.endedAt} /></div>
        )}
      </Card>

      <Reflection sessionId={session.sessionId} />

      {session.parked.length > 0 && (
        <Card className="mt-4 p-6 sm:p-8">
          <Eyebrow>Parked during this session</Eyebrow>
          <ul className="mt-3 space-y-2">
            {session.parked.map((p, i) => <li key={i} className="flex gap-3 text-[15px] text-fg-2"><span className="text-fg-3">·</span>{p}</li>)}
          </ul>
          <p className="mt-4 text-xs text-fg-3">Saved to your Today page so you can deal with them later.</p>
        </Card>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onAgain} className="flex-1">Start another session</Button>
        <NavLink href="/dashboard" className={buttonClass('secondary', 'lg', 'sm:w-48')}>Back to today</NavLink>
      </div>
    </div>
  )
}

// Self-monitoring: a quick, honest look back improves future goal attainment (Harkin et al., 2016).
function Reflection({ sessionId }: { sessionId: number }) {
  const [outcome, setOutcome] = useState<SessionOutcome | null>(null)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState('')

  async function save() {
    if (!outcome) return
    setStatus('saving')
    setError('')
    try {
      await api<SessionResponse>(`/sessions/${sessionId}/reflection`, { method: 'PATCH', body: JSON.stringify({ outcome, reflection: note }) })
      setStatus('saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your reflection.')
      setStatus('idle')
    }
  }

  return (
    <Card className="mt-4 p-6 sm:p-8">
      {status === 'saved' ? (
        <div className="pop flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-ink"><Icon name="check" /></span>
          <p className="text-fg">Reflection saved. Your coach will use it to spot patterns.</p>
        </div>
      ) : (
        <>
          <h2 className="text-lg text-fg">Did you finish what you set out to do?</h2>
          <div className="mt-4"><Segmented label="Outcome" options={OUTCOMES} value={outcome} onChange={setOutcome} /></div>
          {outcome && (
            <div className="slide-down mt-4">
              <label htmlFor="reflection" className="mb-2 block text-sm text-fg-2">
                {outcome === 'done' ? 'What helped?' : 'What got in the way?'} <span className="text-fg-3">(optional)</span>
              </label>
              <textarea id="reflection" value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500} className={cx(inputClass, 'h-auto resize-none py-3')} />
              {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
              <Button onClick={save} disabled={status === 'saving'} className="mt-3">{status === 'saving' ? 'Saving…' : error ? 'Try again' : 'Save reflection'}</Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-[13px] text-fg-3">{label}</p>
      <p className={cx('tabular mt-2 text-[28px] font-light leading-none tracking-[-0.03em] text-fg', className)}>{value}</p>
    </div>
  )
}
