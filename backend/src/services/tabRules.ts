import type { TabRules, TabVerdict } from '../../../shared/api'

// Single source of truth for fast, non-AI tab classification. The extension downloads these rules
// (GET /coach/tab-rules) so it can judge obvious sites instantly without a network round-trip.

export const TAB_RULES: TabRules = {
  alwaysRelevant: [
    'localhost', '127.0.0.1', 'github.com', 'gitlab.com', 'stackoverflow.com', 'stackexchange.com',
    'developer.mozilla.org', 'docs.google.com', 'notion.so', 'figma.com', 'chatgpt.com', 'claude.ai',
    'gemini.google.com', 'scholar.google.com', 'wikipedia.org', 'overleaf.com', 'npmjs.com', 'vercel.com',
    'aws.amazon.com', 'cloud.google.com', 'learn.microsoft.com',
  ],
  distracting: [
    'youtube.com', 'youtu.be', 'reddit.com', 'twitter.com', 'x.com', 'instagram.com', 'facebook.com',
    'tiktok.com', 'netflix.com', 'twitch.tv', 'primevideo.com', 'disneyplus.com', 'hulu.com',
    '9gag.com', 'pinterest.com', 'snapchat.com', 'discord.com', 'web.whatsapp.com', 'messenger.com',
    'amazon.com', 'ebay.com', 'aliexpress.com', 'daraz.pk', 'espn.com', 'espncricinfo.com', 'cricbuzz.com',
    'store.steampowered.com',
  ],
  stopwords: ['the', 'and', 'for', 'with', 'from', 'into', 'this', 'that', 'page', 'build', 'make', 'work', 'on', 'my', 'a', 'an', 'to', 'of', 'in'],
}

const STOPWORDS = new Set(TAB_RULES.stopwords)

// Exact host or any subdomain of it — so 'x.com' doesn't match 'dropbox.com'.
export function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`)
}

export function keywordsFromTask(task: string): string[] {
  return task.toLowerCase().split(/[^a-z0-9.+#-]+/).filter(w => w.length > 2 && !STOPWORDS.has(w))
}

export function hostOf(url: string) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
}

/**
 * Rule-based verdict (no AI). Returns null when the rules can't decide and the AI should be asked.
 * Mirrored in extensions/lib/classify.js, which receives the same lists from TAB_RULES.
 */
export function quickTabVerdict(input: {
  tabTitle: string
  tabUrl: string
  taskDescription: string
  allowedKeywords: string[]
  forbiddenCategories: string[]
}): TabVerdict | null {
  const host = hostOf(input.tabUrl)
  const title = input.tabTitle.toLowerCase()
  const haystack = `${input.tabUrl} ${input.tabTitle}`.toLowerCase()
  const taskWords = keywordsFromTask(input.taskDescription)
  // Content on a usually-distracting site can still be on task (a YouTube tutorial on the exact topic).
  const mentionsTask = taskWords.some(w => title.includes(w))

  if (TAB_RULES.alwaysRelevant.some(d => hostMatches(host, d))) return { relevant: true, reason: 'Work tool' }
  if (TAB_RULES.distracting.some(d => hostMatches(host, d)) && !mentionsTask) {
    return { relevant: false, reason: `${host} is usually a distraction` }
  }
  if ([...input.allowedKeywords, ...taskWords].some(kw => kw && haystack.includes(kw.toLowerCase()))) {
    return { relevant: true, reason: 'Matches your task' }
  }
  if (input.forbiddenCategories.some(kw => kw && haystack.includes(kw.toLowerCase()))) {
    return { relevant: false, reason: 'Outside your task profile' }
  }
  return null
}
