import type { Skill, ToolContext, ToolResult } from './registry'
import { findDigestsByWorkspace } from '@/lib/db/repositories/digest.repository'
import { findNewsByWorkspace } from '@/lib/db/repositories/news.repository'

export const newsSkill: Skill = {
  id: 'news',
  name: 'News & Digest',
  description: 'Access news items and daily digests',
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
        'Get recent news items for the current workspace. Returns titles, URLs, topics, and summaries.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Maximum number of news items to return (default: 10)',
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

      const news = await findNewsByWorkspace(context.client, context.workspaceId, limit)

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
          })),
        },
      }
    },

    search_news: async (input: Record<string, unknown>, context: ToolContext): Promise<ToolResult> => {
      const query = String(input.query || '').toLowerCase()
      const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 10

      if (!query) {
        return { success: false, error: 'Search query is required' }
      }

      // Get all news and filter (simple search for now)
      const allNews = await findNewsByWorkspace(context.client, context.workspaceId, 100)

      const filtered = allNews
        .filter((n) => {
          const title = (n.title || '').toLowerCase()
          const summary = (n.summary || '').toLowerCase()
          return title.includes(query) || summary.includes(query)
        })
        .slice(0, limit)

      return {
        success: true,
        data: {
          query,
          count: filtered.length,
          items: filtered.map((n) => ({
            title: n.title,
            url: n.url,
            topic: n.topic,
            summary: n.summary,
            publishedAt: n.publishedAt,
          })),
        },
      }
    },
  },
}
