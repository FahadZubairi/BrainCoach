import { useId } from 'react'
import { cx } from './ui'

// The BrainCoach mark: a brain drawn in light: sage strokes with a soft glow, as if it's switched on.
// Same symbol as the favicon and the Chrome extension icon, so it's recognisable everywhere.
const BRAIN = [
  // hemispheres
  'M32 16 C29 13.4 24.4 13.4 22.4 16.4 C18.4 15.7 15.3 19 16.1 22.6 C12.7 24.6 12.5 29.2 15.1 31.2 C12.5 33.7 13.5 38.2 17 39.2 C17.2 43.2 21.6 45.7 25.1 44.4 C27.1 47.1 31 47.1 32 44.6',
  'M32 16 C35 13.4 39.6 13.4 41.6 16.4 C45.6 15.7 48.7 19 47.9 22.6 C51.3 24.6 51.5 29.2 48.9 31.2 C51.5 33.7 50.5 38.2 47 39.2 C46.8 43.2 42.4 45.7 38.9 44.4 C36.9 47.1 33 47.1 32 44.6',
  // folds
  'M22.4 16.4 C24.4 17.8 25.1 20.4 24.2 22.6',
  'M16.1 22.6 C18.5 22.8 20.6 24.5 20.9 26.9',
  'M15.1 31.2 C18 30.8 21 32 22.1 34.4',
  'M17 39.2 C19.1 38.3 21.7 38.8 23.2 40.8',
  'M41.6 16.4 C39.6 17.8 38.9 20.4 39.8 22.6',
  'M47.9 22.6 C45.5 22.8 43.4 24.5 43.1 26.9',
  'M48.9 31.2 C46 30.8 43 32 41.9 34.4',
  'M47 39.2 C44.9 38.3 42.3 38.8 40.8 40.8',
  // central fissure
  'M32 16 L32 44.6',
]

export function LogoMark({ size = 32, animate = false, className }: { size?: number; animate?: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cx('shrink-0', animate && 'logo-animate', className)}
    >
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#23231f" />
          <stop offset="1" stopColor="#111110" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.03" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* userSpaceOnUse: an objectBoundingBox gradient collapses on the zero-width centre line */}
        <linearGradient id={`${id}-stroke`} gradientUnits="userSpaceOnUse" x1="18" y1="13" x2="44" y2="48">
          <stop offset="0" stopColor="#e3f3e8" />
          <stop offset="0.5" stopColor="#a9d3b5" />
          <stop offset="1" stopColor="#76aa89" />
        </linearGradient>
        <radialGradient id={`${id}-halo`} cx="0.5" cy="0.48" r="0.5">
          <stop offset="0" stopColor="#9cc9a9" stopOpacity="0.45" />
          <stop offset="1" stopColor="#9cc9a9" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.7" />
        </filter>
      </defs>

      <rect x="0.5" y="0.5" width="63" height="63" rx="15" fill={`url(#${id}-tile)`} />
      <rect x="0.5" y="0.5" width="63" height="63" rx="15" fill="none" stroke={`url(#${id}-edge)`} />
      <circle className="logo-halo" cx="32" cy="31" r="21" fill={`url(#${id}-halo)`} />
      <g transform="translate(32 30.5) scale(1.12) translate(-32 -30.5)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g opacity="0.6">
          <g className="logo-glow" stroke="#b2d8bd" strokeWidth="3.8" filter={`url(#${id}-blur)`}>
            {BRAIN.map(d => <path key={d} d={d} pathLength={100} />)}
          </g>
        </g>
        <g className="logo-lines" stroke={`url(#${id}-stroke)`} strokeWidth="2.6">
          {BRAIN.map(d => <path key={d} d={d} pathLength={100} />)}
        </g>
      </g>
    </svg>
  )
}

// Oversized, line-only brain for decorative backgrounds (login panel). Strokes are drawn with
// vector-effect: non-scaling-stroke so the lines stay fine however large the drawing is.
export function BrainOutline({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="10 10 44 40" aria-hidden="true" className={className} fill="none">
      <defs>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
      </defs>
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* faint glow underneath, then the crisp line */}
        <g opacity="0.5" filter={`url(#${id}-soft)`} strokeWidth={strokeWidth * 4}>
          {BRAIN.map(d => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
        </g>
        <g strokeWidth={strokeWidth}>
          {BRAIN.map(d => <path key={d} d={d} vectorEffect="non-scaling-stroke" />)}
        </g>
      </g>
    </svg>
  )
}

const SIZES = {
  sm: { mark: 28, text: 'text-[21px]', gap: 'gap-2.5' },
  md: { mark: 40, text: 'text-[28px]', gap: 'gap-3' },
  lg: { mark: 60, text: 'text-[44px]', gap: 'gap-4' },
}

export function Logo({ size = 'sm', animate = false, className }: { size?: keyof typeof SIZES; animate?: boolean; className?: string }) {
  const s = SIZES[size]
  return (
    <span className={cx('inline-flex items-center', s.gap, className)}>
      <LogoMark size={s.mark} animate={animate} />
      <span className={cx('font-serif leading-none tracking-[-0.015em] text-fg', s.text)}>
        Brain<span className="italic text-accent">coach</span>
      </span>
    </span>
  )
}
