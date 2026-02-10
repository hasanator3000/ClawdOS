'use client'

import { useRef, useCallback, useEffect, useState, FormEvent, memo } from 'react'
import { usePathname } from 'next/navigation'
import { useChat, type ChatMessage } from '@/hooks/useChat'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface AIPanelProps {
  isOpen: boolean
  width: number
  onClose: () => void
  onWidthChange: (width: number) => void
}

export function AIPanel({ isOpen, width, onClose, onWidthChange }: AIPanelProps) {
  const { workspace } = useWorkspace()
  const workspaceName = workspace?.name
  const workspaceId = workspace?.id
  const panelRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isResizing, setIsResizing] = useState(false)
  const [input, setInput] = useState('')
  const pathname = usePathname()

  // Page label for UI only
  const pageName = getPageName(pathname)

  const { messages, isLoading, error, sendMessage, stopGeneration, clearMessages } = useChat({
    workspaceId: workspaceId || '',
    workspaceName: workspaceName || 'Unknown',
    // Pass the actual route path so the agent + refresh logic are correct
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

  // Listen for prefill events from other components (e.g. NewsOnboarding)
  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail?.message === 'string') {
        setInput(detail.message)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    }
    window.addEventListener('lifeos:ai-prefill', handlePrefill)
    return () => window.removeEventListener('lifeos:ai-prefill', handlePrefill)
  }, [])

  // Handle resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      onWidthChange(newWidth)
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
  }, [isResizing, onWidthChange])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !workspaceId) return

    sendMessage(input.trim())
    setInput('')
  }

  if (!isOpen) return null

  return (
    <>
      {/* Resize handle */}
      <div
        className={`w-1 cursor-col-resize hover:bg-[var(--border)] transition-colors ${
          isResizing ? 'bg-[var(--border)]' : ''
        }`}
        onMouseDown={handleMouseDown}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="flex flex-col bg-[var(--card)] border-l border-[var(--border)] overflow-hidden"
        style={{ width }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="font-semibold">Clawdbot</h2>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearMessages}
                className="p-1 hover:bg-[var(--hover)] rounded transition-colors text-[var(--muted)] hover:text-[var(--fg)]"
                aria-label="Clear chat"
                title="Clear chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-[var(--hover)] rounded transition-colors"
              aria-label="Close panel"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Context info */}
        <div className="px-4 py-2 text-sm text-[var(--muted)] border-b border-[var(--border)]">
          <div>
            <span className="opacity-70">Workspace:</span>{' '}
            <span className="text-[var(--fg)]">{workspaceName || 'None'}</span>
          </div>
          <div>
            <span className="opacity-70">Page:</span>{' '}
            <span className="text-[var(--fg)]">{pageName}</span>
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[var(--muted)] p-4">
              <div className="text-center">
                <div className="mb-2 text-3xl">🤖</div>
                <div className="font-medium">Clawdbot</div>
                <div className="text-xs mt-1 max-w-[200px]">
                  Your AI assistant. Ask questions, create tasks, or get help with anything.
                </div>
              </div>
            </div>
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
          <div className="px-4 py-2 bg-[var(--error-bg)] text-[var(--error-fg)] text-sm">{error}</div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[var(--border)]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={workspaceId ? 'Ask Clawdbot...' : 'Select a workspace first'}
              // Allow typing even while the previous request is streaming
              disabled={!workspaceId}
              className="flex-1 px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--border)]"
            />
            {isLoading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="px-3 py-2 bg-[var(--error-bg)] text-[var(--error-fg)] rounded text-sm hover:opacity-80 transition-opacity"
              >
                Stop
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !workspaceId}
                className="px-3 py-2 bg-[var(--fg)] text-[var(--bg)] rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 transition-opacity"
              >
                Send
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  )
}

// Memoized to prevent O(n) re-renders when messages array updates
const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser ? 'bg-[var(--fg)] text-[var(--bg)]' : 'bg-[var(--hover)] text-[var(--fg)]'
        }`}
      >
        {/* Message content */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
          {message.isStreaming && <span className="animate-pulse">▊</span>}
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

// Memoized to prevent unnecessary re-renders in nested loop
const ToolCallDisplay = memo(function ToolCallDisplay({
  tool,
}: {
  tool: NonNullable<ChatMessage['toolCalls']>[number]
}) {
  return (
    <div className="text-xs p-2 rounded bg-black/10 dark:bg-white/10">
      <div className="flex items-center gap-2">
        <span className="font-mono">{tool.name}</span>
        <span
          className={`px-1 rounded ${
            tool.status === 'running'
              ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
              : tool.status === 'success'
                ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                : tool.status === 'error'
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                  : 'bg-gray-500/20'
          }`}
        >
          {tool.status === 'running' && '...'}
          {tool.status === 'success' && 'done'}
          {tool.status === 'error' && 'error'}
          {tool.status === 'pending' && '...'}
        </span>
      </div>
      {tool.error && <div className="mt-1 text-red-500">{tool.error}</div>}
    </div>
  )
})

function getPageName(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return 'Home'

  const last = segments[segments.length - 1]

  // Capitalize first letter
  return last.charAt(0).toUpperCase() + last.slice(1)
}
