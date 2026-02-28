import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { getPool } from '@/lib/db'
import { updateDeliveryEvents } from '@/lib/db/repositories/delivery.repository'
import { sendTelegramMessage } from '@/lib/telegram/send'
import { getTracking } from '@/lib/trackingmore/client'
import { mapTmStatus, extractEvents, buildStatusChangeMessage } from '@/lib/delivery-utils'
import type { DeliveryStatus } from '@/lib/db/repositories/delivery.repository'

const log = createLogger('cron-refresh-deliveries')

export const dynamic = 'force-dynamic'

/** Delay between API calls to respect rate limits */
const DELAY_MS = 2000
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function GET(request: Request) {
  // Auth: only allow from localhost or with correct cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const host = request.headers.get('host') || ''
  const isLocal = host.startsWith('127.0.0.1') || host.startsWith('localhost')

  if (!isLocal && (!cronSecret || authHeader !== `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const pool = getPool()
  const client = await pool.connect()

  try {
    // Get all active deliveries (no RLS — system cron)
    const result = await client.query(
      `SELECT id, tracking_number, courier_code, courier_name, title, status
       FROM content.delivery
       WHERE status NOT IN ('delivered', 'expired')
         AND courier_code IS NOT NULL
       ORDER BY updated_at DESC`
    )

    const deliveries = result.rows as Array<{
      id: string
      tracking_number: string
      courier_code: string
      courier_name: string | null
      title: string | null
      status: DeliveryStatus
    }>

    if (deliveries.length === 0) {
      log.info('No active deliveries to refresh')
      return NextResponse.json({ ok: true, refreshed: 0, updated: 0 })
    }

    log.info('Cron refresh starting', { count: deliveries.length })

    let updated = 0
    let errors = 0

    for (let i = 0; i < deliveries.length; i++) {
      const d = deliveries[i]
      if (i > 0) await sleep(DELAY_MS)

      try {
        // GET cached data from TrackingMore (no carrier query)
        const tm = await getTracking(d.tracking_number, d.courier_code)
        const newStatus = mapTmStatus(tm.delivery_status)

        // Only update DB if status actually changed
        if (newStatus === d.status) continue

        const events = extractEvents(tm)

        const lastEvent = tm.latest_event ?? events[0]?.description ?? null
        const lastEventAt = tm.lastest_checkpoint_time ?? events[0]?.date ?? null

        await updateDeliveryEvents(
          client,
          d.id,
          events,
          newStatus,
          tm.substatus ?? null,
          lastEvent,
          lastEventAt
        )

        updated++
        log.info('Delivery status changed', {
          id: d.id,
          tracking: d.tracking_number,
          oldStatus: d.status,
          newStatus,
        })

        // Telegram notification
        const chatId = process.env.TELEGRAM_OWNER_CHAT_ID
        if (chatId) {
          const title = d.title || d.tracking_number
          const courier = d.courier_name || d.courier_code
          const msg = buildStatusChangeMessage(title, courier, newStatus, lastEvent)
          sendTelegramMessage(chatId, msg).catch(() => {})
        }
      } catch {
        errors++
      }
    }

    log.info('Cron refresh complete', { total: deliveries.length, updated, errors })
    return NextResponse.json({ ok: true, refreshed: deliveries.length, updated, errors })
  } finally {
    client.release()
  }
}
