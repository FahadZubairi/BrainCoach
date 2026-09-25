// BrainCoach focus tracker — service worker entry point. Wires browser events and messages to lib/.
import { fetchTabRules } from './lib/api.js'
import { closeBreakWindow, focusApp, onWindowRemoved, openBreakWindow, showCountdown } from './lib/breakWindow.js'
import { forgetHost } from './lib/classify.js'
import {
  APP_SESSION_URL, APP_URL_PATTERNS, DEFAULT_API, SNOOZE_MINUTES, TICK_ALARM, getState, resetState, withState,
} from './lib/state.js'
import { evaluateActiveTab } from './lib/tracker.js'
import { closeLogEntry, onNotificationClicked, publish, sendToApp, updateBadge } from './lib/ui.js'

// ── Messages from the web app (via content.js) and our own pages ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse, (err) => sendResponse({ ok: false, error: String(err) }))
  return true // keep the channel open for the async response
})

async function startSession(message) {
  await withState((state) => {
    const same = state.session?.sessionId === message.sessionId
    state.session = {
      sessionId: message.sessionId,
      token: message.token,
      taskDescription: message.taskDescription,
      profile: message.profile || null,
      apiBase: message.apiBase || DEFAULT_API,
      strict: !!message.strict,
      intention: message.intention || '',
      rules: same ? state.session.rules : null,
      // Carried over on reconnects so "this is part of my task" choices aren't forgotten
      allowedHosts: same ? state.session.allowedHosts || [] : [],
      snoozedUntil: same ? state.session.snoozedUntil || {} : {},
      lastRelevantUrl: same ? state.session.lastRelevantUrl || null : null,
    }
    if (!same) Object.assign(state, { tab: null, offTaskSince: null, lostLogged: false, log: [] })
    state.paused = false
  })
  await chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 })
  await evaluateActiveTab()

  // Download the rule lists so known sites are judged instantly from now on.
  const { session } = await getState()
  if (session && !session.rules) {
    try {
      const rules = await fetchTabRules(session)
      await withState((state) => { if (state.session?.sessionId === session.sessionId) state.session.rules = rules })
      await evaluateActiveTab()
    } catch (err) {
      console.warn('BrainCoach: could not load tab rules; falling back to the server for every tab', err)
    }
  }
}

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'START_SESSION':
      await startSession(message)
      return { ok: true }
    case 'PAUSE_SESSION':
    case 'RESUME_SESSION': {
      const paused = message.type === 'PAUSE_SESSION'
      await withState(async (state) => {
        state.paused = paused
        state.offTaskSince = null
        if (paused) closeLogEntry(state, Date.now())
        await publish(state)
      })
      if (!paused) await evaluateActiveTab()
      return { ok: true }
    }
    case 'END_SESSION':
      await chrome.alarms.clear(TICK_ALARM)
      await closeBreakWindow()
      await resetState()
      await updateBadge(await getState())
      return { ok: true }

    // ── From the pause page (pause.html) ──
    case 'PAUSE_BACK_TO_WORK': {
      const { session } = await getState()
      if (sender?.tab?.id) await chrome.tabs.update(sender.tab.id, { url: session?.lastRelevantUrl || APP_SESSION_URL })
      return { ok: true }
    }
    case 'PAUSE_SNOOZE':
    case 'PAUSE_ALLOW': {
      if (!message.host) return { ok: false }
      await withState((state) => {
        if (!state.session) return
        if (message.type === 'PAUSE_ALLOW') {
          // The user says this site is part of the task: trust it for the rest of the session.
          state.session.allowedHosts = [...new Set([...(state.session.allowedHosts || []), message.host])]
          forgetHost(message.host)
        } else {
          state.session.snoozedUntil = { ...(state.session.snoozedUntil || {}), [message.host]: Date.now() + SNOOZE_MINUTES * 60_000 }
        }
      })
      if (sender?.tab?.id && message.url) await chrome.tabs.update(sender.tab.id, { url: message.url })
      return { ok: true }
    }

    // ── Break reminders (from the web app) ──
    case 'BREAK_PROMPT':
      await openBreakWindow('prompt', { planned: message.plannedMinutes, break: message.breakMinutes, task: message.taskDescription })
      return { ok: true }
    case 'BREAK_STARTED':
      await showCountdown(message.breakUntil)
      return { ok: true }
    case 'BREAK_CLOSE':
      // "over": tell you wherever you are that the break ended (the session already resumed).
      if (message.reason === 'over') await openBreakWindow('over', {})
      else await closeBreakWindow()
      return { ok: true }

    // ── From the break window (break.html) ──
    case 'BREAK_WINDOW_ACTION':
      if (message.action === 'back') {
        await closeBreakWindow()
        await focusApp()
        return { ok: true }
      }
      if (message.action === 'dismiss') await closeBreakWindow()
      await sendToApp({ type: 'BREAK_ACTION', action: message.action })
      return { ok: true }

    case 'GET_STATUS': {
      const state = await getState()
      await publish(state)
      return { ok: true, active: !!state.session }
    }
    default:
      return { ok: false, error: 'unknown message' }
  }
}

// ── What triggers a check ──
chrome.tabs.onActivated.addListener(() => evaluateActiveTab())
chrome.tabs.onUpdated.addListener((_id, change, tab) => {
  // change.url catches in-page navigation (YouTube → next video, Google searches) that never "completes".
  if (tab.active && (change.url || change.title || change.status === 'complete')) evaluateActiveTab()
})
chrome.windows.onFocusChanged.addListener(() => evaluateActiveTab())
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) evaluateActiveTab()
})

chrome.notifications.onClicked.addListener(onNotificationClicked)
chrome.windows.onRemoved.addListener(onWindowRemoved)

// Restore the badge when the worker restarts or the browser opens.
chrome.runtime.onStartup.addListener(async () => updateBadge(await getState()))
chrome.runtime.onInstalled.addListener(async () => {
  updateBadge(await getState())
  // Content scripts only load on navigation, so connect to BrainCoach tabs that are already open.
  // This lets the setup page see the extension the moment it's installed, without a reload.
  const tabs = await chrome.tabs.query({ url: APP_URL_PATTERNS })
  for (const t of tabs) {
    chrome.scripting.executeScript({ target: { tabId: t.id }, files: ['content.js'] }).catch(() => {})
  }
})
