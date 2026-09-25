// App-wide transient messages. `toast()` works from anywhere (components, hooks, timers) by dispatching
// an event that <Toaster /> renders, so failures never have to end up only in the console.

export type ToastTone = 'info' | 'success' | 'warn' | 'error'

export interface ToastInput {
  message: string
  tone?: ToastTone
  /** Optional one-click recovery, e.g. "Retry". */
  action?: { label: string; run: () => void }
  /** Toasts with the same key replace each other instead of stacking. */
  key?: string
  durationMs?: number
}

export interface ToastItem extends Required<Pick<ToastInput, 'message' | 'tone' | 'durationMs'>> {
  id: number
  key?: string
  action?: ToastInput['action']
}

export const TOAST_EVENT = 'braincoach:toast'
let nextId = 1

export function toast(input: ToastInput | string) {
  if (typeof window === 'undefined') return
  const t = typeof input === 'string' ? { message: input } : input
  const item: ToastItem = {
    id: nextId++,
    message: t.message,
    tone: t.tone ?? 'info',
    durationMs: t.durationMs ?? (t.tone === 'error' || t.action ? 8000 : 4500),
    key: t.key,
    action: t.action,
  }
  window.dispatchEvent(new CustomEvent<ToastItem>(TOAST_EVENT, { detail: item }))
}

/** Like toast(), but at most once per `windowMs` for a given key; for failures that can repeat every second. */
const lastShown = new Map<string, number>()
export function toastOnce(key: string, input: Omit<ToastInput, 'key'>, windowMs = 2 * 60_000) {
  const now = Date.now()
  if (now - (lastShown.get(key) ?? 0) < windowMs) return
  lastShown.set(key, now)
  toast({ ...input, key })
}
