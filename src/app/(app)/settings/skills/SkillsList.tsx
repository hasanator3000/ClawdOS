'use client'

import { useState } from 'react'
import type { Skill, SkillCategory } from '@/lib/clawdbot/skills-registry'
import { SkillCard } from './SkillCard'

interface SkillsListProps {
  skills: Skill[]
}

const CATEGORIES: Array<{ value: SkillCategory | 'All'; label: string }> = [
  { value: 'All', label: 'All' },
  { value: 'Productivity', label: 'Productivity' },
  { value: 'Content', label: 'Content' },
  { value: 'System', label: 'System' },
  { value: 'Navigation', label: 'Navigation' },
]

export function SkillsList({ skills }: SkillsListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<SkillCategory | 'All'>('All')

  // Filter skills
  const filteredSkills = skills.filter((skill) => {
    // Category filter
    if (selectedCategory !== 'All' && skill.category !== selectedCategory) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesName = skill.name.toLowerCase().includes(query)
      const matchesDescription = skill.description.toLowerCase().includes(query)
      const matchesExamples = skill.examples.some((ex) => ex.toLowerCase().includes(query))
      return matchesName || matchesDescription || matchesExamples
    }

    return true
  })

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div>
        <input
          type="text"
          placeholder="Поиск команд..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.value
          return (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-b-2 border-[var(--neon)] text-[var(--fg)]'
                  : 'border-b-2 border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Skills grid */}
      {filteredSkills.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredSkills.map((skill) => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-[var(--muted)]">
          No skills match your search
        </div>
      )}
    </div>
  )
}
