'use client'

import { useEffect, useState } from 'react'
import type { OAuthProvidersResponse } from '../../../shared/api'
import { API_BASE, api } from '../lib/api'
import { cx } from './ui'

// "Continue with Google / Facebook / GitHub". Each button is a plain link to the API, which sends the
// browser to the provider and back. Only providers configured on the server are shown; if that list
// can't be loaded, the buttons stay hidden and email sign-in works as usual.

type Provider = keyof OAuthProvidersResponse['providers']

const COLUMNS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }
const LABELS: Record<Provider, string> = { google: 'Google', facebook: 'Facebook', github: 'GitHub' }

// Brand marks keep their official colours (the providers' brand rules require it), which is why this
// file is the one place with raw colour values.
function Mark({ provider }: { provider: Provider }) {
  if (provider === 'google') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 01-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
        <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0012 24z" />
        <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 010-4.6V6.6h-4a12 12 0 000 10.8l4-3.1z" />
        <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 001.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
      </svg>
    )
  }
  if (provider === 'facebook') {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path fill="#1877F2" d="M24 12a12 12 0 10-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0024 12z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 00-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 016 0C17.3 4.6 18.3 5 18.3 5c.7 1.7.3 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0012 .3" />
    </svg>
  )
}

export function SocialSignIn({ isSignup }: { isSignup: boolean }) {
  const [enabled, setEnabled] = useState<Provider[]>([])

  useEffect(() => {
    api<OAuthProvidersResponse>('/auth/oauth/providers')
      .then(d => setEnabled((Object.keys(d.providers) as Provider[]).filter(p => d.providers[p])))
      .catch(() => setEnabled([])) // optional feature: email sign-in is unaffected
  }, [])

  if (enabled.length === 0) return null
  return (
    <div className="mt-8">
      <div className="flex items-center gap-4 text-xs text-fg-3" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className={cx('mt-6 grid gap-3', COLUMNS[enabled.length])}>
        {enabled.map(p => (
          <a
            key={p}
            href={`${API_BASE}/auth/oauth/${p}`}
            aria-label={`${isSignup ? 'Sign up' : 'Sign in'} with ${LABELS[p]}`}
            title={`Continue with ${LABELS[p]}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm text-fg transition-colors hover:border-fg-3 hover:bg-surface-2"
          >
            <Mark provider={p} />
            {enabled.length < 3 && <span>{LABELS[p]}</span>}
          </a>
        ))}
      </div>
    </div>
  )
}
