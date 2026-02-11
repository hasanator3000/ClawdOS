'use client'

import { useState, useTransition } from 'react'
import { setupNewsTopics } from './actions'

const TOPICS = [
  { key: 'ai', label: 'AI', emoji: '🤖' },
  { key: 'crypto', label: 'Crypto', emoji: '₿' },
  { key: 'tech', label: 'Tech', emoji: '💻' },
  { key: 'russian', label: 'Russian', emoji: '🇷🇺' },
  { key: 'economy', label: 'Economy', emoji: '📈' },
]

interface Props {
  onManualSetup: () => void
  onSetupComplete: () => void
}

export function NewsOnboarding({ onManualSetup, onSetupComplete }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleSetup = () => {
    if (selected.size === 0) return
    setError(null)
    setProgress('Creating tabs and sources...')

    startTransition(async () => {
      const result = await setupNewsTopics(Array.from(selected))

      if (result.error) {
        setError(result.error)
        setProgress(null)
        return
      }

      setProgress(null)
      onSetupComplete()
    })
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">Set up your news feed</h2>
        <p className="text-[var(--muted)] max-w-md">
          Pick topics you want to follow. We'll create tabs and add the best RSS sources for each.
        </p>
      </div>

      {/* Topic chips */}
      <div className="flex flex-wrap justify-center gap-3 max-w-lg">
        {TOPICS.map((topic) => {
          const isSelected = selected.has(topic.key)
          return (
            <button
              key={topic.key}
              type="button"
              disabled={isPending}
              onClick={() => toggle(topic.key)}
              className={`
                px-5 py-3 rounded-xl text-sm font-medium transition-all
                ${isSelected
                  ? 'bg-[var(--fg)] text-[var(--bg)] scale-105'
                  : 'bg-[var(--card)] border border-[var(--border)] hover:border-[var(--fg)] hover:bg-[var(--hover)]'
                }
                ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <span className="mr-1.5">{topic.emoji}</span>
              {topic.label}
            </button>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleSetup}
          disabled={selected.size === 0 || isPending}
          className="px-6 py-2.5 bg-[var(--fg)] text-[var(--bg)] rounded-lg text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed min-w-[200px]"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {progress || 'Setting up...'}
            </span>
          ) : (
            `Set up ${selected.size > 0 ? selected.size : ''} topic${selected.size !== 1 ? 's' : ''}`
          )}
        </button>

        <button
          type="button"
          onClick={onManualSetup}
          disabled={isPending}
          className="text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          or add sources manually
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 max-w-md text-center">{error}</p>
      )}
    </div>
  )
}
