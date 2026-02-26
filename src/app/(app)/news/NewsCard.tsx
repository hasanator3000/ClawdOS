'use client'

import { useState, useMemo, memo } from 'react'
import Image from 'next/image'
import type { NewsItem } from '@/types/news'

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export const NewsCard = memo(function NewsCard({ item }: { item: NewsItem }) {
  const [imgError, setImgError] = useState(false)
  const showImage = item.imageUrl && !imgError

  const relTime = useMemo(
    () => (item.publishedAt ? formatRelativeTime(item.publishedAt) : ''),
    [item.publishedAt]
  )

  const content = (
    <div className="flex flex-col h-full rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-colors hover:border-[var(--neon-dim)]">
      {showImage && (
        <div className="relative aspect-video overflow-hidden bg-[var(--hover)]">
          <Image
            src={item.imageUrl!}
            alt=""
            fill
            unoptimized
            onError={() => setImgError(true)}
            className="object-cover"
          />
        </div>
      )}
      <div className="flex flex-col flex-1 p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          {item.sourceName && <span className="font-semibold text-[var(--neon)]">{item.sourceName}</span>}
          {item.sourceName && item.publishedAt && <span className="text-[var(--muted-2)]">·</span>}
          {relTime && <span>{relTime}</span>}
        </div>
        <h3 className="mt-2 font-semibold text-base leading-snug line-clamp-2">
          {item.title}
        </h3>
        {item.summary && (
          <p className="mt-1.5 text-sm text-[var(--muted)] line-clamp-2 flex-1 leading-relaxed">{item.summary}</p>
        )}
      </div>
    </div>
  )

  if (item.url) {
    return (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block h-full">
        {content}
      </a>
    )
  }

  return content
})
