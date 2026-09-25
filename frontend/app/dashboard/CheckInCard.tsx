import { useEffect, useState } from 'react'
import type { MessageResponse } from '../../../shared/api'
import { Card, Eyebrow, Icon, Segmented } from '../components/ui'
import { Stats, api } from '../lib/api'

const ENERGY = [
  { value: 1, label: 'Drained' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Steady' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Sharp' },
]

const CHECKIN_KEY = 'braincoach_checkin'
const FALLBACK_NOTE = 'Pick one thing that matters today and give it your first, freshest hour.'

// Energy check-in → a short plan from the coach. Remembered for the day so it survives navigation.
export function CheckInCard({ stats }: { stats: Stats | null }) {
  const [energy, setEnergy] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CHECKIN_KEY) || 'null')
      if (saved?.date === new Date().toDateString()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating from localStorage after mount (pages are prerendered)
        setEnergy(saved.energy)
        setNote(saved.note)
      }
    } catch { /* storage blocked or corrupt: start fresh */ }
  }, [])

  async function checkIn(value: number) {
    setEnergy(value)
    setLoading(true)
    setOffline(false)
    try {
      const { message } = await api<MessageResponse>('/coach/daily-checkin', {
        method: 'POST',
        body: JSON.stringify({
          energyLevel: value,
          sessionsToday: stats?.sessionsToday ?? 0,
          avgFocusScore: stats?.avgFocusScore ?? 0,
          completedSessions: stats?.completedSessions ?? 0,
        }),
      })
      setNote(message)
      try {
        localStorage.setItem(CHECKIN_KEY, JSON.stringify({ date: new Date().toDateString(), energy: value, note: message }))
      } catch { /* not critical */ }
    } catch {
      setNote(FALLBACK_NOTE)
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6 sm:p-8 lg:col-span-3">
      <Eyebrow>Check-in</Eyebrow>
      <h2 className="mt-2 text-lg text-fg">How’s your energy right now?</h2>
      <div className="mt-5"><Segmented label="Energy level" options={ENERGY} value={energy} onChange={checkIn} /></div>
      <div className="mt-6 min-h-[72px] border-t border-line pt-5" aria-live="polite">
        {loading ? (
          <div className="space-y-2" aria-label="Loading coach note">
            <div className="h-3 w-4/5 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-surface-2" />
          </div>
        ) : note ? (
          <div className="flex gap-3">
            <Icon name="spark" className="mt-1 text-accent" />
            <div>
              <p className="font-serif text-xl leading-snug text-fg">{note}</p>
              {offline && energy && (
                <button type="button" onClick={() => checkIn(energy)} className="mt-2 cursor-pointer text-xs text-fg-3 underline-offset-4 hover:text-fg hover:underline">
                  The coach couldn&apos;t be reached. Try again
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-fg-3">Your coach will suggest a plan that fits how you feel.</p>
        )}
      </div>
    </Card>
  )
}
