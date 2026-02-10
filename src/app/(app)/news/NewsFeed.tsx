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

/**
 * Mixed grid pattern over a 6-column base:
 * - "wide" cards span 3 cols (2 per row)  → items with images
 * - "normal" cards span 2 cols (3 per row) → items without images
 *
 * The pattern repeats in groups of 5:
 *   [wide][wide]     ← row of 2 (3+3)
 *   [norm][norm][norm] ← row of 3 (2+2+2)
 *
 * On tablet (sm): 4-col grid, wide=2 normal=2 → 2 per row
 * On mobile: single column
 */
function getSpanClass(index: number, hasImage: boolean): string {
  // On large screens: every group of 5, first 2 are wide (3-col), rest normal (2-col)
  const posInGroup = index % 5
  const isWide = posInGroup < 2 && hasImage

  if (isWide) {
    return 'col-span-1 sm:col-span-2 lg:col-span-3'
  }
  return 'col-span-1 sm:col-span-2 lg:col-span-2'
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
      <div className="grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((item, i) => (
          <div key={item.id} className={getSpanClass(i, !!item.imageUrl)}>
            <NewsCard item={item} />
          </div>
        ))}
      </div>
      {hasMore && <div ref={sentinelRef} className="h-4" />}
      {isLoading && (
        <div className="text-center py-4 text-[var(--muted)] text-sm">Loading...</div>
      )}
    </div>
  )
}
