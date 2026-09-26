'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LogoMark } from './Logo'
import { Button, Icon, IconName } from './ui'
import { clearTour, isTourPending } from '../lib/tour'

// A short, plain-language walkthrough shown once to new users on the Today screen.
// Written for people who've never used a focus app: what each feature does for them, not how it works.

interface Step {
  icon: IconName | 'logo'
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: 'logo',
    title: 'Welcome to BrainCoach',
    body: 'BrainCoach helps you stay on the one thing you decided to work on. Here’s a quick look around. It takes under a minute.',
  },
  {
    icon: 'play',
    title: 'Start a focus session',
    body: 'Press the green button on this page, write what you’ll work on, and pick how long. That’s all you need to begin.',
  },
  {
    icon: 'camera',
    title: 'It notices when you step away',
    body: 'If you allow the camera, BrainCoach can tell when you leave your desk. The video never leaves your computer.',
  },
  {
    icon: 'browser',
    title: 'A gentle nudge when you drift',
    body: 'Choose the browser extension or screen check, and BrainCoach will let you know if you spend a couple of minutes on something unrelated.',
  },
  {
    icon: 'pause',
    title: 'Breaks are part of the plan',
    body: 'Set a work timer and a break length. When it’s time, a reminder pops up. Accept it and your session pauses, then picks up again.',
  },
  {
    icon: 'spark',
    title: 'See your progress',
    body: 'Today shows your daily goal and habits. History and Insights show when you focus best, so each week gets a little easier.',
  },
]

export default function WelcomeTour() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setOpen(isTourPending())
  }, [])

  // Keep keyboard focus on the main action as the steps change.
  useEffect(() => {
    if (open) nextRef.current?.focus()
  }, [open, step])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() {
    clearTour()
    setOpen(false)
  }

  if (!open) return null
  const current = STEPS[step]
  const last = step === STEPS.length - 1
  const progress = ((step + 1) / STEPS.length) * 100

  // Portalled to <body>: page-transition transforms on the app shell would otherwise trap position: fixed.
  return createPortal(
    <div className="fixed inset-0 z-50 flex overflow-y-auto bg-bg/70 px-4 py-6 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className="tour-card m-auto w-full max-w-md rounded-3xl border border-line-strong bg-surface p-8 shadow-[0_24px_80px_-24px_rgb(0_0_0/0.8)] sm:p-10"
      >
        <div key={step} className="tour-step text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-2xl text-accent" aria-hidden="true">
            {current.icon === 'logo' ? <LogoMark size={36} animate /> : <Icon name={current.icon} />}
          </span>
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.08em] text-fg-3">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 id="tour-title" className="mt-2 font-serif text-[32px] leading-tight text-fg">{current.title}</h2>
          <p id="tour-body" className="mt-3 text-[15px] leading-relaxed text-fg-2">{current.body}</p>
        </div>

        <div
          className="mt-8 h-1 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label="Tour progress"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-8 flex gap-3">
          <Button variant="secondary" size="lg" className="flex-1" onClick={close}>Skip</Button>
          <Button ref={nextRef} size="lg" className="flex-1" onClick={() => (last ? close() : setStep(step + 1))}>
            {last ? 'Get started' : <>Next <Icon name="arrow" /></>}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
