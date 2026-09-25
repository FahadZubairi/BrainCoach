'use client' // Error boundaries must be Client Components

import { useEffect } from 'react'
import { LogoMark } from './components/Logo'
import { Button, Icon, buttonClass } from './components/ui'

// Catches rendering errors in any page so one broken component can't blank the whole app.
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('Page crashed:', error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="max-w-md text-center" role="alert">
        <LogoMark size={48} className="mx-auto opacity-80" />
        <h1 className="mt-6 font-serif text-3xl text-fg">Something broke on this page.</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-2">
          It&apos;s not you. Try again, or head back to Today. If you were in a session, it&apos;s saved on this device.
        </p>
        {error.digest && <p className="mt-2 text-xs text-fg-3">Reference: {error.digest}</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => retry()}><Icon name="play" /> Try again</Button>
          {/* A full navigation, not NavLink: if app state is what broke, start clean. */}
          <a href="/dashboard" className={buttonClass('secondary')}>Back to Today</a>
        </div>
      </div>
    </main>
  )
}
