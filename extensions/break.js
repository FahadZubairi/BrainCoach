// Break window: opened by the service worker as a small always-on-top pop-up window, so the prompt
// appears whichever tab or app you're in. The web app owns the session; this page only relays choices.

const params = new URLSearchParams(location.search)
const $ = (id) => document.getElementById(id)

function show(mode) {
  for (const id of ['prompt', 'break', 'over']) $(id).hidden = id !== mode
  const focus = { prompt: 'accept', break: 'continue', over: 'back' }[mode]
  $(focus)?.focus()
}

function send(action) {
  chrome.runtime.sendMessage({ type: 'BREAK_WINDOW_ACTION', action })
}

// ── Prompt ──
const breakMinutes = Number(params.get('break') || 5)
$('planned').textContent = params.get('planned') || ''
$('task').textContent = params.get('task') || 'your task'
$('len').textContent = `${breakMinutes} ${breakMinutes === 1 ? 'minute' : 'minutes'}`
$('accept').textContent = `Take a ${breakMinutes}-min break`
$('accept').addEventListener('click', () => send('accept'))
$('dismiss').addEventListener('click', () => send('dismiss'))

// ── Countdown ──
let timer = null
function startCountdown(until, total) {
  show('break')
  clearInterval(timer)
  const tick = () => {
    const left = Math.max(0, until - Date.now())
    const s = Math.ceil(left / 1000)
    $('count').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    $('bar').style.width = `${total ? Math.min(100, (1 - left / total) * 100) : 0}%`
    if (left <= 0) clearInterval(timer)
  }
  tick()
  timer = setInterval(tick, 1000)
}
$('continue').addEventListener('click', () => send('continue'))
$('back').addEventListener('click', () => send('back'))

// The service worker switches this window between modes.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'BREAK_WINDOW_MODE') return
  if (message.mode === 'break') startCountdown(message.breakUntil, message.total)
  else show(message.mode)
})

const mode = params.get('mode') || 'prompt'
if (mode === 'break') startCountdown(Number(params.get('until')), breakMinutes * 60_000)
else show(mode)

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('prompt').hidden) send('dismiss')
})
