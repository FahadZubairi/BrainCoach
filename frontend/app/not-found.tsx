'use client'

import Link from 'next/link'
import { LogoMark } from './components/Logo'
import { buttonClass } from './components/ui'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="max-w-md text-center">
        <LogoMark size={48} className="mx-auto opacity-80" />
        <p className="mt-6 text-xs font-medium uppercase tracking-[0.08em] text-fg-3">404</p>
        <h1 className="mt-2 font-serif text-3xl text-fg">This page drifted off.</h1>
        <p className="mt-3 text-sm text-fg-2">The link may be old, or the page moved.</p>
        <Link href="/dashboard" className={buttonClass('primary', 'md', 'mt-6')}>Back to Today</Link>
      </div>
    </main>
  )
}
