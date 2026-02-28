'use client'

import { useRef, useEffect, useState, useCallback, FormEvent } from 'react'
import { usePathname } from 'next/navigation'
import { useChat } from '@/hooks/useChat'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { MessageBubble } from './ai-panel/MessageBubble'
import { EmptyState } from './ai-panel/EmptyState'

type SheetState = 'closed' | 'half' | 'full'

export function MobileChatSheet() {
  const { workspace } = useWorkspace()
  const workspaceName = workspace?.name
  const workspaceId = workspace?.id
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')
  const [state, setState] = useState<SheetState>('closed')
  const [dragY, setDragY] = useState<number | null>(null)
  const dragStartRef = useRef<number>(0)
  const stateAtDragStart = useRef<SheetState>('closed')

  const { messages, isLoading, error, sendMessage, stopGeneration, clearMessages } = useChat({
    workspaceId: workspaceId || '',
    workspaceName: workspaceName || 'Unknown',
    currentPage: pathname,
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opening
  useEffect(() => {
    if (state !== 'closed') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [state])

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (state !== 'closed') {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [state])

  const open = useCallback(() => setState('half'), [])
  const close = useCallback(() => setState('closed'), [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !workspaceId) return
    sendMessage(input.trim())
    setInput('')
    if (state === 'closed') setState('half')
  }

  // Touch gesture handling for drag
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.sheet-messages')) return
    dragStartRef.current = e.touches[0].clientY
    stateAtDragStart.current = state
  }, [state])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStartRef.current) return
    const target = e.target as HTMLElement
    if (target.closest('.sheet-messages')) return
    const currentY = e.touches[0].clientY
    const delta = currentY - dragStartRef.current
    setDragY(delta)
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (dragY === null) {
      dragStartRef.current = 0
      return
    }

    const threshold = 80

    if (stateAtDragStart.current === 'half') {
      if (dragY > threshold) {
        setState('closed')
      } else if (dragY < -threshold) {
        setState('full')
      }
    } else if (stateAtDragStart.current === 'full') {
      if (dragY > threshold) {
        setState('half')
      }
    }

    setDragY(null)
    dragStartRef.current = 0
  }, [dragY])

  // Listen for prefill events
  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail?.message === 'string') {
        setInput(detail.message)
        setState('half')
        setTimeout(() => inputRef.current?.focus(), 100)
      }
    }
    window.addEventListener('clawdos:ai-prefill', handlePrefill)
    return () => window.removeEventListener('clawdos:ai-prefill', handlePrefill)
  }, [])

  const sheetHeight = state === 'full' ? '100dvh' : state === 'half' ? '55dvh' : '0px'

  // Apply drag offset
  const dragOffset = dragY !== null && dragY > 0 ? dragY : 0
  const sheetTransform = dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined

  return (
    <>
      {/* FAB — floating action button */}
      {state === 'closed' && (
        <button
          type="button"
          onClick={open}
          className="md:hidden fixed z-50 flex items-center justify-center
            w-14 h-14 rounded-full shadow-lg
            transition-transform active:scale-95"
          style={{
            bottom: 'calc(16px + var(--mobile-safe-bottom))',
            right: '16px',
            background: 'linear-gradient(135deg, var(--neon), var(--pink))',
            boxShadow: '0 4px 20px var(--neon-glow), 0 2px 8px rgba(0,0,0,0.3)',
          }}
          aria-label="Open chat"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {messages.length > 0 && (
            <span
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold
                flex items-center justify-center text-white"
              style={{ background: 'var(--pink)' }}
            >
              {messages.filter(m => m.role === 'assistant').length}
            </span>
          )}
        </button>
      )}

      {/* Backdrop */}
      {state !== 'closed' && (
        <div
          className="md:hidden fixed inset-0 z-50 transition-opacity duration-200"
          style={{
            background: 'rgba(0,0,0,0.5)',
            opacity: state === 'full' ? 0.7 : 0.4,
          }}
          onClick={close}
        />
      )}

      {/* Bottom sheet */}
      {state !== 'closed' && (
        <div
          ref={sheetRef}
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col
            rounded-t-2xl overflow-hidden transition-[height] duration-300 ease-out"
          style={{
            height: sheetHeight,
            transform: sheetTransform,
            background: 'rgba(6,6,10,0.98)',
            borderTop: '1px solid var(--border)',
            willChange: 'height, transform',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-2 pb-1 cursor-grab">
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: 'var(--muted-2)' }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-b-[var(--border)] shrink-0">
            {/* Bot orb */}
            <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
              <div className="absolute inset-0 rounded-full" style={{ background: 'conic-gradient(var(--neon), var(--pink), var(--cyan), var(--neon))', animation: 'spin 3s linear infinite' }} />
              <div className="absolute rounded-full" style={{ inset: 2, background: 'var(--bg)' }} />
              <div className="absolute rounded-full" style={{ width: 6, height: 6, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--neon)', boxShadow: '0 0 8px var(--neon-glow)' }} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-[var(--fg)]">Clawdbot</div>
            </div>

            <div className="flex items-center gap-1">
              {state === 'half' && (
                <button type="button" onClick={() => setState('full')}
                  className="p-1.5 rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--fg)]"
                  aria-label="Expand">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                </button>
              )}
              {state === 'full' && (
                <button type="button" onClick={() => setState('half')}
                  className="p-1.5 rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--fg)]"
                  aria-label="Collapse">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                </button>
              )}
              {messages.length > 0 && (
                <button type="button" onClick={clearMessages}
                  className="p-1.5 rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--fg)]"
                  aria-label="Clear chat">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                </button>
              )}
              <button type="button" onClick={close}
                className="p-1.5 rounded-lg transition-colors text-[var(--muted)] hover:text-[var(--fg)]"
                aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="sheet-messages flex-1 overflow-y-auto">
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

          {/* Error */}
          {error && (
            <div className="px-4 py-2 text-sm shrink-0" style={{ background: 'var(--error-bg)', color: 'var(--error-fg)' }}>
              {error}
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSubmit} className="p-3 border-t border-t-[var(--border)] shrink-0"
            style={{ paddingBottom: 'calc(12px + var(--mobile-safe-bottom))' }}>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-[var(--card)] border border-[var(--border)] focus-within:border-[var(--neon)]">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={workspaceId ? 'Ask Clawdbot...' : 'Select a workspace first'}
                disabled={!workspaceId}
                className="flex-1 bg-transparent text-sm outline-none placeholder-[var(--muted)] disabled:opacity-50 text-[var(--fg)]"
              />
              {isLoading ? (
                <button type="button" onClick={stopGeneration}
                  className="flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium"
                  style={{ background: 'var(--error-bg)', color: 'var(--error-fg)' }}>
                  Stop
                </button>
              ) : (
                <button type="submit" disabled={!input.trim() || !workspaceId}
                  className="flex-shrink-0 p-1.5 rounded-lg transition-colors disabled:opacity-30"
                  style={{
                    background: input.trim() && workspaceId ? 'linear-gradient(135deg, var(--neon), var(--pink))' : 'var(--muted-2)',
                    color: input.trim() && workspaceId ? 'white' : 'var(--muted)',
                  }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </>
  )
}
