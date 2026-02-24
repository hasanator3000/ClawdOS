'use client'

import type { NewsSource, NewsTab } from '@/types/news'

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'text-[var(--success-fg)] bg-[var(--success-bg)]' },
  paused: { label: 'Paused', cls: 'text-[var(--muted)] bg-[var(--hover)]' },
  error: { label: 'Error', cls: 'text-[var(--error-fg)] bg-[var(--error-bg)]' },
}

interface SourceCardProps {
  source: NewsSource
  tabs: NewsTab[]
  assignedTabIds: string[]
  isPending: boolean
  onToggle: (sourceId: string) => void
  onRemove: (sourceId: string) => void
  onToggleTab: (sourceId: string, tabId: string) => void
}

export function SourceCard({
  source, tabs, assignedTabIds, isPending, onToggle, onRemove, onToggleTab,
}: SourceCardProps) {
  const badge = STATUS_BADGE[source.status] || STATUS_BADGE.active
  const assignedSet = new Set(assignedTabIds)

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 space-y-2">
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

      {tabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((tab) => {
            const assigned = assignedSet.has(tab.id)
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onToggleTab(source.id, tab.id)}
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

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onToggle(source.id)}
          disabled={isPending}
          className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          {source.status === 'active' ? 'Pause' : 'Resume'}
        </button>
        <button
          type="button"
          onClick={() => onRemove(source.id)}
          disabled={isPending}
          className="text-xs text-[var(--muted)] hover:text-[var(--red)] transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  )
}
