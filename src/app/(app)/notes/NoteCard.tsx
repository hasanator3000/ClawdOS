'use client'

import type { Note } from '@/lib/db/repositories/note.repository'

/** SVG tiled emoji pattern — grid is rotated but emojis stay upright */
function emojiPattern(icon: string): string {
  const r = 10 // grid rotation angle (applied on the div)
  const svg = [
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='70'>`,
    `<text x='20' y='28' font-size='20' text-anchor='middle' dominant-baseline='central' opacity='0.12' transform='rotate(${r},20,28)'>${icon}</text>`,
    `<text x='60' y='58' font-size='15' text-anchor='middle' dominant-baseline='central' opacity='0.07' transform='rotate(${r},60,58)'>${icon}</text>`,
    `</svg>`,
  ].join('')
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/** Extract plain text preview from Plate JSON content */
function extractPreview(content: unknown[], maxLen = 140): string {
  const texts: string[] = []

  function walk(nodes: unknown[]) {
    for (const node of nodes) {
      if (typeof node !== 'object' || node === null) continue
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string' && n.text) texts.push(n.text)
      if (Array.isArray(n.children)) walk(n.children)
    }
  }

  walk(content)
  const joined = texts.join(' ').replace(/\s+/g, ' ').trim()
  return joined.length > maxLen ? joined.slice(0, maxLen) + '...' : joined
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const COLOR_MAP: Record<string, string> = {
  red: 'bg-[var(--red)]',
  green: 'bg-[var(--green)]',
  blue: 'bg-[var(--neon)]',
  yellow: 'bg-[var(--warm)]',
  purple: 'bg-[var(--neon)]',
  pink: 'bg-[var(--pink)]',
  cyan: 'bg-[var(--cyan)]',
}

/** CSS mask that fades content at the bottom — invisible when content is short */
const FADE_MASK = 'linear-gradient(to bottom, black calc(100% - 32px), transparent 100%)'

interface NoteCardProps {
  note: Note
  onEdit: () => void
  onPin: () => void
  onArchive: () => void
  onDelete: () => void
}

export function NoteCard({ note, onEdit, onPin, onArchive, onDelete }: NoteCardProps) {
  const preview = extractPreview(note.content as unknown[])
  const colorClass = note.color ? COLOR_MAP[note.color] ?? '' : ''

  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full h-[200px] text-left flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--neon-dim)] hover:shadow-[0_0_20px_rgba(167,139,250,0.04)] group relative overflow-hidden"
    >
      {/* Cover gradient or color strip at top */}
      {note.coverImage ? (
        <div className="relative h-16 w-full shrink-0 overflow-hidden" style={{ background: note.coverImage }}>
          {note.icon && (
            <div
              className="absolute -inset-4 pointer-events-none"
              aria-hidden="true"
              style={{
                backgroundImage: emojiPattern(note.icon),
                backgroundRepeat: 'repeat',
                backgroundSize: '80px 70px',
                transform: 'rotate(-10deg) scale(1.2)',
              }}
            />
          )}
        </div>
      ) : (
        colorClass && <div className={`h-1 w-full ${colorClass} opacity-60`} />
      )}

      <div
        className="flex-1 p-4 overflow-hidden"
        style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
      >
        {/* Title row */}
        <div className="flex items-start gap-2 mb-1.5">
          {note.icon && (
            <span className="text-lg shrink-0 leading-none mt-0.5">{note.icon}</span>
          )}
          {!note.icon && note.isPinned && (
            <span className="text-[var(--warm)] shrink-0 mt-0.5" title="Pinned">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
              </svg>
            </span>
          )}
          <h3 className="text-[15px] font-medium text-[var(--fg)] line-clamp-2 leading-snug">
            {note.title || 'Untitled'}
          </h3>
        </div>

        {/* Preview */}
        {preview && (
          <p className="text-sm text-[var(--muted)] leading-relaxed">{preview}</p>
        )}
      </div>

      {/* Footer: time + tags — pinned to bottom */}
      <div className="flex items-center gap-2 px-4 pb-3 shrink-0">
        <span className="text-[11px] text-[var(--muted-2)]">{timeAgo(note.updatedAt)}</span>
        {note.tags.length > 0 && (
          <div className="flex gap-1 overflow-hidden">
            {note.tags.slice(0, 2).map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(167,139,250,0.1)] text-[var(--neon)] truncate max-w-[80px]">{t}</span>
            ))}
            {note.tags.length > 2 && (
              <span className="text-[10px] text-[var(--muted-2)]">+{note.tags.length - 2}</span>
            )}
          </div>
        )}
        {note.status === 'archived' && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[rgba(128,128,128,0.12)] text-[var(--muted)]">archived</span>
        )}
      </div>

      {/* Hover actions */}
      <div
        data-hover-actions
        className="absolute top-2 right-2 items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onPin} title={note.isPinned ? 'Unpin' : 'Pin'} className="p-1.5 rounded-lg bg-[var(--card)] text-[var(--muted)] hover:text-[var(--warm)] transition-colors">
          <svg className="w-3.5 h-3.5" fill={note.isPinned ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
          </svg>
        </button>
        <button onClick={onArchive} title={note.status === 'archived' ? 'Restore' : 'Archive'} className="p-1.5 rounded-lg bg-[var(--card)] text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 1 1 0-4h14a2 2 0 1 1 0 4M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-9 4h4" />
          </svg>
        </button>
        <button onClick={onDelete} title="Delete" className="p-1.5 rounded-lg bg-[var(--card)] text-[var(--muted)] hover:text-[var(--red)] transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </button>
  )
}
