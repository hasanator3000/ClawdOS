'use client'

import { useCallback, useRef } from 'react'
import { createPlatePlugin, Plate, PlateContent, usePlateEditor, useEditorRef } from 'platejs/react'
import {
  BoldPlugin, ItalicPlugin, UnderlinePlugin, CodePlugin,
  StrikethroughPlugin, HeadingPlugin, BlockquotePlugin,
  HorizontalRulePlugin,
} from '@platejs/basic-nodes/react'
import { LinkPlugin } from '@platejs/link/react'
import { ListPlugin } from '@platejs/list/react'
import { AutoformatPlugin } from '@platejs/autoformat'
import { CalloutPlugin } from '@platejs/callout/react'
import { TablePlugin, TableRowPlugin, TableCellPlugin, TableCellHeaderPlugin } from '@platejs/table/react'
import { MarkdownPlugin } from '@platejs/markdown'
import { CodeBlockPlugin, CodeLinePlugin, CodeSyntaxPlugin } from '@platejs/code-block/react'
import { TogglePlugin, useIsVisible, getEnclosingToggleIds } from '@platejs/toggle/react'
import { IndentPlugin } from '@platejs/indent/react'
import { NodeIdPlugin } from '@platejs/core'
import { ExitBreakPlugin, TrailingBlockPlugin } from '@platejs/utils'
import { SlashPlugin, SlashInputPlugin } from '@platejs/slash-command/react'
import { DndPlugin, DndScroller } from '@platejs/dnd'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { ImagePlugin } from '@platejs/media/react'
import { ColumnPlugin, ColumnItemPlugin } from '@platejs/layout/react'
import { EMPTY_PARAGRAPH } from './constants'
import { BlockExitPlugin } from './BlockExitPlugin'
import { EditorToolbar } from './EditorToolbar'
import { SlashCommandMenu } from './SlashCommandMenu'
import { TableElement, TableRowElement, TableCellElement } from './TableComponents'
import { TodoElement } from './TodoElement'
import { ToggleElement } from './ToggleElement'
import { DraggableBlock } from './DraggableBlock'
import { ImageElement } from './ImageElement'
import { ColumnGroupElement, ColumnItemElement } from './ColumnElements'
import { MobileToolbar } from './MobileToolbar'

// ── Toggle zone wrapper — adds visual highlight for toggle content ──────
const hiddenStyle = { height: 0, margin: 0, overflow: 'hidden' as const, visibility: 'hidden' as const }

// Element types that must NOT be wrapped in extra <div> (breaks HTML table structure)
const TABLE_CHILD_TYPES = new Set(['tr', 'td', 'th'])

