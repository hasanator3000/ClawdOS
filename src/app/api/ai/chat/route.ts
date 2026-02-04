import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import {
  createConversation,
  createMessage,
  createToolCall,
  updateToolCallStatus,
  getConversationById,
  getMessagesByConversation,
} from '@/lib/ai/repository'
import type { StreamEvent, AgentContext } from '@/lib/ai/types'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// System prompt for Clawdbot
function getSystemPrompt(context: AgentContext): string {
  return `You are Clawdbot, an AI assistant integrated into LifeOS - a personal operating system.

Current context:
- Workspace: ${context.workspaceName}
- Current page: ${context.currentPage}
- User ID: ${context.userId}

You have access to various skills (tools) to help the user:
- Create and manage tasks
- Access news and digests
- Search and retrieve information
- Create notes and documents

Be helpful, concise, and proactive. When the user asks you to do something, use the appropriate tool if available.
If you don't have a tool for something, explain what you can do instead.

${context.memories?.length ? `\nRelevant memories:\n${context.memories.join('\n')}` : ''}`
}

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversationId, message, context } = body as {
      conversationId?: string
      message: string
      context: {
        workspaceId: string
        workspaceName: string
        currentPage: string
      }
    }

    if (!message || !context?.workspaceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create or get conversation and messages
    const result = await withUser(session.userId, async (client) => {
      let conversation
      let previousMessages: Anthropic.MessageParam[] = []

      if (conversationId) {
        conversation = await getConversationById(client, conversationId)
        if (!conversation) {
          throw new Error('Conversation not found')
        }

        // Get previous messages
        const messages = await getMessagesByConversation(client, conversationId)
        previousMessages = messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content || '',
        }))
      } else {
        // Create new conversation
        conversation = await createConversation(client, {
          workspaceId: context.workspaceId,
          context: {
            page: context.currentPage,
            workspaceName: context.workspaceName,
          },
        })
      }

      // Create user message
      await createMessage(client, {
        conversationId: conversation.id,
        role: 'user',
        content: message,
      })

      return { conversation, previousMessages }
    })

    // Capture userId for use in stream (we already validated it exists)
    const userId = session.userId

    // Build messages for Anthropic API
    const agentContext: AgentContext = {
      workspaceId: context.workspaceId,
      workspaceName: context.workspaceName,
      userId,
      currentPage: context.currentPage,
    }

    const messages: Anthropic.MessageParam[] = [
      ...result.previousMessages,
      { role: 'user', content: message },
    ]

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sendEvent = (event: StreamEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }

        try {
          let fullContent = ''
          let inputTokens = 0
          let outputTokens = 0

          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: getSystemPrompt(agentContext),
            messages,
            stream: true,
          })

          for await (const event of response) {
            if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                fullContent += event.delta.text
                sendEvent({ type: 'token', content: event.delta.text })
              }
            } else if (event.type === 'message_delta') {
              if (event.usage) {
                outputTokens = event.usage.output_tokens
              }
            } else if (event.type === 'message_start') {
              if (event.message.usage) {
                inputTokens = event.message.usage.input_tokens
              }
            }
          }

          // Save assistant message to database
          const assistantMessage = await withUser(userId, async (client) => {
            return createMessage(client, {
              conversationId: result.conversation.id,
              role: 'assistant',
              content: fullContent,
              model: 'claude-sonnet-4-20250514',
              finishReason: 'stop',
              inputTokens,
              outputTokens,
            })
          })

          sendEvent({
            type: 'done',
            messageId: assistantMessage.id,
            inputTokens,
            outputTokens,
          })
        } catch (error) {
          console.error('Anthropic API error:', error)
          sendEvent({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get conversation history
export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const conversationId = url.searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    const result = await withUser(session.userId, async (client) => {
      const conversation = await getConversationById(client, conversationId)
      if (!conversation) {
        return null
      }

      const messages = await getMessagesByConversation(client, conversationId)
      return { conversation, messages }
    })

    if (!result) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Get conversation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
