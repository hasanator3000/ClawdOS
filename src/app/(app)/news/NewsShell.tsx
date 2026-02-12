'use client'

import { useState, useEffect, useTransition, useCallback, useRef, useMemo } from 'react'
import type { NewsItem, NewsSource, NewsTab } from '@/types/news'
import { NewsTabs } from './NewsTabs'
import { NewsFeed } from './NewsFeed'
import { NewsSourcesPanel } from './NewsSourcesPanel'
import { NewsSearch } from './NewsSearch'
import { NewsOnboarding } from './NewsOnboarding'
import { refreshNews, getSources, getTabs } from './actions'

const ITEMS_PER_PAGE = 12

interface Props {
  initialNews: NewsItem[]
  initialSources: NewsSource[]
  initialTabs: NewsTab[]
  initialSourceTabMap: Record<string, string[]>
}

export function NewsShell({ initialNews, initialSources, initialTabs, initialSourceTabMap }: Props) {
  const [allNews, setAllNews] = useState(initialNews)
  const [sources, setSources] = useState(initialSources)
  const [tabs, setTabs] = useState(initialTabs)
  const [sourceTabMap, setSourceTabMap] = useState(initialSourceTabMap)
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const [showSources, setShowSources] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Sync props when server data changes (workspace switch, revalidation)
  useEffect(() => { setAllNews(initialNews) }, [initialNews])
  useEffect(() => { setSources(initialSources) }, [initialSources])
  useEffect(() => { setTabs(initialTabs) }, [initialTabs])
  useEffect(() => { setSourceTabMap(initialSourceTabMap) }, [initialSourceTabMap])

  // Debounce search input (300ms)
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [search])

  // Client-side filtering by tab and search
  const filteredNews = useMemo(() => {
    let items = allNews

    // Filter by active tab (via sourceTabMap)
    if (activeTabId) {
      const sourceIdsInTab = new Set<string>()
      for (const [sourceId, tabIds] of Object.entries(sourceTabMap)) {
        if (tabIds.includes(activeTabId)) sourceIdsInTab.add(sourceId)
      }
      items = items.filter((item) => item.sourceId && sourceIdsInTab.has(item.sourceId))
    }

    // Filter by search
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      items = items.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.summary?.toLowerCase().includes(q) ||
          item.sourceName?.toLowerCase().includes(q)
      )
    }

    return items
  }, [allNews, activeTabId, sourceTabMap, debouncedSearch])

  // Pagination: only show displayedCount items
  const displayedNews = useMemo(() => {
    return filteredNews.slice(0, displayedCount)
  }, [filteredNews, displayedCount])

  // Scroll to top and reset pagination when filters change
  useEffect(() => {
    feedRef.current?.scrollTo(0, 0)
    setDisplayedCount(ITEMS_PER_PAGE)
  }, [activeTabId, debouncedSearch])

  // Refs for stable event handlers
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  // Listen for custom events — single registration on mount
  useEffect(() => {
    const handleRefresh = () => {
      startTransition(async () => {
        const [srcResult, tabResult, newsResult] = await Promise.all([
          getSources(),
          getTabs(),
          refreshNews(),
        ])
        if (srcResult.sources) setSources(srcResult.sources)
        if (tabResult.tabs) setTabs(tabResult.tabs)
        if (newsResult.items) setAllNews(newsResult.items)
      })
    }

    const handleTabSwitch = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.tabId !== undefined) {
        setActiveTabId(detail.tabId)
      } else if (detail?.tabName) {
        const tab = tabsRef.current.find((t) => t.name.toLowerCase() === detail.tabName.toLowerCase())
        setActiveTabId(tab?.id ?? null)
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
  }, [])

  const handleRefreshClick = useCallback(() => {
    startTransition(async () => {
      const result = await refreshNews()
      if (result.items) setAllNews(result.items)
    })
  }, [])

  const handleSetupComplete = useCallback(() => {
    startTransition(async () => {
      const [srcResult, tabResult, newsResult] = await Promise.all([
        getSources(),
        getTabs(),
        refreshNews(),
      ])
      if (srcResult.sources) setSources(srcResult.sources)
      if (tabResult.tabs) setTabs(tabResult.tabs)
      if (newsResult.items) setAllNews(newsResult.items)
    })
  }, [])

  const handleLoadMore = useCallback(() => {
    setDisplayedCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredNews.length))
  }, [filteredNews.length])

  // Onboarding
  if (sources.length === 0 && !showSources) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">News</h1>
        </div>
        <NewsOnboarding onManualSetup={() => setShowSources(true)} onSetupComplete={handleSetupComplete} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem)]">
      {/* Header — pinned */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h1 className="text-2xl font-bold">News</h1>
        <div className="flex items-center gap-3">
          <NewsSearch value={search} onChange={setSearch} />
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={isPending}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors disabled:opacity-50"
          >
            {isPending ? 'Loading...' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => setShowSources(true)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors"
          >
            Sources
          </button>
        </div>
      </div>

      {/* Tabs — pinned */}
      {tabs.length > 0 && (
        <div className="mb-4 shrink-0">
          <NewsTabs tabs={tabs} activeTabId={activeTabId} onTabChange={setActiveTabId} />
        </div>
      )}

      {/* Feed — scrolls independently */}
      <div ref={feedRef} className="flex-1 min-h-0 overflow-y-auto -mx-6 px-4">
        <NewsFeed
          items={displayedNews}
          onLoadMore={handleLoadMore}
          hasMore={displayedCount < filteredNews.length}
          isLoading={isPending}
        />
      </div>

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
