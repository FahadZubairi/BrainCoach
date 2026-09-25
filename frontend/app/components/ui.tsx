'use client'

import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react'

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ── Icons: a small hand-picked 1.5px-stroke set, sized in em so they follow text ──
const PATHS = {
  check: 'M4.5 12.5l5 5 10-11',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M9 5v14M15 5v14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  camera: 'M3 8.5A1.5 1.5 0 014.5 7h2.3l1.4-2h7.6l1.4 2h2.3A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5zM12 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  browser: 'M3.5 5.5h17v13h-17zM3.5 9h17M6.5 7.25h.01M9 7.25h.01',
  trash: 'M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12',
  logout: 'M15 5h3.5v14H15M10 8l-4 4 4 4M6 12h9',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 14.75a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5z',
  eyeOff: 'M3 3l18 18M10.6 5.6A10 10 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-2.7 3.4M6.5 7.1C4 8.8 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9.6 9.6 0 004.3-1',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M6.3 17.7l2.8-2.8M14.9 9.1l2.8-2.8',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  const filled = name === 'play'
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cx('inline-block h-[1.1em] w-[1.1em] shrink-0', className)}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

// ── Button ──
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'bg-surface-2 text-fg border border-line-strong hover:border-fg-3',
  ghost: 'text-fg-2 hover:text-fg hover:bg-surface-2',
  danger: 'text-danger hover:bg-danger-soft',
}

// Heights are ≥40px (lg 48px) so every target is comfortably clickable and tappable (Fitts's law, WCAG 2.5.8).
const SIZES: Record<Size, string> = {
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-[15px]',
}

// Exported so links that look like buttons (e.g. <Link>) don't have to nest a <button>.
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-xl font-medium tracking-[-0.01em]',
    'transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
    'cursor-pointer select-none',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  )
})

// ── Surfaces & text ──
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-line bg-surface', className)}>{children}</div>
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx('text-xs font-medium uppercase tracking-[0.08em] text-fg-3', className)}>{children}</p>
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="font-serif text-[40px] leading-[1.05] tracking-[-0.01em] text-fg sm:text-5xl">{title}</h1>
      </div>
      {children}
    </header>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div>
      <p className="text-[13px] text-fg-3">{label}</p>
      <p className="tabular mt-2 text-[32px] font-light leading-none tracking-[-0.03em] text-fg">{value}</p>
      {hint && <p className="mt-2 text-xs text-fg-3">{hint}</p>}
    </div>
  )
}

export function StatusDot({ tone, pulse }: { tone: 'accent' | 'warn' | 'danger' | 'muted'; pulse?: boolean }) {
  const color = { accent: 'bg-accent', warn: 'bg-warn', danger: 'bg-danger', muted: 'bg-fg-3' }[tone]
  return <span aria-hidden="true" className={cx('inline-block h-2 w-2 shrink-0 rounded-full', color, pulse && 'pulse-dot')} />
}

// Form controls live in ./forms; re-exported so existing imports from './ui' keep working.
export { Field, Segmented, Switch, inputClass } from './forms'

export function ScoreBar({ value, className }: { value: number; className?: string }) {
  const tone = value >= 70 ? 'bg-accent' : value >= 40 ? 'bg-warn' : 'bg-danger'
  return (
    <div className={cx('h-1 overflow-hidden rounded-full bg-line', className)} aria-hidden="true">
      <div className={cx('h-full rounded-full', tone)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

export function scoreTone(value: number) {
  return value >= 70 ? 'text-accent' : value >= 40 ? 'text-warn' : 'text-danger'
}
