import { Button, Card, Icon, cx } from './ui'

// Shared non-happy-path UI: an error with a way out, and loading placeholders shaped like the content.

export function ErrorState({ message, onRetry, className }: { message: string; onRetry: () => void; className?: string }) {
  return (
    <Card className={cx('flex flex-col items-center gap-3 px-6 py-10 text-center', className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-soft text-danger" aria-hidden="true">
        <Icon name="x" />
      </span>
      <p role="alert" className="max-w-sm text-sm text-fg-2">{message}</p>
      <Button variant="secondary" onClick={onRetry}>Try again</Button>
    </Card>
  )
}

/** Placeholder rows for a list that's loading. */
export function SkeletonList({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <Card className="divide-y divide-line" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-6 px-6 py-4">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
          </div>
          <div className="h-3.5 w-10 animate-pulse rounded bg-surface-2" />
        </div>
      ))}
    </Card>
  )
}

/** A placeholder block of a given height. */
export function SkeletonBlock({ className, label }: { className?: string; label: string }) {
  return <div className={cx('animate-pulse rounded-2xl bg-surface', className)} aria-busy="true" aria-label={label} />
}
