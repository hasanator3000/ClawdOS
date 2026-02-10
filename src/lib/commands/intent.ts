/**
 * Simple heuristic intent scorer for chat input disambiguation.
 * No external dependencies — pure function.
 *
 * Used by command handlers to resolve ambiguous inputs like
 * "покажи задачи где todo" (query, not navigation).
 */

export type Intent = {
  navigation: number // 0-100
  action: number // 0-100
  query: number // 0-100
}

const NAV_VERBS = ['открой', 'перейди', 'зайди', 'открыть', 'open', 'go', 'navigate', 'goto']
const ACTION_VERBS = [
  'создай',
  'добавь',
  'удали',
  'выполни',
  'заверши',
  'create',
  'add',
  'delete',
  'remove',
  'complete',
  'finish',
]
const QUERY_WORDS = [
  'покажи',
  'найди',
  'где',
  'какие',
  'сколько',
  'show',
  'find',
  'search',
  'filter',
  'list',
  'what',
  'how',
  'which',
]

export function scoreIntent(input: string): Intent {
  const lower = input.toLowerCase().trim()
  if (!lower) return { navigation: 33, action: 33, query: 34 }

  const words = lower.split(/\s+/)

  // Base scores (slight preference for query as default fallback)
  let nav = 20
  let act = 10
  let qry = 30

  for (const w of words) {
    if (NAV_VERBS.includes(w)) nav += 60
    if (ACTION_VERBS.includes(w)) act += 80
    if (QUERY_WORDS.includes(w)) qry += 50
  }

  // Short single-word inputs are likely navigation ("задачи" → /tasks)
  if (words.length === 1 && !ACTION_VERBS.includes(words[0]) && !QUERY_WORDS.includes(words[0])) {
    nav += 30
  }

  // Questions (ending with ?) lean toward query
  if (lower.endsWith('?')) {
    qry += 40
  }

  const total = nav + act + qry
  return {
    navigation: Math.round((nav / total) * 100),
    action: Math.round((act / total) * 100),
    query: Math.round((qry / total) * 100),
  }
}
