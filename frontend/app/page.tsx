'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthResponse } from '../../shared/api'
import { useAuth } from './context/AuthContext'
import { LoginArt } from './components/LoginArt'
import { Logo } from './components/Logo'
import { SocialSignIn } from './components/SocialSignIn'
import { Button, Field, Icon, cx, inputClass } from './components/ui'
import NavLink from './components/NavLink'
import { api } from './lib/api'
import { markTourPending } from './lib/tour'

// Why a Google / Facebook / GitHub sign-in came back without signing in (?oauth_error=… from the API).
const OAUTH_ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. You can try again or use your email instead.',
  no_email: 'That account didn’t share a verified email address, so we couldn’t sign you in. Try another option or use your email.',
  unavailable: 'That sign-in option isn’t available right now. Please use your email instead.',
  failed: 'Something went wrong while signing you in. Please try again.',
}

export default function Home() {
  const { user, login, isLoading, sessionExpired, timedOut, status, recheck } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard')
  }, [user, isLoading, router])

  // Coming back from a social sign-in that didn't complete: explain, then tidy the address bar.
  useEffect(() => {
    const url = new URL(window.location.href)
    const reason = url.searchParams.get('oauth_error')
    if (!reason) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL is only possible after mount
    setError(OAUTH_ERRORS[reason] ?? OAUTH_ERRORS.failed)
    url.searchParams.delete('oauth_error')
    window.history.replaceState(null, '', url.pathname + url.search)
  }, [])


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      // The API sets an httpOnly session cookie; we only get the user back.
      const data = await api<AuthResponse>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      login(data.user)
      if (mode === 'signup') markTourPending()
      router.push('/dashboard')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side */}
      <aside className="hidden p-6 lg:block xl:p-8">
        <LoginArt />
      </aside>

      {/* Form side */}
      <main className="flex items-center justify-center px-5 py-16 sm:px-8">
        <div className="animate-in w-full max-w-[380px]">
          <div className="mb-12 lg:hidden"><Logo size="md" animate /></div>

          <h2 className="font-serif text-4xl leading-tight text-fg">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="mt-2 text-sm text-fg-3">
            {isSignup ? 'Already have one? ' : 'New here? '}
            <button
              type="button"
              onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError('') }}
              className="cursor-pointer text-accent underline-offset-4 hover:underline"
            >
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>

          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5" noValidate={false}>
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                className={inputClass}
              />
            </Field>

            <Field label="Password" htmlFor="password" hint={isSignup ? 'At least 8 characters.' : undefined}>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={isSignup ? 8 : undefined}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className={cx(inputClass, 'pr-12')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-fg-3 hover:text-fg"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
            </Field>

            {!error && status === 'unreachable' && (
              <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
                <span>Can&apos;t reach the server right now.</span>
                <button type="button" onClick={recheck} className="shrink-0 cursor-pointer underline underline-offset-4">Retry</button>
              </div>
            )}

            {!error && timedOut && (
              <p role="status" className="rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm text-fg-2">
                You were signed out after 30 minutes of inactivity. Please sign in again.
              </p>
            )}

            {!error && !timedOut && sessionExpired && (
              <p role="status" className="rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm text-fg-2">Your session ended. Please sign in again.</p>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
              {loading ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create account' : 'Sign in')}
            </Button>
          </form>
          <SocialSignIn isSignup={isSignup} />
          <p className="mt-8 text-center text-xs text-fg-3">
            Tracking is optional and off by default.{' '}
            <NavLink href="/privacy" className="text-accent underline-offset-4 hover:underline">How we handle your data</NavLink>
          </p>
        </div>
      </main>
    </div>
  )
}
