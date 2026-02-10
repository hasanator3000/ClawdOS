/**
 * Chat command handlers — single source of truth for fast-path command resolution.
 *
 * Replaces duplicated logic previously split between:
 * - useChat.ts (client fast-paths)
 * - /api/ai/chat/route.ts (server fast-paths)
 *
 * All handlers are pure functions (no DB/IO). They return a typed result
 * that the route handler interprets and executes.
 */

import { resolveSectionPath, sectionLabel } from '@/lib/nav/resolve'
import { scoreIntent } from './intent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TasksFilter = 'active' | 'completed' | 'all'

export type CommandResult =
  | { type: 'navigation'; target: string; label: string }
  | { type: 'task.create'; title: string }
  | { type: 'workspace.switch'; targetType: 'personal' | 'shared' }
  | { type: 'tasks.filter'; filter: TasksFilter }
  | { type: 'news.sources.open' }
  | { type: 'news.search'; query: string }

export interface CommandContext {
  workspaceId: string | null
  workspaceName: string | null
  currentPage: string
}

interface Match {
  result: CommandResult
  confidence: number
}

interface CommandHandler {
  name: string
  match(input: string, ctx: CommandContext): Match | null
}

// ---------------------------------------------------------------------------
// Whitelisted navigation paths
// ---------------------------------------------------------------------------

const ALLOWED_PATHS = new Set([
  '/today',
  '/news',
  '/tasks',
  '/settings',
  '/settings/telegram',
  '/settings/password',
])

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// --- Task creation ---

function extractTaskTitle(message: string): string | null {
  const m = message.trim()

  // RU: "создай задачу X", "добавь таск X", "создай новую задачу X", "добавь общий таск X"
  // Allow qualifiers (new/personal/shared) in any order, multiple times
  const ru = m.match(
    /^(создай|добавь)\s+(?:нов[уюый][юе]?\s+|личн\S*\s+|общ\S*\s+)*(задач[уиае]?|таск[аиу]?)\s*[:\-—]?\s*(.+)$/i
  )
  if (ru?.[3]) return ru[3].trim().replace(/^"|"$/g, '')

  // EN: "create task X", "add a task X", "create new task X", "add shared task X"
  // Allow qualifiers (new/a/shared/personal/my) in any order, multiple times
  const en = m.match(/^(create|add)\s+(?:a\s+|new\s+|shared\s+|personal\s+|my\s+)*task\s*[:\-—]?\s*(.+)$/i)
  if (en?.[2]) return en[2].trim().replace(/^"|"$/g, '')

  return null
}

const taskCreateHandler: CommandHandler = {
  name: 'task.create',
  match(input) {
    const title = extractTaskTitle(input)
    if (!title) return null
    return { result: { type: 'task.create', title }, confidence: 95 }
  },
}

// --- Workspace switch ---

function detectWorkspaceType(input: string): 'personal' | 'shared' | null {
  const s = input.toLowerCase().trim()

  // Must contain a task-related word
  if (!/задач|таск|tasks?/i.test(s)) return null

  if (/личн|персональн|мои\s|my\s|personal/i.test(s)) return 'personal'
  if (/общ|шаред|командн|shared|team/i.test(s)) return 'shared'

  return null
}

const workspaceSwitchHandler: CommandHandler = {
  name: 'workspace.switch',
  match(input) {
    // If this is clearly an action (создай, добавь, etc.), skip workspace switch
    // e.g. "добавь общий таск 123" should be task.create, not workspace.switch
    const intent = scoreIntent(input)
    if (intent.action > 50) return null

    const targetType = detectWorkspaceType(input)
    if (!targetType) return null
    return { result: { type: 'workspace.switch', targetType }, confidence: 90 }
  },
}

// --- Tasks filter ---

function detectTasksFilter(message: string): TasksFilter | null {
  const m = message.toLowerCase().trim()

  if (/(выполнен|сделан|completed)/.test(m)) return 'completed'
  if (/(активн|текущ|active)/.test(m)) return 'active'
  if (/(все|all)/.test(m) && /(таск|задач|tasks?)/.test(m)) return 'all'

  return null
}

const taskFilterHandler: CommandHandler = {
  name: 'tasks.filter',
  match(input) {
    const filter = detectTasksFilter(input)
    if (!filter) return null

    // Intent scorer: if action intent dominates, this is a task mutation, not a filter
    // e.g. "пометь задачу тест как выполненную" → action, not "show completed"
    const intent = scoreIntent(input)
    if (intent.action > 40) return null

    const confidence = intent.query > 60 ? 60 : 80

    return { result: { type: 'tasks.filter', filter }, confidence }
  },
}

// --- News sources panel ---

const newsSourcesHandler: CommandHandler = {
  name: 'news.sources.open',
  match(input) {
    const m = input.toLowerCase().trim()
    if (
      /(источник|source|rss|фид|feeds?|подписк)/.test(m) &&
      /(открой|покажи|настро|manage|open|show|мои|my|list|список)/.test(m)
    ) {
      return { result: { type: 'news.sources.open' }, confidence: 85 }
    }
    // Direct: "настройки новостей", "news settings"
    if (/настройк\S*\s+новост|news\s+settings/i.test(m)) {
      return { result: { type: 'news.sources.open' }, confidence: 85 }
    }
    return null
  },
}

// --- Navigation ---

const navigationHandler: CommandHandler = {
  name: 'navigation',
  match(input) {
    const target = resolveSectionPath(input)
    if (!target || !ALLOWED_PATHS.has(target)) return null

    const label = sectionLabel(target)

    // Intent scorer: if action intent dominates, skip navigation
    const intent = scoreIntent(input)
    if (intent.action > 50) return null

    const confidence = intent.navigation > 50 ? 85 : 70

    return { result: { type: 'navigation', target, label }, confidence }
  },
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const CONFIDENCE_THRESHOLD = 70

/**
 * Handlers ordered by specificity (most specific first).
 * Task creation must come before navigation so "создай задачу X" isn't
 * parsed as navigation to /tasks.
 */
const handlers: CommandHandler[] = [
  taskCreateHandler, // "создай задачу X" → 95
  workspaceSwitchHandler, // "открой личные задачи" → 90
  newsSourcesHandler, // "мои источники" → 85
  taskFilterHandler, // "покажи выполненные" → 80
  navigationHandler, // "задачи" → 85
]

/**
 * Resolve a chat message to a fast-path command.
 * Returns null when no handler matches → LLM fallback.
 */
export function resolveCommand(input: string, ctx: CommandContext): CommandResult | null {
  if (!input?.trim()) return null

  let best: Match | null = null

  for (const handler of handlers) {
    const match = handler.match(input, ctx)
    if (match && match.confidence >= CONFIDENCE_THRESHOLD) {
      if (!best || match.confidence > best.confidence) {
        best = match
      }
    }
  }

  return best?.result ?? null
}
