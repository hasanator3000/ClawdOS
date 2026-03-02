'use client'

import React from 'react'
import { useEditorRef } from 'platejs/react'
import { useDraggable, useDropLine } from '@platejs/dnd'
import { Editor } from 'slate'
import { ReactEditor } from 'slate-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useIsInsideTable(element: any): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useEditorRef() as any

  // Table structure elements themselves — skip immediately
  if (element?.type === 'tr' || element?.type === 'td' || element?.type === 'th') {
    return true
  }

  // Check if this element is nested inside a table cell
  try {
    const path = ReactEditor.findPath(editor, element)
    const ancestors = Editor.levels(editor, { at: path, reverse: true })
    for (const [node] of ancestors) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const type = (node as any).type
      if (type === 'td' || type === 'th') return true
      // Stop checking once we hit the table itself (no need to go higher)
      if (type === 'table') return false
    }
  } catch { /* element not in tree yet */ }

  return false
}

/** Inner component that uses DnD hooks — only rendered for non-table elements */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DraggableBlockInner({ children, element }: { children: React.ReactNode; element: any }) {
  const { handleRef, isDragging, nodeRef, previewRef } = useDraggable({
    element,
  })

  const { dropLine } = useDropLine({ id: element.id as string })

  return (
    <div ref={nodeRef} className="relative group" style={{ opacity: isDragging ? 0.4 : 1 }}>
      {/* Drag handle — 6 dots */}
      <div
        ref={(el) => {
          handleRef(el)
          if (previewRef.current === null && el) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(previewRef as any).current = el
          }
        }}
        contentEditable={false}
        className="absolute -left-7 top-0.5 w-5 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity select-none"
      >
        <svg className="w-3.5 h-3.5 text-[var(--muted)]" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="3" cy="2" r="1.2" />
          <circle cx="7" cy="2" r="1.2" />
          <circle cx="3" cy="8" r="1.2" />
          <circle cx="7" cy="8" r="1.2" />
          <circle cx="3" cy="14" r="1.2" />
          <circle cx="7" cy="14" r="1.2" />
        </svg>
      </div>

      {/* Drop line indicator */}
      {dropLine && (
        <div
          className="absolute left-0 right-0 h-0.5 bg-[var(--neon)] rounded-full z-10"
          style={{
            top: dropLine === 'top' ? -1 : undefined,
            bottom: dropLine === 'bottom' ? -1 : undefined,
            boxShadow: '0 0 6px var(--neon-glow)',
          }}
        />
      )}

      {children}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DraggableBlock({ children, element }: { children: React.ReactNode; element: any }) {
  const insideTable = useIsInsideTable(element)

  // Skip DnD for table rows/cells AND any content inside table cells
  // Wrapping <tr>/<td> in <div> breaks HTML table structure,
  // and dragging content out of cells corrupts the table
  if (insideTable) {
    return <>{children}</>
  }

  return <DraggableBlockInner element={element}>{children}</DraggableBlockInner>
}
