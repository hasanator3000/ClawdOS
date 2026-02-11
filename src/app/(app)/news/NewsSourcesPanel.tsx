'use client'

import { useState, useTransition } from 'react'
import type { NewsSource, NewsTab } from '@/types/news'
import {
  addSource,
  removeSource,
  toggleSource,
  createTab,
  deleteTab,
  reorderTabs,
  assignSourceToTab,
  removeSourceFromTab,
} from './actions'

interface Props {
  sources: NewsSource[]
  tabs: NewsTab[]
  sourceTabMap: Record<string, string[]> // sourceId -> tabId[]
  onClose: () => void
  onSourcesChange: (sources: NewsSource[]) => void
  onTabsChange: (tabs: NewsTab[]) => void
  onSourceTabMapChange: (map: Record<string, string[]>) => void
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'text-[var(--success-fg)] bg-[var(--success-bg)]' },
  paused: { label: 'Paused', cls: 'text-[var(--muted)] bg-[var(--hover)]' },
  error: { label: 'Error', cls: 'text-[var(--error-fg)] bg-[var(--error-bg)]' },
}

export function NewsSourcesPanel({
  sources,
  tabs,
  sourceTabMap,
  onClose,
  onSourcesChange,
  onTabsChange,
  onSourceTabMapChange,
}: Props) {
  const [newUrl, setNewUrl] = useState('')
  const [newTabName, setNewTabName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault()
    const url = newUrl.trim()
    if (!url) return
    setError(null)
    setNewUrl('')

    startTransition(async () => {
      const result = await addSource(url)
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('source' in result && result.source) {
        onSourcesChange([...sources, result.source])
      }
    })
  }

  const handleRemoveSource = (sourceId: string) => {
    startTransition(async () => {
      const result = await removeSource(sourceId)
      if (result.success) {
        onSourcesChange(sources.filter((s) => s.id !== sourceId))
        const { [sourceId]: _, ...rest } = sourceTabMap
        onSourceTabMapChange(rest)
      }
    })
  }

  const handleToggleSource = (sourceId: string) => {
    startTransition(async () => {
      const result = await toggleSource(sourceId)
      if ('source' in result && result.source) {
        onSourcesChange(sources.map((s) => (s.id === sourceId ? result.source! : s)))
      }
    })
  }

  const handleCreateTab = (e: React.FormEvent) => {
    e.preventDefault()
    const name = newTabName.trim()
    if (!name) return
    setNewTabName('')

    startTransition(async () => {
      const result = await createTab(name)
      if ('tab' in result && result.tab) {
        onTabsChange([...tabs, result.tab])
      }
    })
  }

  const handleDeleteTab = (tabId: string) => {
    startTransition(async () => {
      const result = await deleteTab(tabId)
      if (result.success) {
        onTabsChange(tabs.filter((t) => t.id !== tabId))
        // Clean up source-tab mappings
        const updated = { ...sourceTabMap }
        for (const [sid, tids] of Object.entries(updated)) {
          updated[sid] = tids.filter((t) => t !== tabId)
        }
        onSourceTabMapChange(updated)
      }
    })
  }

  const handleMoveTab = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= tabs.length) return

    const reordered = [...tabs]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(newIndex, 0, moved)
    onTabsChange(reordered)

    startTransition(async () => {
      await reorderTabs(reordered.map((t) => t.id))
    })
  }

  const handleToggleTabAssignment = (sourceId: string, tabId: string) => {
    const current = sourceTabMap[sourceId] || []
    const isAssigned = current.includes(tabId)

    startTransition(async () => {
      if (isAssigned) {
        await removeSourceFromTab(sourceId, tabId)
        onSourceTabMapChange({
          ...sourceTabMap,
          [sourceId]: current.filter((t) => t !== tabId),
        })
      } else {
        await assignSourceToTab(sourceId, tabId)
        onSourceTabMapChange({
          ...sourceTabMap,
          [sourceId]: [...current, tabId],
        })
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-[var(--bg)] border-l border-[var(--border)] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">News Sources</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Add source */}
          <form onSubmit={handleAddSource} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="Paste RSS feed URL..."
                className="flex-1 px-3 py-2 bg-[var(--input-bg)] text-[var(--input-fg)] border border-[var(--border)] rounded-lg text-sm placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={!newUrl.trim() || isPending}
                className="px-3 py-2 bg-[var(--fg)] text-[var(--bg)] rounded-lg text-sm disabled:opacity-50 hover:opacity-80 transition-opacity"
              >
                Add
              </button>
            </div>
            {error && (
              <div className="text-xs text-[var(--error-fg)] bg-[var(--error-bg)] rounded px-2 py-1">
                {error}
              </div>
            )}
          </form>

          {/* Sources list */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--muted)]">
              Sources ({sources.length})
            </h3>
            {sources.length === 0 && (
              <div className="text-sm text-[var(--muted)]">No sources added yet.</div>
            )}
            {sources.map((source) => {
              const badge = STATUS_BADGE[source.status] || STATUS_BADGE.active
              const assignedSet = new Set(sourceTabMap[source.id] || [])
              return (
                <div
                  key={source.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {source.title || new URL(source.url).hostname}
                      </div>
                      <div className="text-xs text-[var(--muted)] truncate">{source.url}</div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  {source.errorMessage && (
                    <div className="text-xs text-[var(--error-fg)]">{source.errorMessage}</div>
                  )}

                  {/* Tab assignments */}
                  {tabs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tabs.map((tab) => {
                        const assigned = assignedSet.has(tab.id)
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => handleToggleTabAssignment(source.id, tab.id)}
                            disabled={isPending}
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                              assigned
                                ? 'border-[var(--fg)] text-[var(--fg)] bg-[var(--hover)]'
                                : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--fg)]'
                            }`}
                          >
                            {tab.name}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleToggleSource(source.id)}
                      disabled={isPending}
                      className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                    >
                      {source.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSource(source.id)}
                      disabled={isPending}
                      className="text-xs text-[var(--muted)] hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Tabs management */}
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <h3 className="text-sm font-medium text-[var(--muted)]">
              Tabs ({tabs.length})
            </h3>

            <form onSubmit={handleCreateTab} className="flex gap-2">
              <input
                type="text"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                placeholder="New tab name..."
                className="flex-1 px-3 py-1.5 bg-[var(--input-bg)] text-[var(--input-fg)] border border-[var(--border)] rounded-lg text-sm placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                disabled={isPending}
              />
              <button
                type="submit"
                disabled={!newTabName.trim() || isPending}
                className="px-3 py-1.5 bg-[var(--fg)] text-[var(--bg)] rounded-lg text-sm disabled:opacity-50 hover:opacity-80 transition-opacity"
              >
                Add
              </button>
            </form>

            {tabs.map((tab, i) => (
              <div
                key={tab.id}
                className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2"
              >
                <span className="flex-1 text-sm">{tab.name}</span>
                <button
                  type="button"
                  onClick={() => handleMoveTab(i, -1)}
                  disabled={i === 0 || isPending}
                  className="text-xs text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-30 transition-colors"
                  aria-label="Move up"
                >
                  ^
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveTab(i, 1)}
                  disabled={i === tabs.length - 1 || isPending}
                  className="text-xs text-[var(--muted)] hover:text-[var(--fg)] disabled:opacity-30 transition-colors"
                  aria-label="Move down"
                >
                  v
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTab(tab.id)}
                  disabled={isPending}
                  className="text-xs text-[var(--muted)] hover:text-red-500 transition-colors"
                >
                  Del
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
