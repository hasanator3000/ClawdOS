'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Skill, SkillCategory } from '@/lib/clawdbot/skills-registry'
import type { InstalledSkill } from './skills-actions'
import { getInstalledSkills } from './skills-actions'
import { SkillCard } from './SkillCard'
import { InstalledSkillCard } from './InstalledSkillCard'
import { MarketplaceTab } from './MarketplaceTab'

interface SkillsListProps {
  skills: Skill[]
}

type Tab = 'installed' | 'commands' | 'marketplace'

const CATEGORIES: Array<{ value: SkillCategory | 'All'; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Productivity', label: 'Productivity' },
  { value: 'Content', label: 'Content' },
  { value: 'System', label: 'System' },
  { value: 'Navigation', label: 'Navigation' },
]

export function SkillsList({ skills }: SkillsListProps) {
  const [tab, setTab] = useState<Tab>('installed')

  // --- Installed skills from disk ---
  const [installed, setInstalled] = useState<{ workspace: InstalledSkill[]; bundled: InstalledSkill[] }>({
    workspace: [],
    bundled: [],
  })
  const [installedLoading, setInstalledLoading] = useState(true)

  const loadInstalled = useCallback(async () => {
    setInstalledLoading(true)
    const data = await getInstalledSkills()
    setInstalled(data)
    setInstalledLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch on mount
    void loadInstalled()
  }, [loadInstalled])

  const installedSlugs = new Set([
    ...installed.workspace.map((s) => s.slug),
    ...installed.bundled.map((s) => s.slug),
  ])

  // --- Commands (chat) state ---
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'All'>('All')

  const filteredSkills = skills.filter((skill) => {
    if (selectedCategory !== 'All' && skill.category !== selectedCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        skill.examples.some((ex) => ex.toLowerCase().includes(q))
      )
    }
    return true
  })

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: 'installed', label: 'Installed', count: installed.workspace.length + installed.bundled.length },
    { key: 'commands', label: 'Commands', count: skills.length },
    { key: 'marketplace', label: 'Marketplace' },
  ]

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[var(--card)] text-[var(--fg)] shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {t.label}
            {t.count != null && (
              <span className="ml-1.5 text-xs text-[var(--muted)]">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== INSTALLED TAB ===== */}
      {tab === 'installed' && (
        <>
          {installedLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--card)]" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {installed.workspace.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    Workspace Skills
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {installed.workspace.map((s) => (
                      <InstalledSkillCard key={s.slug} skill={s} onUpdated={loadInstalled} />
                    ))}
                  </div>
                </div>
              )}

              {installed.bundled.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                    Built-in Skills
                    <span className="ml-1.5 font-normal normal-case">{installed.bundled.length}</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {installed.bundled.map((s) => (
                      <InstalledSkillCard key={s.slug} skill={s} onUpdated={loadInstalled} />
                    ))}
                  </div>
                </div>
              )}

              {installed.workspace.length === 0 && installed.bundled.length === 0 && (
                <div className="py-12 text-center text-[var(--muted)]">
                  No skills installed. Browse the Marketplace to install one.
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ===== COMMANDS TAB ===== */}
      {tab === 'commands' && (
        <>
          <input
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          />

          <div className="flex gap-2 border-b border-[var(--border)]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  selectedCategory === cat.value
                    ? 'border-b-2 border-[var(--neon)] text-[var(--fg)]'
                    : 'border-b-2 border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {filteredSkills.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredSkills.map((skill) => (
                <SkillCard key={skill.id} skill={skill} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[var(--muted)]">
              No commands match your search
            </div>
          )}
        </>
      )}

      {/* ===== MARKETPLACE TAB ===== */}
      {tab === 'marketplace' && (
        <MarketplaceTab installedSlugs={installedSlugs} onInstalled={loadInstalled} />
      )}
    </div>
  )
}
