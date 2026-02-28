'use server'

import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { validateAction } from '@/lib/validation'
import { createDeliverySchema, deliveryIdSchema } from '@/lib/validation-schemas'
import {
  createDelivery as createDeliveryRepo,
  findDeliveryById,
  findDeliveryByTracking,
  updateDelivery as updateDeliveryRepo,
  updateDeliveryEvents,
  deleteDelivery as deleteDeliveryRepo,
  findActiveDeliveries,
  type Delivery,
} from '@/lib/db/repositories/delivery.repository'
import { detectCarrier, createTracking, getRealtimeTracking, deleteTracking } from '@/lib/trackingmore/client'
import { mapTmStatus, extractEvents } from '@/lib/delivery-utils'
import type { TrackingMoreTracking } from '@/lib/trackingmore/types'

const log = createLogger('delivery-actions')

/** TrackingMore rate limit: ~1 req/sec. Delay between API calls to avoid 401/429. */
const TM_DELAY_MS = 1500
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Statuses from TrackingMore that mean "no real data yet" */
const TM_EMPTY_STATUSES = ['pending', 'notfound']

/** Check if a TrackingMore response has real tracking data */
function hasRealData(result: TrackingMoreTracking): boolean {
  const eventCount =
    (result.origin_info?.trackinfo?.length ?? 0) +
    (result.destination_info?.trackinfo?.length ?? 0)
  return eventCount > 0 || !TM_EMPTY_STATUSES.includes(result.delivery_status)
}

