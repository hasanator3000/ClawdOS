'use client'

import { useState } from 'react'

export type FilterStatus = 'all' | 'active' | 'completed'

export interface TaskFilterState {
  status: FilterStatus
  priority: number | 'all'
}

interface TaskFiltersProps {
  onFilterChange: (filters: TaskFilterState) => void
  onSearchChange: (query: string) => void
  activeTasks: number
  completedTasks: number
  totalTasks: number
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
}: TaskFiltersProps) {
  const [filterState, setFilterState] = useState<TaskFilterState>({
    status: 'all',
    priority: 'all',
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [isPriorityOpen, setIsPriorityOpen] = useState(false)

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
              <div className="absolute top-full left-0 mt-1 w-full bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-lg z-20 overflow-hidden">
                {PRIORITY_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handlePriorityChange(option.value)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--neon-dim)] transition-colors"
                    style={{ color: option.color }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Search input */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search tasks by title..."
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
