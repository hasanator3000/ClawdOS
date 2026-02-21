/**
 * 3-Layer Intent Router
 *
 * Layer 0 — Regex fast-path (<1ms):   Handles explicit commands with clear structure.
 * Layer 1 — Embeddings (~6ms):        Handles implicit/fuzzy inputs that Layer 0 misses.
 * Layer 2 — LLM fallback (external):  Handles everything else (caller's responsibility).
 *
 * Returns a CommandResult for Layers 0/1, or null when LLM should handle it.
 */

import { resolveCommand, type CommandResult, type CommandContext } from '@/lib/commands/chat-handlers'
import { matchIntent } from './embeddings'
import { createLogger } from '@/lib/logger'

const log = createLogger('intent-router')

/** Minimum gap between top-1 and top-2 to trust embedding match */
const MIN_GAP = 0.015

/** Minimum absolute score to consider a match */
const MIN_SCORE = 0.85

export interface RouteResult {
  result: CommandResult
  layer: 0 | 1
  /** For Layer 1: intent ID that matched */
  intentId?: string
}

/**
 * Route user input through all layers.
 * Returns RouteResult if handled, null if LLM should handle it.
 */
export async function routeCommand(
  input: string,
  ctx: CommandContext
): Promise<RouteResult | null> {
  if (!input?.trim()) return null

  // -----------------------------------------------------------------------
  // Layer 0: Regex fast-path (deterministic, <1ms)
  // -----------------------------------------------------------------------
  const cmd = resolveCommand(input, ctx)
  if (cmd) {
    return { result: cmd, layer: 0 }
  }

  // -----------------------------------------------------------------------
  // Layer 1: Embedding semantic match (~6ms)
  // -----------------------------------------------------------------------
  const match = await matchIntent(input)

  if (match && match.score >= MIN_SCORE && match.gap >= MIN_GAP) {
    // Embedding is confident — try to resolve via intent card
    const result = match.card.resolve(input)

    if (result) {
      log.info(`Layer 1 match: "${input}" → ${match.card.id}`, {
        score: match.score.toFixed(3),
        gap: match.gap.toFixed(4),
      })
      return { result, layer: 1, intentId: match.card.id }
    }

    // Card matched but can't resolve (e.g. task.complete needs LLM for task lookup)
    log.debug(`Layer 1 detected ${match.card.id} but needs LLM for resolution`)
  }

  // -----------------------------------------------------------------------
  // Layer 2: LLM fallback (caller handles this)
  // -----------------------------------------------------------------------
  return null
}
