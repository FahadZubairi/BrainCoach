import { z } from 'zod'
import { config } from '../config'

// Social sign-in (OAuth 2.0 authorisation-code flow) for Google, Facebook and GitHub. All we ever ask a
// provider for is a verified email address: no contacts, no posting, no profile data beyond that.

export type Provider = 'google' | 'facebook' | 'github'

interface ProviderDef {
  clientId: string | undefined
  clientSecret: string | undefined
  authorizeUrl: string
  scope: string
  /** Exchanges the code for an access token, then returns the account's verified email (or null). */
  verifiedEmail: (code: string, redirectUri: string) => Promise<string | null>
}

const TokenResponse = z.object({ access_token: z.string() })

async function postForm(url: string, form: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(form),
  })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return TokenResponse.parse(await res.json()).access_token
}

async function getJson(url: string, token: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'BrainCoach' } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json()
}

const credentials = (p: ProviderDef, code: string, redirectUri: string) => ({
  client_id: p.clientId ?? '',
  client_secret: p.clientSecret ?? '',
  code,
  redirect_uri: redirectUri,
})

const PROVIDERS: Record<Provider, ProviderDef> = {
  google: {
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'openid email',
    async verifiedEmail(code, redirectUri) {
      const token = await postForm('https://oauth2.googleapis.com/token', { ...credentials(PROVIDERS.google, code, redirectUri), grant_type: 'authorization_code' })
      const info = z.object({ email: z.string().email(), email_verified: z.boolean() })
        .parse(await getJson('https://openidconnect.googleapis.com/v1/userinfo', token))
      return info.email_verified ? info.email : null
    },
  },
  facebook: {
    clientId: config.FACEBOOK_APP_ID,
    clientSecret: config.FACEBOOK_APP_SECRET,
    authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scope: 'email',
    async verifiedEmail(code, redirectUri) {
      const token = await postForm('https://graph.facebook.com/v19.0/oauth/access_token', credentials(PROVIDERS.facebook, code, redirectUri))
      // Facebook only returns an email the person has confirmed; it's missing if they declined to share it.
      const me = z.object({ email: z.string().email().optional() }).parse(await getJson('https://graph.facebook.com/me?fields=email', token))
      return me.email ?? null
    },
  },
  github: {
    clientId: config.GITHUB_CLIENT_ID,
    clientSecret: config.GITHUB_CLIENT_SECRET,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    scope: 'user:email',
    async verifiedEmail(code, redirectUri) {
      const token = await postForm('https://github.com/login/oauth/access_token', credentials(PROVIDERS.github, code, redirectUri))
      const emails = z.array(z.object({ email: z.string().email(), primary: z.boolean(), verified: z.boolean() }))
        .parse(await getJson('https://api.github.com/user/emails', token))
      return emails.find(e => e.primary && e.verified)?.email ?? null
    },
  },
}

export const providerEnabled = (p: Provider) => !!(PROVIDERS[p].clientId && PROVIDERS[p].clientSecret)

export const enabledProviders = (): Record<Provider, boolean> => ({
  google: providerEnabled('google'),
  facebook: providerEnabled('facebook'),
  github: providerEnabled('github'),
})

/** The callback URL registered with each provider, e.g. https://app.example/api/auth/oauth/google/callback */
export const redirectUri = (p: Provider) => `${config.oauthRedirectBase}/auth/oauth/${p}/callback`

export function authorizeUrl(p: Provider, state: string) {
  const def = PROVIDERS[p]
  const params = new URLSearchParams({
    client_id: def.clientId ?? '',
    redirect_uri: redirectUri(p),
    response_type: 'code',
    scope: def.scope,
    state,
  })
  if (p === 'google') params.set('prompt', 'select_account')
  return `${def.authorizeUrl}?${params}`
}

export async function verifiedEmail(p: Provider, code: string): Promise<string | null> {
  return PROVIDERS[p].verifiedEmail(code, redirectUri(p))
}
