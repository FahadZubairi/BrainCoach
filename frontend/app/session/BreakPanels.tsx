import { Button, Icon } from '../components/ui'
import type { ActiveSession } from '../lib/activeSession'
import { formatCountdown } from './constants'

// The timebox-complete prompt (modal) and the countdown shown while on a break.

export function BreakDialog({ session, ending, onBreak, onDismiss, onFinish }: {
  session: ActiveSession
  ending: boolean
  onBreak: () => void
  onDismiss: () => void
  onFinish: () => void
}) {
  const minutes = session.breakMinutes
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-5 backdrop-blur-sm" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="break-title"
        aria-describedby="break-desc"
        className="slide-down w-full max-w-md rounded-2xl border border-line-strong bg-surface p-7 shadow-2xl"
        onKeyDown={e => { if (e.key === 'Escape') onDismiss() }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-warn">Timebox complete</p>
        <h2 id="break-title" className="mt-2 font-serif text-3xl text-fg">Time for a break.</h2>
        <p id="break-desc" className="mt-2 text-sm leading-relaxed text-fg-2">
          {session.plannedMinutes} focused minutes done. Step away for {minutes} {minutes === 1 ? 'minute' : 'minutes'}: stand, stretch,
          look at something far away. The session pauses and picks up again on its own.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button autoFocus onClick={onBreak} className="flex-1"><Icon name="pause" /> Take a {minutes}-min break</Button>
          <Button variant="ghost" onClick={onDismiss}>Not now</Button>
        </div>
        <button type="button" onClick={onFinish} disabled={ending} className="mt-3 w-full cursor-pointer text-center text-xs text-fg-3 hover:text-fg">
          or finish the session here
        </button>
      </div>
    </div>
  )
}

export function BreakCountdown({ breakUntil, now, onContinue }: { breakUntil: number; now: number; onContinue: () => void }) {
  return (
    <div role="status" className="slide-down mt-10 flex flex-col items-center rounded-2xl border border-warn/30 bg-warn-soft px-6 py-7 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-warn">On a break</p>
      <p className="tabular mt-2 text-5xl font-extralight tracking-[-0.03em] text-fg" aria-live="off">{formatCountdown(breakUntil - now)}</p>
      <p className="mt-2 text-sm text-fg-2">The session resumes automatically. Away from the screen is the point.</p>
      <Button variant="secondary" onClick={onContinue} className="mt-4"><Icon name="play" /> Continue now</Button>
    </div>
  )
}
