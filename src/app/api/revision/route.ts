import { NextResponse } from 'next/server'
import { getRevisions } from '@/lib/revision-store'

export const dynamic = 'force-dynamic'

/**
 * Lightweight endpoint returning in-memory revision counters.
 * The client polls this every N seconds to detect external changes
 * (webhooks, Telegram, other tabs, cron jobs).
 *
 * No auth required — revisions are opaque counters, no data leaked.
 * Payload: ~80 bytes. No DB queries.
 */
export function GET() {
  return NextResponse.json(getRevisions(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}
