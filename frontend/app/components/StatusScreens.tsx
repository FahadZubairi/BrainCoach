'use client'

import { useEffect } from 'react'
import { useOnline } from '../lib/useOnline'
import { LogoMark } from './Logo'
import { Button, Icon } from './ui'

// Full-page states shown instead of the app when it can't render normally.

export function FullPageLoading({ label = 'Loading BrainCoach' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size={44} className="pulse-dot" />
        <span className="sr-only">{label}…</span>
      </div>
    </div>
  )
}

export function Unreachable({ onRetry }: { onRetry: () => void }) {
  const online = useOnline()
  // Try again by itself as soon as the connection comes back.
  useEffect(() => {
    if (!online) return
    const onOnline = () => onRetry()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [online, onRetry])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="max-w-sm text-center" role="alert">
        <LogoMark size={48} className="mx-auto opacity-80" />
        <h1 className="mt-6 font-serif text-3xl text-fg">Can&apos;t reach BrainCoach.</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-2">
          {online
            ? 'The server isn’t responding right now. If you were in a session, it’s saved on this device and will pick up where you left off.'
            : 'You’re offline. Reconnect and we’ll try again automatically. Any session in progress is saved on this device.'}
        </p>
        <Button onClick={onRetry} className="mt-6"><Icon name="play" /> Try again</Button>
      </div>
    </div>
  )
}

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div role="status" className="slide-down border-b border-warn/30 bg-warn-soft px-5 py-2 text-center text-[13px] text-warn">
      You&apos;re offline. Your session keeps running; anything that needs the server will retry when you&apos;re back.
    </div>
  )
}
