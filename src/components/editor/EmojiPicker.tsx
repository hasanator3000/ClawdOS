'use client'

import { useState, useRef, useEffect } from 'react'

const EMOJI_GROUPS = [
  { label: 'Smileys', emojis: ['😀', '😊', '🥰', '😎', '🤔', '😴', '🤯', '🥳', '😈', '👻'] },
  { label: 'Hands', emojis: ['👋', '✌️', '🤝', '👏', '🙌', '💪', '🤙', '👍', '✋', '🫶'] },
  { label: 'Objects', emojis: ['📝', '📚', '💡', '🔥', '⭐', '💎', '🎯', '🏆', '🎨', '🔑'] },
  { label: 'Nature', emojis: ['🌟', '🌈', '🌊', '🌸', '🍀', '🌙', '⚡', '❄️', '🌍', '🌴'] },
  { label: 'Food', emojis: ['☕', '🍕', '🎂', '🍎', '🥑', '🍩', '🧁', '🍣', '🌶️', '🫐'] },
  { label: 'Tech', emojis: ['💻', '🖥️', '📱', '🤖', '🎮', '🔧', '⚙️', '🛠️', '📡', '🔬'] },
  { label: 'Symbols', emojis: ['❤️', '💜', '💙', '💚', '🧡', '🖤', '✅', '❌', '⚠️', '♾️'] },
]

interface EmojiPickerProps {
  onSelect: (emoji: string) => void
  onRemove: () => void
  onClose: () => void
}

export function EmojiPicker({ onSelect, onRemove, onClose }: EmojiPickerProps) {
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const allEmojis = EMOJI_GROUPS.flatMap((g) => g.emojis)
  const filtered = search
    ? allEmojis.filter(() => true) // emoji search is hard without names; show all for now
    : null

  return (
    <div
      ref={ref}
      className="w-72 rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-xl shadow-black/50 p-3"
    >
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search emoji..."
        className="w-full px-2.5 py-1.5 rounded-md border border-[var(--border)] bg-[var(--card)] text-xs text-[var(--fg)] placeholder:text-[var(--muted)] mb-2 focus:outline-none"
        autoFocus
      />

      <div className="max-h-48 overflow-y-auto">
        {filtered ? (
          <div className="grid grid-cols-8 gap-0.5">
            {filtered.map((emoji, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--hover)] text-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="text-[10px] text-[var(--muted-2)] uppercase tracking-wider mb-1 px-0.5">{group.label}</div>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onSelect(emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--hover)] text-lg transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="w-full mt-2 px-2 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--red)] rounded-md hover:bg-[var(--hover)] transition-colors"
      >
        Remove icon
      </button>
    </div>
  )
}

// ── Cover gradient presets ──────────────────────────────

export const COVER_GRADIENTS = [
  'linear-gradient(135deg, rgba(167,139,250,0.3) 0%, rgba(6,6,10,0.8) 100%)',
  'linear-gradient(135deg, rgba(110,231,183,0.3) 0%, rgba(6,6,10,0.8) 100%)',
  'linear-gradient(135deg, rgba(251,191,36,0.3) 0%, rgba(6,6,10,0.8) 100%)',
  'linear-gradient(135deg, rgba(251,113,133,0.3) 0%, rgba(6,6,10,0.8) 100%)',
  'linear-gradient(135deg, rgba(0,188,212,0.3) 0%, rgba(6,6,10,0.8) 100%)',
  'linear-gradient(135deg, rgba(167,139,250,0.2) 0%, rgba(110,231,183,0.2) 100%)',
  'linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(251,113,133,0.2) 100%)',
  'linear-gradient(135deg, rgba(0,188,212,0.2) 0%, rgba(167,139,250,0.2) 100%)',
]
