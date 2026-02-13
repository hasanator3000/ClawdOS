'use client'

import type { NewsTab } from '@/types/news'

interface Props {
  tabs: NewsTab[]
  activeTabId: string | null
  onTabChange: (tabId: string | null) => void
}

export function NewsTabs({ tabs, activeTabId, onTabChange }: Props) {
  return (
    <div className="flex gap-2 border-b border-[var(--border)] overflow-x-auto">
      <button
        type="button"
        onClick={() => onTabChange(null)}
        className={`px-4 py-2 -mb-px border-b-2 transition-colors whitespace-nowrap ${
          activeTabId === null
            ? 'border-[var(--fg)] text-[var(--fg)]'
            : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
        }`}
      >
        Home
      </button>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors whitespace-nowrap ${
            activeTabId === tab.id
              ? 'border-[var(--fg)] text-[var(--fg)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          {tab.name}
        </button>
      ))}
    </div>
  )
}
