/** Represents a node from the XML parser — structure varies by feed format */
export type XmlNode = Record<string, unknown>

export function str(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string') return val.trim() || null
  if (typeof val === 'object' && val !== null && '#text' in (val as Record<string, unknown>)) {
    return str((val as Record<string, unknown>)['#text'])
  }
  return String(val).trim() || null
}

export function ensureArray<T>(val: T | T[]): T[] {
  return Array.isArray(val) ? val : [val]
}

export function parseDate(val: string | null): Date | null {
  if (!val) return null
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

/** Decode HTML/XML entities: named (&amp;), decimal (&#8216;), hex (&#x2018;) */
export function decodeEntities(text: string | null): string | null {
  if (!text) return null
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .trim() || null
}

export function stripHtml(html: string | null): string | null {
  if (!html) return null
  const stripped = html.replace(/<[^>]+>/g, '')
  const decoded = decodeEntities(stripped)
  if (!decoded) return null
  return decoded.replace(/\s+/g, ' ').trim() || null
}

export function truncate(text: string | null, maxLen: number): string | null {
  if (!text) return null
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '\u2026'
}

export function hashGuid(title: string, feedUrl: string): string {
  // Simple deterministic hash — no crypto needed, just dedup
  let hash = 0
  const s = `${feedUrl}:${title}`
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return `hash:${hash.toString(36)}`
}

/**
 * Extract the best image URL from an RSS/Atom item.
 * Checks media:content, media:thumbnail, enclosure, and common patterns.
 */
export function extractImage(item: XmlNode): string | null {
  if (!item || typeof item !== 'object') return null

  // media:content (can be object or array)
  const mediaGroup = item['media:group'] as XmlNode | undefined
  const mediaContent = item['media:content'] || mediaGroup?.['media:content']
  if (mediaContent) {
    const entries = ensureArray(mediaContent) as XmlNode[]
    for (const mc of entries) {
      const url = mc?.['@_url'] as string | undefined
      const medium = mc?.['@_medium'] as string | undefined
      const type = (mc?.['@_type'] as string) || ''
      if (url && (medium === 'image' || type.startsWith('image/') || /\.(jpe?g|png|webp|gif)/i.test(url))) {
        return url
      }
    }
    // If only one media:content with a URL, assume it's the image
    if (entries.length === 1 && entries[0]?.['@_url']) {
      return entries[0]['@_url'] as string
    }
  }

  // media:thumbnail
  const mediaThumbnail = item['media:thumbnail']
  if (mediaThumbnail) {
    const entries = ensureArray(mediaThumbnail) as XmlNode[]
    if (entries[0]?.['@_url']) return entries[0]['@_url'] as string
  }

  // enclosure (RSS)
  const enclosure = item.enclosure
  if (enclosure) {
    const entries = ensureArray(enclosure) as XmlNode[]
    for (const enc of entries) {
      const type = (enc?.['@_type'] as string) || ''
      if (type.startsWith('image/') && enc?.['@_url']) {
        return enc['@_url'] as string
      }
    }
  }

  // Atom: link[rel=enclosure] with image type
  const links = ensureArray(item.link || []) as XmlNode[]
  for (const l of links) {
    if (typeof l === 'object' && l?.['@_rel'] === 'enclosure') {
      const type = (l?.['@_type'] as string) || ''
      if (type.startsWith('image/') && l?.['@_href']) {
        return l['@_href'] as string
      }
    }
  }

  return null
}
