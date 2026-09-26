'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthResponse } from '../../shared/api'
import { useAuth } from './context/AuthContext'
import { BrainOutline, Logo } from './components/Logo'
import { Button, Field, Icon, cx, inputClass } from './components/ui'
import { api } from './lib/api'
import { markTourPending } from './lib/tour'

const POINTS = [
  { title: 'Presence', body: 'Your camera notices when you step away. Nothing leaves your device.' },
  { title: 'Tabs', body: 'A small extension flags tabs that drift from the task you set.' },
  { title: 'Patterns', body: 'A coach reads your history and tells you when you work best.' },
]

export default function Home() {
  const { user, login, isLoading, sessionExpired, status, recheck } = useAuth()
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

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface px-14 py-12 lg:flex">
        {/* Ambient: a soft sage glow and an oversized, barely-there echo of the logo's brain */}
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-accent/[0.07] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-32 h-[36rem] w-[36rem] rounded-full bg-accent/[0.04] blur-3xl" />
        <BrainOutline className="login-brain pointer-events-none absolute -bottom-40 -right-44 w-[44rem] rotate-[-8deg] text-accent/[0.13]" strokeWidth={1.75} />

        <Logo size="lg" animate className="relative" />
        <div className="relative max-w-md">
          <h1 className="font-serif text-6xl leading-[1.02] tracking-[-0.015em] text-fg">
            Attention is a <span className="italic text-accent">practice</span>.
          </h1>
          <ul className="mt-14 space-y-6">
            {POINTS.map((p, i) => (
              <li key={p.title} className="flex gap-5">
                <span className="tabular mt-0.5 text-sm text-fg-3">0{i + 1}</span>
                <div>
                  <p className="text-[15px] text-fg">{p.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-fg-3">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-fg-3">Build discipline one session at a time.</p>
      </section>

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

            {!error && sessionExpired && (
              <p role="status" className="rounded-xl border border-line-strong bg-surface-2 px-4 py-3 text-sm text-fg-2">Your session ended. Please sign in again.</p>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>
            )}

            <Button type="submit" size="lg" disabled={loading} className="mt-2 w-full">
              {loading ? (isSignup ? 'Creating account…' : 'Signing in…') : (isSignup ? 'Create account' : 'Sign in')}
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}
