import type { Skill, ToolContext, ToolResult } from './registry'
import { findDigestsByWorkspace } from '@/lib/db/repositories/digest.repository'
import { findNewsByWorkspace } from '@/lib/db/repositories/news.repository'
import {
  findSourcesByWorkspace,
  createNewsSource,
  deleteNewsSource,
} from '@/lib/db/repositories/news-source.repository'
import {
  createNewsTab,
  findTabByName,
  assignSourceToTab,
} from '@/lib/db/repositories/news-tab.repository'
import { validateFeedUrl } from '@/lib/rss/validator'
import { fetchSource } from '@/lib/rss/fetcher'

export const newsSkill: Skill = {
  id: 'news',
  name: 'News & Digest',
  description: 'Access news items, manage RSS sources and tabs, daily digests',
  tools: [
    {
      name: 'get_today_digest',
      description:
        "Get today's digest summary for the current workspace. Returns the most recent digest with title and summary.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    {
      name: 'get_recent_digests',
      description:
        'Get recent digests for the current workspace. Returns a list of digests with dates and summaries.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of digests to return (default: 7)',
          },
        },
      },
    },
    {
      name: 'get_news_items',
      description:
        'Get recent news items for the current workspace. Returns titles, URLs, topics, summaries, and source names.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of news items to return (default: 10)',
          },
          tab_name: {
            type: 'string',
            description: 'Optional tab name to filter by (e.g. "Tech", "AI")',
          },
        },
      },
    },
    {
      name: 'search_news',
      description: 'Search news items by keyword in title or summary.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to match against news titles and summaries',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (default: 10)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'list_news_sources',
      description:
        'List all configured RSS news sources with their status (active/paused/error), URL, and title.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'add_news_source',
      description:
        'Add a new RSS/Atom/JSON feed source. Validates the URL first, then fetches initial items. Optionally assigns to a tab.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'RSS/Atom/JSON feed URL',
          },
          tab_name: {
            type: 'string',
            description: 'Optional tab name to assign this source to. Creates the tab if it does not exist.',
          },
        },
        required: ['url'],
      },
    },
    {
      name: 'remove_news_source',
      description: 'Remove a news source by its ID. Also removes all associated news items.',
      parameters: {
        type: 'object',
        properties: {
          source_id: {
            type: 'string',
            description: 'The UUID of the source to remove',
          },
        },
        required: ['source_id'],
      },
    },
  ],
  handlers: {
    get_today_digest: async (_input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const digests = await findDigestsByWorkspace(context.client, context.workspaceId, 1)

      if (digests.length === 0) {
        return {
          success: true,
          data: { message: 'No digest found for today.' },
        }
      }

      const digest = digests[0]
      return {
        success: true,
        data: {
          date: digest.date,
          title: digest.title,
          summary: digest.summary,
        },
      }
    },

    get_recent_digests: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 30) : 7

      const digests = await findDigestsByWorkspace(context.client, context.workspaceId, limit)

      return {
        success: true,
        data: {
          count: digests.length,
          digests: digests.map((d) => ({
            date: d.date,
            title: d.title,
            summary: d.summary,
          })),
        },
      }
    },

    get_news_items: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 10
      const tabName = typeof input.tab_name === 'string' ? input.tab_name : undefined

      let tabId: string | undefined
      if (tabName) {
        const tab = await findTabByName(context.client, context.workspaceId, tabName)
        if (tab) tabId = tab.id
      }

      const news = await findNewsByWorkspace(context.client, context.workspaceId, { limit, tabId })

      return {
        success: true,
        data: {
          count: news.length,
          items: news.map((n) => ({
            title: n.title,
            url: n.url,
            topic: n.topic,
            summary: n.summary,
            publishedAt: n.publishedAt,
            sourceName: n.sourceName,
          })),
        },
      }
    },

    search_news: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const query = String(input.query || '').trim()
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 10

      if (!query) {
        return { success: false, error: 'Search query is required' }
      }

      const news = await findNewsByWorkspace(context.client, context.workspaceId, {
        limit,
        search: query,
      })

      return {
        success: true,
        data: {
          query,
          count: news.length,
          items: news.map((n) => ({
            title: n.title,
            url: n.url,
            topic: n.topic,
            summary: n.summary,
            publishedAt: n.publishedAt,
            sourceName: n.sourceName,
          })),
        },
      }
    },

    list_news_sources: async (_input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const sources = await findSourcesByWorkspace(context.client, context.workspaceId)

      return {
        success: true,
        data: {
          count: sources.length,
          sources: sources.map((s) => ({
            id: s.id,
            title: s.title,
            url: s.url,
            feedType: s.feedType,
            status: s.status,
            errorMessage: s.errorMessage,
            lastFetchedAt: s.lastFetchedAt,
          })),
        },
      }
    },

    add_news_source: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const url = String(input.url || '').trim()
      if (!url) return { success: false, error: 'URL is required' }

      const tabName = typeof input.tab_name === 'string' ? input.tab_name.trim() : undefined

      // Validate feed
      const validation = await validateFeedUrl(url)
      if (!validation.valid) {
        return { success: false, error: validation.error || 'Invalid feed URL' }
      }

      try {
        const source = await createNewsSource(context.client, {
          workspaceId: context.workspaceId,
          url,
          title: validation.feedTitle || undefined,
          feedType: validation.feedType || undefined,
        })

        // Assign to tab if requested
        if (tabName) {
          let tab = await findTabByName(context.client, context.workspaceId, tabName)
          if (!tab) {
            tab = await createNewsTab(context.client, {
              workspaceId: context.workspaceId,
              name: tabName,
            })
          }
          await assignSourceToTab(context.client, source.id, tab.id)
        }

        // Initial fetch
        const fetchResult = await fetchSource(context.client, source, context.workspaceId)

        return {
          success: true,
          data: {
            source: {
              id: source.id,
              title: source.title || validation.feedTitle,
              url: source.url,
              feedType: source.feedType,
            },
            newItems: fetchResult.newItems,
            tab: tabName || null,
          },
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('news_source_ws_url_uniq')) {
          return { success: false, error: 'This source URL is already added' }
        }
        return { success: false, error: msg }
      }
    },

    remove_news_source: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const sourceId = String(input.source_id || '').trim()
      if (!sourceId) return { success: false, error: 'source_id is required' }

      const deleted = await deleteNewsSource(context.client, sourceId)
      if (!deleted) return { success: false, error: 'Source not found' }

      return { success: true, data: { sourceId, deleted: true } }
    },
  },
}
