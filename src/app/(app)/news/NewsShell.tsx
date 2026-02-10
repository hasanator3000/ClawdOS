'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import type { NewsItem, NewsSource, NewsTab } from '@/types/news'
import { NewsTabs } from './NewsTabs'
import { NewsFeed } from './NewsFeed'
import { NewsSourcesPanel } from './NewsSourcesPanel'
import { NewsSearch } from './NewsSearch'
import { NewsOnboarding } from './NewsOnboarding'
import { refreshNews, loadMoreNews } from './actions'

interface Props {
  initialNews: NewsItem[]
  initialSources: NewsSource[]
  initialTabs: NewsTab[]
  initialSourceTabMap: Record<string, string[]>
}

const PAGE_SIZE = 30

export function NewsShell({ initialNews, initialSources, initialTabs, initialSourceTabMap }: Props) {
  const [news, setNews] = useState(initialNews)
  const [sources, setSources] = useState(initialSources)
  const [tabs, setTabs] = useState(initialTabs)
  const [sourceTabMap, setSourceTabMap] = useState(initialSourceTabMap)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showSources, setShowSources] = useState(false)
  const [hasMore, setHasMore] = useState(initialNews.length >= PAGE_SIZE)
  const [isPending, startTransition] = useTransition()

  // Sync props when server data changes (workspace switch, revalidation)
  useEffect(() => { setNews(initialNews) }, [initialNews])
  useEffect(() => { setSources(initialSources) }, [initialSources])
  useEffect(() => { setTabs(initialTabs) }, [initialTabs])
  useEffect(() => { setSourceTabMap(initialSourceTabMap) }, [initialSourceTabMap])

  // Background refresh on mount (stale-while-revalidate)
  useEffect(() => {
    if (sources.length === 0) return
    startTransition(async () => {
      await refreshNews()
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch when tab or search changes
  useEffect(() => {
    startTransition(async () => {
      const result = await loadMoreNews('', '', activeTabId ?? undefined, search || undefined)
      if (result.items) {
        setNews(result.items)
        setHasMore(result.items.length >= PAGE_SIZE)
      }
    })
  }, [activeTabId, search])

  // Listen for chat SSE events
  useEffect(() => {
    const handleRefresh = () => {
      startTransition(async () => {
        await refreshNews()
        const result = await loadMoreNews('', '', activeTabId ?? undefined, search || undefined)
        if (result.items) {
          setNews(result.items)
          setHasMore(result.items.length >= PAGE_SIZE)
        }
      })
    }

    const handleTabSwitch = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.tabName) {
        const tab = tabs.find((t) => t.name.toLowerCase() === detail.tabName.toLowerCase())
        setActiveTabId(tab?.id ?? null)
      } else if (detail?.tabId !== undefined) {
        setActiveTabId(detail.tabId)
      }
    }

    const handleSourcesOpen = () => {
      setShowSources(true)
    }

    window.addEventListener('lifeos:news-refresh', handleRefresh)
    window.addEventListener('lifeos:news-tab-switch', handleTabSwitch)
    window.addEventListener('lifeos:news-sources-open', handleSourcesOpen)
    return () => {
      window.removeEventListener('lifeos:news-refresh', handleRefresh)
      window.removeEventListener('lifeos:news-tab-switch', handleTabSwitch)
      window.removeEventListener('lifeos:news-sources-open', handleSourcesOpen)
    }
  }, [tabs, activeTabId, search])

  const handleLoadMore = useCallback(() => {
    if (news.length === 0 || isPending) return

    const lastItem = news[news.length - 1]
    if (!lastItem.publishedAt) return

    startTransition(async () => {
      const result = await loadMoreNews(
        lastItem.publishedAt!,
        lastItem.id,
        activeTabId ?? undefined,
        search || undefined
      )
      if (result.items) {
        setNews((prev) => [...prev, ...result.items])
        if (result.items.length < PAGE_SIZE) setHasMore(false)
      }
    })
  }, [news, isPending, activeTabId, search])

  // Onboarding
  if (sources.length === 0 && !showSources) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">News</h1>
        </div>
        <NewsOnboarding onManualSetup={() => setShowSources(true)} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">News</h1>
        <div className="flex items-center gap-3">
          <NewsSearch value={search} onChange={setSearch} />
          <button
            type="button"
            onClick={() => setShowSources(true)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors"
          >
            Sources
          </button>
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <NewsTabs tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
      )}

      {/* Feed */}
      <NewsFeed
        items={news}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        isLoading={isPending}
      />

      {/* Sources panel */}
      {showSources && (
        <NewsSourcesPanel
          sources={sources}
          tabs={tabs}
          sourceTabMap={sourceTabMap}
          onClose={() => setShowSources(false)}
          onSourcesChange={setSources}
          onTabsChange={setTabs}
          onSourceTabMapChange={setSourceTabMap}
        />
      )}
    </div>
  )
}
