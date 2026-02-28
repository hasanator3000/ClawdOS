import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { getPool } from '@/lib/db'
import { updateDeliveryEvents } from '@/lib/db/repositories/delivery.repository'
import { sendTelegramMessage } from '@/lib/telegram/send'
import { mapTmStatus, extractEvents, buildStatusChangeMessage } from '@/lib/delivery-utils'
import type { TrackingMoreWebhookPayload } from '@/lib/trackingmore/types'
import type { DeliveryStatus } from '@/lib/db/repositories/delivery.repository'
import { bumpRevision } from '@/lib/revision-store'

const log = createLogger('webhook-trackingmore')

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let body: TrackingMoreWebhookPayload
  try {
    body = (await request.json()) as TrackingMoreWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const data = body?.data
  if (!data?.tracking_number) {
    log.warn('Webhook received with no tracking number', { event: body?.event })
    return NextResponse.json({ error: 'Missing tracking number' }, { status: 400 })
  }

  log.info('Webhook received', {
    event: body.event,
    trackingNumber: data.tracking_number,
    courier: data.courier_code,
    status: data.delivery_status,
  })

  try {
    const pool = getPool()
    const client = await pool.connect()

    try {
      // Find delivery by tracking number (no RLS — webhook is system-level)
      const findResult = await client.query(
        `SELECT id, status, title, courier_name FROM content.delivery WHERE tracking_number = $1 LIMIT 1`,
        [data.tracking_number]
      )

      if (findResult.rows.length === 0) {
        log.warn('Delivery not found for webhook', { trackingNumber: data.tracking_number })
        return NextResponse.json({ ok: true, message: 'Tracking not found, ignored' })
      }

      const row = findResult.rows[0]
      const deliveryId = row.id as string
      const oldStatus = row.status as DeliveryStatus
      const deliveryTitle = (row.title as string) || data.tracking_number
      const courierName = (row.courier_name as string) || data.courier_code || 'Unknown'

      const events = extractEvents(data)
      const status = mapTmStatus(data.delivery_status)
      const lastEvent = data.latest_event ?? events[0]?.description ?? null
      const lastEventAt = data.lastest_checkpoint_time ?? events[0]?.date ?? null

      await updateDeliveryEvents(
        client,
        deliveryId,
        events,
        status,
        data.substatus ?? null,
        lastEvent,
        lastEventAt
      )

      log.info('Delivery updated via webhook', { deliveryId, status, eventsCount: events.length })
      bumpRevision('deliveries')

      // Send Telegram notification if status changed
      if (status !== oldStatus) {
        const chatId = process.env.TELEGRAM_OWNER_CHAT_ID
        if (chatId) {
          const msg = buildStatusChangeMessage(deliveryTitle, courierName, status, lastEvent)
          sendTelegramMessage(chatId, msg).catch((err) => {
            log.warn('Telegram notify failed', { error: err instanceof Error ? err.message : String(err) })
          })
        }
      }

      return NextResponse.json({ ok: true })
    } finally {
      client.release()
    }
  } catch (err) {
    log.error('Webhook processing error', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }
}