/** Inner component that uses toggle hooks — only rendered for non-table elements */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToggleZoneInner({ children, element }: { children: React.ReactNode; element: any }) {
  const visible = useIsVisible(element.id as string)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useEditorRef() as any

  if (!visible) {
    return <div style={hiddenStyle}>{children}</div>
  }

  const enclosingIds = getEnclosingToggleIds(editor, element.id as string)
  if (enclosingIds.length > 0) {
    return (
      <div className="border-l-2 border-[rgba(167,139,250,0.12)] ml-1 pl-3">
        {children}
      </div>
    )
  }

  return <>{children}</>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToggleZoneWrapper({ children, element }: { children: React.ReactNode; element: any }) {
  // Skip wrapper for table rows/cells — wrapping <tr>/<td> in <div> breaks <table> layout
  if (TABLE_CHILD_TYPES.has(element?.type)) return <>{children}</>

  return <ToggleZoneInner element={element}>{children}</ToggleZoneInner>
}

// ── Custom todo plugin — simple block element with checkbox ──────
const TodoPlugin = createPlatePlugin({
  key: 'todo',
  node: { isElement: true, type: 'todo' },
}).withComponent(TodoElement)

const EDITOR_PLUGINS = [
  // Infrastructure — must be first
  NodeIdPlugin,
  IndentPlugin,
  // Drag & drop (requires NodeIdPlugin above)
  DndPlugin.configure({
    options: { enableScroller: true },
    render: { aboveNodes: () => DraggableBlock },
  }),
  // Marks
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
  StrikethroughPlugin,
  // Override "hard" affinity — it adds NonBreakingSpace spans that split selection across lines
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CodePlugin.extend({ rules: { selection: { affinity: null as any } } }),
  // Block nodes
  // Enter → exit heading / create new paragraph (handled by BlockExitPlugin)
  HeadingPlugin,
  // Blockquote: Shift+Enter = new line, Enter on empty line = exit
  BlockquotePlugin.extend({
    rules: { break: { default: 'lineBreak', emptyLineEnd: 'deleteExit' } },
  }),
  HorizontalRulePlugin.configure({ render: { as: 'div' } }),
  LinkPlugin,
  ListPlugin,
  CalloutPlugin.extend({
    rules: { break: { default: 'lineBreak', emptyLineEnd: 'deleteExit' } },
  }),
  // Custom block elements
  TodoPlugin,
  TogglePlugin.withComponent(ToggleElement).extend({
    render: { aboveNodes: () => ToggleZoneWrapper },
  }),
  // Tables — floating toolbar for row/col operations
  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableCellElement),
  // Images
  ImagePlugin.withComponent(ImageElement).configure({
    options: {
      uploadImage: async (dataUrl: ArrayBuffer | string) => {
        const blob = typeof dataUrl === 'string'
          ? await fetch(dataUrl).then((r) => r.blob())
          : new Blob([dataUrl])
        const formData = new FormData()
        formData.append('file', blob, 'pasted-image.png')
        const res = await fetch('/api/uploads', { method: 'POST', body: formData })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Upload failed')
        return json.url as string
      },
    },
  }),
  // Columns
  ColumnPlugin.withComponent(ColumnGroupElement),
  ColumnItemPlugin.withComponent(ColumnItemElement),
  // Code blocks — exit handled by BlockExitPlugin
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
  // Exit behavior
  BlockExitPlugin,
  // ExitBreak: Mod+Enter exits any nested block (official Plate pattern)
  ExitBreakPlugin.configure({
    shortcuts: {
      insert: { keys: 'mod+enter' },
    },
  }),
  // TrailingBlock: always ensures a paragraph at document end
  // so users can always click/arrow below tables, code blocks, etc.
  TrailingBlockPlugin,
  // Slash commands
  SlashPlugin,
  SlashInputPlugin.withComponent(SlashCommandMenu),
  // Utilities
  AutoformatPlugin,
  MarkdownPlugin,
]

const DEFAULT_VALUE = [EMPTY_PARAGRAPH]

const CONTENT_STYLES = [
  // Body
  'outline-none text-[var(--fg)] text-[15px] leading-[1.8]',
  // Bold
  '[&_strong]:font-extrabold [&_strong]:text-[var(--fg-bright)]',
  // Italic
  '[&_em]:italic [&_em]:text-[var(--card-fg)]',
  // Underline
  '[&_u]:underline [&_u]:decoration-[var(--neon)] [&_u]:underline-offset-3 [&_u]:decoration-2',
  // Strikethrough
  '[&_s]:line-through [&_s]:text-[var(--muted)]',
  // H1
  '[&_h1]:text-[32px] [&_h1]:font-bold [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-[var(--fg-bright)] [&_h1]:tracking-tight [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-[var(--border)]',
  // H2
  '[&_h2]:text-[24px] [&_h2]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-[var(--fg-bright)]',
  // H3
  '[&_h3]:text-[19px] [&_h3]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-[var(--neon)]',
  // Blockquote
  '[&_blockquote]:border-l-3 [&_blockquote]:border-[var(--neon)] [&_blockquote]:pl-5 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:text-[var(--muted)] [&_blockquote]:my-3',
  // Inline code — box-decoration-clone keeps bg+radius intact on line wraps
  '[&_code]:rounded-md [&_code]:bg-[rgba(167,139,250,0.12)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-[var(--neon)]',
  // Code block
  '[&_pre]:rounded-lg [&_pre]:bg-[rgba(0,0,0,0.3)] [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:p-4 [&_pre]:my-3 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:text-[var(--fg)]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[var(--fg)]',
  // Links
  '[&_a]:text-[var(--neon)] [&_a]:underline [&_a]:underline-offset-2',
  // Lists
  '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_li]:mb-1.5 [&_li]:leading-relaxed',
  // Tables — styled via TableComponents (as="tr"/as="td" renders real HTML elements)
  // Callout
  '[&_.slate-callout]:rounded-lg [&_.slate-callout]:border [&_.slate-callout]:border-[var(--border)] [&_.slate-callout]:p-3 [&_.slate-callout]:my-2 [&_.slate-callout]:bg-[rgba(255,255,255,0.03)]',
  // Horizontal rule
  '[&_.slate-hr]:border-t [&_.slate-hr]:border-[rgba(255,255,255,0.2)] [&_.slate-hr]:my-8',
].join(' ')

