'use client'

import type { AgentFile, FileCategory } from './page'

const CATEGORY_META: Record<FileCategory, { label: string; color: string; bg: string }> = {
  'agent-core':    { label: 'Agent Core',    color: 'var(--neon)',  bg: 'rgba(167, 139, 250, 0.12)' },
  'agent-rules':   { label: 'Agent Rules',   color: 'var(--green)', bg: 'rgba(110, 231, 183, 0.12)' },
  'clawdos-rules': { label: 'ClawdOS Rules', color: 'var(--cyan)',  bg: 'rgba(0, 188, 212, 0.12)' },
  'skills':        { label: 'Skills',        color: 'var(--warm)',  bg: 'rgba(255, 171, 64, 0.12)' },
  'memory':        { label: 'Memory',        color: 'var(--fg)',    bg: 'rgba(255, 255, 255, 0.06)' },
  'config':        { label: 'Config',        color: 'var(--muted)', bg: 'rgba(128, 128, 128, 0.12)' },
  'claude-rules':  { label: 'Claude Rules',  color: 'var(--red)',   bg: 'rgba(251, 113, 133, 0.12)' },
}

interface FilePanelProps {
  file: AgentFile
  content: string | null
  isLoading: boolean
  isEditing: boolean
  editContent: string
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  saveError: string
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onEdit: () => void
  onCancelEdit: () => void
  onSave: () => void
  onClose: () => void
  onEditChange: (val: string) => void
}

export function FilePanel({
  file, content, isLoading, isEditing, editContent, saveStatus, saveError,
  textareaRef, onEdit, onCancelEdit, onSave, onClose, onEditChange,
}: FilePanelProps) {
  const meta = CATEGORY_META[file.category]
  const canEdit = !file.readOnly && content && !content.startsWith('Error:')

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-[640px] bg-[var(--bg)] border-l border-[var(--border)] flex flex-col shadow-2xl animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-semibold text-[var(--fg)] truncate">{file.name}</h2>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0" style={{ color: meta.color, background: meta.bg }}>
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {!isEditing && canEdit && (
              <button type="button" onClick={onEdit}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors text-[var(--fg)] hover:bg-[var(--surface)] border border-[var(--border)]">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}
            {saveStatus === 'saved' && <span className="text-xs text-[var(--green)] font-medium px-2">Saved</span>}
            <button type="button" onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-sm text-[var(--muted)]">Loading...</div>
          ) : isEditing ? (
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => onEditChange(e.target.value)}
              spellCheck={false}
              className="w-full h-full min-h-[400px] p-4 text-xs font-mono text-[var(--fg)] bg-transparent leading-relaxed resize-none focus:outline-none"
              style={{ tabSize: 2 }}
            />
          ) : content ? (
            <pre className="p-4 text-xs font-mono text-[var(--fg)] whitespace-pre-wrap break-words leading-relaxed">{content}</pre>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border)] shrink-0">
          {isEditing ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {saveStatus === 'error' && <span className="text-xs text-[var(--red)]">{saveError}</span>}
                <span className="text-xs text-[var(--muted)]">
                  {editContent !== content ? 'Unsaved changes' : 'No changes'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onCancelEdit}
                  className="px-3 py-1.5 text-xs font-medium rounded-md text-[var(--muted)] hover:text-[var(--fg)] transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={onSave}
                  disabled={editContent === content}
                  className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-40"
                  style={{ background: 'var(--neon)', color: 'var(--bg)' }}>
                  {saveStatus === 'saving' ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--muted)]">
              {file.path} &middot; {file.size}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.2s ease-out; }
      `}</style>
    </div>
  )
}
