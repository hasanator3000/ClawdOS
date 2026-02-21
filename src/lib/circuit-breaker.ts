/**
 * In-memory circuit breaker for upstream service calls.
 *
 * States:
 * - CLOSED:    Normal operation. Tracks consecutive failures.
 * - OPEN:      After failureThreshold consecutive failures. All calls fail fast.
 * - HALF_OPEN: After resetTimeout, allows one probe request through.
 *              Success → CLOSED, Failure → OPEN again.
 */

import { createLogger } from './logger'

const log = createLogger('circuit-breaker')

type State = 'closed' | 'open' | 'half_open'

interface CircuitBreakerOptions {
  /** Name for logging */
  name: string
  /** Number of consecutive failures before opening the circuit */
  failureThreshold?: number
  /** Time in ms to wait before trying again (half-open) */
  resetTimeout?: number
}

interface CircuitBreakerState {
  state: State
  failures: number
  lastFailure: number
  lastSuccess: number
}

const breakers = new Map<string, CircuitBreakerState>()

function getState(name: string): CircuitBreakerState {
  let s = breakers.get(name)
  if (!s) {
    s = { state: 'closed', failures: 0, lastFailure: 0, lastSuccess: 0 }
    breakers.set(name, s)
  }
  return s
}

/**
 * Execute a function through a circuit breaker.
 *
 * @throws Error with message "Circuit open: <name>" if circuit is open
 * @throws The original error if the function fails
 */
export async function withCircuitBreaker<T>(
  opts: CircuitBreakerOptions,
  fn: () => Promise<T>
): Promise<T> {
  const { name, failureThreshold = 5, resetTimeout = 30_000 } = opts
  const s = getState(name)

  // Check if circuit should transition from open to half_open
  if (s.state === 'open') {
    const elapsed = Date.now() - s.lastFailure
    if (elapsed >= resetTimeout) {
      s.state = 'half_open'
      log.info('Circuit half-open, allowing probe', { name })
    } else {
      log.warn('Circuit open, failing fast', {
        name,
        failures: s.failures,
        retryIn: Math.ceil((resetTimeout - elapsed) / 1000),
      })
      throw new Error(`Circuit open: ${name}`)
    }
  }

  try {
    const result = await fn()

    // Success: reset to closed
    if (s.state !== 'closed') {
      log.info('Circuit closed after successful probe', { name })
    }
    s.state = 'closed'
    s.failures = 0
    s.lastSuccess = Date.now()

    return result
  } catch (err) {
    s.failures++
    s.lastFailure = Date.now()

    if (s.state === 'half_open' || s.failures >= failureThreshold) {
      s.state = 'open'
      log.error('Circuit opened', {
        name,
        failures: s.failures,
        resetTimeout,
        error: err instanceof Error ? err.message : String(err),
      })
    }

    throw err
  }
}

/** Get current state of a named circuit breaker (for monitoring/health). */
export function getCircuitState(name: string): { state: State; failures: number } {
  const s = getState(name)
  // Check if open circuit should transition to half_open
  if (s.state === 'open' && Date.now() - s.lastFailure >= 30_000) {
    return { state: 'half_open', failures: s.failures }
  }
  return { state: s.state, failures: s.failures }
}
