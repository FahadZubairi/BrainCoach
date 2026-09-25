import { useState } from 'react'
import { Button, Card, Eyebrow, Field, Icon, Segmented, Switch, cx, inputClass } from '../components/ui'
import { ENERGY, INTENTION_PRESETS } from './constants'
import { TimeboxField } from './TimeboxField'
import { TrackingCard } from './TrackingCard'
import type { SessionController } from './useSessionController'

// Before a session: what you'll work on, how you feel, the timebox, and your if-then plan.
export function SetupView({ c }: { c: SessionController }) {
  const [task, setTask] = useState('')
  const [energy, setEnergy] = useState(3)
  const [exercised, setExercised] = useState(false)
  const [intention, setIntention] = useState('')
  const presets = [...new Set([c.prefs.lastIntention, ...INTENTION_PRESETS].filter(Boolean))].slice(0, 3)

  return (
    <div>
      <header className="mb-10">
        <Eyebrow className="mb-2">New session</Eyebrow>
        <h1 className="font-serif text-[40px] leading-[1.05] text-fg sm:text-5xl">What deserves your attention?</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-6 sm:p-8">
          <form
            onSubmit={e => { e.preventDefault(); c.start({ taskDescription: task, energyLevel: energy, exercisedToday: exercised, intention }) }}
            className="flex flex-col gap-8"
          >
            <Field label="Task" htmlFor="task" hint="Be specific — it’s also how the tracker decides which tabs are on topic.">
              <input id="task" autoFocus value={task} onChange={e => setTask(e.target.value)} placeholder="e.g. Write the methods section of my thesis" className={inputClass} maxLength={200} autoComplete="off" />
            </Field>

            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-sm text-fg-2">Energy</span>
                <span className="text-[13px] text-fg-3">{ENERGY[energy - 1].hint}</span>
              </div>
              <Segmented label="Energy level from 1 to 5" options={ENERGY} value={energy} onChange={setEnergy} />
            </div>

            <TimeboxField prefs={c.prefs} updatePrefs={c.updatePrefs} />

            <div>
              <label htmlFor="intention" className="mb-2 block text-sm text-fg-2">If I get distracted, then I will…</label>
              <input id="intention" value={intention} onChange={e => setIntention(e.target.value)} placeholder="close the tab and reread my task" maxLength={120} autoComplete="off" className={inputClass} />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {presets.map(p => (
                  <button
                    key={p} type="button" onClick={() => setIntention(p)}
                    className={cx(
                      'cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors',
                      intention === p ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-fg-3 hover:border-line-strong hover:text-fg-2',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-fg-3">A concrete if-then plan makes follow-through far more likely. It reappears when you drift.</p>
            </div>

            <Switch checked={exercised} onChange={setExercised} label="I exercised today" description="Helps the coach spot how movement affects your focus." />

            {c.error && <p role="alert" className="text-sm text-danger">{c.error}</p>}

            <Button type="submit" size="lg" disabled={!task.trim() || c.starting} className="w-full">
              {c.starting ? 'Starting…' : <>Start session <Icon name="arrow" /></>}
            </Button>
          </form>
        </Card>

        <TrackingCard c={c} />
      </div>
    </div>
  )
}
