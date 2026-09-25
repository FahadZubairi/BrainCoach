'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import AppShell from '../components/AppShell'
import { Button, Card, Eyebrow, Icon, PageHeader, StatusDot, buttonClass, cx } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useExtension } from '../lib/extension'
import { usePrefs } from '../lib/prefs'
import { toast } from '../lib/toast'

// Once the extension is on the Chrome Web Store, set NEXT_PUBLIC_EXTENSION_URL to its listing and this
// page becomes a one-click "Add to Chrome". Until then it offers the packaged zip + unpacked install.
const STORE_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || ''
const ZIP_URL = '/braincoach-extension.zip'

export default function ExtensionSetupPage() {
  return (
    <AppShell width="narrow">
      <Suspense>
        <ExtensionSetup />
      </Suspense>
    </AppShell>
  )
}

function isChromium() {
  if (typeof navigator === 'undefined') return true
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands
  if (brands) return brands.some(b => /Chromium|Google Chrome|Microsoft Edge|Brave|Opera/i.test(b.brand))
  return /Chrome\//.test(navigator.userAgent) && !/Firefox\//.test(navigator.userAgent)
}

function ExtensionSetup() {
  const router = useRouter()
  const params = useSearchParams()
  const fromSession = params.get('from') === 'session'
  const { user } = useAuth()
  const { update: updatePrefs } = usePrefs(user?.id)
  const ext = useExtension()
  const { connected, send } = ext
  const [chromium, setChromium] = useState(true)
  const [copied, setCopied] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser detection needs the client
    setChromium(isChromium())
  }, [])

  // Keep asking: the extension may be installed while this page is open.
  useEffect(() => {
    if (connected) return
    const id = setInterval(() => send({ type: 'PING' }), 1500)
    return () => clearInterval(id)
  }, [connected, send])

  // Connected: head back to the session automatically.
  useEffect(() => {
    if (!ext.connected) return
    updatePrefs({ tracking: 'extension' })
    if (!fromSession) return
    const id = setTimeout(() => router.push('/session'), 2200)
    return () => clearTimeout(id)
  }, [ext.connected, fromSession, router, updatePrefs])

  function copyExtensionsUrl() {
    navigator.clipboard?.writeText('chrome://extensions').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => toast({ tone: 'warn', message: 'Couldn’t copy automatically. Type chrome://extensions into the address bar.' }))
  }

  function useScreenCheckInstead() {
    updatePrefs({ tracking: 'screen' })
    router.push('/session')
  }

  if (ext.connected) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <span className="pop flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl text-accent-ink">
          <Icon name="check" />
        </span>
        <h1 className="mt-6 font-serif text-4xl text-fg">Extension connected.</h1>
        <p className="mt-3 max-w-sm text-fg-2">
          Tab tracking is on. During a session, the BrainCoach icon in your toolbar shows <span className="text-accent">ON</span> or{' '}
          <span className="text-danger">OFF</span>.
        </p>
        {fromSession ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-fg-3"><StatusDot tone="accent" pulse /> Taking you back to your session…</p>
        ) : (
          <Button size="lg" className="mt-8" onClick={() => router.push('/session')}>Start a session <Icon name="arrow" /></Button>
        )}
      </div>
    )
  }

  if (!chromium) {
    return (
      <div>
        <PageHeader eyebrow="Tab tracking" title="This browser can't run the extension." />
        <Card className="p-6 sm:p-8">
          <p className="text-fg-2">The BrainCoach extension works in Chrome, Edge, Brave and Arc. You can switch browsers, or use <span className="text-fg">Screen check</span>, which needs no install.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={useScreenCheckInstead}>Use screen check instead</Button>
            <Button variant="ghost" onClick={() => router.back()}>Back</Button>
          </div>
        </Card>
      </div>
    )
  }

  const steps = STORE_URL
    ? [
        {
          title: 'Add BrainCoach to Chrome',
          body: <>Opens the Chrome Web Store in a new tab. Click <b className="font-medium text-fg">Add to Chrome</b>, then <b className="font-medium text-fg">Add extension</b>.</>,
          action: <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'md')}>Open Chrome Web Store <Icon name="arrow" /></a>,
        },
        {
          title: 'Come back to this tab',
          body: 'This page detects the extension on its own. No need to reload.',
        },
      ]
    : [
        {
          title: 'Download the extension',
          body: 'A small zip file (about 40 KB). Unzip it; you’ll get a folder called braincoach-extension.',
          action: (
            <a href={ZIP_URL} download onClick={() => setDownloaded(true)} className={buttonClass(downloaded ? 'secondary' : 'primary', 'md')}>
              {downloaded ? <><Icon name="check" /> Downloaded</> : 'Download extension'}
            </a>
          ),
        },
        {
          title: 'Open your extensions page',
          body: <>Paste <code className="rounded bg-surface-2 px-1.5 py-0.5 text-fg-2">chrome://extensions</code> into the address bar. Browsers don&apos;t let websites link there directly.</>,
          action: (
            <Button variant="secondary" onClick={copyExtensionsUrl}>
              {copied ? <><Icon name="check" /> Copied</> : 'Copy address'}
            </Button>
          ),
        },
        {
          title: 'Turn on Developer mode',
          body: 'The switch in the top-right corner of the extensions page.',
        },
        {
          title: 'Load unpacked',
          body: <>Click <b className="font-medium text-fg">Load unpacked</b> and choose the <b className="font-medium text-fg">braincoach-extension</b> folder you unzipped.</>,
        },
        {
          title: 'Come back to this tab',
          body: 'This page connects to the extension automatically. No reload needed.',
        },
      ]

  return (
    <div>
      <PageHeader eyebrow="Tab tracking" title="Set up the extension." />

      <div
        className="mb-6 flex items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4"
        role="status"
        aria-live="polite"
      >
        <StatusDot tone="warn" pulse />
        <span className="text-sm text-fg-2">Waiting for the extension…</span>
        <span className="ml-auto text-xs text-fg-3">Checks every few seconds</span>
      </div>

      <Card>
        <ol className="divide-y divide-line">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-5 px-6 py-5 sm:px-7">
              <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-xs text-fg-2">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-fg">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-3">{step.body}</p>
                {step.action && <div className="mt-3">{step.action}</div>}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className={cx('mt-8 flex flex-col items-start gap-1 text-sm text-fg-3 sm:flex-row sm:items-center sm:gap-3')}>
        <span>Would rather not install anything?</span>
        <button type="button" onClick={useScreenCheckInstead} className="cursor-pointer text-accent underline-offset-4 hover:underline">
          Use screen check instead
        </button>
      </div>

      <div className="mt-8">
        <Eyebrow>What the extension can see</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed text-fg-3">
          Only the address and title of the tab you&apos;re on, and only during a session. No cookies, page content, passwords or browsing history.
        </p>
      </div>
    </div>
  )
}
