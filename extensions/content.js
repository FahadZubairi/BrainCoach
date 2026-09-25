// Bridge between the BrainCoach web app and the extension's service worker.
// The page talks to us with window.postMessage, so the app never needs to know the extension ID
// (unpacked extensions get a different ID on every machine).

const APP = 'braincoach-app'
const EXT = 'braincoach-extension'
const VERSION = chrome.runtime.getManifest().version

function toPage(message) {
  window.postMessage({ source: EXT, ...message }, window.location.origin)
}

function announce() {
  toPage({ type: 'EXTENSION_READY', version: VERSION })
}

window.addEventListener('message', (event) => {
  if (event.source !== window || event.data?.source !== APP) return
  const { source, ...message } = event.data

  if (message.type === 'PING') {
    announce()
    return
  }

  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) return
      if (response) toPage({ type: `${message.type}_ACK`, ...response })
    })
  } catch {
    // Extension was reloaded or removed; this content script is orphaned.
    toPage({ type: 'EXTENSION_GONE' })
  }
})

// Live tab status pushed from the service worker
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'TAB_STATUS' || message?.type === 'BREAK_ACTION') toPage(message)
})

announce()
