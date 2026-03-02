'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditorRef } from 'platejs/react'
import { useComboboxInput } from '@platejs/combobox/react'
import { Editor, Transforms, Path } from 'slate'
import { TogglePlugin } from '@platejs/toggle/react'
import { insertColumnGroup } from '@platejs/layout'
import { insertTable } from '@platejs/table'
import { emptyParagraph } from './constants'

// ── Slash command items ───────────────────────────────────

interface SlashItem {
  key: string
  label: string
  description: string
  icon: string
  type: string  // element type to insert
  category: string
}

const SLASH_ITEMS: SlashItem[] = [
  { key: 'h1', label: 'Heading 1', description: 'Large heading', icon: 'H1', type: 'h1', category: 'Basic' },
  { key: 'h2', label: 'Heading 2', description: 'Medium heading', icon: 'H2', type: 'h2', category: 'Basic' },
  { key: 'h3', label: 'Heading 3', description: 'Small heading', icon: 'H3', type: 'h3', category: 'Basic' },
  { key: 'ul', label: 'Bullet list', description: 'Unordered list', icon: '•', type: 'ul', category: 'Basic' },
  { key: 'ol', label: 'Numbered list', description: 'Ordered list', icon: '1.', type: 'ol', category: 'Basic' },
  { key: 'todo', label: 'Todo', description: 'Checkbox item', icon: '☐', type: 'todo', category: 'Basic' },
  { key: 'blockquote', label: 'Quote', description: 'Block quote', icon: '❝', type: 'blockquote', category: 'Basic' },
  { key: 'code_block', label: 'Code block', description: 'Code snippet', icon: '<>', type: 'code_block', category: 'Advanced' },
  { key: 'table', label: 'Table', description: '3×3 table', icon: '⊞', type: 'table', category: 'Advanced' },
  { key: 'toggle', label: 'Toggle', description: 'Collapsible block', icon: '▸', type: 'toggle', category: 'Advanced' },
  { key: 'callout', label: 'Callout', description: 'Info callout', icon: 'ⓘ', type: 'callout', category: 'Advanced' },
  { key: 'hr', label: 'Divider', description: 'Horizontal rule', icon: '—', type: 'hr', category: 'Advanced' },
  { key: 'image', label: 'Image', description: 'Upload an image', icon: '🖼', type: 'image', category: 'Media' },
  { key: '2cols', label: '2 Columns', description: 'Side-by-side layout', icon: '❚❚', type: 'column_group_2', category: 'Layout' },
  { key: '3cols', label: '3 Columns', description: 'Three-column layout', icon: '❚❚❚', type: 'column_group_3', category: 'Layout' },
]

// ── Component ─────────────────────────────────────────────

interface SlashCommandMenuProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element: any
}

