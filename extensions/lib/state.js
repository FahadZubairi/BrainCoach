// Persistent tracker state. MV3 service workers are stopped when idle, so nothing important may live
// only in memory. All writes go through withState(), which serialises read-modify-write cycles so a
// slow tab check can never overwrite a newer change (a pause, a new session) made in the meantime.

export const OFF_TASK_THRESHOLD_MS = 2 * 60 * 1000
export const TICK_ALARM = 'braincoach-tick'
export const APP_URL_PATTERNS = ['http://localhost:3000/*', 'http://127.0.0.1:3000/*']
export const APP_SESSION_URL = 'http://localhost:3000/session'
export const DEFAULT_API = 'http://localhost:5000'
export const SNOOZE_MINUTES = 5
export const LOG_LIMIT = 60

export function emptyState() {
  return { session: null, tab: null, offTaskSince: null, lostLogged: false, paused: false, log: [], lastCheckedAt: null }
}

export async function getState() {
  const { state } = await chrome.storage.local.get('state')
  return state || emptyState()
}

let queue = Promise.resolve()

/** Runs fn(state) exclusively; whatever fn leaves in `state` is saved. Returns fn's result. */
export function withState(fn) {
  const run = queue.then(async () => {
    const state = await getState()
    const result = await fn(state)
    await chrome.storage.local.set({ state })
    return result
  })
  queue = run.catch(() => {})
  return run
}

export async function resetState() {
  return withState((state) => {
    Object.assign(state, emptyState())
  })
}

export function hostOf(url) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

export function isAppUrl(url) {
  return APP_URL_PATTERNS.some((p) => url.startsWith(p.replace('*', '')))
}
