import type { SessionRecord, StatsResponse } from '../../../shared/api'

export type { SessionRecord } from '../../../shared/api'
export type Stats = StatsResponse

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'

/** API_BASE as a full URL. The extension runs outside this page, so a relative '/api' means nothing to it. */
export function absoluteApiBase() {
  return new URL(API_BASE, window.location.origin).href.replace(/\/+$/, '')
}

// Fired when the server says we're no longer signed in; AuthContext listens and signs out.
export const UNAUTHORIZED_EVENT = 'braincoach:unauthorized'

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
  /** The server couldn't be reached at all (offline, down, timed out), as opposed to answering with an error. */
  get unreachable() {
    return this.status === 0
  }
}

const TIMEOUT_MS = 20_000
// Safe (read-only) requests are retried on network failures and gateway errors, with backoff.
const RETRY_DELAYS_MS = [400, 1500]
const RETRYABLE_STATUS = new Set([502, 503, 504])

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchOnce(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: init.signal ?? controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The only way the app talks to the API. Auth is an httpOnly cookie the browser attaches itself
 * (`credentials: 'include'`), so no token ever touches JavaScript.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const retries = method === 'GET' ? RETRY_DELAYS_MS : []
  const request: RequestInit = { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init.headers } }

  let res: Response | null = null
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetchOnce(`${API_BASE}${path}`, request)
      if (!RETRYABLE_STATUS.has(res.status) || attempt >= retries.length) break
    } catch (err) {
      if (attempt >= retries.length) {
        const timedOut = err instanceof DOMException && err.name === 'AbortError'
        throw new ApiError(
          timedOut ? 'The server took too long to respond. Please try again.' : 'Can’t reach BrainCoach. Check your connection and try again.',
          0,
        )
      }
    }
    await sleep(retries[attempt])
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data: unknown = isJson ? await res.json().catch(() => null) : null
  const message = typeof data === 'object' && data && 'error' in data && typeof data.error === 'string' ? data.error : null

  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(message ?? 'Your session has expired. Please sign in again.', 401)
  }
  if (RETRYABLE_STATUS.has(res.status)) throw new ApiError(message ?? 'BrainCoach is temporarily unavailable. Please try again in a moment.', res.status)
  if (!res.ok) throw new ApiError(message ?? `Request failed (${res.status})`, res.status)
  return data as T
}

/** A readable message for any thrown value. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.') {
  return err instanceof Error && err.message ? err.message : fallback
}

export function sessionMinutes(s: Pick<SessionRecord, 'startedAt' | 'endedAt'>) {
  if (!s.endedAt) return 0
  return Math.max(0, Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000))
}

export function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
