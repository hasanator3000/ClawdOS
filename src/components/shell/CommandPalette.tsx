'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { commandRegistry, registerNavigationCommands, type Command } from '@/lib/commands/registry'

const CATEGORY_LABELS: Record<string, string> = {
  navigation: 'Pages',
  workspace: 'Workspaces',
  action: 'Actions',
}

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

  // Filter commands based on query
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
      const timerId = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timerId)
    }
  }, [isOpen])

  // Refs for stable keyboard handler
  const filteredRef = useRef(filteredCommands)
  filteredRef.current = filteredCommands
  const selectedRef = useRef(selectedIndex)
  selectedRef.current = selectedIndex

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
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(6,6,10,0.97)',
          border: '1px solid var(--border)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.6), 0 0 0 1px var(--border)',
        }}
      >
        {/* Search input */}
        <div className="p-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="w-full bg-transparent outline-none text-sm"
            style={{
              color: 'var(--fg)',
              fontFamily: 'var(--font-outfit, Outfit, sans-serif)',
            }}
          />
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--muted)' }}>
              No commands found
            </div>
          ) : (
            <ul className="py-1">
              {filteredCommands.map((cmd, index) => {
                const prevCategory = index > 0 ? filteredCommands[index - 1].category : null
                const showHeader = cmd.category !== prevCategory

                return (
                  <li key={cmd.id}>
                    {showHeader && (
                      <div
                        className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest font-mono"
                        style={{ color: 'var(--muted)' }}
                      >
                        {CATEGORY_LABELS[cmd.category] || cmd.category}
                      </div>
                    )}
                    <button
                      type="button"
                      className="w-full px-4 py-2 text-left flex items-center gap-3 transition-colors"
                      style={{
                        background: index === selectedIndex ? 'var(--hover)' : 'transparent',
                        color: 'var(--fg)',
                      }}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <span className="flex-1">
                        <span className="font-medium text-sm">{cmd.name}</span>
                        {cmd.description && (
                          <span className="ml-2 text-xs" style={{ color: 'var(--muted)' }}>
                            {cmd.description}
                          </span>
                        )}
                      </span>
                      {cmd.shortcut && (
                        <kbd
                          className="px-2 py-0.5 text-[10px] font-mono rounded"
                          style={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: 'var(--muted)',
                          }}
                        >
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div
          className="px-4 py-2 text-[10px] flex gap-4 font-mono"
          style={{
            borderTop: '1px solid var(--border)',
            color: 'var(--muted)',
          }}
        >
          <span>↑↓ Navigate</span>
          <span>↵ Execute</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  )
}
