import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getPool, withUser } from '@/lib/db'
import { refreshStaleSources } from '@/lib/rss/fetcher'
import { getWorkspacesForUser } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

/**
 * POST /api/news/refresh
 *
 * Refreshes stale RSS sources. Two auth modes:
 * 1. Session-based (from web UI) — refreshes active workspace
 * 2. Token-based (from cron/Clawdbot) — refreshes all workspaces
 */
export async function POST(request: Request) {
  const consultToken = request.headers.get('x-lifeos-consult-token')
  const session = await getSession()

  // Auth: session OR consult token
  if (!session.userId && consultToken !== process.env.LIFEOS_CONSULT_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (session.userId) {
      // Session mode: refresh current user's workspaces
      const workspaces = await getWorkspacesForUser()
      const allResults = []

      for (const ws of workspaces) {
        const results = await withUser(session.userId, (client) =>
          refreshStaleSources(client, ws.id, 15)
        )
        allResults.push(...results)
      }

      return NextResponse.json({
        refreshed: allResults.filter((r) => !r.error).length,
        errors: allResults.filter((r) => r.error).length,
        results: allResults,
      })
    }

    // Token mode: refresh all workspaces (system-level)
    // Uses a simple query without RLS to get workspace IDs,
    // then processes each with the first member's user_id for RLS context
    const pool = getPool()
    const client = await pool.connect()

    try {
      const wsResult = await client.query('select id from core.workspace')
      const allResults = []

      for (const row of wsResult.rows) {
        // Get first member of workspace for RLS context
        const memberResult = await client.query(
          'select user_id from core.membership where workspace_id = $1 limit 1',
          [row.id]
        )
        if (memberResult.rows.length === 0) continue

        const userId = memberResult.rows[0].user_id
        const results = await withUser(userId, (c) =>
          refreshStaleSources(c, row.id, 15)
        )
        allResults.push(...results)
      }

      return NextResponse.json({
        refreshed: allResults.filter((r) => !r.error).length,
        errors: allResults.filter((r) => r.error).length,
        results: allResults,
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('[News Refresh] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
