import { logEvent } from './api.js'
import { quickVerdict, remoteVerdict } from './classify.js'
import { OFF_TASK_THRESHOLD_MS, getState, hostOf, withState } from './state.js'
import { nudge, publish, recordLog } from './ui.js'

// Decides what the user is looking at right now and records it.
// Speed matters: the verdict for known sites is applied the instant you switch tabs; only ambiguous
// sites wait for the backend, and even then the badge/app show "checking" immediately.

const PAUSE_PAGE = chrome.runtime.getURL('pause.html')

let running = false
let rerun = false

// Serialised: if a tab event arrives mid-evaluation, run once more afterwards instead of dropping it.
export async function evaluateActiveTab() {
  if (running) {
    rerun = true
    return
  }
  running = true
  try {
    do {
      rerun = false
      await evaluateOnce()
    } while (rerun)
  } catch (err) {
    console.error('BrainCoach evaluation error:', err)
  } finally {
    running = false
  }
}

async function currentTab() {
  const win = await chrome.windows.getLastFocused().catch(() => null)
  // Chrome isn't in front (editor, PDF viewer…). We can't see other apps: treat as neutral.
  if (!win || !win.focused) return { outside: true }
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id })
  return tab?.url ? { tab } : null
}

async function evaluateOnce() {
  const snapshot = await getState()
  if (!snapshot.session || snapshot.paused) return
  const sessionId = snapshot.session.sessionId

  const found = await currentTab()
  if (!found) return

  if (found.outside) {
    await apply(sessionId, { url: '', host: 'Outside Chrome', title: 'Outside the browser', relevant: true, reason: 'Another app is in front', neutral: true })
    return
  }

  const tab = found.tab
  const host = tab.url.startsWith(PAUSE_PAGE) ? 'Pause screen' : hostOf(tab.url) || 'Browser page'
  const base = { url: tab.url, host, title: tab.title || '', tabId: tab.id }

  const quick = quickVerdict(tab, snapshot.session)
  if (quick) {
    await apply(sessionId, { ...base, ...quick })
    return
  }

  // Unknown site: show "checking" right away, then ask the backend.
  await withState(async (state) => {
    if (state.session?.sessionId !== sessionId || state.paused) return
    state.tab = { ...base, relevant: true, pending: true, reason: 'Checking…' }
    await publish(state)
  })
  const verdict = await remoteVerdict(tab, snapshot.session)
  await apply(sessionId, { ...base, ...verdict })
}

/** Applies a verdict under the state lock, unless the session changed or paused meanwhile. */
function apply(sessionId, tabInfo) {
  return withState(async (state) => {
    if (state.session?.sessionId !== sessionId || state.paused) return
    const now = Date.now()
    const { tabId, ...info } = tabInfo
    state.tab = info

    if (info.relevant) {
      state.offTaskSince = null
      if (!info.neutral && info.url) state.session.lastRelevantUrl = info.url
    } else {
      state.offTaskSince = state.offTaskSince ?? now
      // Strict mode: put a short, deliberate pause between you and the distraction.
      const snoozed = (state.session.snoozedUntil?.[info.host] ?? 0) > now
      if (state.session.strict && !snoozed && tabId !== undefined) {
        const pause = `pause.html?url=${encodeURIComponent(info.url)}&host=${encodeURIComponent(info.host)}`
        chrome.tabs.update(tabId, { url: chrome.runtime.getURL(pause) }).catch(() => {})
      }
    }

    if (info.relevant && state.lostLogged) {
      state.lostLogged = false
      logEvent(state.session, 'focused', `Back on task${info.host ? ` (${info.host})` : ''}`)
    } else if (!info.relevant && !state.lostLogged && now - state.offTaskSince >= OFF_TASK_THRESHOLD_MS) {
      state.lostLogged = true
      logEvent(state.session, 'lost_focus', `Off task on ${info.host || info.title} for 2+ min`)
      nudge(state)
    }

    recordLog(state, now)
    state.lastCheckedAt = now
    await publish(state)
  })
}
