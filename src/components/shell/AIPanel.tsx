'use client'

import { useRef, useCallback, useEffect, useState, FormEvent } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@/hooks/useChat'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { MessageBubble } from './ai-panel/MessageBubble'
import { EmptyState } from './ai-panel/EmptyState'

interface AIPanelProps {
  isOpen: boolean
  width: number
  onClose: () => void
  onToggle: () => void
  onWidthChange: (width: number) => void
}

export function AIPanel({ isOpen, onClose, onWidthChange }: AIPanelProps) {
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
    window.addEventListener('clawdos:ai-prefill', handlePrefill)
    return () => window.removeEventListener('clawdos:ai-prefill', handlePrefill)
  }, [])

  // Handle resize
  const onWidthChangeRef = useRef(onWidthChange)
  useEffect(() => { onWidthChangeRef.current = onWidthChange })

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
      {/* Resize handle */}
      <div className="w-1.5 cursor-col-resize group relative flex-shrink-0" onMouseDown={handleMouseDown}>
        <div className={`absolute inset-0 transition-opacity duration-200 ${isResizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ background: 'linear-gradient(180deg, var(--neon), var(--pink), var(--cyan))', filter: 'blur(1px)' }} />
        <div className={`absolute inset-0 transition-opacity duration-200 ${isResizing ? 'opacity-60' : 'opacity-0 group-hover:opacity-40'}`}
          style={{ background: 'linear-gradient(180deg, var(--neon), var(--pink))', filter: 'blur(6px)' }} />
      </div>

      {/* Panel content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          {/* Bot orb with spinning ring */}
          <div className="relative flex-shrink-0" style={{ width: 36, height: 36 }}>
            <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(var(--neon), var(--pink), var(--cyan), var(--neon))', animation: 'spin 3s linear infinite' }} />
            <div className="absolute rounded-full" style={{ inset: 2, background: 'var(--bg)' }} />
            <div className="absolute rounded-full" style={{ width: 8, height: 8, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--neon)', boxShadow: '0 0 8px var(--neon-glow), 0 0 16px var(--neon-glow)', animation: 'orbPulse 2s ease-in-out infinite' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>Clawdbot</div>
            <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{workspaceName || 'No workspace'} / {pageName}</div>
          </div>

          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button type="button" onClick={clearMessages} className="p-1.5 rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)]" aria-label="Clear chat" title="New conversation">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)]" aria-label="Close panel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
          <div className="px-4 py-2 text-sm" style={{ background: 'var(--error-bg)', color: 'var(--error-fg)' }}>{error}</div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors bg-[var(--card)] border border-[var(--border)] focus-within:border-[var(--neon)] focus-within:shadow-[0_0_0_1px_var(--neon-dim),0_0_12px_var(--neon-dim)]">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={workspaceId ? 'Ask Clawdbot...' : 'Select a workspace first'}
              disabled={!workspaceId}
              className="flex-1 bg-transparent text-sm outline-none placeholder-[var(--muted)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--fg)]"
            />
            {isLoading ? (
              <button type="button" onClick={stopGeneration} className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium transition-opacity hover:opacity-80" style={{ background: 'var(--error-bg)', color: 'var(--error-fg)' }}>Stop</button>
            ) : (
              <button type="submit" disabled={!input.trim() || !workspaceId}
                className="flex-shrink-0 p-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: input.trim() && workspaceId ? 'linear-gradient(135deg, var(--neon), var(--pink))' : 'var(--muted-2)', color: input.trim() && workspaceId ? 'white' : 'var(--muted)', boxShadow: input.trim() && workspaceId ? '0 0 12px var(--neon-glow)' : 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function getPageName(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return 'Home'
  const last = segments[segments.length - 1]
  return last.charAt(0).toUpperCase() + last.slice(1)
}