const COMPACT_STYLES = [
  // Body — slightly smaller for side panels
  'outline-none text-[var(--fg)] text-[13px] leading-[1.7]',
  // Bold
  '[&_strong]:font-extrabold [&_strong]:text-[var(--fg-bright)]',
  // Italic
  '[&_em]:italic [&_em]:text-[var(--card-fg)]',
  // Underline
  '[&_u]:underline [&_u]:decoration-[var(--neon)] [&_u]:underline-offset-3 [&_u]:decoration-2',
  // Strikethrough
  '[&_s]:line-through [&_s]:text-[var(--muted)]',
  // H1
  '[&_h1]:text-[22px] [&_h1]:font-bold [&_h1]:mt-5 [&_h1]:mb-2.5 [&_h1]:text-[var(--fg-bright)] [&_h1]:tracking-tight [&_h1]:pb-1.5 [&_h1]:border-b [&_h1]:border-[var(--border)]',
  // H2
  '[&_h2]:text-[18px] [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-[var(--fg-bright)]',
  // H3
  '[&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-[var(--neon)]',
  // Blockquote
  '[&_blockquote]:border-l-3 [&_blockquote]:border-[var(--neon)] [&_blockquote]:pl-4 [&_blockquote]:py-0.5 [&_blockquote]:italic [&_blockquote]:text-[var(--muted)] [&_blockquote]:my-2',
  // Inline code
  '[&_code]:rounded-md [&_code]:bg-[rgba(167,139,250,0.12)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_code]:text-[var(--neon)]',
  // Code block
  '[&_pre]:rounded-lg [&_pre]:bg-[rgba(0,0,0,0.3)] [&_pre]:border [&_pre]:border-[var(--border)] [&_pre]:p-3 [&_pre]:my-2 [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:leading-relaxed [&_pre]:overflow-x-auto [&_pre]:text-[var(--fg)]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[var(--fg)]',
  // Links
  '[&_a]:text-[var(--neon)] [&_a]:underline [&_a]:underline-offset-2',
  // Lists
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_li]:mb-1 [&_li]:leading-relaxed',
  // Tables — styled via TableComponents (as="tr"/as="td" renders real HTML elements)
  // Callout
  '[&_.slate-callout]:rounded-lg [&_.slate-callout]:border [&_.slate-callout]:border-[var(--border)] [&_.slate-callout]:p-2.5 [&_.slate-callout]:my-1.5 [&_.slate-callout]:bg-[rgba(255,255,255,0.03)]',
  // Horizontal rule
  '[&_.slate-hr]:border-t [&_.slate-hr]:border-[rgba(255,255,255,0.2)] [&_.slate-hr]:my-5',
].join(' ')

interface NoteEditorProps {
  initialValue?: unknown[]
  onChange?: (value: unknown[]) => void
  readOnly?: boolean
  placeholder?: string
  showToolbar?: boolean
  minHeight?: string
  compact?: boolean
}

export function NoteEditor({
  initialValue,
  onChange,
  readOnly = false,
  placeholder = 'Type / for commands, ** for bold, # for heading',
  showToolbar = true,
  minHeight = '200px',
  compact = false,
}: NoteEditorProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = usePlateEditor({
    plugins: EDITOR_PLUGINS,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: (initialValue?.length ? initialValue : DEFAULT_VALUE) as any,
  })

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ value }: { value: any }) => {
      if (!onChange) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChange(value)
      }, 400)
    },
    [onChange]
  )

  return (
    <DndProvider backend={HTML5Backend}>
      <Plate editor={editor} onChange={handleChange}>
        {showToolbar && !readOnly && (
          <div className="hidden md:block">
            <EditorToolbar />
          </div>
        )}
        <PlateContent
          readOnly={readOnly}
          placeholder={placeholder}
          style={{ minHeight }}
          className={compact ? COMPACT_STYLES : CONTENT_STYLES}
        />
        {!readOnly && <DndScroller />}
        {showToolbar && !readOnly && !compact && <MobileToolbar />}
      </Plate>
    </DndProvider>
  )
}
