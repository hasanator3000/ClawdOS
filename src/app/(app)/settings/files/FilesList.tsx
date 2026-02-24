'use client'

import { useState, useTransition, useEffect } from 'react'
import type { AgentFile } from './page'
import { readAgentFile } from './actions'

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  core: { label: 'Core', color: 'var(--neon)', bg: 'rgba(167, 139, 250, 0.12)' },
  skills: { label: 'Skill', color: 'var(--cyan)', bg: 'rgba(0, 188, 212, 0.12)' },
  memory: { label: 'Memory', color: 'var(--warm)', bg: 'rgba(255, 171, 64, 0.12)' },
  config: { label: 'Config', color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)' },
}

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'core', label: 'Core' },
  { value: 'skills', label: 'Skills' },
  { value: 'memory', label: 'Memory' },
  { value: 'config', label: 'Config' },
]

interface FilesListProps {
  files: AgentFile[]
}

export function FilesList({ files }: FilesListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedFile, setSelectedFile] = useState<AgentFile | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = files.filter((f) => {
    if (selectedCategory !== 'all' && f.category !== selectedCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    }
    return true
  })

  const openFile = (file: AgentFile) => {
    setSelectedFile(file)
    setFileContent(null)
    startTransition(async () => {
      const result = await readAgentFile(file.path)
      if ('content' in result) setFileContent(result.content)
      else setFileContent(`Error: ${result.error}`)
    })
  }

  const closeFile = () => {
    setSelectedFile(null)
    setFileContent(null)
  }

  // Escape to close panel
  useEffect(() => {
    if (!selectedFile) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeFile() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedFile])

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search files..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
      />

      {/* Category tabs */}
      <div className="flex gap-2 border-b border-[var(--border)]">
        {CATEGORIES.map((cat) => {
          const count = cat.value === 'all' ? files.length : files.filter((f) => f.category === cat.value).length
          if (count === 0 && cat.value !== 'all') return null
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
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* File list */}
      {filtered.length > 0 ? (
        <div className="space-y-1.5">
          {filtered.map((file) => {
            const meta = CATEGORY_META[file.category]
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => openFile(file)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-[var(--surface)]"
                style={{ border: '1px solid var(--border)' }}
              >
                <span className="text-sm font-medium text-[var(--fg)] flex-1 truncate">{file.name}</span>
                {meta && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0" style={{ color: meta.color, background: meta.bg }}>
                    {meta.label}
                  </span>
                )}
                <span className="text-xs text-[var(--muted)] shrink-0 tabular-nums">{file.size}</span>
                <svg className="w-3.5 h-3.5 shrink-0 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-[var(--muted)]">No files match your search</div>
      )}

      {/* File viewer panel */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) closeFile() }}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-[560px] bg-[var(--bg)] border-l border-[var(--border)] flex flex-col shadow-2xl animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-sm font-semibold text-[var(--fg)] truncate">{selectedFile.name}</h2>
                {CATEGORY_META[selectedFile.category] && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
                    style={{ color: CATEGORY_META[selectedFile.category].color, background: CATEGORY_META[selectedFile.category].bg }}>
                    {CATEGORY_META[selectedFile.category].label}
                  </span>
                )}
              </div>
              <button type="button" onClick={closeFile} className="p-1 text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {isPending ? (
                <div className="text-sm text-[var(--muted)]">Loading...</div>
              ) : fileContent ? (
                <pre className="text-xs font-mono text-[var(--fg)] whitespace-pre-wrap break-words leading-relaxed">{fileContent}</pre>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--muted)] shrink-0">
              {selectedFile.path} &middot; {selectedFile.size}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.2s ease-out; }
      `}</style>
    </div>
  )
}
