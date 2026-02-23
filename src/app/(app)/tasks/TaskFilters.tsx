'use client'

import { useState } from 'react'
import type { Project } from '@/lib/db/repositories/project.repository'
import { getTagColor } from '@/lib/tag-colors'

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
  const [isPriorityOpen, setIsPriorityOpen] = useState(false)
  const [isTagsOpen, setIsTagsOpen] = useState(false)
  const [isProjectOpen, setIsProjectOpen] = useState(false)

  const handleStatusChange = (status: FilterStatus) => {
    const newState = { ...filterState, status }
    setFilterState(newState)
    onFilterChange(newState)
  }

  const handlePriorityChange = (priority: number | 'all') => {
    const newState = { ...filterState, priority }
    setFilterState(newState)
    onFilterChange(newState)
    setIsPriorityOpen(false)
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    onSearchChange(query)
  }

  const handleProjectFilter = (projectId: string | 'all') => {
    const newState = { ...filterState, projectId }
    setFilterState(newState)
    onFilterChange(newState)
    setIsProjectOpen(false)
  }

  const handleTagToggle = (tag: string) => {
    const tags = filterState.tags.includes(tag)
      ? filterState.tags.filter((t) => t !== tag)
      : [...filterState.tags, tag]
    const newState = { ...filterState, tags }
    setFilterState(newState)
    onFilterChange(newState)
  }

  const handleClearTags = () => {
    const newState = { ...filterState, tags: [] }
    setFilterState(newState)
    onFilterChange(newState)
    setIsTagsOpen(false)
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
        <button
          type="button"
          onClick={() => handleStatusChange('active')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
            filterState.status === 'active'
              ? 'border-[var(--neon)] text-[var(--neon)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          Active ({activeTasks})
        </button>
        <button
          type="button"
          onClick={() => handleStatusChange('completed')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
            filterState.status === 'completed'
              ? 'border-[var(--neon)] text-[var(--neon)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          Completed ({completedTasks})
        </button>
        <button
          type="button"
          onClick={() => handleStatusChange('all')}
          className={`px-4 py-2 -mb-px border-b-2 transition-colors text-sm ${
            filterState.status === 'all'
              ? 'border-[var(--neon)] text-[var(--neon)]'
              : 'border-transparent text-[var(--muted)] hover:text-[var(--fg)]'
          }`}
        >
          All ({totalTasks})
        </button>
      </div>

      {/* Priority dropdown and Search */}
      <div className="flex gap-2">
        {/* Priority filter dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsPriorityOpen(!isPriorityOpen)}
            className="px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg hover:border-[var(--neon-dim)] transition-colors text-sm flex items-center gap-2 min-w-[160px] justify-between"
          >
            <span style={{ color: selectedPriority?.color || 'var(--fg)' }}>
              {selectedPriority?.label || 'All priorities'}
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${isPriorityOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {isPriorityOpen && (
            <>
              {/* Backdrop to close dropdown */}
              <div className="fixed inset-0 z-10" onClick={() => setIsPriorityOpen(false)} />

              {/* Dropdown options */}
              <div
                className="absolute top-full left-0 mt-1 w-full rounded-lg shadow-lg z-20 overflow-hidden backdrop-blur-xl"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                }}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handlePriorityChange(option.value)}
                    className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2.5 ${
                      filterState.priority === option.value
                        ? 'bg-[var(--neon-dim)]'
                        : 'hover:bg-[var(--surface)]'
                    }`}
                  >
                    {option.color && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: option.color }}
                      />
                    )}
                    <span style={{ color: option.color || 'var(--fg)' }}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tags filter dropdown */}
        {allTags.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTagsOpen(!isTagsOpen)}
              className="px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg hover:border-[var(--neon-dim)] transition-colors text-sm flex items-center gap-2 min-w-[120px] justify-between"
            >
              <span style={{ color: filterState.tags.length > 0 ? 'var(--neon)' : 'var(--fg)' }}>
                {filterState.tags.length > 0 ? `Tags (${filterState.tags.length})` : 'Tags'}
              </span>
              <svg className={`w-4 h-4 transition-transform ${isTagsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isTagsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsTagsOpen(false)} />
                <div className="absolute top-full left-0 mt-1 min-w-[180px] rounded-lg shadow-lg z-20 overflow-hidden backdrop-blur-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  {allTags.map((tag) => {
                    const tc = getTagColor(tag)
                    const isActive = filterState.tags.includes(tag)
                    return (
                      <button key={tag} type="button" onClick={() => handleTagToggle(tag)} className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2.5 ${isActive ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tc.color }} />
                        <span style={{ color: tc.color }}>{tag}</span>
                        {isActive && (
                          <svg className="w-3.5 h-3.5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="var(--neon)"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>
                    )
                  })}
                  {filterState.tags.length > 0 && (
                    <button type="button" onClick={handleClearTags} className="w-full px-4 py-2 text-left text-xs transition-colors hover:bg-[var(--surface)]" style={{ color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
                      Clear tags
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Project filter dropdown */}
        {projects.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProjectOpen(!isProjectOpen)}
              className="px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg hover:border-[var(--neon-dim)] transition-colors text-sm flex items-center gap-2 min-w-[130px] justify-between"
            >
              <span style={{ color: filterState.projectId !== 'all' ? 'var(--cyan)' : 'var(--fg)' }}>
                {filterState.projectId !== 'all' ? projects.find((p) => p.id === filterState.projectId)?.name || 'Project' : 'Project'}
              </span>
              <svg className={`w-4 h-4 transition-transform ${isProjectOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isProjectOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsProjectOpen(false)} />
                <div className="absolute top-full left-0 mt-1 min-w-[180px] rounded-lg shadow-lg z-20 overflow-hidden backdrop-blur-xl" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <button type="button" onClick={() => handleProjectFilter('all')} className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${filterState.projectId === 'all' ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`} style={{ color: 'var(--fg)' }}>
                    All projects
                  </button>
                  {projects.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleProjectFilter(p.id)} className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${filterState.projectId === p.id ? 'bg-[var(--neon-dim)]' : 'hover:bg-[var(--surface)]'}`} style={{ color: 'var(--cyan)' }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Search input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tasks..."
            className="w-full px-4 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-colors pr-10"
          />

          {/* Clear button */}
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
