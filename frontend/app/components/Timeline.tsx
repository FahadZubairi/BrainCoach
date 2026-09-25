import { Sample } from '../lib/activeSession'
import { cx } from './ui'

const COLORS: Record<Sample, string> = {
  focus: 'bg-accent',
  away: 'bg-warn',
  off: 'bg-danger',
  paused: 'bg-line-strong',
}

const LABELS: Record<Sample, string> = {
  focus: 'Focused',
  away: 'Away from desk',
  off: 'Off-task tab',
  paused: 'Paused',
}

// Compresses the raw 10-second samples into at most `columns` bars, each showing its dominant state.
function bucket(samples: Sample[], columns: number): Sample[] {
  if (samples.length <= columns) return samples
  const size = samples.length / columns
  return Array.from({ length: columns }, (_, i) => {
    const slice = samples.slice(Math.floor(i * size), Math.floor((i + 1) * size))
    const counts = slice.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {})
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as Sample) || 'focus'
  })
}

export default function Timeline({ samples, columns = 72, className }: { samples: Sample[]; columns?: number; className?: string }) {
  const bars = bucket(samples, columns)
  const present = (Object.keys(COLORS) as Sample[]).filter(k => samples.includes(k))

  return (
    <div className={className}>
      {/* Fixed slots so the strip fills up over time instead of one sample stretching full-width. */}
      <div
        className="grid h-8 gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`Session timeline: ${present.map(k => `${Math.round((samples.filter(s => s === k).length / Math.max(1, samples.length)) * 100)}% ${LABELS[k].toLowerCase()}`).join(', ') || 'no data yet'}`}
      >
        {Array.from({ length: columns }, (_, i) => {
          const s = bars[i]
          return <div key={i} className={cx('rounded-[2px]', s ? COLORS[s] : 'bg-surface-2', s === 'focus' && 'opacity-80')} />
        })}
      </div>
      {present.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-fg-3" aria-hidden="true">
          {present.map(k => (
            <span key={k} className="flex items-center gap-2">
              <span className={cx('h-2 w-2 rounded-[2px]', COLORS[k])} />
              {LABELS[k]}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
