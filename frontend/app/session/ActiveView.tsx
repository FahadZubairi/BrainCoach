import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { TabActivity } from '../components/TabActivity'
import Timeline from '../components/Timeline'
import { Button, Card, Eyebrow, Icon, cx, inputClass, scoreTone } from '../components/ui'
import { ActiveSession, activeMs, focusScore, formatClock, formatDuration } from '../lib/activeSession'
import { BreakCountdown, BreakDialog } from './BreakPanels'
import { CameraVideo, CameraStatus, TrackerStatus } from './StatusRows'
import type { SessionController } from './useSessionController'

// The running session: timer, live status, parking lot and controls.
export function ActiveView({ c, session }: { c: SessionController; session: ActiveSession }) {
  const router = useRouter()
  const [previewHidden, setPreviewHidden] = useState(false)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [thought, setThought] = useState('')
  const { now, paused, face, tracker } = c

  const ms = activeMs(session, now)
  const score = focusScore(session, now)
  const plannedMs = session.plannedMinutes ? session.plannedMinutes * 60_000 : 0
  const cycleMs = ms - session.cycleStartMs
  const showBreak = session.promptOpen && !paused
  const drifting = !paused && (face.state === 'absent' || (tracker.connected && !!tracker.status?.tab && !tracker.status.tab.relevant))

  return (
    <div className="animate-in mx-auto max-w-2xl">
      {c.coachNote && (
        <div className="mb-10 flex items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
          <Icon name="spark" className="mt-0.5 text-accent" />
          <p className="flex-1 text-[15px] leading-relaxed text-fg-2">{c.coachNote}</p>
          <button type="button" onClick={() => c.setCoachNote('')} aria-label="Dismiss coach note" className="-m-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-fg-3 hover:bg-surface-2 hover:text-fg">
            <Icon name="x" />
          </button>
        </div>
      )}

      <div className="text-center">
        <Eyebrow>{paused ? 'Paused' : 'Focusing on'}</Eyebrow>
        <h1 className="mx-auto mt-3 max-w-xl font-serif text-3xl leading-tight text-fg sm:text-4xl">{session.taskDescription}</h1>
        <p
          className={cx('tabular mt-10 text-[88px] font-extralight leading-none tracking-[-0.04em] sm:text-[120px]', paused ? 'text-fg-3' : 'text-fg')}
          role="timer" aria-live="off" aria-label={`Elapsed ${formatDuration(ms)}`}
        >
          {formatClock(ms)}
        </p>

        {plannedMs > 0 && (
          <div className="mx-auto mt-8 max-w-xs">
            <div className="h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-label="Timebox progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((cycleMs / plannedMs) * 100))}>
              <div className={cx('h-full rounded-full transition-[width] duration-1000 ease-linear', cycleMs >= plannedMs ? 'bg-warn' : 'bg-accent')} style={{ width: `${Math.min(100, (cycleMs / plannedMs) * 100)}%` }} />
            </div>
            <p className="tabular mt-2 text-xs text-fg-3">
              {cycleMs >= plannedMs
                ? `${session.plannedMinutes}-minute timebox complete`
                : `${Math.ceil((plannedMs - cycleMs) / 60000)} min left of ${session.plannedMinutes}${session.cycleStartMs > 0 ? ' · next block' : ''}`}
            </p>
          </div>
        )}

        <p className="mt-5 text-sm text-fg-3">
          Focus <span className={cx('tabular font-medium', scoreTone(score))}>{score}%</span>
          {!session.sensed && <span> · no sensors connected, based on check-ins</span>}
        </p>
      </div>

      {showBreak && <BreakDialog session={session} ending={c.ending} onBreak={c.startBreak} onDismiss={c.dismissBreak} onFinish={() => c.finish(false)} />}
      {paused && session.breakUntil && <BreakCountdown breakUntil={session.breakUntil} now={now} onContinue={() => c.endBreak(false)} />}

      {drifting && session.intention && !showBreak && (
        <div role="status" className="slide-down mt-10 flex gap-4 rounded-2xl border border-line bg-surface p-5">
          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-warn" aria-hidden="true" />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-fg-3">Your plan</p>
            <p className="mt-1 font-serif text-xl leading-snug text-fg">If I get distracted, then I will {session.intention}.</p>
          </div>
        </div>
      )}

      <Card className="mt-12 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <CameraStatus state={face.state} enabled={c.cameraOn} paused={paused} absentSince={face.absentSince} now={now} onEnable={() => c.toggleCamera(true)} />
          <TrackerStatus
            mode={c.tracking} connected={tracker.connected} status={tracker.status} screenState={c.screen.state} surface={c.screen.surface}
            paused={paused} now={now} onShareScreen={() => c.screen.request()} onSetupExtension={() => router.push('/extension?from=session')}
          />
        </div>
        {c.trackerError && <p role="alert" className="mt-3 text-[13px] text-warn">{c.trackerError}</p>}

        {c.cameraOn && !paused && ['starting', 'present', 'absent'].includes(face.state) && (
          <div className="mt-5 flex items-center gap-4 border-t border-line pt-5">
            <div className={cx('relative h-[72px] w-24 shrink-0 overflow-hidden rounded-lg bg-bg', previewHidden && 'invisible absolute')}>
              <CameraVideo attach={face.attachVideo} className="h-full w-full -scale-x-100 object-cover" />
            </div>
            <p className="flex-1 text-[13px] leading-relaxed text-fg-3">Video is analysed on this device and never uploaded. Only “at desk” or “away” is recorded.</p>
            <Button variant="ghost" onClick={() => setPreviewHidden(h => !h)} aria-pressed={previewHidden}>
              <Icon name={previewHidden ? 'eye' : 'eyeOff'} />
              <span className="hidden sm:inline">{previewHidden ? 'Show' : 'Hide'}</span>
            </Button>
          </div>
        )}

        <div className="mt-5 border-t border-line pt-5"><Timeline samples={session.timeline} /></div>

        {tracker.connected && (
          <div className="mt-5 border-t border-line pt-5">
            <TabActivity log={tracker.status?.log ?? []} lastCheckedAt={tracker.status?.lastCheckedAt ?? null} now={now} paused={paused} mode={c.tracking === 'screen' ? 'screen' : 'extension'} />
          </div>
        )}
      </Card>

      {/* Parking lot: writing a stray thought down stops it nagging (Masicampo & Baumeister, 2011). */}
      <Card className="mt-4 p-5 sm:p-6">
        <form onSubmit={e => { e.preventDefault(); c.parkThought(thought); setThought('') }} className="flex gap-2">
          <label htmlFor="park" className="sr-only">Park a thought</label>
          <input id="park" value={thought} onChange={e => setThought(e.target.value)} placeholder="Something pulling at you? Park it here and get back to work…" maxLength={140} autoComplete="off" className={cx(inputClass, 'h-11 text-sm')} />
          <Button type="submit" variant="secondary" className="h-11 shrink-0" disabled={!thought.trim()}>Park</Button>
        </form>
        {session.parked.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Parked thoughts">
            {session.parked.map((p, i) => <li key={i} className="pop rounded-full bg-surface-2 px-3 py-1 text-[13px] text-fg-2">{p}</li>)}
          </ul>
        )}
      </Card>

      {c.error && <p role="alert" className="mt-6 text-center text-sm text-danger">{c.error}</p>}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" variant="secondary" onClick={c.togglePause} className="sm:w-40"><Icon name={paused ? 'play' : 'pause'} />{paused ? 'Resume' : 'Pause'}</Button>
        <Button size="lg" onClick={() => c.finish(false)} disabled={c.ending} className="flex-1"><Icon name="check" />{c.ending ? 'Saving…' : 'Finish session'}</Button>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="ghost" onClick={c.markDistracted} disabled={paused}>
          I drifted off{session.distractions > 0 && <span className="tabular text-fg-3">· {session.distractions}</span>}
        </Button>
        {confirmAbandon ? (
          <div className="flex items-center gap-1">
            <span className="text-sm text-fg-3">Discard this session?</span>
            <Button variant="danger" onClick={() => { c.finish(true); setConfirmAbandon(false) }} disabled={c.ending}>Abandon</Button>
            <Button variant="ghost" onClick={() => setConfirmAbandon(false)}>Keep going</Button>
          </div>
        ) : (
          <Button variant="ghost" onClick={() => setConfirmAbandon(true)}>Abandon</Button>
        )}
      </div>
    </div>
  )
}
