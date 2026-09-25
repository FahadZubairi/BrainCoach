import { Card, cx } from '../components/ui'

// Presentational pieces of the Insights page.

export function InsightCard({ title, body, tone }: { title: string; body: string; tone: 'accent' | 'danger' | 'warn' | 'muted' }) {
  const bar = { accent: 'bg-accent', danger: 'bg-danger', warn: 'bg-warn', muted: 'bg-fg-3' }[tone]
  return (
    <Card className="relative overflow-hidden p-6 sm:p-7">
      <span className={cx('absolute left-0 top-7 h-5 w-[3px] rounded-r', bar)} aria-hidden="true" />
      <h2 className="text-sm font-medium text-fg">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{body}</p>
    </Card>
  )
}

export function BarList({ rows }: { rows: { label: string; hint?: string; value: number | null; count: number }[] }) {
  return (
    <ul className="mt-6 space-y-4">
      {rows.map(r => (
        <li key={r.label} className="grid grid-cols-[88px_1fr_48px] items-center gap-4 text-sm">
          <span className="text-fg-2">{r.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            {r.value !== null && (
              <span className={cx('block h-full origin-left rounded-full [animation:grow-x_0.8s_var(--ease-out)_both]', r.value >= 70 ? 'bg-accent' : r.value >= 40 ? 'bg-warn' : 'bg-danger')} style={{ width: `${Math.max(3, r.value)}%` }} />
            )}
          </span>
          <span className="tabular text-right text-fg-3" aria-label={r.value !== null ? `${r.value}% across ${r.count} sessions` : 'no sessions'}>
            {r.value !== null ? `${r.value}%` : '—'}
          </span>
        </li>
      ))}
    </ul>
  )
}