export async function addDelivery(params: {
  trackingNumber: string
  courierCode?: string
  title?: string
}): Promise<{ delivery?: Delivery; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const v = validateAction(createDeliverySchema, params)
  if (v.error) return { error: v.error }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace selected' }

  // Check for duplicate
  const existing = await withUser(session.userId, (client) =>
    findDeliveryByTracking(client, workspace.id, params.trackingNumber)
  )
  if (existing) return { error: 'This tracking number is already being tracked' }

  try {
    // Auto-detect carrier if not provided
    let courierCode = params.courierCode
    let courierName: string | undefined
    let detectedCandidates: Array<{ courier_code: string; courier_name: string }> = []

    if (!courierCode) {
      try {
        detectedCandidates = await detectCarrier(params.trackingNumber)
        if (detectedCandidates.length > 0) {
          courierCode = detectedCandidates[0].courier_code
          courierName = detectedCandidates[0].courier_name
        }
      } catch (err) {
        log.warn('Carrier detection failed, will create without courier', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Fetch realtime status — try each detected carrier candidate until one
    // returns actual tracking data. The detect API often ranks the wrong
    // carrier first (e.g. SF International before FedEx for 888* numbers).
    let trackingmoreId: string | undefined
    let tmData: TrackingMoreTracking | undefined

    const candidatesToTry = courierCode && !params.courierCode && detectedCandidates.length > 1
      ? detectedCandidates.slice(0, 4) // try top 4 candidates from detect
      : courierCode ? [{ courier_code: courierCode, courier_name: courierName || '' }] : []

    for (let i = 0; i < candidatesToTry.length; i++) {
      const candidate = candidatesToTry[i]
      if (i > 0) await sleep(TM_DELAY_MS)
      try {
        const realtime = await getRealtimeTracking(params.trackingNumber, candidate.courier_code)
        if (hasRealData(realtime)) {
          tmData = realtime
          courierCode = candidate.courier_code
          courierName = realtime.courier_name || candidate.courier_name
          if (realtime.id) trackingmoreId = realtime.id
          log.info('Found carrier with data', { courier: candidate.courier_code, status: realtime.delivery_status })
          break
        }
      } catch {
        // This candidate didn't work, try next
      }
    }

    // If no candidate returned data, register with best guess and rely on webhooks
    if (!tmData && courierCode) {
      try {
        const created = await createTracking({
          tracking_number: params.trackingNumber,
          courier_code: courierCode,
        })
        trackingmoreId = created.id
        if (created.courier_name) courierName = created.courier_name
        if (created.courier_code) courierCode = created.courier_code
        tmData = created
      } catch (err) {
        log.warn('TrackingMore create failed, saving locally anyway', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Create in DB
    const delivery = await withUser(session.userId, async (client) => {
      const d = await createDeliveryRepo(client, {
        workspaceId: workspace.id,
        trackingNumber: params.trackingNumber,
        courierCode,
        courierName,
        title: params.title,
        trackingmoreId,
      })

      // If we got tracking data, update events immediately
      if (tmData) {
        const events = extractEvents(tmData)
        const status = mapTmStatus(tmData.delivery_status)
        const updated = await updateDeliveryEvents(
          client,
          d.id,
          events,
          status,
          tmData.substatus ?? null,
          tmData.latest_event ?? null,
          tmData.lastest_checkpoint_time ?? null
        )
        return updated ?? d
      }

      return d
    })

    return { delivery }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('delivery_ws_tracking_uniq')) {
      return { error: 'This tracking number is already being tracked' }
    }
    log.error('Add delivery failed', { error: msg })
    return { error: 'Failed to add delivery' }
  }
}

export async function removeDelivery(id: string): Promise<{ success?: boolean; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const idV = validateAction(deliveryIdSchema, id)
  if (idV.error) return { error: 'Invalid delivery ID' }

  try {
    // Get delivery info for TrackingMore cleanup
    const delivery = await withUser(session.userId, (client) => findDeliveryById(client, id))
    if (!delivery) return { error: 'Delivery not found' }

    // Delete from TrackingMore (best-effort)
    if (delivery.courierCode) {
      try {
        await deleteTracking(delivery.trackingNumber, delivery.courierCode)
      } catch {
        // Ignore — local delete still proceeds
      }
    }

    // Delete from DB
    await withUser(session.userId, (client) => deleteDeliveryRepo(client, id))
    return { success: true }
  } catch (err) {
    log.error('Remove delivery failed', { error: err instanceof Error ? err.message : String(err) })
    return { error: 'Failed to remove delivery' }
  }
}

export async function refreshDelivery(id: string): Promise<{ delivery?: Delivery; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const idV = validateAction(deliveryIdSchema, id)
  if (idV.error) return { error: 'Invalid delivery ID' }

  try {
    const delivery = await withUser(session.userId, (client) => findDeliveryById(client, id))
    if (!delivery) return { error: 'Delivery not found' }

    if (!delivery.courierCode) return { error: 'No carrier detected — cannot refresh' }

    let tmData: TrackingMoreTracking | undefined
    let resolvedCourierCode = delivery.courierCode

    // Try current carrier first
    try {
      const result = await getRealtimeTracking(delivery.trackingNumber, delivery.courierCode)
      if (hasRealData(result)) {
        tmData = result
      }
    } catch {
      // Current carrier failed
    }

    // If current carrier returned no data and status is still pending,
    // try re-detecting carrier (detect API may have picked wrong one)
    if (!tmData && delivery.status === 'pending') {
      try {
        await sleep(TM_DELAY_MS)
        const candidates = await detectCarrier(delivery.trackingNumber)
        const toTry = candidates.slice(0, 3).filter(c => c.courier_code !== delivery.courierCode)
        for (let i = 0; i < toTry.length; i++) {
          if (i > 0) await sleep(TM_DELAY_MS)
          try {
            const result = await getRealtimeTracking(delivery.trackingNumber, toTry[i].courier_code)
            if (hasRealData(result)) {
              tmData = result
              resolvedCourierCode = toTry[i].courier_code
              log.info('Found correct carrier on refresh', { old: delivery.courierCode, new: toTry[i].courier_code })
              break
            }
          } catch {
            // This candidate didn't work
          }
        }
      } catch {
        // Re-detect failed
      }
    }

    if (!tmData) return { error: 'No tracking data available from carrier' }

    const events = extractEvents(tmData)
    const status = mapTmStatus(tmData.delivery_status)

    const updated = await withUser(session.userId, (client) =>
      updateDeliveryEvents(
        client,
        id,
        events,
        status,
        tmData!.substatus ?? null,
        tmData!.latest_event ?? null,
        tmData!.lastest_checkpoint_time ?? null
      )
    )

    // Update courier info (may have changed if we found the correct carrier)
    await withUser(session.userId, (client) =>
      updateDeliveryRepo(client, id, {
        courierCode: resolvedCourierCode,
        courierName: tmData!.courier_name || undefined,
        origin: tmData!.origin || undefined,
        destination: tmData!.destination || undefined,
        eta: tmData!.estimated_delivery_date ?? undefined,
      })
    )

    return { delivery: updated ?? delivery }
  } catch (err) {
    log.error('Refresh delivery failed', { error: err instanceof Error ? err.message : String(err) })
    return { error: 'Failed to refresh tracking data' }
  }
}

export async function updateDeliveryInfo(
  id: string,
  params: { title?: string; courierCode?: string }
): Promise<{ delivery?: Delivery; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const idV = validateAction(deliveryIdSchema, id)
  if (idV.error) return { error: 'Invalid delivery ID' }

  try {
    const delivery = await withUser(session.userId, (client) =>
      updateDeliveryRepo(client, id, {
        title: params.title,
        courierCode: params.courierCode,
      })
    )
    if (!delivery) return { error: 'Delivery not found' }
    return { delivery }
  } catch (err) {
    log.error('Update delivery failed', { error: err instanceof Error ? err.message : String(err) })
    return { error: 'Failed to update delivery' }
  }
}

export async function refreshAllDeliveries(): Promise<{ count: number; errors: number }> {
  const session = await getSession()
  if (!session.userId) return { count: 0, errors: 0 }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { count: 0, errors: 0 }

  const deliveries = await withUser(session.userId, (client) =>
    findActiveDeliveries(client, workspace.id)
  )

  let errors = 0
  for (let i = 0; i < deliveries.length; i++) {
    if (i > 0) await sleep(TM_DELAY_MS * 2) // extra gap between deliveries
    const result = await refreshDelivery(deliveries[i].id)
    if (result.error) errors++
  }

  return { count: deliveries.length, errors }
}
