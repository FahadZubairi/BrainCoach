import { BrainOutline, Logo } from './Logo'

// The sign-in page's brand card: a soft sage-to-amber glow with a few floating rounded slabs and a faint
// echo of the logo's brain, carrying the logo, the headline and the three things BrainCoach does.
// Pure CSS on theme tokens, so it follows the palette.

const POINTS = [
  { title: 'Presence', body: 'Your camera notices when you step away. Nothing leaves your device.' },
  { title: 'Tabs', body: 'A small extension flags tabs that drift from the task you set.' },
  { title: 'Patterns', body: 'A coach reads your history and tells you when you work best.' },
]

export function LoginArt() {
  return (
    <div className="relative flex h-full min-h-[600px] flex-col justify-between overflow-hidden rounded-3xl border border-line bg-surface p-10 xl:p-12">
      {/* Glow: warm light rising from below, cooler sage towards the edges */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg via-surface to-accent/25" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-1/2 h-[30rem] w-[36rem] -translate-x-1/2 translate-y-1/3 rounded-full bg-warn/40 blur-[90px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-20 h-80 w-80 rounded-full bg-accent/40 blur-[80px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 bottom-24 h-64 w-64 rounded-full bg-accent/15 blur-[70px]" />

      {/* Floating slabs along the top-right edge */}
      <div aria-hidden="true" className="login-slab pointer-events-none absolute -top-36 right-24 h-72 w-72 rotate-45 rounded-[3rem] border border-line-strong/50 bg-surface/70 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] [animation-delay:-4s]" />
      <div aria-hidden="true" className="login-slab pointer-events-none absolute -right-24 -top-12 h-64 w-64 rotate-45 rounded-[3rem] border border-line-strong/40 bg-bg/60 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] [animation-delay:-8s]" />

      <BrainOutline className="login-brain pointer-events-none absolute -bottom-24 -right-28 w-[34rem] rotate-[-8deg] text-accent/[0.12]" strokeWidth={1.5} />

      <Logo size="lg" animate className="relative" />

      <h1 className="relative max-w-md font-serif text-6xl leading-[1.02] tracking-[-0.015em] text-fg">
        Attention is a <span className="italic text-accent">practice</span>.
      </h1>

      <div className="relative">
        <ul className="space-y-5 rounded-2xl border border-fg/10 bg-bg/55 p-6 backdrop-blur-xl">
          {POINTS.map((p, i) => (
            <li key={p.title} className="flex gap-5">
              <span className="tabular mt-0.5 text-sm text-fg-3">0{i + 1}</span>
              <div>
                <p className="text-[15px] text-fg">{p.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-2">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-fg-3">Build discipline one session at a time.</p>
      </div>
    </div>
  )
}
