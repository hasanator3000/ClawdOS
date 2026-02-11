'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { setupNewsTopics } from './actions'

const SUGGESTIONS = ['AI', 'Crypto', 'Tech', 'Science', 'Economy', 'Gaming', 'Startups', 'Space']

interface Props {
  onManualSetup: () => void
  onSetupComplete: () => void
}

export function NewsOnboarding({ onManualSetup, onSetupComplete }: Props) {
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const addSuggestion = (s: string) => {
    setInput((prev) => {
      const current = prev.trim()
      // Don't add duplicates
      const parts = current.split(/[,\s]+/).map((p) => p.toLowerCase())
      if (parts.includes(s.toLowerCase())) return prev
      return current ? `${current}, ${s}` : s
    })
    inputRef.current?.focus()
  }

  const handleSetup = () => {
    if (!input.trim() || isPending) return
    setError(null)

    startTransition(async () => {
      const result = await setupNewsTopics(input.trim())

      if (result.error) {
        setError(result.error)
        return
      }

      onSetupComplete()
    })
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Set up your news feed</h2>
        <p className="text-[var(--muted)] max-w-md">
          Describe what topics you want to follow. We'll find the best RSS sources and set everything up.
        </p>
      </div>

      {/* Input */}
      <div className="w-full max-w-lg space-y-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSetup() }}
            placeholder="e.g. AI, ecology, medicine, space..."
            disabled={isPending}
            className="flex-1 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSetup}
            disabled={!input.trim() || isPending}
            className="px-5 py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            style={{
              background: 'linear-gradient(135deg, var(--neon), var(--pink))',
              color: 'var(--bg)',
            }}
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Setting up...
              </span>
            ) : (
              'Set up'
            )}
          </button>
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              disabled={isPending}
              onClick={() => addSuggestion(s)}
              className="px-3 py-1 rounded-full text-xs border border-[var(--border)] text-[var(--muted)] hover:text-[var(--neon)] hover:border-[var(--neon)] transition-colors disabled:opacity-50"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-[var(--red)] max-w-md text-center">{error}</p>
      )}

      <button
        type="button"
        onClick={onManualSetup}
        disabled={isPending}
        className="text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
      >
        or add sources manually
      </button>
    </div>
  )
}
