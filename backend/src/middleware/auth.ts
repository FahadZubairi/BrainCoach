import { CookieOptions, NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { config } from '../config'

// Two credentials:
//  • Web app: an httpOnly `bc_session` cookie holding a full-access JWT. JavaScript can't read it, so an XSS
//    bug can't steal it. Cookie-authenticated writes must come from an allowed Origin (CSRF protection).
//  • Browser extension: a short-lived Bearer JWT with scope "extension", only valid on EXTENSION_ROUTES.
//    The app fetches it over the cookie session and hands it to the extension.

export interface AuthUser {
  userId: number
  email: string
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

export const SESSION_COOKIE = 'bc_session'
// Idle timeout: the cookie lives 30 minutes and every authenticated request renews it, so it only runs
// out after 30 minutes without using the app (a running focus session pings to stay alive). Even with
// constant use, a sign-in lasts at most 7 days.
const SESSION_IDLE_SECONDS = 30 * 60
const SESSION_MAX_SECONDS = 7 * 24 * 60 * 60
const RENEW_AFTER_SECONDS = 60 // don't mint a new cookie on every single request
export const EXTENSION_TTL_SECONDS = 24 * 60 * 60

const Payload = z.object({
  userId: z.number().int().positive(),
  email: z.string(),
  scope: z.enum(['session', 'extension']).default('session'),
  iat: z.number(),
  /** When the user actually signed in (seconds). Missing on tokens from before the idle timeout existed. */
  authAt: z.number().optional(),
})

// What an extension-scoped token may call (method + path under the API root).
const EXTENSION_ROUTES: [string, RegExp][] = [
  ['GET', /^\/coach\/tab-rules$/],
  ['POST', /^\/coach\/evaluate-tab$/],
  ['POST', /^\/sessions\/\d+\/event$/],
]

const nowSeconds = () => Math.floor(Date.now() / 1000)

const sign = (user: AuthUser, scope: 'session' | 'extension', ttl: number, authAt?: number) =>
  jwt.sign({ userId: user.userId, email: user.email, scope, ...(authAt ? { authAt } : {}) }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: ttl })

export const signExtensionToken = (user: AuthUser) => sign(user, 'extension', EXTENSION_TTL_SECONDS)

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax',
  path: '/',
}

/** `authAt` carries the original sign-in time through renewals; omit it for a fresh sign-in. */
export function setSessionCookie(res: Response, user: AuthUser, authAt = nowSeconds()) {
  const ttl = Math.min(SESSION_IDLE_SECONDS, authAt + SESSION_MAX_SECONDS - nowSeconds())
  if (ttl <= 0) return
  res.cookie(SESSION_COOKIE, sign(user, 'session', ttl, authAt), { ...cookieOptions, maxAge: ttl * 1000 })
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions)
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
  }
  return null
}

function verify(token: string) {
  // Pin the algorithm so a token can't choose its own (e.g. "none").
  const decoded = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] })
  return Payload.parse(decoded)
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const cookie = readCookie(req, SESSION_COOKIE)

  let payload: z.infer<typeof Payload>
  try {
    if (bearer) payload = verify(bearer)
    else if (cookie) payload = verify(cookie)
    else {
      res.status(401).json({ error: 'Not signed in' })
      return
    }
  } catch {
    if (!bearer) clearSessionCookie(res)
    res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    return
  }

  if (bearer) {
    // Bearer tokens are only issued to the extension, and only work on its few endpoints.
    const path = req.baseUrl + req.path
    const allowed = payload.scope === 'extension' && EXTENSION_ROUTES.some(([m, re]) => m === req.method && re.test(path))
    if (!allowed) {
      res.status(403).json({ error: 'This token cannot access that endpoint' })
      return
    }
  } else if (UNSAFE_METHODS.has(req.method)) {
    // CSRF: a cookie is sent automatically, so writes must come from our own web app.
    const origin = req.headers.origin
    if (!origin || !config.corsOrigins.includes(origin)) {
      res.status(403).json({ error: 'Request origin not allowed' })
      return
    }
  }

  if (!bearer) {
    // Tokens from before the idle timeout lasted 7 days regardless of use: make those sign in again.
    if (payload.scope !== 'session' || payload.authAt === undefined) {
      clearSessionCookie(res)
      res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
      return
    }
    // Sliding expiry: using the app pushes the 30-minute idle deadline forward.
    if (nowSeconds() - payload.iat >= RENEW_AFTER_SECONDS) setSessionCookie(res, { userId: payload.userId, email: payload.email }, payload.authAt)
  }

  req.user = { userId: payload.userId, email: payload.email }
  next()
}
