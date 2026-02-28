'use server'

import { revalidatePath } from 'next/cache'
import { bumpRevision } from '@/lib/revision-store'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { validateAction } from '@/lib/validation'
import { setupNewsTopicsSchema } from '@/lib/validation-schemas'
import { createNewsSource } from '@/lib/db/repositories/news-source.repository'
import {
  createNewsTab,
  assignSourceToTab as assignRepo,
} from '@/lib/db/repositories/news-tab.repository'

const log = createLogger('news-setup')

const SETUP_SYSTEM_PROMPT = `You are an RSS feed configuration assistant.
Given user's topic preferences, return a JSON object with tabs and RSS sources.

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, no code fences, no text before or after.

Format:
{"tabs":[{"name":"Short Tab Name","sources":[{"url":"https://full-rss-url/feed","title":"Source Name"}]}]}

Rules:
- Create 1 tab per distinct topic the user mentioned
- Add 3-6 real, working RSS/Atom/JSON feed URLs per tab
- Tab names: short, 1-2 words, English
- Only use URLs you are confident are real RSS feeds (ending in /rss, /feed, .xml, etc.)
- Never invent fake URLs

Known working RSS feeds (prefer these when relevant):
AI/ML: https://openai.com/blog/rss.xml, https://www.technologyreview.com/topic/artificial-intelligence/feed, https://www.deeplearning.ai/the-batch/feed/, https://huggingface.co/blog/feed.xml, https://magazine.sebastianraschka.com/feed
Tech: https://news.ycombinator.com/rss, https://techcrunch.com/feed/, https://www.theverge.com/rss/index.xml, https://feeds.arstechnica.com/arstechnica/index, https://www.wired.com/feed/rss
Crypto: https://www.coindesk.com/arc/outboundfeeds/rss/, https://cointelegraph.com/rss, https://www.theblock.co/rss.xml, https://decrypt.co/feed, https://bitcoinmagazine.com/feed
Russian: https://www.kommersant.ru/RSS/news.xml, https://rssexport.rbc.ru/rbcnews/news/30/full.rss, https://www.vedomosti.ru/rss/news, https://meduza.io/rss/all, https://tass.ru/rss/v2.xml, https://lenta.ru/rss
Economy: https://feeds.bloomberg.com/markets/news.rss, https://feeds.a.dj.com/rss/RSSMarketsMain.xml, https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline
Science: https://rss.sciencedaily.com/all.xml, https://www.nature.com/nature.rss, https://www.newscientist.com/feed/home
Health: https://rss.medicalnewstoday.com/newsfeeds.xml, https://tools.cdc.gov/api/v2/resources/media/132608.rss
Environment: https://grist.org/feed/, https://e360.yale.edu/feed.xml
Gaming: https://kotaku.com/rss, https://www.ign.com/articles.rss, https://www.gamespot.com/feeds/mashup/
Space: https://www.nasa.gov/rss/dyn/breaking_news.rss, https://spacenews.com/feed/, https://www.space.com/feeds/all
Design: https://feeds.feedburner.com/SmashingMagazine, https://alistapart.com/main/feed/
Startups: https://feeds.feedburner.com/venturebeat/SZYF, https://www.producthunt.com/feed

You can also suggest feeds beyond this catalog based on your knowledge.`

interface SetupConfig {
  tabs: Array<{
    name: string
    sources: Array<{ url: string; title: string }>
  }>
}

export async function setupNewsTopics(userTopics: string) {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected' }

  const tv = validateAction(setupNewsTopicsSchema, userTopics)
  if (tv.error) return { error: tv.error }
  const input = userTopics.trim()

  // 1. Ask Clawdbot for RSS config
  const gatewayUrl = process.env.CLAWDBOT_URL || 'http://127.0.0.1:18789'
  const gatewayToken = process.env.CLAWDBOT_TOKEN
  if (!gatewayToken) return { error: 'AI service not configured' }

  let config: SetupConfig
  try {
    const upstream = await fetch(`${gatewayUrl.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'clawdbot',
        stream: false,
        messages: [
          { role: 'system', content: SETUP_SYSTEM_PROMPT },
          { role: 'user', content: input },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!upstream.ok) {
      return { error: 'AI service unavailable' }
    }

    const json = await upstream.json()
    const raw = json.choices?.[0]?.message?.content?.trim() || ''

    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    config = JSON.parse(cleaned) as SetupConfig
  } catch (err) {
    log.error('setupNewsTopics LLM error', { error: err instanceof Error ? err.message : String(err) })
    return { error: 'Failed to generate feed configuration' }
  }

  // 2. Validate structure
  if (!Array.isArray(config?.tabs) || config.tabs.length === 0) {
    return { error: 'AI returned invalid configuration' }
  }

  // 3. Create tabs + sources in DB
  try {
    await withUser(session.userId, async (client) => {
      for (const tab of config.tabs) {
        const tabName = String(tab.name || '').trim()
        if (!tabName) continue

        const createdTab = await createNewsTab(client, { workspaceId: workspace.id, name: tabName })

        const sources = Array.isArray(tab.sources) ? tab.sources : []
        for (const feed of sources) {
          const url = String(feed.url || '').trim()
          if (!url) continue

          // Quick URL validation
          try {
            const parsed = new URL(url)
            if (!['http:', 'https:'].includes(parsed.protocol)) continue
          } catch { continue }

          try {
            const source = await createNewsSource(client, {
              workspaceId: workspace.id,
              url,
              title: feed.title || undefined,
            })
            await assignRepo(client, source.id, createdTab.id)
          } catch (err) {
            // Skip duplicates
            const msg = err instanceof Error ? err.message : ''
            if (!msg.includes('news_source_ws_url_uniq')) throw err
          }
        }
      }
    })

    revalidatePath('/news')
    bumpRevision('news')
    return { success: true, topicCount: config.tabs.length }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Setup failed'
    return { error: msg }
  }
}
