import { BrainOutline } from './Logo'

// The sign-in page's art card: a soft sage-to-amber glow with a few floating rounded slabs, a faint
// echo of the logo's brain, and a frosted caption card. Pure CSS on theme tokens, so it follows the palette.

const TAGS = ['Presence', 'Tab tracking', 'Insights']

export function LoginArt() {
  return (
    <div className="relative h-full min-h-[560px] overflow-hidden rounded-3xl border border-line bg-surface">
      {/* Glow: warm light rising from below, cooler sage towards the edges */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg via-surface to-accent/25" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-[30rem] w-[36rem] -translate-x-1/2 translate-y-1/3 rounded-full bg-warn/40 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-20 h-80 w-80 rounded-full bg-accent/40 blur-[80px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 bottom-24 h-64 w-64 rounded-full bg-accent/15 blur-[70px]" />

      {/* Floating slabs along the top edge */}
      <div aria-hidden="true" className="login-slab pointer-events-none absolute -left-16 -top-24 h-64 w-64 rotate-45 rounded-[3rem] border border-line-strong/60 bg-bg/70 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]" />
      <div aria-hidden="true" className="login-slab pointer-events-none absolute left-40 -top-36 h-72 w-72 rotate-45 rounded-[3rem] border border-line-strong/50 bg-surface/70 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] [animation-delay:-4s]" />
      <div aria-hidden="true" className="login-slab pointer-events-none absolute -right-20 -top-16 h-60 w-60 rotate-45 rounded-[3rem] border border-line-strong/40 bg-bg/60 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] [animation-delay:-8s]" />

      <BrainOutline className="login-brain pointer-events-none absolute left-1/2 top-[30%] w-[26rem] -translate-x-1/2 -translate-y-1/2 text-accent/[0.14]" strokeWidth={1.5} />

      {/* Caption */}
      <div className="absolute inset-x-6 bottom-6 sm:inset-x-8 sm:bottom-8">
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="Features">
          {TAGS.map(t => (
            <li key={t} className="rounded-md bg-bg/70 px-2.5 py-1 text-xs font-medium text-fg backdrop-blur-md">{t}</li>
          ))}
        </ul>
        <figure className="rounded-2xl border border-fg/10 bg-bg/55 p-5 backdrop-blur-xl">
          <blockquote className="text-[17px] leading-relaxed text-fg">
            Write down the one thing you&apos;re here to do. BrainCoach quietly notices when you drift, and helps you come back.
          </blockquote>
          <figcaption className="mt-4 text-sm text-fg-3">
            Attention is a practice. <span className="text-fg-2">Build it one session at a time.</span>
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
