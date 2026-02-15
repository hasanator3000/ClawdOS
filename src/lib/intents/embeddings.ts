/**
 * Singleton embedding service for semantic intent matching (Layer 1).
 *
 * - Loads multilingual-e5-small model lazily on first request
 * - Computes centroids from intent card examples once
 * - Matches user queries against centroids via cosine similarity
 * - E5 instruction prefix ("query:" / "passage:") for better accuracy
 *
 * Perf: ~6ms per query after warm-up. ~700MB RSS with model loaded.
 */

import { INTENT_CARDS, type IntentCard } from './cards'

// Lazy-loaded pipeline function from @xenova/transformers
let pipelinePromise: Promise<any> | null = null
let embedFn: any = null

/** Computed centroid for each intent card */
interface IntentCentroid {
  card: IntentCard
  centroid: Float64Array
}

let centroids: IntentCentroid[] | null = null
let initPromise: Promise<void> | null = null

// ---------------------------------------------------------------------------
// Model loading
// ---------------------------------------------------------------------------

async function loadModel() {
  if (embedFn) return embedFn

  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      const { pipeline } = await import('@xenova/transformers')
      const fn = await pipeline('feature-extraction', 'Xenova/multilingual-e5-small', {
        quantized: true,
      })
      // Warm-up inference (first call is always slower)
      await fn('warmup', { pooling: 'mean', normalize: true })
      return fn
    })()
  }

  embedFn = await pipelinePromise
  return embedFn
}

// ---------------------------------------------------------------------------
// Embedding helpers
// ---------------------------------------------------------------------------

async function embed(text: string, isQuery: boolean): Promise<Float64Array> {
  const fn = await loadModel()
  const prefixed = isQuery ? `query: ${text}` : `passage: ${text}`
  const result = await fn(prefixed, { pooling: 'mean', normalize: true })
  return new Float64Array(result.data)
}

function cosine(a: Float64Array, b: Float64Array): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function computeCentroid(vectors: Float64Array[]): Float64Array {
  const dim = vectors[0].length
  const avg = new Float64Array(dim)
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) avg[i] += v[i]
  }
  let norm = 0
  for (let i = 0; i < dim; i++) {
    const val = avg[i] / vectors.length
    norm += val * val
  }
  norm = Math.sqrt(norm)
  const result = new Float64Array(dim)
  for (let i = 0; i < dim; i++) {
    result[i] = avg[i] / vectors.length / norm
  }
  return result
}

// ---------------------------------------------------------------------------
// Initialization: compute centroids from intent cards
// ---------------------------------------------------------------------------

async function buildCentroids(): Promise<IntentCentroid[]> {
  const results: IntentCentroid[] = []

  for (const card of INTENT_CARDS) {
    const vecs = await Promise.all(card.examples.map((ex) => embed(ex, false)))
    results.push({ card, centroid: computeCentroid(vecs) })
    console.log(`[IntentRouter] Centroid for "${card.id}": ${card.examples.length} examples`)
  }

  return results
}

async function ensureInitialized(): Promise<void> {
  if (centroids) return

  if (!initPromise) {
    initPromise = (async () => {
      const t0 = Date.now()
      console.log('[IntentRouter] Initializing embedding service...')
      centroids = await buildCentroids()
      console.log(`[IntentRouter] Ready in ${Date.now() - t0}ms (${centroids.length} intents)`)
    })()
  }

  await initPromise
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SemanticMatch {
  card: IntentCard
  score: number
  gap: number // score difference between top-1 and top-2
}

/**
 * Match user input against intent centroids.
 * Returns the best match with confidence metrics, or null if service unavailable.
 */
export async function matchIntent(input: string): Promise<SemanticMatch | null> {
  try {
    await ensureInitialized()
  } catch (err) {
    console.error('[IntentRouter] Init failed, skipping Layer 1:', err)
    return null
  }

  if (!centroids || centroids.length === 0) return null

  const vec = await embed(input, true)

  const scored = centroids
    .map((c) => ({ card: c.card, score: cosine(vec, c.centroid) }))
    .sort((a, b) => b.score - a.score)

  const top = scored[0]
  const second = scored[1]
  const gap = second ? top.score - second.score : 1

  console.log(`[IntentRouter] matchIntent("${input}")`, {
    top: { id: top.card.id, score: top.score.toFixed(4) },
    second: second ? { id: second.card.id, score: second.score.toFixed(4) } : null,
    gap: gap.toFixed(4),
  })

  return { card: top.card, score: top.score, gap }
}

/**
 * Pre-warm the model and centroids. Call at server startup to avoid
 * cold-start latency on the first user request.
 */
export async function warmup(): Promise<void> {
  await ensureInitialized()
}
