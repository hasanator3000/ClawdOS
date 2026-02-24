'use client'

import { memo } from 'react'
import type { ChatMessage } from '@/hooks/chat-types'

// Memoized message bubble with gradient/glass styling
export const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[85%] rounded-2xl px-3.5 py-2.5"
        style={
          isUser
            ? {
                background: 'linear-gradient(135deg, var(--neon), var(--pink))',
                color: '#ffffff',
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
            <span className="inline-block ml-0.5 animate-pulse" style={{ color: isUser ? '#ffffff' : 'var(--neon)' }}>
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
export const ToolCallDisplay = memo(function ToolCallDisplay({
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
