'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { commandRegistry, registerNavigationCommands, type Command } from '@/lib/commands/registry'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [commands, setCommands] = useState<Command[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Register navigation commands on mount
  useEffect(() => {
    registerNavigationCommands(router)
  }, [router])

  // Subscribe to command changes
  useEffect(() => {
    return commandRegistry.subscribe(setCommands)
  }, [])

  // Filter commands based on query (memoized to avoid new array every render)
  const filteredCommands = useMemo(
    () => (query ? commandRegistry.search(query) : commands),
    [query, commands]
  )

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Small delay to ensure modal is rendered
      const timerId = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timerId)
    }
  }, [isOpen])

  // Refs for stable keyboard handler
  const filteredRef = useRef(filteredCommands)
  filteredRef.current = filteredCommands
  const selectedRef = useRef(selectedIndex)
  selectedRef.current = selectedIndex

  // Handle keyboard navigation (stable callback — no deps churn)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filteredRef.current.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredRef.current[selectedRef.current]) {
          executeCommand(filteredRef.current[selectedRef.current])
        }
        break
    }
  }, [])

  const executeCommand = async (command: Command) => {
    onClose()
    await command.action()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[var(--card)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="p-3 border-b border-[var(--border)]">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="w-full bg-transparent outline-none text-[var(--fg)] placeholder:text-[var(--muted)]"
          />
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-[var(--muted)]">No commands found</div>
          ) : (
            <ul className="py-2">
              {filteredCommands.map((cmd, index) => (
                <li key={cmd.id}>
                  <button
                    type="button"
                    className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${
                      index === selectedIndex
                        ? 'bg-[var(--hover)] text-[var(--fg)]'
                        : 'text-[var(--fg)] hover:bg-[var(--hover)]'
                    }`}
                    onClick={() => executeCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="flex-1">
                      <span className="font-medium">{cmd.name}</span>
                      {cmd.description && (
                        <span className="ml-2 text-sm text-[var(--muted)]">{cmd.description}</span>
                      )}
                    </span>
                    {cmd.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs bg-[var(--bg)] border border-[var(--border)] rounded">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--muted)] flex gap-4">
          <span>↑↓ Navigate</span>
          <span>↵ Execute</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  )
}
