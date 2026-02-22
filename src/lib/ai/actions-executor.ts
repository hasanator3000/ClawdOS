import { withUser } from '@/lib/db'
import {
  createTask as createTaskRepo,
  completeTask as completeTaskRepo,
  reopenTask as reopenTaskRepo,
  deleteTask as deleteTaskRepo,
  updateTask as updateTaskRepo,
} from '@/lib/db/repositories/task.repository'
import {
  createNewsSource,
  deleteNewsSource,
} from '@/lib/db/repositories/news-source.repository'
import {
  createNewsTab,
  assignSourceToTab as assignSourceToTabRepo,
  findTabsByWorkspace,
} from '@/lib/db/repositories/news-tab.repository'

// Whitelisted navigation paths
const ALLOWED_PATHS = new Set([
  '/today',
  '/news',
  '/tasks',
  '/settings',
  '/settings/telegram',
  '/settings/password',
])

/**
 * Execute privileged actions (task mutations, news operations) on server under session + RLS
 * @returns Object with optional navigation target and array of action results
 */
export async function executeActions(
  actions: any[],
  userId: string,
  workspaceId: string | null
): Promise<{ navigation?: string; results: any[] }> {
  let navigationTarget: string | undefined
  const results: any[] = []

  // Track tab name→id for source-tab assignment within same batch
  const tabNameToId = new Map<string, string>()

  // Pre-load existing tabs so source.add can reference them
  if (workspaceId && actions.some((a) => a?.k === 'news.source.add' && a?.tabs?.length)) {
    try {
      const existingTabs = await withUser(userId, (client) =>
        findTabsByWorkspace(client, workspaceId)
      )
      for (const t of existingTabs) {
        tabNameToId.set(t.name.toLowerCase(), t.id)
      }
    } catch { /* ignore */ }
  }

  for (const action of actions) {
    const k = action?.k

    // Navigation: return target to client (non-privileged)
    if (k === 'navigate') {
      const to = String(action?.to || '')
      if (ALLOWED_PATHS.has(to)) {
        navigationTarget = to
        results.push({ action: 'navigate', to })
      }
    }

    // Task actions: execute on server with RLS
    if (k === 'task.create') {
      const title = String(action?.title || '').trim()
      if (!title) continue

      if (!workspaceId) {
        results.push({ action: 'task.create', error: 'No workspace' })
        continue
      }

      try {
        const task = await withUser(userId, async (client) => {
          return createTaskRepo(client, {
            title,
            description: action?.description ? String(action.description) : undefined,
            priority: typeof action?.priority === 'number' ? action.priority : undefined,
            workspaceId,
          })
        })

        results.push({ action: 'task.create', taskId: task.id, task })
      } catch (err) {
        results.push({ action: 'task.create', error: String(err) })
      }
    }

    if (k === 'task.complete') {
      const taskId = String(action?.taskId || '')
      if (!taskId) continue

      try {
        const task = await withUser(userId, async (client) => completeTaskRepo(client, taskId))
        results.push({ action: 'task.complete', taskId, task })
      } catch (err) {
        results.push({ action: 'task.complete', error: String(err) })
      }
    }

    if (k === 'task.reopen') {
      const taskId = String(action?.taskId || '')
      if (!taskId) continue

      try {
        const task = await withUser(userId, async (client) => reopenTaskRepo(client, taskId))
        results.push({ action: 'task.reopen', taskId, task })
      } catch (err) {
        results.push({ action: 'task.reopen', error: String(err) })
      }
    }

    if (k === 'task.delete') {
      const taskId = String(action?.taskId || '')
      if (!taskId) continue

      try {
        const ok = await withUser(userId, async (client) => deleteTaskRepo(client, taskId))
        results.push({ action: 'task.delete', taskId, success: Boolean(ok) })
      } catch (err) {
        results.push({ action: 'task.delete', error: String(err) })
      }
    }

    if (k === 'task.priority') {
      const taskId = String(action?.taskId || '')
      const priority = action?.priority
      if (!taskId || typeof priority !== 'number') continue

      // Validate priority range (0-4)
      if (priority < 0 || priority > 4 || !Number.isInteger(priority)) {
        results.push({ action: 'task.priority', error: 'Priority must be integer 0-4' })
        continue
      }

      try {
        const task = await withUser(userId, async (client) =>
          updateTaskRepo(client, taskId, { priority })
        )
        results.push({ action: 'task.priority', taskId, priority, task })
      } catch (err) {
        results.push({ action: 'task.priority', error: String(err) })
      }
    }

    // News actions — create source record fast (no inline validation/fetch)
    // The refresh cycle will validate and fetch items asynchronously.
    if (k === 'news.source.add') {
      const url = String(action?.url || '').trim()
      if (!url || !workspaceId) continue

      // Quick URL format check only (no network)
      try {
        const parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          results.push({ action: 'news.source.add', error: 'URL must use http or https' })
          continue
        }
      } catch {
        results.push({ action: 'news.source.add', error: 'Invalid URL format' })
        continue
      }

      try {
        const source = await withUser(userId, async (client) => {
          const s = await createNewsSource(client, { workspaceId, url, title: action?.title as string | undefined })

          // Assign to tabs by name (supports both newly created and existing tabs)
          const tabNames: string[] = Array.isArray(action?.tabs) ? action.tabs : []
          for (const tn of tabNames) {
            const tabId = tabNameToId.get(String(tn).toLowerCase())
            if (tabId) {
              await assignSourceToTabRepo(client, s.id, tabId)
            }
          }

          return s
        })
        results.push({ action: 'news.source.add', source })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('news_source_ws_url_uniq')) {
          results.push({ action: 'news.source.add', error: 'Source already added' })
        } else {
          results.push({ action: 'news.source.add', error: msg })
        }
      }
    }

    if (k === 'news.source.remove') {
      const sourceId = String(action?.sourceId || '')
      if (!sourceId) continue

      try {
        const ok = await withUser(userId, async (client) => deleteNewsSource(client, sourceId))
        results.push({ action: 'news.source.remove', sourceId, success: Boolean(ok) })
      } catch (err) {
        results.push({ action: 'news.source.remove', error: String(err) })
      }
    }

    if (k === 'news.tab.create') {
      const name = String(action?.name || '').trim()
      if (!name || !workspaceId) continue

      try {
        const tab = await withUser(userId, async (client) =>
          createNewsTab(client, { workspaceId, name })
        )
        tabNameToId.set(name.toLowerCase(), tab.id)
        results.push({ action: 'news.tab.create', tab })
      } catch (err) {
        results.push({ action: 'news.tab.create', error: String(err) })
      }
    }
  }

  return { navigation: navigationTarget, results }
}
