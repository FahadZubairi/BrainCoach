import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { eq, sql } from 'drizzle-orm'
import type { AuthResponse, ErrorResponse, ExtensionTokenResponse } from '../../../shared/api'
import { config } from '../config'
import { db } from '../db'
import { users } from '../db/schema'
import { parse } from '../http'
import {
  AuthRequest, EXTENSION_TTL_SECONDS, clearSessionCookie, requireAuth, setSessionCookie, signExtensionToken,
} from '../middleware/auth'
import { rateLimit } from '../middleware/rateLimit'
import { Credentials, Signup } from '../schemas'

const router = Router()

// Slow down password guessing and bulk signups: 10 attempts per IP per 15 minutes.
const credentialLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, message: 'Too many attempts. Please wait a few minutes and try again.' })

const BCRYPT_ROUNDS = 10
// Compared against when the email doesn't exist, so login takes the same time either way
// and response timing can't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('braincoach-timing-equaliser', BCRYPT_ROUNDS)

// Older signups stored emails as typed, so match case-insensitively.
function findUserByEmail(email: string) {
  return db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
}

// Login/signup set the cookie themselves, so they need the same CSRF origin check as other writes.
function fromAllowedOrigin(req: Request, res: Response) {
  const origin = req.headers.origin
  if (origin && !config.corsOrigins.includes(origin)) {
    res.status(403).json({ error: 'Request origin not allowed' })
    return false
  }
  return true
}

router.post('/signup', credentialLimit, async (req: Request, res: Response<AuthResponse | ErrorResponse>) => {
  if (!fromAllowedOrigin(req, res)) return
  const body = parse(Signup, req.body, res)
  if (!body) return

  const [existing] = await findUserByEmail(body.email)
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists. Try signing in.' })
    return
  }

  const hashedPassword = await bcrypt.hash(body.password, BCRYPT_ROUNDS)
  const [created] = await db.insert(users).values({ email: body.email, hashedPassword }).returning()

  setSessionCookie(res, { userId: created.id, email: created.email })
  res.status(201).json({ user: { id: created.id, email: created.email } })
})

router.post('/login', credentialLimit, async (req: Request, res: Response<AuthResponse | ErrorResponse>) => {
  if (!fromAllowedOrigin(req, res)) return
  const body = parse(Credentials, req.body, res)
  if (!body) return

  const [user] = await findUserByEmail(body.email)
  const passwordMatch = await bcrypt.compare(body.password, user?.hashedPassword ?? DUMMY_HASH)
  if (!user || !passwordMatch) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  setSessionCookie(res, { userId: user.id, email: user.email })
  res.json({ user: { id: user.id, email: user.email } })
})

router.post('/logout', (req: Request, res: Response) => {
  if (!fromAllowedOrigin(req, res)) return
  clearSessionCookie(res)
  res.status(204).end()
})

// Who am I? Used by the app on load to restore the signed-in user from the cookie.
router.get('/me', requireAuth, async (req: AuthRequest, res: Response<AuthResponse | ErrorResponse>) => {
  const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, req.user!.userId))
  if (!user) {
    clearSessionCookie(res)
    res.status(401).json({ error: 'Account not found' })
    return
  }
  res.json({ user })
})

// A short-lived, narrowly scoped token for the browser extension (it can't use the app's cookie).
router.get('/extension-token', requireAuth, (req: AuthRequest, res: Response<ExtensionTokenResponse>) => {
  res.json({ token: signExtensionToken(req.user!), expiresInSeconds: EXTENSION_TTL_SECONDS })
})

export default router
