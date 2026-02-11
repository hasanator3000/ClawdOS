'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
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
import { findNewsByWorkspace, type FindNewsOptions } from '@/lib/db/repositories/news.repository'
import { validateFeedUrl } from '@/lib/rss/validator'
import { fetchSource, refreshStaleSources } from '@/lib/rss/fetcher'

// ---------------------------------------------------------------------------
// Source management
// ---------------------------------------------------------------------------

export async function addSource(url: string, tabIds?: string[]) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

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

      // Initial fetch to populate items
      const fetchResult = await fetchSource(client, source, workspace.id)

      return { source, fetchResult }
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

  try {
    const deleted = await withUser(session.userId, (client) => deleteNewsSource(client, sourceId))
    if (!deleted) return { error: 'Source not found' }

    revalidatePath('/news')
    return { success: true }
  } catch (error) {
    return { error: 'Failed to remove source' }
  }
}

export async function toggleSource(sourceId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

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
  } catch (error) {
    return { error: 'Failed to toggle source' }
  }
}

// ---------------------------------------------------------------------------
// Tab management
// ---------------------------------------------------------------------------

export async function createTab(name: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected' }

  try {
    const tab = await withUser(session.userId, (client) =>
      createNewsTab(client, { workspaceId: workspace.id, name })
    )

    revalidatePath('/news')
    return { tab }
  } catch (error) {
    return { error: 'Failed to create tab' }
  }
}

export async function deleteTab(tabId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  try {
    const deleted = await withUser(session.userId, (client) => deleteNewsTab(client, tabId))
    if (!deleted) return { error: 'Tab not found' }

    revalidatePath('/news')
    return { success: true }
  } catch (error) {
    return { error: 'Failed to delete tab' }
  }
}

export async function reorderTabs(tabIds: string[]) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  try {
    await withUser(session.userId, (client) => reorderTabsRepo(client, tabIds))

    revalidatePath('/news')
    return { success: true }
  } catch (error) {
    return { error: 'Failed to reorder tabs' }
  }
}

export async function assignSourceToTab(sourceId: string, tabId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  try {
    await withUser(session.userId, (client) => assignRepo(client, sourceId, tabId))

    revalidatePath('/news')
    return { success: true }
  } catch (error) {
    return { error: 'Failed to assign source to tab' }
  }
}

export async function removeSourceFromTab(sourceId: string, tabId: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  try {
    await withUser(session.userId, (client) => removeAssignRepo(client, sourceId, tabId))

    revalidatePath('/news')
    return { success: true }
  } catch (error) {
    return { error: 'Failed to remove source from tab' }
  }
}

// ---------------------------------------------------------------------------
// Feed operations
// ---------------------------------------------------------------------------

export async function refreshNews() {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected' }

  try {
    const results = await withUser(session.userId, (client) =>
      refreshStaleSources(client, workspace.id, 15)
    )

    revalidatePath('/news')
    return { results }
  } catch (error) {
    return { error: 'Failed to refresh sources' }
  }
}

export async function loadMoreNews(
  cursor: string,
  cursorId: string,
  tabId?: string,
  search?: string
) {
  const session = await getSession()
  if (!session.userId) return { items: [] }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { items: [] }

  const opts: FindNewsOptions = { limit: 30, cursor, cursorId }
  if (tabId) opts.tabId = tabId
  if (search) opts.search = search

  const items = await withUser(session.userId, (client) =>
    findNewsByWorkspace(client, workspace.id, opts)
  )

  return { items }
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

// ---------------------------------------------------------------------------
// Quick setup — deterministic topic-based feed configuration
// ---------------------------------------------------------------------------

const TOPIC_CATALOG: Record<string, { label: string; sources: Array<{ url: string; title: string }> }> = {
  ai: {
    label: 'AI',
    sources: [
      { url: 'https://openai.com/blog/rss.xml', title: 'OpenAI Blog' },
      { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', title: 'MIT Tech Review AI' },
      { url: 'https://www.deeplearning.ai/the-batch/feed/', title: 'The Batch' },
      { url: 'https://huggingface.co/blog/feed.xml', title: 'Hugging Face Blog' },
      { url: 'https://magazine.sebastianraschka.com/feed', title: 'Sebastian Raschka' },
    ],
  },
  crypto: {
    label: 'Crypto',
    sources: [
      { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', title: 'CoinDesk' },
      { url: 'https://cointelegraph.com/rss', title: 'Cointelegraph' },
      { url: 'https://www.theblock.co/rss.xml', title: 'The Block' },
      { url: 'https://decrypt.co/feed', title: 'Decrypt' },
      { url: 'https://bitcoinmagazine.com/feed', title: 'Bitcoin Magazine' },
    ],
  },
  tech: {
    label: 'Tech',
    sources: [
      { url: 'https://news.ycombinator.com/rss', title: 'Hacker News' },
      { url: 'https://techcrunch.com/feed/', title: 'TechCrunch' },
      { url: 'https://www.theverge.com/rss/index.xml', title: 'The Verge' },
      { url: 'https://feeds.arstechnica.com/arstechnica/index', title: 'Ars Technica' },
      { url: 'https://www.wired.com/feed/rss', title: 'Wired' },
    ],
  },
  russian: {
    label: 'Russian',
    sources: [
      { url: 'https://www.kommersant.ru/RSS/news.xml', title: 'Коммерсантъ' },
      { url: 'https://rssexport.rbc.ru/rbcnews/news/30/full.rss', title: 'РБК' },
      { url: 'https://www.vedomosti.ru/rss/news', title: 'Ведомости' },
      { url: 'https://meduza.io/rss/all', title: 'Медуза' },
      { url: 'https://tass.ru/rss/v2.xml', title: 'ТАСС' },
      { url: 'https://lenta.ru/rss', title: 'Лента.ру' },
    ],
  },
  economy: {
    label: 'Economy',
    sources: [
      { url: 'https://feeds.bloomberg.com/markets/news.rss', title: 'Bloomberg' },
      { url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', title: 'WSJ Markets' },
      { url: 'https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline', title: 'Investopedia' },
    ],
  },
}

export function getTopicCatalog() {
  return Object.entries(TOPIC_CATALOG).map(([key, val]) => ({
    key,
    label: val.label,
    sourceCount: val.sources.length,
  }))
}

export async function setupNewsTopics(topicKeys: string[]) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected' }

  const topics = topicKeys
    .map((k) => ({ key: k, ...TOPIC_CATALOG[k] }))
    .filter((t) => t.sources)

  if (topics.length === 0) return { error: 'No valid topics selected' }

  try {
    await withUser(session.userId, async (client) => {
      for (const topic of topics) {
        // Create tab
        const tab = await createNewsTab(client, { workspaceId: workspace.id, name: topic.label })

        // Create sources and assign to tab
        for (const feed of topic.sources) {
          try {
            const source = await createNewsSource(client, {
              workspaceId: workspace.id,
              url: feed.url,
              title: feed.title,
            })
            await assignRepo(client, source.id, tab.id)
          } catch (err) {
            // Skip duplicates silently
            const msg = err instanceof Error ? err.message : ''
            if (!msg.includes('news_source_ws_url_uniq')) throw err
          }
        }
      }
    })

    // Fetch feeds (outside the main transaction — network I/O)
    await withUser(session.userId, (client) =>
      refreshStaleSources(client, workspace.id, 0)
    )

    revalidatePath('/news')
    return { success: true, topicCount: topics.length }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Setup failed'
    return { error: msg }
  }
}
