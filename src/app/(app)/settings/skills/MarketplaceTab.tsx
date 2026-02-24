'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { MarketplaceSkill } from './marketplace-actions'
import { searchMarketplaceSkills } from './marketplace-actions'
import { MarketplaceCard } from './MarketplaceCard'

const SORT_OPTIONS = [
  { value: 'downloads', label: 'Downloads' },
  { value: 'stars', label: 'Stars' },
  { value: 'security', label: 'Security' },
] as const

type SortKey = (typeof SORT_OPTIONS)[number]['value']

function sortMarketplace(skills: MarketplaceSkill[], sort: SortKey): MarketplaceSkill[] {
  return [...skills].sort((a, b) => {
    if (sort === 'downloads') return b.downloads - a.downloads
    if (sort === 'stars') return b.stars - a.stars
    return b.security.score - a.security.score
  })
}

interface MarketplaceTabProps {
  installedSlugs: Set<string>
  onInstalled: () => void
}

export function MarketplaceTab({ installedSlugs, onInstalled }: MarketplaceTabProps) {
  const [mpQuery, setMpQuery] = useState('')
  const [mpSort, setMpSort] = useState<SortKey>('downloads')
  const [mpSkills, setMpSkills] = useState<MarketplaceSkill[]>([])
  const [mpLoading, setMpLoading] = useState(false)
  const [mpError, setMpError] = useState<string | null>(null)
  const [mpLoaded, setMpLoaded] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)

  const fetchMp = useCallback(async (q: string) => {
    setMpLoading(true)
    setMpError(null)
    const result = await searchMarketplaceSkills(q, 30)
    if (result.error) setMpError(result.error)
    setMpSkills(result.skills)
    setMpLoading(false)
    setMpLoaded(true)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount
    if (!mpLoaded) void fetchMp('')
  }, [mpLoaded, fetchMp])

  const handleMpSearch = (value: string) => {
    setMpQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchMp(value), 400)
  }

  const sortedMp = sortMarketplace(mpSkills, mpSort)

  return (
    <>
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search marketplace..."
          value={mpQuery}
          onChange={(e) => handleMpSearch(e.target.value)}
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
        />
        <div className="flex rounded-md border border-[var(--border)] bg-[var(--card)]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMpSort(opt.value)}
              className={`px-3 py-2 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                mpSort === opt.value
                  ? 'bg-[var(--neon-dim)] text-[var(--neon)]'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {mpLoading && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]" />
          ))}
        </div>
      )}

      {mpError && !mpLoading && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--error-bg)] p-4 text-sm text-[var(--error-fg)]">
          Failed to load: {mpError}
        </div>
      )}

      {!mpLoading && sortedMp.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sortedMp.map((skill) => (
            <MarketplaceCard
              key={skill.slug}
              skill={skill}
              isInstalled={installedSlugs.has(skill.slug)}
              onInstalled={onInstalled}
            />
          ))}
        </div>
      )}

      {!mpLoading && !mpError && sortedMp.length === 0 && mpLoaded && (
        <div className="py-12 text-center text-[var(--muted)]">
          No skills found{mpQuery ? ` for "${mpQuery}"` : ''}
        </div>
      )}

      {!mpLoading && sortedMp.length > 0 && (
        <div className="text-center text-xs text-[var(--muted)]">
          {sortedMp.length} skills from{' '}
          <a
            href="https://clawdtm.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--neon)] hover:underline"
          >
            ClawdTM
          </a>
        </div>
      )}
    </>
  )
}
