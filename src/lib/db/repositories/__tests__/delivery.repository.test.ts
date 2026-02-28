import { describe, it, expect, vi } from 'vitest'
import type { PoolClient, QueryResult } from 'pg'
import {
  createDelivery,
  findDeliveriesByWorkspace,
  findDeliveryById,
  findDeliveryByTracking,
  updateDelivery,
  updateDeliveryEvents,
  deleteDelivery,
  findActiveDeliveries,
  type TrackingEvent,
} from '../delivery.repository'

// Mock PoolClient
function createMockClient(rows: Record<string, unknown>[] = [], rowCount = 1): PoolClient {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount } as QueryResult),
  } as unknown as PoolClient
}

const SAMPLE_DELIVERY = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  workspaceId: 'ws-123',
  trackingNumber: '1Z999AA10123456784',
  courierCode: 'ups',
  courierName: 'UPS',
  title: 'Test Package',
  status: 'pending',
  substatus: null,
  origin: 'US',
  destination: 'DE',
  eta: null,
  lastEvent: null,
  lastEventAt: null,
  trackingmoreId: 'tm-123',
  events: [],
  createdBy: 'user-1',
  createdAt: '2026-02-26T00:00:00Z',
  updatedAt: '2026-02-26T00:00:00Z',
}

describe('delivery.repository', () => {
  describe('createDelivery', () => {
    it('inserts delivery with all params', async () => {
      const client = createMockClient([SAMPLE_DELIVERY])

      const result = await createDelivery(client, {
        workspaceId: 'ws-123',
        trackingNumber: '1Z999AA10123456784',
        courierCode: 'ups',
        courierName: 'UPS',
        title: 'Test Package',
        trackingmoreId: 'tm-123',
      })

      expect(result.id).toBe(SAMPLE_DELIVERY.id)
      expect(result.trackingNumber).toBe('1Z999AA10123456784')
      expect(client.query).toHaveBeenCalledOnce()

      const [sql, params] = (client.query as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(sql).toContain('INSERT INTO content.delivery')
      expect(params).toContain('ws-123')
      expect(params).toContain('1Z999AA10123456784')
      expect(params).toContain('ups')
      expect(params).toContain('UPS')
      expect(params).toContain('Test Package')
      expect(params).toContain('tm-123')
    })

    it('handles optional params as null', async () => {
      const client = createMockClient([SAMPLE_DELIVERY])

      await createDelivery(client, {
        workspaceId: 'ws-123',
        trackingNumber: 'ABC123',
      })

      const params = (client.query as ReturnType<typeof vi.fn>).mock.calls[0][1]
      // courierCode, courierName, title, trackingmoreId should be null
      expect(params[2]).toBeNull()
      expect(params[3]).toBeNull()
      expect(params[4]).toBeNull()
      expect(params[5]).toBeNull()
    })
  })

  describe('findDeliveriesByWorkspace', () => {
    it('fetches deliveries for workspace', async () => {
      const client = createMockClient([SAMPLE_DELIVERY])

      const result = await findDeliveriesByWorkspace(client, 'ws-123')

      expect(result).toHaveLength(1)
      expect(result[0].trackingNumber).toBe('1Z999AA10123456784')
      const [sql, params] = (client.query as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(sql).toContain('workspace_id = $1')
      expect(params[0]).toBe('ws-123')
    })

    it('applies status filter', async () => {
      const client = createMockClient([])

      await findDeliveriesByWorkspace(client, 'ws-123', { status: 'transit' })

      const [sql, params] = (client.query as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(sql).toContain('status = $2')
      expect(params).toContain('transit')
    })

    it('applies search filter on tracking number and title', async () => {
      const client = createMockClient([])

      await findDeliveriesByWorkspace(client, 'ws-123', { search: 'test' })

      const [sql, params] = (client.query as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(sql).toContain('ILIKE')
      expect(params).toContain('%test%')
    })

    it('defaults to limit 100', async () => {
      const client = createMockClient([])

      await findDeliveriesByWorkspace(client, 'ws-123')

      const params = (client.query as ReturnType<typeof vi.fn>).mock.calls[0][1]
      expect(params).toContain(100)
    })

    it('orders by status priority then updated_at DESC', async () => {
      const client = createMockClient([])

      await findDeliveriesByWorkspace(client, 'ws-123')

      const sql = (client.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(sql).toContain('CASE status')
      expect(sql).toContain('updated_at DESC')
    })
  })

  describe('findDeliveryById', () => {
    it('returns delivery when found', async () => {
      const client = createMockClient([SAMPLE_DELIVERY])

      const result = await findDeliveryById(client, SAMPLE_DELIVERY.id)

      expect(result).not.toBeNull()
      expect(result!.id).toBe(SAMPLE_DELIVERY.id)
    })

    it('returns null when not found', async () => {
      const client = createMockClient([])

      const result = await findDeliveryById(client, 'non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findDeliveryByTracking', () => {
    it('finds by workspace + tracking number', async () => {
      const client = createMockClient([SAMPLE_DELIVERY])

      const result = await findDeliveryByTracking(client, 'ws-123', '1Z999AA10123456784')

      expect(result).not.toBeNull()
      const [sql, params] = (client.query as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(sql).toContain('workspace_id = $1')
      expect(sql).toContain('tracking_number = $2')
      expect(params).toEqual(['ws-123', '1Z999AA10123456784'])
    })
  })

  describe('updateDelivery', () => {
    it('builds dynamic SET for provided fields', async () => {
      const client = createMockClient([{ ...SAMPLE_DELIVERY, status: 'transit' }])

      await updateDelivery(client, SAMPLE_DELIVERY.id, {
        status: 'transit',
        courierCode: 'fedex',
      })

      const [sql, params] = (client.query as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(sql).toContain('UPDATE content.delivery SET')
      expect(sql).toContain('status =')
      expect(sql).toContain('courier_code =')
      expect(params).toContain('transit')
      expect(params).toContain('fedex')
      expect(params).toContain(SAMPLE_DELIVERY.id)
    })

    it('returns existing delivery when no fields provided', async () => {
      const client = createMockClient([SAMPLE_DELIVERY])

      const result = await updateDelivery(client, SAMPLE_DELIVERY.id, {})

      // Should call findDeliveryById instead of UPDATE
      expect(result).not.toBeNull()
    })
  })

  describe('updateDeliveryEvents', () => {
    it('updates events, status, and last event fields', async () => {
      const events: TrackingEvent[] = [
        { date: '2026-02-26', description: 'Delivered', location: 'Berlin' },
      ]
      const client = createMockClient([{ ...SAMPLE_DELIVERY, status: 'delivered', events }])

      const result = await updateDeliveryEvents(
        client,
        SAMPLE_DELIVERY.id,
        events,
        'delivered',
        'delivered_to_door',
        'Delivered',
        '2026-02-26T12:00:00Z'
      )

      expect(result).not.toBeNull()
      const [sql, params] = (client.query as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(sql).toContain('UPDATE content.delivery')
      expect(sql).toContain('events = $1')
      expect(sql).toContain('status = $2')
      expect(params[0]).toBe(JSON.stringify(events))
      expect(params[1]).toBe('delivered')
      expect(params[2]).toBe('delivered_to_door')
      expect(params[3]).toBe('Delivered')
      expect(params[4]).toBe('2026-02-26T12:00:00Z')
      expect(params[5]).toBe(SAMPLE_DELIVERY.id)
    })
  })

  describe('deleteDelivery', () => {
    it('returns true when deleted', async () => {
      const client = createMockClient([], 1)

      const result = await deleteDelivery(client, SAMPLE_DELIVERY.id)

      expect(result).toBe(true)
    })

    it('returns false when not found', async () => {
      const client = createMockClient([], 0)

      const result = await deleteDelivery(client, 'non-existent')

      expect(result).toBe(false)
    })
  })

  describe('findActiveDeliveries', () => {
    it('excludes delivered and expired', async () => {
      const client = createMockClient([SAMPLE_DELIVERY])

      await findActiveDeliveries(client, 'ws-123')

      const sql = (client.query as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
      expect(sql).toContain("NOT IN ('delivered', 'expired')")
    })
  })
})
