import { SECTIONS } from './sections'

const OPEN_VERBS_RE = /^(открой|перейди|зайди|открыть|open|go to|goto|navigate)\s+/i

// Action verbs that indicate a COMMAND, not navigation
// "создай задачу" = create task, NOT navigate to tasks
const ACTION_VERBS_RE = /^(создай|добавь|удали|выполни|заверши|create|add|delete|remove|complete|finish)\s+/i

function norm(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(OPEN_VERBS_RE, '')
    .replace(/[\u2014\u2013\-_:;,!.?()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
}

// Check if alias matches as a whole word (not substring of another word)
function matchesAsWord(text: string, word: string): boolean {
  const re = new RegExp(`(^|\\s)${escapeRegex(word)}($|\\s)`, 'i')
  return re.test(text)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length

  const dp = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) dp[j] = j

  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost)
      prev = tmp
    }
  }

  return dp[b.length]
}

/**
 * Resolve a user input into a known section path.
 * Designed to be fast and deterministic (no LLM).
 */
export function resolveSectionPath(input: string): string | null {
  const trimmed = input.trim()

  // IMPORTANT: If input starts with action verb, it's a COMMAND, not navigation
  // "создай задачу X" should NOT match /tasks
  if (ACTION_VERBS_RE.test(trimmed)) {
    return null
  }

  const m = norm(trimmed)
  if (!m) return null

  // Direct path
  if (m.startsWith('/')) {
    const direct = SECTIONS.find((s) => s.path === m)
    return direct?.path ?? null
  }

  // Exact matches first (highest priority)
  for (const s of SECTIONS) {
    if (m === s.title.toLowerCase()) return s.path
    if (m === s.id.toLowerCase()) return s.path
    for (const a of s.aliases) {
      const na = norm(a)
      if (m === na) return s.path
    }
  }

  // Word-boundary substring matches (e.g. "открой таски" → /tasks)
  // Only match if alias appears as a complete word, not as part of another word
  for (const s of SECTIONS) {
    for (const a of s.aliases) {
      const na = norm(a)
      if (na.length >= 4 && matchesAsWord(m, na)) return s.path
    }
  }

  // Fuzzy match for short inputs (typos)
  if (m.length <= 20) {
    let best: { path: string; score: number } | null = null

    for (const s of SECTIONS) {
      for (const a of [s.title, ...s.aliases]) {
        const na = norm(a)
        if (!na) continue
        const d = levenshtein(m, na)
        // Be conservative: only accept very close matches
        const threshold = Math.max(1, Math.floor(na.length * 0.2))
        if (d <= threshold) {
          if (!best || d < best.score) best = { path: s.path, score: d }
        }
      }
    }

    return best?.path ?? null
  }

  return null
}

export function sectionLabel(pathname: string): string {
  const s = SECTIONS.find((x) => x.path === pathname)
  return s?.title ?? pathname
}
