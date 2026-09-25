// Calls to the BrainCoach API with the extension-scoped token the web app handed us.
// That token only works on /coach/tab-rules, /coach/evaluate-tab and /sessions/:id/event.

async function call(session, path, init = {}) {
  const res = await fetch(`${session.apiBase}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, ...init.headers },
  })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.status === 204 ? null : res.json()
}

export function fetchTabRules(session) {
  return call(session, '/coach/tab-rules')
}

export function evaluateTabRemote(session, tab) {
  return call(session, '/coach/evaluate-tab', {
    method: 'POST',
    body: JSON.stringify({
      tabTitle: (tab.title || '').slice(0, 500),
      tabUrl: tab.url.slice(0, 2048),
      taskDescription: session.taskDescription,
      sessionProfile: session.profile,
    }),
  })
}

export async function logEvent(session, type, notes) {
  try {
    await call(session, `/sessions/${session.sessionId}/event`, { method: 'POST', body: JSON.stringify({ type, notes }) })
  } catch (err) {
    console.error('BrainCoach: failed to log event', err)
  }
}
