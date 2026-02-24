'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { validateAction } from '@/lib/validation'
import { addSourceSchema, createTabSchema, reorderTabsSchema, uuidSchema } from '@/lib/validation-schemas'
import {
  createNewsSource,
  deleteNewsSource,
  updateSourceStatus,
  findSourceById,
  findSourcesByWorkspace,
} from '@/lib/db/repositories/news-source.repository'
import {
  createNewsTab,
  deleteNewsTab,
  reorderTabs as reorderTabsRepo,
  assignSourceToTab as assignRepo,
  removeSourceFromTab as removeAssignRepo,
  findTabsByWorkspace,
} from '@/lib/db/repositories/news-tab.repository'
import { validateFeedUrl } from '@/lib/rss/validator'
import { fetchLiveFeeds, invalidateFeedCache } from '@/lib/rss/live'

export async function addSource(url: string, tabIds?: string[]) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const v = validateAction(addSourceSchema, { url, tabIds })
  if (v.error) return { error: v.error }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected' }

  // Validate feed URL first (outside transaction — network I/O)
  const validation = await validateFeedUrl(url)
  if (!validation.valid) {
    return { error: validation.error || 'Invalid feed URL' }
  }

  try {
    const result = await withUser(session.userId, async (client) => {
      // Create source record
      const source = await createNewsSource(client, {
        workspaceId: workspace.id,
        url,
        title: validation.feedTitle || undefined,
        feedType: validation.feedType || undefined,
      })

      // Assign to tabs if requested
      if (tabIds?.length) {
        for (const tabId of tabIds) {
          await assignRepo(client, source.id, tabId)
        }
      }

      return { source }
    })

    revalidatePath('/news')
    return result
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to add source'
    // Duplicate URL
    if (msg.includes('news_source_ws_url_uniq')) {
      return { error: 'This source URL is already added' }
    }
    return { error: msg }
  }
}

export async function removeSource(sourceId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, sourceId)
  if (idV.error) return { error: 'Invalid source ID' }

  try {
    const deleted = await withUser(session.userId, (client) => deleteNewsSource(client, sourceId))
    if (!deleted) return { error: 'Source not found' }

    revalidatePath('/news')
    return { success: true }
  } catch {
    return { error: 'Failed to remove source' }
  }
}

export async function toggleSource(sourceId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, sourceId)
  if (idV.error) return { error: 'Invalid source ID' }

  try {
    const source = await withUser(session.userId, async (client) => {
      const existing = await findSourceById(client, sourceId)
      if (!existing) return null

      const newStatus = existing.status === 'active' ? 'paused' : 'active'
      return updateSourceStatus(client, sourceId, newStatus)
    })

    if (!source) return { error: 'Source not found' }

    revalidatePath('/news')
    return { source }
  } catch {
    return { error: 'Failed to toggle source' }
  }
}

export async function createTab(name: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const v = validateAction(createTabSchema, name)
  if (v.error) return { error: v.error }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected' }

  try {
    const tab = await withUser(session.userId, (client) =>
      createNewsTab(client, { workspaceId: workspace.id, name })
    )

    revalidatePath('/news')
    return { tab }
  } catch {
    return { error: 'Failed to create tab' }
  }
}

export async function deleteTab(tabId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, tabId)
  if (idV.error) return { error: 'Invalid tab ID' }

  try {
    const deleted = await withUser(session.userId, (client) => deleteNewsTab(client, tabId))
    if (!deleted) return { error: 'Tab not found' }

    revalidatePath('/news')
    return { success: true }
  } catch {
    return { error: 'Failed to delete tab' }
  }
}

export async function reorderTabs(tabIds: string[]) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const v = validateAction(reorderTabsSchema, tabIds)
  if (v.error) return { error: v.error }

  try {
    await withUser(session.userId, (client) => reorderTabsRepo(client, tabIds))

    revalidatePath('/news')
    return { success: true }
  } catch {
    return { error: 'Failed to reorder tabs' }
  }
}

export async function assignSourceToTab(sourceId: string, tabId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const sv = validateAction(uuidSchema, sourceId)
  if (sv.error) return { error: 'Invalid source ID' }
  const tv = validateAction(uuidSchema, tabId)
  if (tv.error) return { error: 'Invalid tab ID' }

  try {
    await withUser(session.userId, (client) => assignRepo(client, sourceId, tabId))

    revalidatePath('/news')
    return { success: true }
  } catch {
    return { error: 'Failed to assign source to tab' }
  }
}

export async function removeSourceFromTab(sourceId: string, tabId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const sv = validateAction(uuidSchema, sourceId)
  if (sv.error) return { error: 'Invalid source ID' }
  const tv = validateAction(uuidSchema, tabId)
  if (tv.error) return { error: 'Invalid tab ID' }

  try {
    await withUser(session.userId, (client) => removeAssignRepo(client, sourceId, tabId))

    revalidatePath('/news')
    return { success: true }
  } catch {
    return { error: 'Failed to remove source from tab' }
  }
}

export async function refreshNews() {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized', items: [] }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected', items: [] }

  try {
    // Invalidate cache so we get fresh data
    invalidateFeedCache()
    const sources = await withUser(session.userId, (client) =>
      findSourcesByWorkspace(client, workspace.id)
    )
    const items = await fetchLiveFeeds(sources)
    return { items }
  } catch {
    return { error: 'Failed to refresh feeds', items: [] }
  }
}

export async function getSources() {
  const session = await getSession()
  if (!session.userId) return { sources: [] }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { sources: [] }

  const sources = await withUser(session.userId, (client) =>
    findSourcesByWorkspace(client, workspace.id)
  )

  return { sources }
}

export async function getTabs() {
  const session = await getSession()
  if (!session.userId) return { tabs: [] }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { tabs: [] }

  const tabs = await withUser(session.userId, (client) =>
    findTabsByWorkspace(client, workspace.id)
  )

  return { tabs }
}
