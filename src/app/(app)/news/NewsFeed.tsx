'use client'

import { useRef, useEffect, useCallback } from 'react'
import type { NewsItem } from '@/types/news'
import { NewsCard } from './NewsCard'

interface Props {
  items: NewsItem[]
  onLoadMore: () => void
  hasMore: boolean
  isLoading: boolean
}

export function NewsFeed({ items, onLoadMore, hasMore, isLoading }: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && !isLoading) {
        onLoadMoreRef.current()
      }
    },
    [isLoading]
  )

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(handleIntersect, {
      rootMargin: '200px',
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, handleIntersect])

  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12 text-[var(--muted)]">
        No news items yet. Add some RSS sources to get started.
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
      {hasMore && <div ref={sentinelRef} className="h-4" />}
      {isLoading && (
        <div className="text-center py-4 text-[var(--muted)] text-sm">Loading...</div>
      )}
    </div>
  )
}
