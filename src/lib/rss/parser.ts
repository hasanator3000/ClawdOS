import { XMLParser } from 'fast-xml-parser'

export interface FeedItem {
  title: string
  url: string | null
  summary: string | null
  imageUrl: string | null
  publishedAt: Date | null
  guid: string
}

export interface ParsedFeed {
  title: string | null
  feedType: 'rss' | 'atom' | 'json'
  items: FeedItem[]
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  isArray: (name) => ['item', 'entry'].includes(name),
})

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseFeed(raw: string, feedUrl: string): ParsedFeed {
  const trimmed = raw.trim()

  // JSON Feed detection
  if (trimmed.startsWith('{')) {
    return parseJsonFeed(trimmed, feedUrl)
  }

  const doc = xmlParser.parse(trimmed)

  // Atom: <feed>
  if (doc.feed) {
    return parseAtom(doc.feed, feedUrl)
  }

  // RSS 2.0: <rss><channel>
  if (doc.rss?.channel) {
    return parseRss(doc.rss.channel, feedUrl)
  }

  // RSS 1.0 / RDF
  if (doc['rdf:RDF']) {
    const rdf = doc['rdf:RDF']
    const channel = rdf.channel || rdf['rdf:channel'] || {}
    const items = rdf.item || []
    return {
      title: str(channel.title),
      feedType: 'rss',
      items: ensureArray(items).map((item: any) => rssItemToFeedItem(item, feedUrl)),
    }
  }

  throw new Error('Unrecognized feed format')
}

// ---------------------------------------------------------------------------
// RSS 2.0
// ---------------------------------------------------------------------------

function parseRss(channel: any, feedUrl: string): ParsedFeed {
  const items = ensureArray(channel.item || [])

  return {
    title: str(channel.title),
    feedType: 'rss',
    items: items.map((item: any) => rssItemToFeedItem(item, feedUrl)),
  }
}

function rssItemToFeedItem(item: any, feedUrl: string): FeedItem {
  const title = str(item.title) || 'Untitled'
  const link = str(item.link)
  const description = stripHtml(str(item.description) || str(item['content:encoded']))
  const pubDate = parseDate(str(item.pubDate))

  // GUID: prefer <guid>, fallback to link, fallback to title hash
  let guid = str(item.guid)
  if (typeof item.guid === 'object' && item.guid?.['#text']) {
    guid = item.guid['#text']
  }
  if (!guid) guid = link || hashGuid(title, feedUrl)

  return {
    title,
    url: link,
    summary: truncate(description, 500),
    imageUrl: extractImage(item),
    publishedAt: pubDate,
    guid,
  }
}

// ---------------------------------------------------------------------------
// Atom
// ---------------------------------------------------------------------------

function parseAtom(feed: any, feedUrl: string): ParsedFeed {
  const entries = ensureArray(feed.entry || [])

  return {
    title: str(feed.title),
    feedType: 'atom',
    items: entries.map((entry: any) => atomEntryToFeedItem(entry, feedUrl)),
  }
}

function atomEntryToFeedItem(entry: any, feedUrl: string): FeedItem {
  const title = str(entry.title) || 'Untitled'

  // Atom links can be objects or arrays
  let link: string | null = null
  const links = ensureArray(entry.link || [])
  for (const l of links) {
    if (typeof l === 'string') {
      link = l
      break
    }
    if (l?.['@_rel'] === 'alternate' || !l?.['@_rel']) {
      link = l['@_href'] || null
      break
    }
  }
  if (!link && links.length > 0) {
    const first = links[0]
    link = typeof first === 'string' ? first : first?.['@_href'] || null
  }

  const summary = stripHtml(
    str(entry.summary) || str(entry.content) || str(entry['content:encoded'])
  )
  const published = parseDate(str(entry.published) || str(entry.updated))
  const guid = str(entry.id) || link || hashGuid(title, feedUrl)

  return {
    title,
    url: link,
    summary: truncate(summary, 500),
    imageUrl: extractImage(entry),
    publishedAt: published,
    guid,
  }
}

