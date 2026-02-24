'use client'

import { useState } from 'react'
import type { Project } from '@/lib/db/repositories/project.repository'
import { getTagColor } from '@/lib/tag-colors'
import { FilterDropdown } from './FilterDropdown'

export type FilterStatus = 'all' | 'active' | 'completed'

export interface TaskFilterState {
  status: FilterStatus
  priority: number | 'all'
  tags: string[]
  projectId: string | 'all'
}

interface TaskFiltersProps {
  onFilterChange: (filters: TaskFilterState) => void
  onSearchChange: (query: string) => void
  activeTasks: number
  completedTasks: number
  totalTasks: number
  allTags?: string[]
  projects?: Project[]
}

const PRIORITY_OPTIONS: Array<{ value: number | 'all'; label: string; color?: string }> = [
  { value: 'all' as const, label: 'All priorities' },
  { value: 4 as const, label: 'Urgent', color: 'var(--red)' },
  { value: 3 as const, label: 'High', color: 'var(--pink)' },
  { value: 2 as const, label: 'Medium', color: 'var(--warm)' },
  { value: 1 as const, label: 'Low', color: 'var(--cyan)' },
  { value: 0 as const, label: 'None', color: 'var(--muted)' },
]

export function TaskFilters({
  onFilterChange,
  onSearchChange,
  activeTasks,
  completedTasks,
  totalTasks,
  allTags = [],
  projects = [],
}: TaskFiltersProps) {
  const [filterState, setFilterState] = useState<TaskFilterState>({
    status: 'all',
    priority: 'all',
    tags: [],
    projectId: 'all',
  })
  const [searchQuery, setSearchQuery] = useState('')

  const handleStatusChange = (status: FilterStatus) => {
    const newState = { ...filterState, status }
    setFilterState(newState)
    onFilterChange(newState)
  }

  const handlePriorityChange = (priority: number | 'all', close: () => void) => {
    const newState = { ...filterState, priority }
    setFilterState(newState)
    onFilterChange(newState)
    close()
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    onSearchChange(query)
  }

  const handleProjectFilter = (projectId: string | 'all', close: () => void) => {
    const newState = { ...filterState, projectId }
    setFilterState(newState)
    onFilterChange(newState)
    close()
  }

  const handleTagToggle = (tag: string) => {
    const tags = filterState.tags.includes(tag)
      ? filterState.tags.filter((t) => t !== tag)
      : [...filterState.tags, tag]
    const newState = { ...filterState, tags }
    setFilterState(newState)
    onFilterChange(newState)
  }

  const handleClearTags = (close: () => void) => {
    const newState = { ...filterState, tags: [] }
    setFilterState(newState)
    onFilterChange(newState)
    close()
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    onSearchChange('')
  }

  const selectedPriority = PRIORITY_OPTIONS.find((opt) => opt.value === filterState.priority)

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {(['active', 'completed', 'all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handleStatusChange(s)}
            className={`px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
              filterState.status === s
                ? 'border-[var(--neon)] text-[var(--neon)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
          >
            {s === 'active' ? `Active (${activeTasks})` : s === 'completed' ? `Completed (${completedTasks})` : `All (${totalTasks})`}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex gap-2">
        {/* Priority */}
        <FilterDropdown
          label={selectedPriority?.label || 'All priorities'}
          activeColor={selectedPriority?.color}
          isActive={filterState.priority !== 'all'}
        >
          {(close) => (
            <>
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePriorityChange(option.value, close)}
                  className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2.5 ${
                    filterState.priority === option.value ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'
                  }`}
                >
                  {option.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: option.color }} />}
                  <span style={{ color: option.color || 'var(--fg)' }}>{option.label}</span>
                </button>
              ))}
            </>
          )}
        </FilterDropdown>

        {/* Tags */}
        {allTags.length > 0 && (
          <FilterDropdown
            label={filterState.tags.length > 0 ? `Tags (${filterState.tags.length})` : 'Tags'}
            isActive={filterState.tags.length > 0}
            minWidth="120px"
          >
            {(close) => (
              <>
                {allTags.map((tag) => {
                  const tc = getTagColor(tag)
                  const isActive = filterState.tags.includes(tag)
                  return (
                    <button key={tag} type="button" onClick={() => handleTagToggle(tag)} className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2.5 ${isActive ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tc.color }} />
                      <span style={{ color: tc.color }}>{tag}</span>
                      {isActive && <svg className="w-3.5 h-3.5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="var(--neon)"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    </button>
                  )
                })}
                {filterState.tags.length > 0 && (
                  <button type="button" onClick={() => handleClearTags(close)} className="w-full px-4 py-2 text-left text-xs transition-colors hover:bg-[var(--surface)]" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                    Clear tags
                  </button>
                )}
              </>
            )}
          </FilterDropdown>
        )}

        {/* Project */}
        {projects.length > 0 && (
          <FilterDropdown
            label={filterState.projectId !== 'all' ? projects.find((p) => p.id === filterState.projectId)?.name || 'Project' : 'Project'}
            activeColor="var(--cyan)"
            isActive={filterState.projectId !== 'all'}
            minWidth="130px"
          >
            {(close) => (
              <>
                <button type="button" onClick={() => handleProjectFilter('all', close)} className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${filterState.projectId === 'all' ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`} style={{ color: 'var(--fg)' }}>
                  All projects
                </button>
                {projects.map((p) => (
                  <button key={p.id} type="button" onClick={() => handleProjectFilter(p.id, close)} className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${filterState.projectId === p.id ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`} style={{ color: 'var(--cyan)' }}>
                    {p.name}
                  </button>
                ))}
              </>
            )}
          </FilterDropdown>
        )}

        {/* Search */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tasks..."
            className="w-full px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-colors pr-10"
          />
          {searchQuery && (
            <button type="button" onClick={handleClearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--fg)] transition-colors" aria-label="Clear search">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
