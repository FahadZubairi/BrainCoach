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
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60
export const EXTENSION_TTL_SECONDS = 24 * 60 * 60

const Payload = z.object({
  userId: z.number().int().positive(),
  email: z.string(),
  scope: z.enum(['session', 'extension']).default('session'),
})

// What an extension-scoped token may call (method + path under the API root).
const EXTENSION_ROUTES: [string, RegExp][] = [
  ['GET', /^\/coach\/tab-rules$/],
  ['POST', /^\/coach\/evaluate-tab$/],
  ['POST', /^\/sessions\/\d+\/event$/],
]

const sign = (user: AuthUser, scope: 'session' | 'extension', ttl: number) =>
  jwt.sign({ userId: user.userId, email: user.email, scope }, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: ttl })

export const signExtensionToken = (user: AuthUser) => sign(user, 'extension', EXTENSION_TTL_SECONDS)

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax',
  path: '/',
}

export function setSessionCookie(res: Response, user: AuthUser) {
  res.cookie(SESSION_COOKIE, sign(user, 'session', SESSION_TTL_SECONDS), { ...cookieOptions, maxAge: SESSION_TTL_SECONDS * 1000 })
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

  req.user = { userId: payload.userId, email: payload.email }
  next()
}
