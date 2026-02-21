import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health
 *
 * Public health check endpoint (no auth required).
 * Checks DB connectivity and Clawdbot upstream reachability.
 * Returns 200 if all healthy, 503 if degraded.
 */
export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; latencyMs?: number; detail?: string }> = {}
  const t0 = Date.now()

  // --- Database check ---
  try {
    const dbStart = Date.now()
    const pool = getPool()
    await pool.query('SELECT 1')
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
  } catch (err) {
    checks.database = {
      status: 'error',
      detail: err instanceof Error ? err.message : 'Connection failed',
    }
  }

  // --- Clawdbot upstream check ---
  const clawdbotUrl = process.env.CLAWDBOT_URL || 'http://127.0.0.1:18789'
  try {
    const cbStart = Date.now()
    const res = await fetch(`${clawdbotUrl.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(3_000),
    })
    checks.clawdbot = {
      status: res.ok ? 'ok' : 'error',
      latencyMs: Date.now() - cbStart,
      ...(res.ok ? {} : { detail: `HTTP ${res.status}` }),
    }
  } catch (err) {
    checks.clawdbot = {
      status: 'error',
      detail: err instanceof Error ? err.message : 'Unreachable',
    }
  }

  const allOk = Object.values(checks).every((c) => c.status === 'ok')

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      totalMs: Date.now() - t0,
      checks,
    },
    { status: allOk ? 200 : 503 }
  )
}
