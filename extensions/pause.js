// Friction screen shown in strict mode before an off-topic site.
// Research on "one sec"-style interventions (Grüning et al., PNAS 2023) found that a short, forced
// pause before opening a distracting app cut how often people opened it by more than half.

const WAIT_SECONDS = 10
const params = new URLSearchParams(location.search)
const url = params.get('url') || ''
const host = params.get('host') || ''

document.getElementById('host').textContent = host || 'this site'

chrome.storage.local.get('state', ({ state }) => {
  const session = state?.session
  if (session?.taskDescription) {
    document.getElementById('task').textContent = session.taskDescription
    document.getElementById('task-card').hidden = false
  }
  if (session?.intention) {
    document.getElementById('plan').textContent = `If I get distracted, then I will ${session.intention}.`
    document.getElementById('plan-card').hidden = false
  }
})

const count = document.getElementById('count')
const cue = document.getElementById('cue')
const allow = document.getElementById('allow')
const snooze = document.getElementById('snooze')

let left = WAIT_SECONDS
const timer = setInterval(() => {
  left -= 1
  count.textContent = String(Math.max(0, left))
  if (left === 6) cue.textContent = 'And slowly out…'
  if (left <= 0) {
    clearInterval(timer)
    cue.textContent = 'Still want to go? Your call.'
    allow.disabled = false
    snooze.disabled = false
  }
}, 1000)

document.getElementById('back').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'PAUSE_BACK_TO_WORK' })
})
allow.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'PAUSE_ALLOW', host, url })
})
snooze.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'PAUSE_SNOOZE', host, url })
})

document.getElementById('back').focus()
