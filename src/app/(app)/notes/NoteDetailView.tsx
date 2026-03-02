'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { Note } from '@/lib/db/repositories/note.repository'
import { updateNoteAction, deleteNoteAction } from './actions'
import { createClientLogger } from '@/lib/client-logger'
import { slateToMarkdown } from '@/lib/slate-to-markdown'
import { EmojiPicker, COVER_GRADIENTS } from '@/components/editor/EmojiPicker'

const NoteEditor = dynamic(
  () => import('@/components/editor/NoteEditor').then(
    (m) => ({ default: m.NoteEditor }),
    () => ({ default: () => <div className="p-4 text-[var(--red)]">Editor failed to load. Try refreshing.</div> })
  ),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-lg bg-[var(--hover)]" /> }
)

const log = createClientLogger('note-detail')

/** SVG tiled emoji pattern — grid is rotated but emojis stay upright */
function emojiPattern(icon: string): string {
  // Tile with two emojis at different sizes; the div rotates the grid,
  // the SVG counter-rotates each glyph so emojis stay upright
  const r = 10 // grid rotation angle (applied on the div)
  const svg = [
    `<svg xmlns='http://www.w3.org/2000/svg' width='110' height='100'>`,
    `<text x='28' y='38' font-size='30' text-anchor='middle' dominant-baseline='central' opacity='0.1' transform='rotate(${r},28,38)'>${icon}</text>`,
    `<text x='83' y='78' font-size='22' text-anchor='middle' dominant-baseline='central' opacity='0.06' transform='rotate(${r},83,78)'>${icon}</text>`,
    `</svg>`,
  ].join('')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

interface NoteDetailViewProps {
  note: Note
  onBack: () => void
  onUpdate: (note: Note) => void
  onDelete: (id: string) => void
}

export function NoteDetailView({ note, onBack, onUpdate, onDelete }: NoteDetailViewProps) {
  const [title, setTitle] = useState(note.title)
  const [isPinned, setIsPinned] = useState(note.isPinned)
  const [isArchived, setIsArchived] = useState(note.status === 'archived')
  const [saving, setSaving] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showCoverPicker, setShowCoverPicker] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Sync when note prop changes
  useEffect(() => {
    setTitle(note.title)
    setIsPinned(note.isPinned)
    setIsArchived(note.status === 'archived')
  }, [note.id, note.title, note.isPinned, note.status])

  // Auto-resize title textarea
  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [title])

  const saveTitle = useCallback(async () => {
    const trimmed = title.trim()
    if (!trimmed || trimmed === note.title) return
    setSaving(true)
    const result = await updateNoteAction(note.id, { title: trimmed })
    if (result.note) onUpdate(result.note)
    else log.error('Title save failed', { error: result.error })
    setSaving(false)
  }, [title, note.id, note.title, onUpdate])

  const saveContent = useCallback(async (value: unknown[]) => {
    const result = await updateNoteAction(note.id, { content: value })
    if (result.note) onUpdate(result.note)
    else log.error('Content save failed', { error: result.error })
  }, [note.id, onUpdate])

  const togglePin = useCallback(async () => {
    const next = !isPinned
    setIsPinned(next)
    const result = await updateNoteAction(note.id, { isPinned: next })
    if (result.note) onUpdate(result.note)
  }, [isPinned, note.id, onUpdate])

  const toggleArchive = useCallback(async () => {
    const next = !isArchived
    setIsArchived(next)
    const result = await updateNoteAction(note.id, { status: next ? 'archived' : 'active' })
    if (result.note) onUpdate(result.note)
  }, [isArchived, note.id, onUpdate])

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this note permanently?')) return
    const result = await deleteNoteAction(note.id)
    if (result.success) onDelete(note.id)
    else log.error('Delete failed', { error: result.error })
  }, [note.id, onDelete])

  const handleExportMarkdown = useCallback(() => {
    const md = slateToMarkdown(note.content as unknown[])
    const full = `# ${note.title || 'Untitled'}\n\n${md}`
    const blob = new Blob([full], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(note.title || 'untitled').replace(/[^a-zA-Z0-9-_ ]/g, '').trim()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [note.content, note.title])

  const handleSetIcon = useCallback(async (emoji: string) => {
    setShowEmojiPicker(false)
    const result = await updateNoteAction(note.id, { icon: emoji })
    if (result.note) onUpdate(result.note)
  }, [note.id, onUpdate])

  const handleRemoveIcon = useCallback(async () => {
    setShowEmojiPicker(false)
    const result = await updateNoteAction(note.id, { icon: null })
    if (result.note) onUpdate(result.note)
  }, [note.id, onUpdate])

  const handleSetCover = useCallback(async (gradient: string) => {
    setShowCoverPicker(false)
    const result = await updateNoteAction(note.id, { coverImage: gradient })
    if (result.note) onUpdate(result.note)
  }, [note.id, onUpdate])

  const handleRemoveCover = useCallback(async () => {
    setShowCoverPicker(false)
    const result = await updateNoteAction(note.id, { coverImage: null })
    if (result.note) onUpdate(result.note)
  }, [note.id, onUpdate])

  return (
    <div className="max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          All Notes
        </button>

        <div className="flex items-center gap-1">
          {saving && <span className="text-xs text-[var(--muted)] mr-2">Saving...</span>}

          <button
            onClick={togglePin}
            title={isPinned ? 'Unpin' : 'Pin'}
            className={`p-2 rounded-lg transition-colors ${isPinned ? 'text-[var(--warm)]' : 'text-[var(--muted)] hover:text-[var(--warm)]'}`}
          >
            <svg className="w-4 h-4" fill={isPinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
            </svg>
          </button>

          <button
            onClick={toggleArchive}
            title={isArchived ? 'Restore' : 'Archive'}
            className={`p-2 rounded-lg transition-colors ${isArchived ? 'text-[var(--neon)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 1 1 0-4h14a2 2 0 1 1 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h4" />
            </svg>
          </button>

          <button
            onClick={handleExportMarkdown}
            title="Export Markdown"
            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
            </svg>
          </button>

          <button
            onClick={handleDelete}
            title="Delete"
            className="p-2 rounded-lg text-[var(--muted)] hover:text-[var(--red)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Cover image */}
      {note.coverImage && (
        <div
          className="relative h-40 rounded-xl mb-4 -mx-2 group overflow-hidden"
          style={{ background: note.coverImage }}
        >
          {/* Emoji tiled pattern overlay */}
          {note.icon && (
            <div
              className="absolute -inset-6 pointer-events-none"
              aria-hidden="true"
              style={{
                backgroundImage: emojiPattern(note.icon),
                backgroundRepeat: 'repeat',
                backgroundSize: '110px 100px',
                transform: 'rotate(-10deg) scale(1.15)',
              }}
            />
          )}
          {/* Hover buttons on cover */}
          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              type="button"
              onClick={() => setShowCoverPicker(true)}
              className="px-2.5 py-1 rounded-md bg-black/60 text-xs text-[var(--fg)] hover:bg-black/80 transition-colors"
            >
              Change cover
            </button>
            <button
              type="button"
              onClick={handleRemoveCover}
              className="px-2.5 py-1 rounded-md bg-black/60 text-xs text-[var(--fg)] hover:bg-black/80 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {/* Action buttons: Add icon / Add cover (shown when missing) */}
      {(!note.icon || !note.coverImage) && (
        <div className="flex items-center gap-2 mb-2">
          {!note.icon && (
            <button
              type="button"
              onClick={() => { setShowCoverPicker(false); setShowEmojiPicker(true) }}
              className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              + Add icon
            </button>
          )}
          {!note.coverImage && (
            <button
              type="button"
              onClick={() => { setShowEmojiPicker(false); setShowCoverPicker(true) }}
              className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              + Add cover
            </button>
          )}
        </div>
      )}

      {/* Cover picker */}
      {showCoverPicker && (
        <div className="relative mb-3">
          <CoverPicker
            onSelect={handleSetCover}
            onRemove={handleRemoveCover}
            onClose={() => setShowCoverPicker(false)}
          />
        </div>
      )}

      {/* Icon + Title */}
      <div className="relative">
        {note.icon && (
          <div className="relative inline-block mb-2">
            <button
              type="button"
              onClick={() => { setShowCoverPicker(false); setShowEmojiPicker(true) }}
              className="text-5xl hover:opacity-80 transition-opacity cursor-pointer"
              title="Change icon"
            >
              {note.icon}
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <div className="absolute left-0 z-50" style={{ top: note.icon ? '64px' : '0px' }}>
            <EmojiPicker
              onSelect={handleSetIcon}
              onRemove={handleRemoveIcon}
              onClose={() => setShowEmojiPicker(false)}
            />
          </div>
        )}

        {/* Notion-style title */}
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveTitle() } }}
          placeholder="Untitled"
          rows={1}
          className="w-full text-3xl font-bold bg-transparent border-none outline-none resize-none text-[var(--fg)] placeholder:text-[var(--muted-2)] mb-1 leading-tight"
        />
      </div>

      {/* Meta: tags + date */}
      <div className="flex items-center gap-3 mb-6 text-xs text-[var(--muted)]">
        <span>{new Date(note.updatedAt).toLocaleString()}</span>
        {note.tags.length > 0 && (
          <div className="flex gap-1">
            {note.tags.map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded bg-[rgba(167,139,250,0.1)] text-[var(--neon)]">{t}</span>
            ))}
          </div>
        )}
        {isArchived && (
          <span className="px-1.5 py-0.5 rounded bg-[rgba(128,128,128,0.12)] text-[var(--muted)]">archived</span>
        )}
      </div>

      {/* Editor */}
      <NoteEditor
        initialValue={note.content as unknown[]}
        onChange={saveContent}
        showToolbar
        minHeight="calc(100vh - 320px)"
      />
    </div>
  )
}

// ── Cover Picker ─────────────────────────────────────────

function CoverPicker({ onSelect, onRemove, onClose }: { onSelect: (gradient: string) => void; onRemove: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  return (
    <div ref={ref} className="absolute left-0 top-0 z-50 w-80 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-xl shadow-black/50 p-3">
      <div className="text-xs text-[var(--muted)] mb-2 font-medium">Gradient covers</div>
      <div className="grid grid-cols-4 gap-2">
        {COVER_GRADIENTS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onSelect(g)}
            className="h-12 rounded-lg border border-[var(--border)] hover:border-[var(--neon)] transition-colors"
            style={{ background: g }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="w-full mt-2 px-2 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--red)] rounded-md hover:bg-[var(--hover)] transition-colors"
      >
        Remove cover
      </button>
    </div>
  )
}
