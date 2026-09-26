'use client'

import NavLink from '../components/NavLink'
import { Logo } from '../components/Logo'
import { DISCLOSURES } from '../components/PrivacyConsent'
import { Card, Eyebrow, Icon } from '../components/ui'
import type { Tracker } from '../lib/prefs'

// Public (no sign-in needed) so people can read it before creating an account.

const TRACKERS: Tracker[] = ['camera', 'extension', 'screen']

const PROMISES = [
  'Every tracker is optional and off until you turn it on.',
  'No photos, videos or screenshots are ever saved.',
  'We never read page content, passwords, cookies or your browsing history.',
  'Nothing is tracked outside a focus session.',
  'Your data is never sold or used for ads.',
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg px-5 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <NavLink href="/" className="inline-flex"><Logo /></NavLink>

        <header className="mt-12">
          <Eyebrow>Privacy</Eyebrow>
          <h1 className="mt-2 font-serif text-[40px] leading-[1.05] text-fg sm:text-[52px]">Your focus, not your data.</h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-fg-2">
            BrainCoach only needs to know one thing: whether you&apos;re on the task you chose. Here is exactly what each feature looks at, where it goes, and how to switch it off.
          </p>
        </header>

        <Card className="mt-10 p-6 sm:p-8">
          <ul className="space-y-3">
            {PROMISES.map(p => (
              <li key={p} className="flex gap-3 text-[15px] text-fg-2">
                <span className="mt-0.5 text-accent" aria-hidden="true"><Icon name="check" /></span>
                {p}
              </li>
            ))}
          </ul>
        </Card>

        {TRACKERS.map(t => {
          const d = DISCLOSURES[t]
          return (
            <section key={t} className="mt-10" aria-labelledby={`privacy-${t}`}>
              <h2 id={`privacy-${t}`} className="flex items-center gap-3 font-serif text-[28px] text-fg">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-lg text-accent" aria-hidden="true"><Icon name={d.icon} /></span>
                {d.title}
              </h2>
              <dl className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
                {d.rows.map(r => (
                  <div key={r.label} className="grid gap-1 px-5 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
                    <dt className="text-sm text-fg-3">{r.label}</dt>
                    <dd className="text-sm leading-relaxed text-fg-2">{r.text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        })}

        <section className="mt-10 space-y-4 text-sm leading-relaxed text-fg-2" aria-labelledby="privacy-account">
          <h2 id="privacy-account" className="font-serif text-[28px] text-fg">Your account</h2>
          <p>
            We store your email, a scrambled (hashed) version of your password, and your sessions: the task you typed, how long it ran,
            your focus score, and the moments you stepped away or drifted. That&apos;s what powers History and Insights.
            Habits, goals and settings stay in this browser only.
          </p>
          <p>
            Sign-in uses a secure cookie that scripts on the page can&apos;t read. The extension gets its own key that only lets it report
            tab verdicts for your current session, and it expires within a day.
          </p>
          <p>
            AI features (tab and screen verdicts, the coach) are processed by Google Gemini. We send the minimum needed for each answer, and the
            extension removes email addresses, long numbers and everything after “?” in web addresses before sending. Depending on the plan BrainCoach uses, Google may retain what it receives under its own terms.
          </p>
        </section>

        <p className="mt-12 border-t border-line pt-6 text-[13px] text-fg-3">
          <NavLink href="/dashboard" className="text-accent underline-offset-4 hover:underline">Back to BrainCoach</NavLink>
        </p>
      </div>
    </main>
  )
}
