import { APP_SESSION_URL, APP_URL_PATTERNS, LOG_LIMIT, getState } from './state.js'

// Everything the user can see: toolbar badge, notifications, the activity log, and live status
// pushed to open BrainCoach tabs.

const BADGE = {
  on: { text: 'ON', color: '#9cc9a9', textColor: '#0d1a11' },
  off: { text: 'OFF', color: '#e58b7b', textColor: '#1a0d0b' },
  checking: { text: '…', color: '#353532', textColor: '#edece8' },
  paused: { text: 'II', color: '#e3bd7a', textColor: '#1a140b' },
}

export async function updateBadge(state) {
  if (!state.session) {
    await chrome.action.setBadgeText({ text: '' })
    await chrome.action.setTitle({ title: 'BrainCoach: no active session' })
    return
  }
  const kind = state.paused ? 'paused' : state.tab?.pending ? 'checking' : state.tab && !state.tab.relevant ? 'off' : 'on'
  const b = BADGE[kind]
  await chrome.action.setBadgeText({ text: b.text })
  await chrome.action.setBadgeBackgroundColor({ color: b.color })
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: b.textColor })
  const where = state.tab?.host ? ` (${state.tab.host})` : ''
  const titles = {
    paused: 'BrainCoach: session paused',
    checking: `BrainCoach: checking${where}…`,
    off: `BrainCoach: off task${where}`,
    on: `BrainCoach: on task${where}`,
  }
  await chrome.action.setTitle({ title: titles[kind] })
}

// Activity log: one entry per stretch on a site with the same verdict.
export function recordLog(state, now) {
  const log = state.log || (state.log = [])
  const last = log[log.length - 1]
  const tab = state.tab
  if (last && last.end === null && last.host === tab.host && last.relevant === tab.relevant) return
  closeLogEntry(state, now)
  log.push({ host: tab.host, title: tab.title, relevant: tab.relevant, neutral: !!tab.neutral, reason: tab.reason || '', start: now, end: null })
  if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT)
}

export function closeLogEntry(state, now) {
  const last = state.log?.[state.log.length - 1]
  if (last && last.end === null) last.end = now
}

// A gentle system notification after 2 minutes off task (strict mode already interrupts sooner).
export function nudge(state) {
  if (state.session.strict) return
  const plan = state.session.intention ? `\nYour plan: ${state.session.intention}.` : ''
  chrome.notifications.create(`drift-${Date.now()}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `2 minutes on ${state.tab.host}`,
    message: `Back to: ${state.session.taskDescription}${plan}`,
    priority: 1,
  })
}

export async function onNotificationClicked(id) {
  chrome.notifications.clear(id)
  const state = await getState()
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id) chrome.tabs.update(tab.id, { url: state.session?.lastRelevantUrl || APP_SESSION_URL })
}

export async function sendToApp(message) {
  const tabs = await chrome.tabs.query({ url: APP_URL_PATTERNS })
  for (const t of tabs) chrome.tabs.sendMessage(t.id, message).catch(() => {})
}

// Push the latest status to every open BrainCoach tab so the session screen updates live.
export function broadcast(state) {
  return sendToApp({
    type: 'TAB_STATUS',
    active: !!state.session,
    paused: state.paused,
    tab: state.tab,
    offTaskSince: state.offTaskSince,
    log: state.log || [],
    lastCheckedAt: state.lastCheckedAt,
  })
}

/** Badge + app update in one go. */
export async function publish(state) {
  await updateBadge(state)
  await broadcast(state)
}
