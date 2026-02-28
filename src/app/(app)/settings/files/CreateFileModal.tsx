'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { FileCategory } from './page'
import { createAgentFile } from './actions'

const CATEGORY_META: Record<string, { label: string; color: string; description: string }> = {
  'agent-core':    { label: 'Agent Core',    color: 'var(--neon)',  description: 'Identity, soul, tools — who the agent is' },
  'agent-rules':   { label: 'Agent Rules',   color: 'var(--green)', description: 'Behavior rules loaded into agent system prompt' },
  'clawdos-rules': { label: 'ClawdOS Rules', color: 'var(--cyan)',  description: 'Developer guide for this codebase (RULES/)' },
  'memory':        { label: 'Memory',        color: 'var(--fg)',    description: 'Persistent agent memory and context' },
  'config':        { label: 'Config',        color: 'var(--muted)', description: 'Agent configuration files' },
  'claude-rules':  { label: 'Claude Rules',  color: 'var(--red)',   description: 'Claude Code rules (~/.claude/rules/)' },
}

const CREATABLE_CATEGORIES: FileCategory[] = [
  'agent-core', 'agent-rules', 'clawdos-rules', 'memory', 'config', 'claude-rules',
]

interface CreateFileModalProps {
  defaultCategory?: FileCategory
  onClose: () => void
}

export function CreateFileModal({ defaultCategory, onClose }: CreateFileModalProps) {
  const [category, setCategory] = useState<FileCategory>(defaultCategory ?? 'agent-rules')
  const [fileName, setFileName] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleCreate = () => {
    if (!fileName.trim()) { setError('File name required'); return }
    setError('')
    startTransition(async () => {
      const result = await createAgentFile(category, fileName.trim(), content)
      if ('ok' in result) {
        onClose()
        window.location.reload()
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 shadow-2xl space-y-4">
        <h2 className="text-lg font-semibold text-[var(--fg)]">Create New File</h2>

        {/* Category select */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CREATABLE_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat]
              const active = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    active
                      ? 'border border-[var(--neon-dim)] bg-[rgba(167,139,250,0.1)] text-[var(--fg)]'
                      : 'border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)]'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                  {meta.label}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-[var(--muted)]">{CATEGORY_META[category].description}</p>
        </div>

        {/* File name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">File Name</label>
          <input
            ref={inputRef}
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="example.md"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleCreate() }}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-mono text-[var(--fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
          />
        </div>

        {/* Initial content */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--muted)]">Content (optional)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="# New file"
            rows={6}
            spellCheck={false}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-mono text-[var(--fg)] placeholder:text-[var(--input-placeholder)] leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            style={{ tabSize: 2 }}
          />
        </div>

        {/* Error */}
        {error && <p className="text-xs text-[var(--red)]">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleCreate} disabled={isPending || !fileName.trim()}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-40"
            style={{ background: 'var(--neon)', color: 'var(--bg)' }}>
            {isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
