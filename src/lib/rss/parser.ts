import { XMLParser } from 'fast-xml-parser'
import {
  type XmlNode,
  str,
  ensureArray,
  parseDate,
  decodeEntities,
  stripHtml,
  truncate,
  hashGuid,
  extractImage,
} from './parser-utils'

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
      items: (ensureArray(items) as XmlNode[]).map((item) => rssItemToFeedItem(item, feedUrl)),
    }
  }

  throw new Error('Unrecognized feed format')
}

// ---------------------------------------------------------------------------
// RSS 2.0
// ---------------------------------------------------------------------------

function parseRss(channel: XmlNode, feedUrl: string): ParsedFeed {
  const items = ensureArray(channel.item || []) as XmlNode[]

  return {
    title: str(channel.title),
    feedType: 'rss',
    items: items.map((item) => rssItemToFeedItem(item, feedUrl)),
  }
}

function rssItemToFeedItem(item: XmlNode, feedUrl: string): FeedItem {
  const title = decodeEntities(str(item.title)) || 'Untitled'
  const link = str(item.link)
  const description = stripHtml(str(item.description) || str(item['content:encoded']))
  const pubDate = parseDate(str(item.pubDate))

  // GUID: prefer <guid>, fallback to link, fallback to title hash
  let guid = str(item.guid)
  if (typeof item.guid === 'object' && item.guid !== null && '#text' in (item.guid as Record<string, unknown>)) {
    guid = (item.guid as Record<string, unknown>)['#text'] as string
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

function parseAtom(feed: XmlNode, feedUrl: string): ParsedFeed {
  const entries = ensureArray(feed.entry || []) as XmlNode[]

  return {
    title: str(feed.title),
    feedType: 'atom',
    items: entries.map((entry) => atomEntryToFeedItem(entry, feedUrl)),
  }
}

function atomEntryToFeedItem(entry: XmlNode, feedUrl: string): FeedItem {
  const title = decodeEntities(str(entry.title)) || 'Untitled'

  // Atom links can be objects or arrays
  let link: string | null = null
  const links = ensureArray(entry.link || []) as XmlNode[]
  for (const l of links) {
    if (typeof l === 'string') {
      link = l
      break
    }
    if (l?.['@_rel'] === 'alternate' || !l?.['@_rel']) {
      link = (l['@_href'] as string) || null
      break
    }
  }
  if (!link && links.length > 0) {
    const first = links[0]
    link = typeof first === 'string' ? first : (first?.['@_href'] as string) || null
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
  const data = JSON.parse(raw) as Record<string, unknown>
  const items = ensureArray((data.items as unknown[]) || []) as XmlNode[]

  return {
    title: (data.title as string) || null,
    feedType: 'json',
    items: items.map((item: XmlNode) => {
      const title = decodeEntities(item.title as string) || 'Untitled'
      const url = (item.url as string) || (item.external_url as string) || null
      const summary = stripHtml((item.summary as string) || (item.content_text as string) || (item.content_html as string))
      const published = parseDate((item.date_published as string) || (item.date_modified as string))
      const guid = (item.id as string) || url || hashGuid(title, feedUrl)

      // JSON Feed image: item.image, item.banner_image, or first image attachment
      let imageUrl: string | null = (item.image as string) || (item.banner_image as string) || null
      if (!imageUrl && Array.isArray(item.attachments)) {
        const imgAttach = (item.attachments as XmlNode[]).find(
          (a) => typeof a.mime_type === 'string' && (a.mime_type as string).startsWith('image/')
        )
        if (imgAttach?.url) imageUrl = imgAttach.url as string
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
