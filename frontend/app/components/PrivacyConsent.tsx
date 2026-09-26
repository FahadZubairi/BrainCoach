'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import NavLink from './NavLink'
import { Button, Icon, IconName } from './ui'
import type { Tracker } from '../lib/prefs'

// Shown the first time someone turns on a tracker: exactly what it uses, where that goes, what's kept,
// and how to stop, in plain words. Nothing turns on until they agree.

interface Disclosure {
  icon: IconName
  title: string
  rows: { label: string; text: string }[]
}

export const DISCLOSURES: Record<Tracker, Disclosure> = {
  camera: {
    icon: 'camera',
    title: 'Camera presence',
    rows: [
      { label: 'What it uses', text: 'Your webcam, only while a session is running.' },
      { label: 'Where it goes', text: 'Nowhere. Face detection runs inside your browser; no image or video is ever uploaded.' },
      { label: 'What’s kept', text: 'Only “you stepped away at 3:12 for 2 minutes”. No pictures, no face data.' },
      { label: 'How to stop', text: 'Switch it off any time, or end the session. Your browser shows a camera light while it’s on.' },
    ],
  },
  extension: {
    icon: 'browser',
    title: 'Tab tracking with the extension',
    rows: [
      { label: 'What it uses', text: 'The address and title of the tab you’re on, only during a session.' },
      { label: 'Where it goes', text: 'Known sites are judged on your computer. For unfamiliar ones, the site address (without the part after “?”) and the tab title are checked by BrainCoach’s AI.' },
      { label: 'What’s kept', text: 'Only “off task on youtube.com for 2+ minutes”. Never page content, passwords, cookies or browsing history.' },
      { label: 'How to stop', text: 'Set tab tracking to Off, end the session, or remove the extension. It does nothing outside a session.' },
    ],
  },
  screen: {
    icon: 'eye',
    title: 'Screen check',
    rows: [
      { label: 'What it uses', text: 'The screen you choose to share, only while you’re on another tab during a session.' },
      { label: 'Where it goes', text: 'A small, low-resolution snapshot goes to BrainCoach’s AI, and only when your screen has changed.' },
      { label: 'What’s kept', text: 'Only the verdict, like “YouTube · off task”. Snapshots are analysed and thrown away, never saved.' },
      { label: 'How to stop', text: 'Click “Stop sharing” in your browser at any time. Share a single window instead of the whole screen if you prefer.' },
    ],
  },
}

export function PrivacyConsent({ tracker, onAllow, onCancel }: { tracker: Tracker; onAllow: () => void; onCancel: () => void }) {
  const d = DISCLOSURES[tracker]
  const allowRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    allowRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-bg/70 px-4 py-6 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        className="tour-card m-auto w-full max-w-lg rounded-3xl border border-line-strong bg-surface p-7 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.8)] sm:p-9"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-xl text-accent" aria-hidden="true">
            <Icon name={d.icon} />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-fg-3">Before you turn this on</p>
            <h2 id="consent-title" className="font-serif text-[28px] leading-tight text-fg">{d.title}</h2>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-bg">
          {d.rows.map(r => (
            <div key={r.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[7.5rem_1fr] sm:gap-4">
              <dt className="text-[13px] text-fg-3">{r.label}</dt>
              <dd className="text-[13px] leading-relaxed text-fg-2">{r.text}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-xs text-fg-3">
          It’s optional: sessions work without it.{' '}
          <NavLink href="/privacy" className="text-accent underline-offset-4 hover:underline">Read the full privacy details</NavLink>
        </p>

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1" onClick={onCancel}>Not now</Button>
          <Button ref={allowRef} size="lg" className="flex-1" onClick={onAllow}>Turn on</Button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
