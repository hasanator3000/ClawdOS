'use client'

interface AIPanelToggleProps {
  isOpen: boolean
  onToggle: () => void
  panelWidth?: number
}

export function AIPanelToggle({ isOpen, onToggle, panelWidth = 400 }: AIPanelToggleProps) {
  // When panel is open, position toggle inside the panel header area
  // When closed, position in top-right corner
  const rightOffset = isOpen ? panelWidth + 8 : 16

  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ right: rightOffset }}
      className={`fixed top-4 z-40 p-2 rounded-lg border transition-all ${
        isOpen
          ? 'bg-[var(--hover)] border-[var(--border)]'
          : 'bg-[var(--card)] border-[var(--border)] hover:bg-[var(--hover)]'
      }`}
      aria-label={isOpen ? 'Close AI panel' : 'Open AI panel'}
      title="Toggle AI Panel (Clawdbot)"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Bot icon */}
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
      </svg>
    </button>
  )
}
