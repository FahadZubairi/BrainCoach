import { ReactNode, useState } from 'react'
import { Button, cx } from '../components/ui'
import type { Prefs } from '../lib/prefs'
import { BREAK_MAX, PRESET_TIMEBOXES, TIMEBOX_MAX, TIMEBOX_MIN } from './constants'

// Timebox (25/50/90/custom/open) plus break length. Values persist in prefs.
export function TimeboxField({ prefs, updatePrefs }: { prefs: Prefs; updatePrefs: (p: Partial<Prefs>) => void }) {
  const [custom, setCustom] = useState(false)
  const [text, setText] = useState('')
  const planned = prefs.plannedMinutes ?? 0
  const isCustomValue = planned > 0 && !PRESET_TIMEBOXES.includes(planned)

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm text-fg-2">Timebox</span>
        <span className="text-[13px] text-fg-3">{planned ? `Break reminder after ${planned} min` : 'No reminder'}</span>
      </div>
      <div role="radiogroup" aria-label="Session length" className="grid grid-cols-5 gap-1.5 rounded-xl border border-line bg-bg p-1.5">
        {PRESET_TIMEBOXES.map(m => (
          <Option key={m} selected={!custom && planned === m} onClick={() => { setCustom(false); updatePrefs({ plannedMinutes: m }) }}>{m} min</Option>
        ))}
        <Option selected={custom || isCustomValue} onClick={() => { setCustom(true); setText(isCustomValue ? String(planned) : '') }}>
          {!custom && isCustomValue ? `${planned} min` : 'Custom'}
        </Option>
        <Option selected={!custom && planned === 0} onClick={() => { setCustom(false); updatePrefs({ plannedMinutes: null }) }}>Open</Option>
      </div>

      {custom && (
        <CustomMinutes
          text={text}
          onText={setText}
          onSet={m => { updatePrefs({ plannedMinutes: m }); setCustom(false) }}
          onCancel={() => setCustom(false)}
        />
      )}

      {planned > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="break-length" className="text-sm text-fg-2">Break length</label>
            <span className="tabular text-[13px] text-fg">{prefs.breakMinutes} min</span>
          </div>
          <input
            id="break-length" type="range" min={1} max={BREAK_MAX} step={1} value={prefs.breakMinutes}
            onChange={e => updatePrefs({ breakMinutes: Number(e.target.value) })}
            className="range w-full" aria-valuetext={`${prefs.breakMinutes} minutes`}
          />
          <div className="mt-1 flex justify-between text-[11px] text-fg-3" aria-hidden="true"><span>1 min</span><span>15 min</span></div>
        </div>
      )}
    </div>
  )
}

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button" role="radio" aria-checked={selected} onClick={onClick}
      className={cx(
        'h-10 cursor-pointer truncate rounded-lg px-1 text-sm transition-colors duration-150',
        selected ? 'bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-fg-3 hover:text-fg-2',
      )}
    >
      {children}
    </button>
  )
}

function CustomMinutes({ text, onText, onSet, onCancel }: { text: string; onText: (v: string) => void; onSet: (m: number) => void; onCancel: () => void }) {
  const n = Number(text)
  const valid = text.trim() !== '' && Number.isInteger(n) && n >= TIMEBOX_MIN && n <= TIMEBOX_MAX
  const error = text.trim() && !valid ? `Whole minutes from ${TIMEBOX_MIN} to ${TIMEBOX_MAX}` : ''
  return (
    <div className="slide-down mt-2.5" onKeyDown={e => { if (e.key === 'Escape') onCancel() }}>
      <div className="flex items-center gap-2">
        <div className="relative">
          <label htmlFor="custom-timebox" className="sr-only">Custom timebox in minutes</label>
          <input
            id="custom-timebox" autoFocus inputMode="numeric" value={text} placeholder="40" maxLength={3} aria-invalid={!!error}
            onChange={e => onText(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (valid) onSet(n) } }}
            className={cx(
              'h-10 w-32 rounded-lg border bg-bg pl-3 pr-14 text-sm text-fg placeholder:text-fg-3 focus:outline-none focus-visible:outline-none',
              error ? 'border-danger/60' : 'border-line-strong focus:border-accent',
            )}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-3">minutes</span>
        </div>
        <Button className="h-10 px-4 text-xs" disabled={!valid} onClick={() => onSet(n)}>Set</Button>
        <Button variant="ghost" className="h-10 px-3 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
      <p className={cx('mt-1.5 text-xs', error ? 'text-danger' : 'text-fg-3')} role={error ? 'alert' : undefined}>
        {error || 'How long you want to focus before a break.'}
      </p>
    </div>
  )
}
