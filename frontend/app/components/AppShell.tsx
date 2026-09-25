'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { ACTIVE_SESSION_EVENT, ACTIVE_SESSION_KEY } from '../lib/activeSession'
import { Logo } from './Logo'
import { FullPageLoading, OfflineBanner, Unreachable } from './StatusScreens'
import NavLink, { usePageTransitionCommit } from './NavLink'
import { Icon, StatusDot, cx } from './ui'

const LINKS = [
  { href: '/dashboard', label: 'Today' },
  { href: '/session', label: 'Focus' },
  { href: '/habits', label: 'Habits' },
  { href: '/history', label: 'History' },
  { href: '/insights', label: 'Insights' },
]

// The first page of a visit fades in; after that, navigations are animated by view transitions.
let introPending = true

export default function AppShell({ children, width = 'default' }: { children: ReactNode; width?: 'narrow' | 'default' }) {
  const { user, logout, status, recheck } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sessionRunning, setSessionRunning] = useState(false)
  const intro = introPending
  usePageTransitionCommit()

  useEffect(() => {
    if (user) introPending = false
  }, [user])

  useEffect(() => {
    if (status === 'signedOut') router.replace('/')
  }, [status, router])

  useEffect(() => {
    const read = () => {
      try {
        setSessionRunning(!!localStorage.getItem(ACTIVE_SESSION_KEY))
      } catch {
        setSessionRunning(false)
      }
    }
    read()
    window.addEventListener(ACTIVE_SESSION_EVENT, read)
    window.addEventListener('storage', read) // other tabs
    return () => {
      window.removeEventListener(ACTIVE_SESSION_EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [])

  if (status === 'unreachable') return <Unreachable onRetry={recheck} />
  if (status !== 'signedIn' || !user) return <FullPageLoading />

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface-2 focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md" style={{ viewTransitionName: 'site-header' }}>
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-5 sm:px-8">
          <NavLink href="/dashboard" aria-label="BrainCoach home" className="shrink-0">
            <Logo />
          </NavLink>

          <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
            {LINKS.map(link => {
              const active = pathname === link.href
              return (
                <NavLink
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'relative flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors duration-150',
                    active ? 'text-fg' : 'text-fg-3 hover:bg-surface/60 hover:text-fg',
                  )}
                >
                  {active && (
                    <span aria-hidden="true" className="absolute inset-0 -z-10 rounded-lg bg-surface-2" style={{ viewTransitionName: 'nav-pill' }} />
                  )}
                  {link.href === '/session' && sessionRunning && <StatusDot tone="accent" pulse />}
                  {link.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span
              className="hidden h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-medium uppercase text-fg-2 sm:flex"
              title={user.email}
              aria-hidden="true"
            >
              {user.email[0]}
            </span>
            <button
              type="button"
              onClick={() => { logout().then(() => router.replace('/'), () => { /* toast already shown; stay signed in */ }) }}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label={`Sign out ${user.email}`}
              title="Sign out"
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>
      <OfflineBanner />

      {/* Phones: primary navigation in the thumb zone, all five destinations always visible */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden" style={{ viewTransitionName: 'site-tabbar' }}>
        <div className="grid grid-cols-5">
          {LINKS.map(link => {
            const active = pathname === link.href
            return (
              <NavLink
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cx('relative flex h-14 items-center justify-center text-[13px] transition-colors', active ? 'text-fg' : 'text-fg-3')}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" aria-hidden="true" style={{ viewTransitionName: 'nav-pill-mobile' }} />}
                <span className="flex items-center gap-1.5">
                  {link.href === '/session' && sessionRunning && <StatusDot tone="accent" pulse />}
                  {link.label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      <main
        id="main"
        style={{ viewTransitionName: 'page' }}
        className={cx('mx-auto px-5 pb-28 pt-10 sm:px-8 sm:pb-24 sm:pt-16', width === 'narrow' ? 'max-w-2xl' : 'max-w-5xl', intro && 'animate-in')}
      >
        {children}
      </main>
    </div>
  )
}
