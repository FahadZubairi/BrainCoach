import { evaluateTabRemote } from './api.js'
import { hostOf, isAppUrl } from './state.js'

// Tab classification, fastest first:
//   1. local special cases (BrainCoach itself, browser pages, sites you allowed)      → instant
//   2. the backend's rule lists (downloaded once per session into session.rules)       → instant
//   3. the backend (keyword profile, then Gemini for ambiguous sites), cached per tab  → ~0.2–4 s
// quickVerdict() covers 1–2 synchronously so the badge and app update the moment you switch tabs.

const remoteCache = new Map() // `${host}|${title}` → verdict; fine to lose when the worker restarts

function hostMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`)
}

function taskWords(task, stopwords) {
  const stop = new Set(stopwords)
  return task.toLowerCase().split(/[^a-z0-9.+#-]+/).filter((w) => w.length > 2 && !stop.has(w))
}

/** Synchronous verdict from local knowledge, or null if the backend needs to decide. */
export function quickVerdict(tab, session) {
  const url = tab.url
  const host = hostOf(url)

  if (isAppUrl(url)) return { relevant: true, reason: 'BrainCoach', neutral: true }
  if (!/^https?:/.test(url)) return { relevant: true, reason: 'Browser page', neutral: true }
  if ((session.allowedHosts || []).includes(host)) return { relevant: true, reason: 'You marked this as part of your task' }

  const cached = remoteCache.get(`${host}|${tab.title}`)
  if (cached) return cached

  const rules = session.rules
  if (!rules) return null
  const title = (tab.title || '').toLowerCase()
  const haystack = `${url} ${tab.title || ''}`.toLowerCase()
  const words = taskWords(session.taskDescription || '', rules.stopwords || [])
  const mentionsTask = words.some((w) => title.includes(w))

  if (rules.alwaysRelevant.some((d) => hostMatches(host, d))) return { relevant: true, reason: 'Work tool' }
  if (rules.distracting.some((d) => hostMatches(host, d)) && !mentionsTask) {
    return { relevant: false, reason: `${host} is usually a distraction` }
  }
  const allowed = session.profile?.allowedKeywords || []
  const forbidden = session.profile?.forbiddenCategories || []
  if ([...allowed, ...words].some((kw) => kw && haystack.includes(String(kw).toLowerCase()))) {
    return { relevant: true, reason: 'Matches your task' }
  }
  if (forbidden.some((kw) => kw && haystack.includes(String(kw).toLowerCase()))) {
    return { relevant: false, reason: 'Outside your task profile' }
  }
  return null
}

/** Asks the backend. Never throws: if it can't decide, the tab counts as on task. */
export async function remoteVerdict(tab, session) {
  const key = `${hostOf(tab.url)}|${tab.title}`
  try {
    const data = await evaluateTabRemote(session, tab)
    const verdict = { relevant: !!data.relevant, reason: data.reason || '', neutral: !!data.neutral }
    // A "couldn't classify" answer isn't cached, so the next switch to this tab asks again.
    if (!verdict.neutral) remoteCache.set(key, verdict)
    if (remoteCache.size > 500) remoteCache.clear()
    return verdict
  } catch (err) {
    console.warn('BrainCoach: could not classify tab, assuming on task', err)
    return { relevant: true, reason: 'Could not reach BrainCoach', neutral: true }
  }
}

export function forgetHost(host) {
  for (const key of [...remoteCache.keys()]) if (key.startsWith(`${host}|`)) remoteCache.delete(key)
}