// ---------------------------------------------------------------------------
// JSON Feed (https://jsonfeed.org/version/1.1)
// ---------------------------------------------------------------------------

function parseJsonFeed(raw: string, feedUrl: string): ParsedFeed {
  const data = JSON.parse(raw)
  const items = ensureArray(data.items || [])

  return {
    title: data.title || null,
    feedType: 'json',
    items: items.map((item: any) => {
      const title = item.title || 'Untitled'
      const url = item.url || item.external_url || null
      const summary = stripHtml(item.summary || item.content_text || item.content_html)
      const published = parseDate(item.date_published || item.date_modified)
      const guid = item.id || url || hashGuid(title, feedUrl)

      // JSON Feed image: item.image, item.banner_image, or first image attachment
      let imageUrl: string | null = item.image || item.banner_image || null
      if (!imageUrl && Array.isArray(item.attachments)) {
        const imgAttach = item.attachments.find(
          (a: any) => typeof a.mime_type === 'string' && a.mime_type.startsWith('image/')
        )
        if (imgAttach?.url) imageUrl = imgAttach.url
      }

      return {
        title,
        url,
        summary: truncate(summary, 500),
        imageUrl,
        publishedAt: published,
        guid,
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the best image URL from an RSS/Atom item.
 * Checks media:content, media:thumbnail, enclosure, and common patterns.
 */
function extractImage(item: any): string | null {
  if (!item || typeof item !== 'object') return null

  // media:content (can be object or array)
  const mediaContent = item['media:content'] || item['media:group']?.['media:content']
  if (mediaContent) {
    const entries = ensureArray(mediaContent)
    for (const mc of entries) {
      const url = mc?.['@_url']
      const medium = mc?.['@_medium']
      const type = mc?.['@_type'] || ''
      if (url && (medium === 'image' || type.startsWith('image/') || /\.(jpe?g|png|webp|gif)/i.test(url))) {
        return url
      }
    }
    // If only one media:content with a URL, assume it's the image
    if (entries.length === 1 && entries[0]?.['@_url']) {
      return entries[0]['@_url']
    }
  }

  // media:thumbnail
  const mediaThumbnail = item['media:thumbnail']
  if (mediaThumbnail) {
    const entries = ensureArray(mediaThumbnail)
    if (entries[0]?.['@_url']) return entries[0]['@_url']
  }

  // enclosure (RSS)
  const enclosure = item.enclosure
  if (enclosure) {
    const entries = ensureArray(enclosure)
    for (const enc of entries) {
      const type = enc?.['@_type'] || ''
      if (type.startsWith('image/') && enc?.['@_url']) {
        return enc['@_url']
      }
    }
  }

  // Atom: link[rel=enclosure] with image type
  const links = ensureArray(item.link || [])
  for (const l of links) {
    if (typeof l === 'object' && l?.['@_rel'] === 'enclosure') {
      const type = l?.['@_type'] || ''
      if (type.startsWith('image/') && l?.['@_href']) {
        return l['@_href']
      }
    }
  }

  return null
}

function str(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') return val.trim() || null
  if (typeof val === 'object' && '#text' in (val as any)) {
    return str((val as any)['#text'])
  }
  return String(val).trim() || null
}

function ensureArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val]
}

function parseDate(val: string | null): Date | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function stripHtml(html: string | null): string | null {
  if (!html) return null
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim() || null
}

function truncate(text: string | null, maxLen: number): string | null {
  if (!text) return null
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '\u2026'
}

function hashGuid(title: string, feedUrl: string): string {
  // Simple deterministic hash — no crypto needed, just dedup
  let hash = 0
  const str = `${feedUrl}:${title}`
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return `hash:${hash.toString(36)}`
}
