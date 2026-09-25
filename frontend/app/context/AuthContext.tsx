'use client'

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import type { AuthResponse, PublicUser } from '../../../shared/api'
import { ApiError, UNAUTHORIZED_EVENT, api } from '../lib/api'
import { toast } from '../lib/toast'

// The signed-in user. The credential itself is an httpOnly cookie set by the API; the app never sees it.
// On load we ask the API who we are (GET /auth/me) instead of trusting anything in localStorage.
//
// "Can't reach the server" is deliberately distinct from "signed out": treating an outage as a
// sign-out would bounce people to the login page for no reason and lose their place.

export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'unreachable'

interface AuthContextType {
  user: PublicUser | null
  status: AuthStatus
  isLoading: boolean
  /** Set when the saved sign-in ended unexpectedly (expired or revoked), to explain the login screen. */
  sessionExpired: boolean
  login: (user: PublicUser) => void
  logout: () => Promise<void>
  /** Ask the server again (after it was unreachable). */
  recheck: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Tokens used to live in localStorage; remove any left over from older versions.
const LEGACY_KEYS = ['token', 'user']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    const hadLegacyLogin = LEGACY_KEYS.some(k => localStorage.getItem(k) !== null)
    LEGACY_KEYS.forEach(k => localStorage.removeItem(k))

    api<AuthResponse>('/auth/me')
      .then(({ user }) => {
        if (cancelled) return
        setUser(user)
        setStatus('signedIn')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.unreachable) {
          setStatus('unreachable')
          return
        }
        setUser(null)
        setStatus('signedOut')
        // Signed out is normal; only flag it if they previously had a login that no longer works.
        if (err instanceof ApiError && err.status === 401 && hadLegacyLogin) setSessionExpired(true)
      })
    return () => { cancelled = true }
  }, [attempt])

  useEffect(() => {
    function onUnauthorized() {
      setUser(null)
      setStatus('signedOut')
      setSessionExpired(true)
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const login = useCallback((next: PublicUser) => {
    setUser(next)
    setStatus('signedIn')
    setSessionExpired(false)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
      setUser(null)
      setStatus('signedOut')
    } catch {
      // If the server can't clear the cookie, don't pretend we're signed out: a reload would sign back in.
      toast({ tone: 'error', message: 'Couldn’t sign out because the server is unreachable. Please try again.', key: 'logout' })
      throw new Error('logout failed')
    }
  }, [])

  const recheck = useCallback(() => {
    setStatus('loading')
    setAttempt(a => a + 1)
  }, [])

  return (
    <AuthContext.Provider value={{ user, status, isLoading: status === 'loading', sessionExpired, login, logout, recheck }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
