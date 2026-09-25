'use client'

import { ReactNode } from 'react'
import { cx } from './ui'

// Form controls: segmented choice, switch, labelled field, and the shared input style.
export function Segmented<T extends string | number>({
  options, value, onChange, label,
}: {
  options: { value: T; label: string; hint?: string }[]
  value: T | null
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-1.5 rounded-xl border border-line bg-bg p-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(opt => {
        const selected = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={opt.hint}
            onClick={() => onChange(opt.value)}
            className={cx(
              'h-10 cursor-pointer rounded-lg text-sm transition-colors duration-150',
              selected ? 'bg-surface-2 text-fg shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, description }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: ReactNode
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full cursor-pointer items-center justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-sm text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-fg-3">{description}</span>}
      </span>
      <span className={cx('relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-accent' : 'bg-line-strong')}>
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-fg shadow transition-transform duration-200', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
    </button>
  )
}

export const inputClass = cx(
  'h-12 w-full rounded-xl border border-line-strong bg-bg px-4 text-[15px] text-fg',
  'placeholder:text-fg-3 transition-colors duration-150 hover:border-fg-3',
  'focus:border-accent focus:outline-none focus-visible:outline-none',
)

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-sm text-fg-2">{label}</label>
      {children}
      {hint && <p className="mt-2 text-xs text-fg-3">{hint}</p>}
    </div>
  )
}

