'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { AgentFile, FileCategory } from './page'
import { readAgentFile, writeAgentFile } from './actions'
import { FilePanel } from './FilePanel'
import { CreateFileModal } from './CreateFileModal'

const CATEGORY_META: Record<FileCategory, { label: string; color: string; bg: string; description: string }> = {
  'agent-core':    { label: 'Agent Core',    color: 'var(--neon)',  bg: 'rgba(167, 139, 250, 0.12)', description: 'Identity, soul, tools — who the agent is' },
  'agent-rules':   { label: 'Agent Rules',   color: 'var(--green)', bg: 'rgba(110, 231, 183, 0.12)', description: 'Behavior rules loaded into agent system prompt' },
  'clawdos-rules': { label: 'ClawdOS Rules', color: 'var(--cyan)',  bg: 'rgba(0, 188, 212, 0.12)',   description: 'Developer guide for this codebase (RULES/)' },
  'skills':        { label: 'Skills',        color: 'var(--warm)',  bg: 'rgba(255, 171, 64, 0.12)',   description: 'Installed workspace skill definitions' },
  'memory':        { label: 'Memory',        color: 'var(--fg)',    bg: 'rgba(255, 255, 255, 0.06)',  description: 'Persistent agent memory and context' },
  'config':        { label: 'Config',        color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)',  description: 'Agent configuration files' },
  'claude-rules':  { label: 'Claude Rules',  color: 'var(--red)',   bg: 'rgba(251, 113, 133, 0.12)',  description: 'Claude Code rules (~/.claude/rules/)' },
}

const CATEGORY_ORDER: FileCategory[] = [
  'agent-core', 'agent-rules', 'clawdos-rules', 'skills', 'memory', 'config', 'claude-rules',
]

const CREATABLE_CATEGORIES: FileCategory[] = [
  'agent-core', 'agent-rules', 'clawdos-rules', 'memory', 'config', 'claude-rules',
]

export function FilesList({ files }: { files: AgentFile[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | FileCategory>('all')
  const [selectedFile, setSelectedFile] = useState<AgentFile | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
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

  const grouped = CATEGORY_ORDER
    .map((cat) => ({ cat, files: filtered.filter((f) => f.category === cat) }))
    .filter((g) => g.files.length > 0)

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

  useEffect(() => {
    if (!selectedFile) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isEditing) cancelEditing()
        else closeFile()
      }
      if (isEditing && (e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveFile()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, isEditing, editContent, fileContent])

  const createCategory = selectedCategory !== 'all' && CREATABLE_CATEGORIES.includes(selectedCategory)
    ? selectedCategory
    : undefined

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--fg)] placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
        />
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--fg)] transition-colors hover:border-[var(--neon-dim)] hover:text-[var(--neon)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New File
        </button>
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="All" count={files.length} active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')} />
        {CATEGORY_ORDER.map((cat) => {
          const count = files.filter((f) => f.category === cat).length
          if (count === 0) return null
          return (
            <FilterChip
              key={cat}
              label={CATEGORY_META[cat].label}
              count={count}
              active={selectedCategory === cat}
              color={CATEGORY_META[cat].color}
              onClick={() => setSelectedCategory(cat)}
            />
          )
        })}
      </div>

      {/* File list */}
      {selectedCategory === 'all' ? (
        grouped.map(({ cat, files: catFiles }) => (
          <CategoryGroup key={cat} meta={CATEGORY_META[cat]} files={catFiles} onOpen={openFile} />
        ))
      ) : filtered.length > 0 ? (
        <div className="space-y-1.5">
          {filtered.map((file) => <FileRow key={file.path} file={file} meta={CATEGORY_META[file.category]} onOpen={openFile} />)}
        </div>
      ) : (
        <div className="py-12 text-center text-[var(--muted)]">No files match your search</div>
      )}

      {/* Overlays */}
      {selectedFile && (
        <FilePanel
          file={selectedFile} content={fileContent}
          isLoading={isPending && !isEditing} isEditing={isEditing}
          editContent={editContent} saveStatus={saveStatus} saveError={saveError}
          textareaRef={textareaRef}
          onEdit={startEditing} onCancelEdit={cancelEditing}
          onSave={saveFile} onClose={closeFile} onEditChange={setEditContent}
        />
      )}
      {showCreate && (
        <CreateFileModal defaultCategory={createCategory} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}

/* ─── Leaf components ─── */

function FilterChip({ label, count, active, color, onClick }: {
  label: string; count: number; active: boolean; color?: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
        active
          ? 'border border-[var(--neon-dim)] bg-[rgba(167,139,250,0.1)] text-[var(--fg)]'
          : 'border border-[var(--border)] text-[var(--muted)] hover:text-[var(--fg)] hover:border-[var(--neon-dim)]'
      }`}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  )
}

function CategoryGroup({ meta, files, onOpen }: {
  meta: { label: string; color: string; description: string }; files: AgentFile[]; onOpen: (f: AgentFile) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pt-2">
        <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
        <h3 className="text-sm font-semibold text-[var(--fg)]">{meta.label}</h3>
        <span className="text-xs text-[var(--muted)]">{meta.description}</span>
      </div>
      <div className="space-y-1.5">
        {files.map((file) => <FileRow key={file.path} file={file} meta={CATEGORY_META[file.category]} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

function FileRow({ file, meta, onOpen }: {
  file: AgentFile; meta: { label: string; color: string; bg: string }; onOpen: (f: AgentFile) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(file)}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors border border-[var(--border)] bg-[var(--card)] hover:border-[var(--neon-dim)]"
    >
      <span className="text-[14px] font-medium text-[var(--fg)] flex-1 truncate">{file.name}</span>
      {file.readOnly && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded text-[var(--muted)] bg-[rgba(128,128,128,0.12)]">read-only</span>
      )}
      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0" style={{ color: meta.color, background: meta.bg }}>
        {meta.label}
      </span>
      <span className="text-xs text-[var(--muted)] shrink-0 tabular-nums">{file.size}</span>
      <svg className="w-4 h-4 shrink-0 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