export function SlashCommandMenu({ element: _element }: SlashCommandMenuProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useEditorRef() as any
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const { props: inputProps, removeInput } = useComboboxInput({
    ref: inputRef,
    cancelInputOnBlur: true,
    cancelInputOnEscape: true,
  })

  const filtered = SLASH_ITEMS.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
  })

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIdx(0)
  }, [filtered.length])

  // Scroll selected item into view
  useEffect(() => {
    const el = menuRef.current?.querySelector('[data-selected="true"]')
    if (el) el.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const insertBlock = useCallback((item: SlashItem) => {
    // Remove the slash input element first
    removeInput(true)

    // Insert the appropriate block
    if (item.type === 'table') {
      // Use official Plate insertTable API — creates properly structured nodes
      insertTable(editor, { colCount: 3, rowCount: 3 })
    } else if (item.type === 'code_block') {
      Transforms.insertNodes(editor, {
        type: 'code_block',
        children: [{ type: 'code_line', children: [{ text: '' }] }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    } else if (item.type === 'ul' || item.type === 'ol') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Transforms.setNodes(editor, { type: 'p', listStyleType: item.type === 'ul' ? 'disc' : 'decimal', indent: 1 } as any, {
        match: (n) => editor.isBlock(n),
      })
    } else if (item.type === 'todo') {
      // Custom todo block — renders checkbox via TodoElement component
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Transforms.setNodes(editor, { type: 'todo', checked: false } as any, {
        match: (n) => editor.isBlock(n),
      })
    } else if (item.type === 'toggle') {
      // Toggle is indent-based: heading element + indented content below
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Transforms.setNodes(editor, { type: 'toggle' } as any, {
        match: (n) => editor.isBlock(n),
      })
      // Insert indented paragraph below for the collapsible content
      const entry = Editor.above(editor, { match: (n: unknown) => editor.isBlock(n) })
      if (entry) {
        const nextPath = Path.next(entry[1])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Transforms.insertNodes(editor, { type: 'p', indent: 1, children: [{ text: '' }] } as any, { at: nextPath })
        // Force-open the toggle so content is visible immediately
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toggleId = (entry[0] as any).id
        if (toggleId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(editor as any).getApi(TogglePlugin).toggle.toggleIds([toggleId], true)
        }
        // Move cursor into the content paragraph
        Transforms.select(editor, Editor.start(editor, nextPath))
      }
    } else if (item.type === 'hr') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Transforms.insertNodes(editor, [{ type: 'hr', children: [{ text: '' }] }, emptyParagraph()] as any)
    } else if (item.type === 'image') {
      // Open file picker for image upload
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/jpeg,image/png,image/gif,image/webp'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        const formData = new FormData()
        formData.append('file', file)
        try {
          const res = await fetch('/api/uploads', { method: 'POST', body: formData })
          const json = await res.json()
          if (res.ok && json.url) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Transforms.insertNodes(editor, [{ type: 'img', url: json.url, children: [{ text: '' }] }, emptyParagraph()] as any)
          }
        } catch {
          // upload failed silently
        }
      }
      input.click()
    } else if (item.type === 'column_group_2' || item.type === 'column_group_3') {
      const columns = item.type === 'column_group_2' ? 2 : 3
      insertColumnGroup(editor, { columns })
    } else {
      // Simple block types (h1, h2, h3, blockquote, callout)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Transforms.setNodes(editor, { type: item.type } as any, {
        match: (n) => editor.isBlock(n),
      })
    }
  }, [editor, removeInput])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Space with empty search → dismiss menu, keep "/ " as plain text
    if (e.key === ' ' && search === '') {
      e.preventDefault()
      removeInput(true)
      Transforms.insertText(editor, '/ ')
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputProps.onKeyDown(e as any)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => (i + 1) % filtered.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault()
      insertBlock(filtered[selectedIdx])
    }
  }

  // Auto-dismiss when no results match
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearch(val)
    // Check if any items would match the new search
    if (val) {
      const q = val.toLowerCase()
      const hasMatch = SLASH_ITEMS.some(
        (item) => item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
      )
      if (!hasMatch) removeInput(true)
    }
  }

  return (
    <span className="relative inline-block" contentEditable={false}>
      {/* Hidden input captures keystrokes */}
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={inputProps.onBlur}
        className="w-0 h-0 opacity-0 absolute"
        autoFocus
      />
      {/* Visible trigger indicator */}
      <span className="text-[var(--neon)] font-mono">/</span>
      <span className="text-[var(--muted)]">{search}</span>

      {/* Dropdown */}
      <div ref={menuRef} className="absolute left-0 top-full mt-1 w-64 max-h-72 overflow-y-auto z-50 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[var(--bg)] shadow-xl shadow-black/50">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-sm text-[var(--muted)]">No commands found</div>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              data-selected={idx === selectedIdx ? 'true' : undefined}
              onMouseDown={(e) => { e.preventDefault(); insertBlock(item) }}
              className={`w-full text-left flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                idx === selectedIdx
                  ? 'bg-[rgba(167,139,250,0.12)] text-[var(--fg)]'
                  : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--fg)]'
              }`}
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-md bg-[var(--card)] border border-[var(--border)] text-xs font-mono shrink-0">
                {item.icon}
              </span>
              <div className="min-w-0">
                <div className="font-medium truncate">{item.label}</div>
                <div className="text-[11px] text-[var(--muted-2)] truncate">{item.description}</div>
              </div>
            </button>
          ))
        )}
      </div>
    </span>
  )
}
