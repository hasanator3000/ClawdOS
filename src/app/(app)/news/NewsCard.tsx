'use client'

import { useState, memo } from 'react'
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

  const content = (
    <div className="flex flex-col h-full rounded-lg border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-colors hover:bg-[var(--hover)]">
      {showImage && (
        <div className="aspect-video overflow-hidden bg-[var(--hover)]">
          <img
            src={item.imageUrl!}
            alt=""
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex flex-col flex-1 p-3">
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          {item.sourceName && <span>{item.sourceName}</span>}
          {item.sourceName && item.publishedAt && <span>·</span>}
          {item.publishedAt && <span>{formatRelativeTime(item.publishedAt)}</span>}
        </div>
        <h3 className="mt-1 font-medium text-sm leading-snug line-clamp-2">
          {item.title}
        </h3>
        {item.summary && (
          <p className="mt-1 text-xs text-[var(--muted-2)] line-clamp-2 flex-1">{item.summary}</p>
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
