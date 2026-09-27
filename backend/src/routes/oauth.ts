import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { randomBytes, timingSafeEqual } from 'crypto'
import { sql } from 'drizzle-orm'
import type { OAuthProvidersResponse } from '../../../shared/api'
import { config } from '../config'
import { db } from '../db'
import { users } from '../db/schema'
import { cookieOptions, readCookie, setSessionCookie } from '../middleware/auth'
import { rateLimit } from '../middleware/rateLimit'
import { OAuthCallbackQuery, OAuthProviderParam } from '../schemas'
import { Provider, authorizeUrl, enabledProviders, providerEnabled, verifiedEmail } from '../services/oauth'

// Sign in with Google, Facebook or GitHub. The browser is sent to the provider and comes back to
// /callback with a one-time code; we swap it for a verified email, then find or create that account and
// set the normal session cookie. Failures go back to the sign-in page with a short reason code.

const router = Router()
const STATE_COOKIE = 'bc_oauth'
const STATE_TTL_MS = 10 * 60_000
const oauthLimit = rateLimit({ windowMs: 15 * 60_000, max: 30, message: 'Too many sign-in attempts. Please wait a few minutes.' })

type Failure = 'cancelled' | 'failed' | 'no_email' | 'unavailable'
const backToSignIn = (res: Response, reason: Failure) => res.redirect(`${config.appUrl}/?oauth_error=${reason}`)

function sameString(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

router.get('/providers', (_req: Request, res: Response<OAuthProvidersResponse>) => {
  res.json({ providers: enabledProviders() })
})

router.get('/:provider', oauthLimit, (req: Request, res: Response) => {
  const params = OAuthProviderParam.safeParse(req.params)
  if (!params.success || !providerEnabled(params.data.provider)) return backToSignIn(res, 'unavailable')
  const provider = params.data.provider

  // CSRF protection for the round trip: the provider hands `state` back and it must match this cookie.
  const state = randomBytes(24).toString('base64url')
  res.cookie(STATE_COOKIE, `${provider}.${state}`, { ...cookieOptions, maxAge: STATE_TTL_MS })
  res.redirect(authorizeUrl(provider, state))
})

router.get('/:provider/callback', oauthLimit, async (req: Request, res: Response) => {
  const params = OAuthProviderParam.safeParse(req.params)
  const query = OAuthCallbackQuery.safeParse(req.query)
  const saved = readCookie(req, STATE_COOKIE)
  res.clearCookie(STATE_COOKIE, cookieOptions)
  if (!params.success || !query.success) return backToSignIn(res, 'failed')

  const provider: Provider = params.data.provider
  const { code, state, error } = query.data
  if (error) return backToSignIn(res, 'cancelled') // they pressed Cancel on the provider's screen
  if (!code || !state || !saved || !sameString(saved, `${provider}.${state}`)) return backToSignIn(res, 'failed')

  let email: string | null
  try {
    email = await verifiedEmail(provider, code)
  } catch (err) {
    console.error(`OAuth ${provider} exchange failed:`, err)
    return backToSignIn(res, 'failed')
  }
  if (!email) return backToSignIn(res, 'no_email')
  email = email.toLowerCase()

  // The provider has verified this address, so it's safe to sign into an existing account that uses it.
  let [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1)
  let created = false
  if (!user) {
    // No password for social accounts: store a hash of random bytes nobody knows, so password sign-in
    // simply never matches (and the column stays NOT NULL).
    const unusable = await bcrypt.hash(randomBytes(32).toString('hex'), 10)
    ;[user] = await db.insert(users).values({ email, hashedPassword: unusable }).returning()
    created = true
  }

  setSessionCookie(res, { userId: user.id, email: user.email })
  res.redirect(`${config.appUrl}/dashboard${created ? '?welcome=1' : ''}`)
})

export default router
