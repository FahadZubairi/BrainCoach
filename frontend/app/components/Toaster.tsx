'use client'

import { useEffect, useState } from 'react'
import { TOAST_EVENT, ToastItem } from '../lib/toast'
import { Icon, cx } from './ui'

const TONE: Record<ToastItem['tone'], { dot: string; ring: string }> = {
  info: { dot: 'bg-fg-3', ring: 'border-line-strong' },
  success: { dot: 'bg-accent', ring: 'border-accent/30' },
  warn: { dot: 'bg-warn', ring: 'border-warn/30' },
  error: { dot: 'bg-danger', ring: 'border-danger/40' },
}

// Renders toasts from lib/toast. Bottom-centre on phones (above the tab bar), bottom-right on desktop.
export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([])

  useEffect(() => {
    function onToast(e: Event) {
      const item = (e as CustomEvent<ToastItem>).detail
      setItems(prev => [...prev.filter(t => !item.key || t.key !== item.key), item].slice(-4))
      window.setTimeout(() => setItems(prev => prev.filter(t => t.id !== item.id)), item.durationMs)
    }
    window.addEventListener(TOAST_EVENT, onToast)
    return () => window.removeEventListener(TOAST_EVENT, onToast)
  }, [])

  const dismiss = (id: number) => setItems(prev => prev.filter(t => t.id !== id))

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:px-6"
    >
      {items.map(t => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={cx('slide-down pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-surface-2 px-4 py-3 shadow-2xl', TONE[t.tone].ring)}
        >
          <span aria-hidden="true" className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE[t.tone].dot)} />
          <p className="flex-1 text-sm leading-snug text-fg">{t.message}</p>
          {t.action && (
            <button
              type="button"
              onClick={() => { t.action?.run(); dismiss(t.id) }}
              className="shrink-0 cursor-pointer text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              {t.action.label}
            </button>
          )}
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-m-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-fg-3 hover:text-fg">
            <Icon name="x" />
          </button>
        </div>
      ))}
    </div>
  )
}
