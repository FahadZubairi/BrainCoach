import { APP_URL_PATTERNS } from './state.js'
import { sendToApp } from './ui.js'

// The break prompt as a small always-on-top pop-up window, so it appears over whatever you're doing.

export async function getBreakWindow() {
  const { breakWindow } = await chrome.storage.local.get('breakWindow')
  if (!breakWindow) return null
  try {
    await chrome.windows.get(breakWindow.id)
    return breakWindow
  } catch {
    await chrome.storage.local.remove('breakWindow')
    return null
  }
}

export async function openBreakWindow(mode, params) {
  const existing = await getBreakWindow()
  const query = new URLSearchParams({ mode, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v ?? '')])) })
  const url = chrome.runtime.getURL(`break.html?${query}`)
  const breakMinutes = Number(params.break || existing?.breakMinutes || 5)

  if (existing) {
    const [tab] = await chrome.tabs.query({ windowId: existing.id })
    if (tab) await chrome.tabs.update(tab.id, { url })
    await chrome.windows.update(existing.id, { focused: true, drawAttention: true })
    await chrome.storage.local.set({ breakWindow: { ...existing, mode, breakMinutes } })
    return
  }

  const width = 420
  const height = 500
  const anchor = await chrome.windows.getLastFocused().catch(() => null)
  const left = anchor?.left != null && anchor.width ? Math.round(anchor.left + (anchor.width - width) / 2) : undefined
  const top = anchor?.top != null && anchor.height ? Math.round(anchor.top + (anchor.height - height) / 2) : undefined
  const win = await chrome.windows.create({ url, type: 'popup', width, height, left, top, focused: true })
  await chrome.storage.local.set({ breakWindow: { id: win.id, mode, breakMinutes } })
}

export async function closeBreakWindow() {
  const win = await getBreakWindow()
  await chrome.storage.local.remove('breakWindow')
  if (win) await chrome.windows.remove(win.id).catch(() => {})
}

export async function showCountdown(breakUntil) {
  const win = await getBreakWindow()
  if (!win) return
  await chrome.storage.local.set({ breakWindow: { ...win, mode: 'break' } })
  chrome.runtime.sendMessage({ type: 'BREAK_WINDOW_MODE', mode: 'break', breakUntil, total: win.breakMinutes * 60_000 }).catch(() => {})
}

export async function focusApp() {
  const [tab] = await chrome.tabs.query({ url: APP_URL_PATTERNS })
  if (!tab) return
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })
}

// Closing the prompt with the window's X counts as "Not now".
export async function onWindowRemoved(windowId) {
  const { breakWindow } = await chrome.storage.local.get('breakWindow')
  if (breakWindow?.id !== windowId) return
  await chrome.storage.local.remove('breakWindow')
  if (breakWindow.mode === 'prompt') await sendToApp({ type: 'BREAK_ACTION', action: 'dismiss' })
}
