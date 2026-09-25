// Constants and small helpers shared by the session screens.

export type Phase = 'setup' | 'active' | 'ended'

export const ENERGY = [
  { value: 1, label: '1', hint: 'Drained' },
  { value: 2, label: '2', hint: 'Low' },
  { value: 3, label: '3', hint: 'Steady' },
  { value: 4, label: '4', hint: 'Good' },
  { value: 5, label: '5', hint: 'Sharp' },
]

// Timeboxes. 25 is the classic Pomodoro; 50 and 90 suit deeper work.
export const PRESET_TIMEBOXES = [25, 50, 90]
export const TIMEBOX_MIN = 5
export const TIMEBOX_MAX = 240
export const BREAK_MAX = 15

// Implementation intentions ("if X, then Y") substantially raise follow-through
// (Gollwitzer & Sheeran, 2006). These are starting points; people write their own.
export const INTENTION_PRESETS = [
  'close the tab and reread my task',
  'park the thought and return to the next small step',
  'take three slow breaths, then continue',
]

export const CAMERA_PREF_KEY = 'braincoach_camera'

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function elapsedLabel(since: number | null, now: number) {
  if (!since) return ''
  const s = Math.max(0, Math.floor((now - since) / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

// A soft two-note chime via Web Audio: no asset to load, quiet enough not to startle.
export function chime() {
  try {
    const ctx = new AudioContext()
    ;[659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = ctx.currentTime + i * 0.22
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.12, t + 0.03)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1.2)
    })
    setTimeout(() => ctx.close(), 2000)
  } catch { /* audio unavailable */ }
}

/** A system notification, only when the page isn't visible (the in-app UI covers the visible case). */
export function notifyIfHidden(title: string, body: string) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    new Notification(title, { body, silent: true })
  }
}
