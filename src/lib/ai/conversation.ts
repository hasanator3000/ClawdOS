import { withUser } from '@/lib/db'
import {
  createConversation,
  createMessage,
} from '@/lib/ai/repository'
import { createLogger } from '@/lib/logger'

const log = createLogger('chat')

/**
 * Ensure a conversation exists (create if needed) and save the user message.
 * @returns conversationId or null if no workspace
 */
export async function ensureConversation(
  userId: string,
  incomingConversationId: string | null,
  workspaceId: string | null,
  userMessage: string
): Promise<string | null> {
  if (!workspaceId) return null
  try {
    let convId = incomingConversationId
    await withUser(userId, async (client) => {
      if (!convId) {
        const conv = await createConversation(client, {
          workspaceId,
          title: userMessage.slice(0, 80),
        })
        convId = conv.id
      }
      await createMessage(client, { conversationId: convId!, role: 'user', content: userMessage })
    })
    return convId
  } catch (err) {
    log.error('Failed to persist conversation', { error: err instanceof Error ? err.message : String(err) })
    return incomingConversationId
  }
}

/**
 * Save the assistant's reply after streaming completes.
 */
export async function saveAssistantMessage(userId: string, conversationId: string | null, content: string) {
  if (!conversationId || !content.trim()) return
  try {
    await withUser(userId, (client) =>
      createMessage(client, { conversationId, role: 'assistant', content })
    )
  } catch (err) {
    log.error('Failed to persist assistant message', { error: err instanceof Error ? err.message : String(err) })
  }
}
