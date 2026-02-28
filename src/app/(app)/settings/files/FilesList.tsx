'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { AgentFile } from './page'
import { readAgentFile, writeAgentFile } from './actions'

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  core: { label: 'Core', color: 'var(--neon)', bg: 'rgba(167, 139, 250, 0.12)' },
  skills: { label: 'Skill', color: 'var(--cyan)', bg: 'rgba(0, 188, 212, 0.12)' },
  memory: { label: 'Memory', color: 'var(--warm)', bg: 'rgba(255, 171, 64, 0.12)' },
  rules: { label: 'Rules', color: 'var(--green)', bg: 'rgba(110, 231, 183, 0.12)' },
  config: { label: 'Config', color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)' },
}

const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'core', label: 'Core' },
  { value: 'skills', label: 'Skills' },
  { value: 'memory', label: 'Memory' },
  { value: 'rules', label: 'Rules' },
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
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    setIsEditing(false)
    setSaveStatus('idle')
    startTransition(async () => {
      const result = await readAgentFile(file.path)
      if ('content' in result) setFileContent(result.content)
      else setFileContent(`Error: ${result.error}`)
    })
  }

  const closeFile = () => {
    if (isEditing && editContent !== fileContent) {
      if (!confirm('Discard unsaved changes?')) return
    }
    setSelectedFile(null)
    setFileContent(null)
    setIsEditing(false)
    setSaveStatus('idle')
  }

  const startEditing = () => {
    if (!fileContent) return
    setEditContent(fileContent)
    setIsEditing(true)
    setSaveStatus('idle')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const cancelEditing = () => {
    if (editContent !== fileContent) {
      if (!confirm('Discard unsaved changes?')) return
    }
    setIsEditing(false)
    setSaveStatus('idle')
  }

  const saveFile = () => {
    if (!selectedFile) return
    setSaveStatus('saving')
    setSaveError('')
    startTransition(async () => {
      const result = await writeAgentFile(selectedFile.path, editContent)
      if ('ok' in result) {
        setFileContent(editContent)
        setSaveStatus('saved')
        setIsEditing(false)
        setTimeout(() => setSaveStatus('idle'), 2000)
      } else {
        setSaveStatus('error')
        setSaveError(result.error)
      }
    })
  }

  // Keyboard shortcuts
  useEffect(() => {
    if (!selectedFile) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) cancelEditing()
        else closeFile()
      }
      // Ctrl+S / Cmd+S to save when editing
      if (isEditing && (e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveFile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cancelEditing/closeFile/saveFile are stable within render
  }, [selectedFile, isEditing, editContent, fileContent])

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
        <div className="space-y-2.5">
          {filtered.map((file) => {
            const meta = CATEGORY_META[file.category]
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => openFile(file)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors border border-[var(--border)] bg-[var(--card)] hover:border-[var(--neon-dim)]"
              >
                <span className="text-[15px] font-medium text-[var(--fg)] flex-1 truncate">{file.name}</span>
                {meta && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0" style={{ color: meta.color, background: meta.bg }}>
                    {meta.label}
                  </span>
                )}
                <span className="text-xs text-[var(--muted)] shrink-0 tabular-nums">{file.size}</span>
                <svg className="w-4 h-4 shrink-0 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-[var(--muted)]">No files match your search</div>
      )}

      {/* File viewer/editor panel */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) closeFile() }}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative w-full max-w-[640px] bg-[var(--bg)] border-l border-[var(--border)] flex flex-col shadow-2xl animate-slide-in">
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
              <div className="flex items-center gap-1.5">
                {!isEditing && fileContent && !fileContent.startsWith('Error:') && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors text-[var(--fg)] hover:bg-[var(--surface)] border border-[var(--border)]"
                    
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                )}
                {saveStatus === 'saved' && (
                  <span className="text-xs text-[var(--green)] font-medium px-2">Saved</span>
                )}
                <button type="button" onClick={closeFile} className="p-1 text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isPending && !isEditing ? (
                <div className="p-4 text-sm text-[var(--muted)]">Loading...</div>
              ) : isEditing ? (
                <textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  spellCheck={false}
                  className="w-full h-full min-h-[400px] p-4 text-xs font-mono text-[var(--fg)] bg-transparent leading-relaxed resize-none focus:outline-none"
                  style={{ tabSize: 2 }}
                />
              ) : fileContent ? (
                <pre className="p-4 text-xs font-mono text-[var(--fg)] whitespace-pre-wrap break-words leading-relaxed">{fileContent}</pre>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-[var(--border)] shrink-0">
              {isEditing ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {saveStatus === 'error' && (
                      <span className="text-xs text-[var(--red)]">{saveError}</span>
                    )}
                    <span className="text-xs text-[var(--muted)]">
                      {editContent !== fileContent ? 'Unsaved changes' : 'No changes'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="px-3 py-1.5 text-xs font-medium rounded-md text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveFile}
                      disabled={isPending || editContent === fileContent}
                      className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40"
                      style={{
                        background: 'var(--neon)',
                        color: 'var(--bg)',
                      }}
                    >
                      {isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--muted)]">
                  {selectedFile.path} &middot; {selectedFile.size}
                </div>
              )}
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
