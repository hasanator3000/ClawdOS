'use client'

interface AIPanelToggleProps {
  isOpen: boolean
  onToggle: () => void
}

export function AIPanelToggle({ isOpen, onToggle }: AIPanelToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="p-2 rounded-xl transition-all"
      style={{
        background: isOpen ? 'var(--neon-dim)' : 'var(--card)',
        border: `1px solid ${isOpen ? 'var(--neon)' : 'var(--border)'}`,
        color: isOpen ? 'var(--neon)' : 'var(--muted)',
        boxShadow: isOpen ? '0 0 12px var(--neon-dim)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isOpen) {
          e.currentTarget.style.borderColor = 'var(--neon)'
          e.currentTarget.style.color = 'var(--neon)'
          e.currentTarget.style.background = 'var(--neon-dim)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isOpen) {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.color = 'var(--muted)'
          e.currentTarget.style.background = 'var(--card)'
        }
      }}
      aria-label={isOpen ? 'Close AI panel' : 'Open AI panel'}
      title="Toggle Clawdbot (Ctrl+J)"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Message bubble icon */}
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  )
}
