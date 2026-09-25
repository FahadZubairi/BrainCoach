// Built with DOM APIs (not innerHTML) because task titles and tab titles are user-controlled text.
function el(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function row(dotClass, text) {
  const r = el('div', 'row')
  r.append(el('span', `dot ${dotClass}`), el('span', '', text))
  return r
}

function ago(ts) {
  if (!ts) return 'not yet'
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000))
  return s < 60 ? `${s}s ago` : `${Math.floor(s / 60)}m ago`
}

function duration(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function render(state) {
  const root = document.getElementById('status')
  root.replaceChildren()

  if (!state?.session) {
    root.append(row('', 'No active session'))
    root.append(el('p', 'reason', 'Start a session in BrainCoach and tracking turns on automatically. The badge on this icon will show ON or OFF.'))
    return
  }

  const kind = state.paused ? 'paused' : state.tab && !state.tab.relevant ? 'off' : 'on'
  const head = el('div', 'row spread')
  head.append(row(kind, { paused: 'Session paused', off: 'Off task', on: 'On task' }[kind]))
  head.append(el('span', 'beat', `Checked ${ago(state.lastCheckedAt)}`))
  root.append(head)

  root.append(el('div', 'label', 'Working on'))
  root.append(el('div', 'task', state.session.taskDescription))

  if (state.tab) {
    root.append(el('div', 'label', 'Current tab'))
    root.append(el('div', 'muted', state.tab.host || state.tab.title))
    if (state.tab.reason) root.append(el('div', 'reason', state.tab.reason))
  }

  const log = (state.log || []).slice(-6).reverse()
  if (log.length) {
    root.append(el('div', 'label', 'Recent tabs'))
    const list = el('ul', 'log')
    for (const entry of log) {
      const li = el('li')
      li.append(
        el('span', `dot ${entry.neutral ? 'neutral' : entry.relevant ? 'on' : 'off'}`),
        el('span', 'host', entry.host || entry.title),
        el('span', 'dur', duration((entry.end ?? Date.now()) - entry.start)),
      )
      list.append(li)
    }
    root.append(list)
  }
}

let latest = null
chrome.storage.local.get('state', ({ state }) => { latest = state; render(state) })
chrome.storage.onChanged.addListener((changes) => {
  if (changes.state) { latest = changes.state.newValue; render(latest) }
})
// Keep "checked Xs ago" and the running duration ticking while the popup is open.
setInterval(() => render(latest), 1000)
