import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSession } from '@/lib/auth/session'
import { withUser } from '@/lib/db'
import {
  createConversation,
  createMessage,
  getConversationById,
  getMessagesByConversation,
} from '@/lib/ai/repository'
import type { StreamEvent, AgentContext } from '@/lib/ai/types'
import { skillRegistry } from '@/lib/ai/skills/registry'
import '@/lib/ai/skills' // Auto-register skills

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// System prompt for Clawdbot
function getSystemPrompt(context: AgentContext): string {
  return `You are Clawdbot, an AI assistant integrated into LifeOS - a personal operating system.

Current context:
- Workspace: ${context.workspaceName}
- Current page: ${context.currentPage}

You have access to tools to help the user:

NEWS TOOLS:
- get_today_digest: Get today's news digest
- get_recent_digests: Get recent digests
- get_news_items: Get recent news items
- search_news: Search news by keyword

TASK TOOLS:
- create_task: Create a new task (e.g., "create task: buy groceries")
- list_tasks: List current tasks (e.g., "what are my tasks?")
- complete_task: Mark a task as done (e.g., "mark X done")
- update_task: Update task details
- delete_task: Delete a task
- get_overdue_tasks: Get tasks past their due date

IMPORTANT:
- When the user asks about news, digests, or what's happening, use the NEWS TOOLS.
- When the user asks to create, list, complete, or manage tasks, use the TASK TOOLS.
- Always use tools when you can provide real data instead of generic responses.
- Be helpful, concise, and proactive.

${context.memories?.length ? `\nRelevant memories:\n${context.memories.join('\n')}` : ''}`
}

// Convert skill tools to Anthropic format
function getAnthropicTools(): Anthropic.Tool[] {
  return skillRegistry.getAllTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: tool.parameters.properties as Record<string, unknown>,
      required: tool.parameters.required || [],
    },
  }))
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

    // Capture userId and workspaceId for use in stream
    const userId = session.userId
    const workspaceId = context.workspaceId

    // Build messages for Anthropic API
    const agentContext: AgentContext = {
      workspaceId,
      workspaceName: context.workspaceName,
      userId,
      currentPage: context.currentPage,
    }

    const messages: Anthropic.MessageParam[] = [
      ...result.previousMessages,
      { role: 'user', content: message },
    ]

    // Get tools
    const tools = getAnthropicTools()

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
          let currentMessages = [...messages]
          let continueLoop = true

          while (continueLoop) {
            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: getSystemPrompt(agentContext),
              messages: currentMessages,
              tools: tools.length > 0 ? tools : undefined,
              stream: true,
            })

            let currentToolUse: { id: string; name: string; input: string } | null = null
            let stopReason: string | null = null
            const toolResults: Anthropic.ToolResultBlockParam[] = []

            for await (const event of response) {
              if (event.type === 'content_block_start') {
                if (event.content_block.type === 'tool_use') {
                  currentToolUse = {
                    id: event.content_block.id,
                    name: event.content_block.name,
                    input: '',
                  }
                  sendEvent({
                    type: 'tool_start',
                    toolName: event.content_block.name,
                    toolCallId: event.content_block.id,
                    input: {},
                  })
                }
              } else if (event.type === 'content_block_delta') {
                if (event.delta.type === 'text_delta') {
                  fullContent += event.delta.text
                  sendEvent({ type: 'token', content: event.delta.text })
                } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
                  currentToolUse.input += event.delta.partial_json
                }
              } else if (event.type === 'content_block_stop') {
                if (currentToolUse) {
                  // Execute the tool
                  let toolInput: Record<string, unknown> = {}
                  try {
                    toolInput = JSON.parse(currentToolUse.input || '{}')
                  } catch {
                    toolInput = {}
                  }

                  // Execute tool with database context
                  const toolResult = await withUser(userId, async (client) => {
                    return skillRegistry.executeTool(currentToolUse!.name, toolInput, {
                      workspaceId,
                      userId,
                      client,
                    })
                  })

                  sendEvent({
                    type: 'tool_end',
                    toolCallId: currentToolUse.id,
                    output: toolResult.success ? (toolResult.data as Record<string, unknown>) : null,
                    error: toolResult.error || null,
                  })

                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: currentToolUse.id,
                    content: JSON.stringify(toolResult.success ? toolResult.data : { error: toolResult.error }),
                  })

                  currentToolUse = null
                }
              } else if (event.type === 'message_delta') {
                if (event.usage) {
                  outputTokens += event.usage.output_tokens
                }
                stopReason = event.delta.stop_reason || null
              } else if (event.type === 'message_start') {
                if (event.message.usage) {
                  inputTokens += event.message.usage.input_tokens
                }
              }
            }

            // Check if we need to continue with tool results
            if (stopReason === 'tool_use' && toolResults.length > 0) {
              // Add assistant message with tool use to context
              currentMessages = [
                ...currentMessages,
                {
                  role: 'assistant' as const,
                  content: [
                    ...(fullContent ? [{ type: 'text' as const, text: fullContent }] : []),
                    ...toolResults.map((tr) => ({
                      type: 'tool_use' as const,
                      id: tr.tool_use_id,
                      name:
                        tools.find(
                          (t) =>
                            toolResults.find((r) => r.tool_use_id === tr.tool_use_id) &&
                            t.name ===
                              messages
                                .flatMap((m) =>
                                  typeof m.content === 'string' ? [] : m.content
                                )
                                .find(
                                  (c): c is Anthropic.ToolUseBlockParam =>
                                    c.type === 'tool_use' && c.id === tr.tool_use_id
                                )?.name
                        )?.name || 'unknown',
                      input: {},
                    })),
                  ],
                },
                {
                  role: 'user' as const,
                  content: toolResults,
                },
              ]
              fullContent = '' // Reset for next iteration
            } else {
              continueLoop = false
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
