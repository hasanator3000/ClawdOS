'use client'

import { useRef, useCallback, useEffect, useState, FormEvent, memo } from 'react'
import { usePathname } from 'next/navigation'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface AIPanelProps {
  isOpen: boolean
  width: number
  onClose: () => void
  onToggle: () => void
  onWidthChange: (width: number) => void
}

export function AIPanel({ isOpen, width, onClose, onToggle, onWidthChange }: AIPanelProps) {
  const { workspace } = useWorkspace()
  const workspaceName = workspace?.name
  const workspaceId = workspace?.id
  const panelRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [input, setInput] = useState('')
  const pathname = usePathname()

  const pageName = getPageName(pathname)

  const { messages, isLoading, error, sendMessage, stopGeneration, clearMessages } = useChat({
    workspaceId: workspaceId || '',
    workspaceName: workspaceName || 'Unknown',
    currentPage: pathname,
  })

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Listen for prefill events from other components
  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail?.message === 'string') {
        setInput(detail.message)
        const timerId = setTimeout(() => inputRef.current?.focus(), 50)
        return () => clearTimeout(timerId)
      }
    }
    window.addEventListener('lifeos:ai-prefill', handlePrefill)
    return () => window.removeEventListener('lifeos:ai-prefill', handlePrefill)
  }, [])

  // Handle resize
  const onWidthChangeRef = useRef(onWidthChange)
  onWidthChangeRef.current = onWidthChange

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      onWidthChangeRef.current(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !workspaceId) return

    sendMessage(input.trim())
    setInput('')
  }

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className="flex h-full overflow-hidden"
      style={{
        background: 'rgba(6,6,10,0.95)',
        borderLeft: '1px solid var(--border)',
      }}
    >
      {/* Resize handle — gradient glow on hover/drag */}
      <div
        className="w-1.5 cursor-col-resize group relative flex-shrink-0"
        onMouseDown={handleMouseDown}
      >
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
          style={{
            background: 'linear-gradient(180deg, var(--neon), var(--pink), var(--cyan))',
            filter: 'blur(1px)',
          }}
        />
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${
            isResizing ? 'opacity-60' : 'opacity-0 group-hover:opacity-40'
          }`}
          style={{
            background: 'linear-gradient(180deg, var(--neon), var(--pink))',
            filter: 'blur(6px)',
          }}
        />
      </div>

      {/* Panel content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header — bot orb + context */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {/* Bot orb with spinning ring */}
          <div className="relative flex-shrink-0" style={{ width: 36, height: 36 }}>
            {/* Spinning ring */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: 'conic-gradient(var(--neon), var(--pink), var(--cyan), var(--neon))',
                animation: 'spin 3s linear infinite',
              }}
            />
            {/* Inner mask */}
            <div
              className="absolute rounded-full"
              style={{
                inset: 2,
                background: 'var(--bg)',
              }}
            />
            {/* Pulsing core dot */}
            <div
              className="absolute rounded-full"
              style={{
                width: 8,
                height: 8,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--neon)',
                boxShadow: '0 0 8px var(--neon-glow), 0 0 16px var(--neon-glow)',
                animation: 'orbPulse 2s ease-in-out infinite',
              }}
            />
          </div>

          {/* Title + context */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>
              Clawdbot
            </div>
            <div
              className="text-xs truncate"
              style={{ color: 'var(--muted)' }}
            >
              {workspaceName || 'No workspace'} / {pageName}
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearMessages}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--fg)'
                  e.currentTarget.style.background = 'var(--hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--muted)'
                  e.currentTarget.style.background = 'transparent'
                }}
                aria-label="Clear chat"
                title="New conversation"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--muted)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--fg)'
                e.currentTarget.style.background = 'var(--hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--muted)'
                e.currentTarget.style.background = 'transparent'
              }}
              aria-label="Close panel"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="p-4 space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div
            className="px-4 py-2 text-sm"
            style={{
              background: 'var(--error-bg)',
              color: 'var(--error-fg)',
            }}
          >
            {error}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="p-3"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={workspaceId ? 'Ask Clawdbot...' : 'Select a workspace first'}
              disabled={!workspaceId}
              className="flex-1 bg-transparent text-sm outline-none placeholder-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ color: 'var(--fg)' }}
              onFocus={(e) => {
                const container = e.currentTarget.parentElement
                if (container) {
                  container.style.borderColor = 'var(--neon)'
                  container.style.boxShadow = '0 0 0 1px var(--neon-dim), 0 0 12px var(--neon-dim)'
                }
              }}
              onBlur={(e) => {
                const container = e.currentTarget.parentElement
                if (container) {
                  container.style.borderColor = 'var(--border)'
                  container.style.boxShadow = 'none'
                }
              }}
            />
            {isLoading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
                style={{
                  background: 'var(--error-bg)',
                  color: 'var(--error-fg)',
                }}
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !workspaceId}
                className="flex-shrink-0 p-1.5 rounded-lg text-sm transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  background: input.trim() && workspaceId
                    ? 'linear-gradient(135deg, var(--neon), var(--pink))'
                    : 'var(--muted-2)',
                  color: input.trim() && workspaceId ? '#fff' : 'var(--muted)',
                  boxShadow: input.trim() && workspaceId
                    ? '0 0 12px var(--neon-glow)'
                    : 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

/* Empty state with bot orb and hint chips */
function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6" style={{ color: 'var(--muted)' }}>
      {/* Large orb */}
      <div className="relative mb-6" style={{ width: 64, height: 64 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(var(--neon), var(--pink), var(--cyan), var(--neon))',
            animation: 'spin 4s linear infinite',
            opacity: 0.6,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            inset: 3,
            background: 'var(--bg)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 14,
            height: 14,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--neon)',
            boxShadow: '0 0 12px var(--neon-glow), 0 0 24px var(--neon-glow)',
            animation: 'orbPulse 2s ease-in-out infinite',
          }}
        />
      </div>

      <div className="font-semibold text-sm mb-1" style={{ color: 'var(--fg)' }}>
        Clawdbot
      </div>
      <div className="text-xs text-center mb-5 max-w-[220px]" style={{ color: 'var(--muted)' }}>
        Your AI assistant for tasks, questions, and everything in between.
      </div>

      {/* Hint chips */}
      <div className="flex flex-wrap gap-2 justify-center max-w-[260px]">
        {['Create a task', 'Summarize my day', 'What can you do?'].map((hint) => (
          <HintChip key={hint} label={hint} />
        ))}
      </div>
    </div>
  )
}

function HintChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="px-3 py-1.5 rounded-full text-xs transition-all"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        color: 'var(--muted)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--neon-dim)'
        e.currentTarget.style.color = 'var(--neon)'
        e.currentTarget.style.background = 'var(--neon-dim)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.color = 'var(--muted)'
        e.currentTarget.style.background = 'var(--card)'
      }}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('lifeos:ai-prefill', { detail: { message: label } })
        )
      }}
    >
      {label}
    </button>
  )
}

// Memoized message bubble with gradient/glass styling
const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2.5"
        style={
          isUser
            ? {
                background: 'linear-gradient(135deg, var(--neon), var(--pink))',
                color: '#fff',
                boxShadow: '0 2px 12px var(--neon-glow)',
              }
            : {
                background: 'var(--card)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
              }
        }
      >
        {/* Message content */}
        <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
          {message.content}
          {message.isStreaming && (
            <span className="inline-block ml-0.5 animate-pulse" style={{ color: isUser ? '#fff' : 'var(--neon)' }}>
              ▊
            </span>
          )}
        </div>

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {message.toolCalls.map((tool) => (
              <ToolCallDisplay key={tool.id} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

// Memoized tool call display with glass styling
const ToolCallDisplay = memo(function ToolCallDisplay({
  tool,
}: {
  tool: NonNullable<ChatMessage['toolCalls']>[number]
}) {
  return (
    <div
      className="text-xs p-2 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono" style={{ color: 'var(--cyan)' }}>{tool.name}</span>
        <span
          className="px-1.5 py-0.5 rounded text-[10px]"
          style={{
            background:
              tool.status === 'running' ? 'rgba(251,191,36,0.15)' :
              tool.status === 'success' ? 'rgba(110,231,183,0.15)' :
              tool.status === 'error' ? 'rgba(251,113,133,0.15)' :
              'rgba(255,255,255,0.05)',
            color:
              tool.status === 'running' ? 'var(--warm)' :
              tool.status === 'success' ? 'var(--green)' :
              tool.status === 'error' ? 'var(--red)' :
              'var(--muted)',
          }}
        >
          {tool.status === 'running' && '...'}
          {tool.status === 'success' && 'done'}
          {tool.status === 'error' && 'error'}
          {tool.status === 'pending' && '...'}
        </span>
      </div>
      {tool.error && (
        <div className="mt-1" style={{ color: 'var(--red)' }}>{tool.error}</div>
      )}
    </div>
  )
})

function getPageName(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return 'Home'
  const last = segments[segments.length - 1]
  return last.charAt(0).toUpperCase() + last.slice(1)
}
