import { useState } from 'react'
import { Button, cx } from '../components/ui'
import { formatMinutes } from '../lib/api'
import { GOAL_MAX, GOAL_MIN, GOAL_OPTIONS, parseGoal } from '../lib/goal'

// Daily goal picker: presets plus a free-form custom goal ("6.5", "6h 30m", "90m").
export function GoalEditor({ current, onSave, onClose }: { current: number; onSave: (m: number) => void; onClose: () => void }) {
  const isCustom = !GOAL_OPTIONS.includes(current)
  const [custom, setCustom] = useState(isCustom)
  const [text, setText] = useState(isCustom ? String(+(current / 60).toFixed(2)) : '')
  const parsed = parseGoal(text)
  const valid = parsed !== null && parsed >= GOAL_MIN && parsed <= GOAL_MAX
  const error = text.trim() && !valid
    ? parsed === null ? 'Try 6.5, 6h 30m or 90m' : parsed < GOAL_MIN ? 'At least 10 minutes' : 'At most 16 hours'
    : ''

  function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (valid) onSave(parsed!)
  }

  return (
    <div className="slide-down mt-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Daily goal">
        {GOAL_OPTIONS.map(m => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={!custom && current === m}
            onClick={() => onSave(m)}
            className={cx('h-8 cursor-pointer rounded-lg px-2.5 text-xs transition-colors',
              !custom && current === m ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-fg-2 hover:text-fg')}
          >
            {formatMinutes(m)}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={custom}
          onClick={() => setCustom(true)}
          className={cx('h-8 cursor-pointer rounded-lg px-2.5 text-xs transition-colors',
            custom ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-fg-2 hover:text-fg')}
        >
          {isCustom && !custom ? formatMinutes(current) : 'Custom'}
        </button>
      </div>

      {custom && (
        <form onSubmit={save} className="slide-down mt-2.5" onKeyDown={e => { if (e.key === 'Escape') onClose() }}>
          <div className="flex items-center gap-2">
            <label htmlFor="custom-goal" className="sr-only">Custom daily goal in hours</label>
            <div className="relative">
              <input
                id="custom-goal"
                autoFocus
                inputMode="decimal"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="6.5"
                maxLength={12}
                aria-invalid={!!error}
                aria-describedby="custom-goal-hint"
                className={cx(
                  'h-9 w-28 rounded-lg border bg-bg pl-3 pr-12 text-sm text-fg placeholder:text-fg-3 focus:outline-none focus-visible:outline-none',
                  error ? 'border-danger/60' : 'border-line-strong focus:border-accent',
                )}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-3">hours</span>
            </div>
            <Button type="submit" className="h-9 px-3 text-xs" disabled={!valid}>Set</Button>
            <Button variant="ghost" className="h-9 px-2.5 text-xs" onClick={onClose}>Cancel</Button>
          </div>
          <p id="custom-goal-hint" className={cx('mt-1.5 text-xs', error ? 'text-danger' : 'text-fg-3')} role={error ? 'alert' : undefined}>
            {error || (valid ? `= ${formatMinutes(parsed!)} a day` : 'Hours like 6.5, or 6h 30m')}
          </p>
        </form>
      )}
    </div>
  )
}
