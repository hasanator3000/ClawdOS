import type { PoolClient } from 'pg'

// ── Types ──────────────────────────────────────────────────

export type DeliveryStatus =
  | 'pending'
  | 'transit'
  | 'pickup'
  | 'delivered'
  | 'expired'
  | 'undelivered'

export interface TrackingEvent {
  date: string
  description: string
  location?: string
  status?: string
}

export interface Delivery {
  id: string
  workspaceId: string
  trackingNumber: string
  courierCode: string | null
  courierName: string | null
  title: string | null
  status: DeliveryStatus
  substatus: string | null
  origin: string | null
  destination: string | null
  eta: string | null
  lastEvent: string | null
  lastEventAt: string | null
  trackingmoreId: string | null
  events: TrackingEvent[]
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateDeliveryParams {
  workspaceId: string
  trackingNumber: string
  courierCode?: string
  courierName?: string
  title?: string
  trackingmoreId?: string
}

export interface UpdateDeliveryParams {
  courierCode?: string
  courierName?: string
  title?: string
  status?: DeliveryStatus
  substatus?: string
  origin?: string
  destination?: string
  eta?: string | null
  lastEvent?: string
  lastEventAt?: string
  trackingmoreId?: string
}

// ── Shared columns ──────────────────────────────────────────

const DELIVERY_COLS = `
  id, workspace_id AS "workspaceId", tracking_number AS "trackingNumber",
  courier_code AS "courierCode", courier_name AS "courierName", title,
  status, substatus, origin, destination, eta,
  last_event AS "lastEvent", last_event_at AS "lastEventAt",
  trackingmore_id AS "trackingmoreId", events,
  created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt"
`

// ── CRUD ────────────────────────────────────────────────────

export async function createDelivery(
  client: PoolClient,
  params: CreateDeliveryParams
): Promise<Delivery> {
  const result = await client.query(
    `INSERT INTO content.delivery
       (workspace_id, tracking_number, courier_code, courier_name, title, trackingmore_id, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, core.current_user_id())
     RETURNING ${DELIVERY_COLS}`,
    [
      params.workspaceId,
      params.trackingNumber,
      params.courierCode ?? null,
      params.courierName ?? null,
      params.title ?? null,
      params.trackingmoreId ?? null,
    ]
  )
  return result.rows[0] as Delivery
}

export async function findDeliveriesByWorkspace(
  client: PoolClient,
  workspaceId: string,
  options?: { status?: DeliveryStatus; search?: string; limit?: number }
): Promise<Delivery[]> {
  const conditions = ['workspace_id = $1']
  const values: unknown[] = [workspaceId]
  let idx = 2

  if (options?.status) {
    conditions.push(`status = $${idx++}`)
    values.push(options.status)
  }

  if (options?.search) {
    conditions.push(`(tracking_number ILIKE $${idx} OR title ILIKE $${idx})`)
    values.push(`%${options.search}%`)
    idx++
  }

  values.push(options?.limit ?? 100)

  const result = await client.query(
    `SELECT ${DELIVERY_COLS}
     FROM content.delivery
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE status
         WHEN 'transit' THEN 0
         WHEN 'pickup' THEN 1
         WHEN 'pending' THEN 2
         WHEN 'undelivered' THEN 3
         WHEN 'delivered' THEN 4
         WHEN 'expired' THEN 5
       END,
       updated_at DESC
     LIMIT $${idx}`,
    values
  )
  return result.rows as Delivery[]
}

export async function findDeliveryById(
  client: PoolClient,
  id: string
): Promise<Delivery | null> {
  const result = await client.query(
    `SELECT ${DELIVERY_COLS} FROM content.delivery WHERE id = $1`,
    [id]
  )
  return (result.rows[0] as Delivery) ?? null
}

export async function findDeliveryByTracking(
  client: PoolClient,
  workspaceId: string,
  trackingNumber: string
): Promise<Delivery | null> {
  const result = await client.query(
    `SELECT ${DELIVERY_COLS} FROM content.delivery
     WHERE workspace_id = $1 AND tracking_number = $2`,
    [workspaceId, trackingNumber]
  )
  return (result.rows[0] as Delivery) ?? null
}

export async function updateDelivery(
  client: PoolClient,
  id: string,
  params: UpdateDeliveryParams
): Promise<Delivery | null> {
  const sets: string[] = []
  const vals: unknown[] = []
  let idx = 1

  if (params.courierCode !== undefined) { sets.push(`courier_code = $${idx++}`); vals.push(params.courierCode) }
  if (params.courierName !== undefined) { sets.push(`courier_name = $${idx++}`); vals.push(params.courierName) }
  if (params.title !== undefined) { sets.push(`title = $${idx++}`); vals.push(params.title) }
  if (params.status !== undefined) { sets.push(`status = $${idx++}`); vals.push(params.status) }
  if (params.substatus !== undefined) { sets.push(`substatus = $${idx++}`); vals.push(params.substatus) }
  if (params.origin !== undefined) { sets.push(`origin = $${idx++}`); vals.push(params.origin) }
  if (params.destination !== undefined) { sets.push(`destination = $${idx++}`); vals.push(params.destination) }
  if (params.eta !== undefined) { sets.push(`eta = $${idx++}`); vals.push(params.eta) }
  if (params.lastEvent !== undefined) { sets.push(`last_event = $${idx++}`); vals.push(params.lastEvent) }
  if (params.lastEventAt !== undefined) { sets.push(`last_event_at = $${idx++}`); vals.push(params.lastEventAt) }
  if (params.trackingmoreId !== undefined) { sets.push(`trackingmore_id = $${idx++}`); vals.push(params.trackingmoreId) }

  if (sets.length === 0) return findDeliveryById(client, id)

  vals.push(id)

  const result = await client.query(
    `UPDATE content.delivery SET ${sets.join(', ')} WHERE id = $${idx}
     RETURNING ${DELIVERY_COLS}`,
    vals
  )
  return (result.rows[0] as Delivery) ?? null
}

export async function updateDeliveryEvents(
  client: PoolClient,
  id: string,
  events: TrackingEvent[],
  status: DeliveryStatus,
  substatus: string | null,
  lastEvent: string | null,
  lastEventAt: string | null
): Promise<Delivery | null> {
  const result = await client.query(
    `UPDATE content.delivery
     SET events = $1, status = $2, substatus = $3, last_event = $4, last_event_at = $5
     WHERE id = $6
     RETURNING ${DELIVERY_COLS}`,
    [JSON.stringify(events), status, substatus, lastEvent, lastEventAt, id]
  )
  return (result.rows[0] as Delivery) ?? null
}

export async function deleteDelivery(
  client: PoolClient,
  id: string
): Promise<boolean> {
  const result = await client.query('DELETE FROM content.delivery WHERE id = $1', [id])
  return (result.rowCount ?? 0) > 0
}

export async function findActiveDeliveries(
  client: PoolClient,
  workspaceId: string
): Promise<Delivery[]> {
  const result = await client.query(
    `SELECT ${DELIVERY_COLS} FROM content.delivery
     WHERE workspace_id = $1 AND status NOT IN ('delivered', 'expired')
     ORDER BY updated_at DESC`,
    [workspaceId]
  )
  return result.rows as Delivery[]
}
