'use client'

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

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:bg-[var(--hover)]">
      <div className="flex items-baseline justify-between gap-4">
        <div className="font-medium min-w-0">
          {item.url ? (
            <a
              className="hover:underline"
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.title}
            </a>
          ) : (
            item.title
          )}
        </div>
        <div className="text-xs text-[var(--muted)] whitespace-nowrap shrink-0">
          {item.publishedAt ? formatRelativeTime(item.publishedAt) : ''}
        </div>
      </div>
      {item.sourceName && (
        <div className="mt-1 text-xs text-[var(--muted)]">{item.sourceName}</div>
      )}
      {item.summary && (
        <p className="mt-1.5 text-sm text-[var(--muted-2)] line-clamp-3">{item.summary}</p>
      )}
    </div>
  )
}
