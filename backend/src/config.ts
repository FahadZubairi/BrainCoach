import 'dotenv/config'
import { z } from 'zod'

// All environment access goes through here, validated once at startup, so a missing secret fails
// loudly on boot instead of as a confusing runtime error on the first request.
const Env = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters (32+ recommended)'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
  // Quick on-task verdicts (tab and screen checks) run every few seconds: a faster, cheaper model.
  GEMINI_FAST_MODEL: z.string().default('gemini-2.5-flash-lite'),
  // Comma-separated browser origins allowed to call the API.
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
  // Send the session cookie only over HTTPS. Must be true in production.
  // Proxy hops in front of the API (e.g. 2 for Vercel rewrite + Render). Without it every request
  // appears to come from the proxy, so rate limits would be shared by all users.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // Social sign-in. Each provider is enabled only when both of its values are set.
  // APP_URL: where users land afterwards (default: the first CORS origin).
  // OAUTH_REDIRECT_BASE: the API as the browser reaches it (default: APP_URL + '/api', the Vercel proxy).
  APP_URL: z.string().url().optional(),
  OAUTH_REDIRECT_BASE: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).default(process.env.NODE_ENV === 'production' ? 'true' : 'false'),
})

const parsed = Env.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

if (parsed.data.JWT_SECRET.length < 32) {
  console.warn('Warning: JWT_SECRET is shorter than 32 characters. Generate a longer one, e.g.:')
  console.warn("  node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\"")
}

const corsOrigins = parsed.data.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
const appUrl = (parsed.data.APP_URL ?? corsOrigins[0] ?? 'http://localhost:3000').replace(/\/+$/, '')

export const config = {
  ...parsed.data,
  corsOrigins,
  appUrl,
  oauthRedirectBase: (parsed.data.OAUTH_REDIRECT_BASE ?? `${appUrl}/api`).replace(/\/+$/, ''),
  cookieSecure: parsed.data.COOKIE_SECURE === 'true',
}
