'use client'

import { useEffect, useRef, useState } from 'react'
import { cx } from './ui'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Counts from the previous value to the new one, so a changed number reads as a change, not a swap.
export function CountUp({ value, format = String, duration = 700 }: {
  value: number
  format?: (n: number) => string
  duration?: number
}) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const from = useRef(0)

  useEffect(() => {
    const start = from.current
    from.current = value
    let raf = 0
    if (prefersReducedMotion() || start === value) {
      raf = requestAnimationFrame(() => setShown(value))
      return () => cancelAnimationFrame(raf)
    }
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(start + (value - start) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span className="tabular">{format(shown)}</span>
}

// Circular progress. The stroke animates on change via a CSS transition.
export function ProgressRing({ value, size = 120, stroke = 6, className, trackClass = 'stroke-line', barClass = 'stroke-accent', children, label }: {
  value: number // 0–1
  size?: number
  stroke?: number
  className?: string
  trackClass?: string
  barClass?: string
  children?: React.ReactNode
  label: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  return (
    <div className={cx('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className={cx(barClass, 'transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]')}
        />
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>}
    </div>
  )
}
