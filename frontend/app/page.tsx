'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthResponse } from '../../shared/api'
import { useAuth } from './context/AuthContext'
import { LoginArt } from './components/LoginArt'
import { LogoMark } from './components/Logo'
import { Button, Icon, cx } from './components/ui'
import NavLink from './components/NavLink'
import { api } from './lib/api'
import { markTourPending } from './lib/tour'

// Filled inputs with a quiet border that appears on hover/focus, as on the reference design.
const labelClass = 'mb-2 block text-sm font-medium text-fg'
const fieldClass = cx(
  'h-12 w-full rounded-lg border border-transparent bg-surface-2 px-4 text-[15px] text-fg',
  'placeholder:text-fg-3 transition-colors duration-150 hover:border-line-strong',
  'focus:border-accent focus:outline-none',
)

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
  const switchMode = () => { setMode(isSignup ? 'login' : 'signup'); setError('') }

  return (
    <div className="grid min-h-screen bg-bg lg:grid-cols-2">
      {/* Form side */}
      <main className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="animate-in w-full max-w-[440px]">
          <LogoMark size={36} animate />

          <h1 className="mt-6 text-[34px] font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-[40px]">
            {isSignup ? 'Create your account' : 'Welcome back!'}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-fg-2">
            {isSignup
              ? 'Start your first focus session in under a minute. Tracking is optional and off until you choose it.'
              : 'Pick up where you left off: set one task, start a session, and let BrainCoach keep you on it.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input
                id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email" autoFocus placeholder="you@example.com" className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor="password" className={labelClass}>Password</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  required minLength={isSignup ? 8 : undefined} autoComplete={isSignup ? 'new-password' : 'current-password'}
                  placeholder={isSignup ? 'Create a password' : 'Your password'} className={cx(fieldClass, 'pr-12')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-fg-3 hover:text-fg"
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} />
                </button>
              </div>
              {isSignup && <p className="mt-2 text-xs text-fg-3">At least 8 characters.</p>}
            </div>

            {!error && status === 'unreachable' && (
              <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm text-warn">
                <span>Can&apos;t reach the server right now.</span>
                <button type="button" onClick={recheck} className="shrink-0 cursor-pointer underline underline-offset-4">Retry</button>
              </div>
            )}
            {!error && timedOut && (
              <p role="status" className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-fg-2">You were signed out after 30 minutes of inactivity. Please sign in again.</p>
            )}
            {!error && !timedOut && sessionExpired && (
              <p role="status" className="rounded-lg bg-surface-2 px-4 py-3 text-sm text-fg-2">Your session ended. Please sign in again.</p>
            )}
            {error && (
              <p role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="mt-1 w-full rounded-lg">
              {loading ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create account' : 'Sign in')}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-fg-3">
            {isSignup ? 'Already have an account? ' : 'New to BrainCoach? '}
            <button type="button" onClick={switchMode} className="cursor-pointer font-medium text-accent underline-offset-4 hover:underline">
              {isSignup ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="mt-3 text-center text-xs text-fg-3">
            <NavLink href="/privacy" className="underline-offset-4 hover:text-fg-2 hover:underline">How we handle your data</NavLink>
          </p>
        </div>
      </main>

      {/* Art side */}
      <aside className="hidden p-6 lg:block xl:p-8" aria-hidden="true">
        <LoginArt />
      </aside>
    </div>
  )
}
