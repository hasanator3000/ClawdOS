import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/revision-store', () => ({
  bumpRevision: vi.fn(),
}))

const mockQuery = vi.fn()
const mockRelease = vi.fn()
const mockConnect = vi.fn().mockResolvedValue({
  query: mockQuery,
  release: mockRelease,
})

vi.mock('@/lib/db', () => ({
  getPool: () => ({
    connect: mockConnect,
  }),
}))

vi.mock('@/lib/db/repositories/delivery.repository', () => ({
  updateDeliveryEvents: vi.fn().mockResolvedValue({ id: 'delivery-1', status: 'transit' }),
}))

import { POST } from '../route'

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/webhooks/trackingmore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('TrackingMore webhook route', () => {
  const originalEnv = process.env.TRACKINGMORE_WEBHOOK_SECRET

  beforeEach(() => {
    mockQuery.mockReset()
    mockRelease.mockReset()
    delete process.env.TRACKINGMORE_WEBHOOK_SECRET
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TRACKINGMORE_WEBHOOK_SECRET = originalEnv
    } else {
      delete process.env.TRACKINGMORE_WEBHOOK_SECRET
    }
  })

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost:3000/api/webhooks/trackingmore', {
      method: 'POST',
      body: 'not-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Invalid JSON')
  })

  it('returns 400 for missing tracking number', async () => {
    const res = await POST(makeRequest({ event: 'test', data: {} }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Missing tracking number')
  })

  it('returns ok when delivery not found (ignores gracefully)', async () => {
    mockQuery.mockResolvedValue({ rows: [] })

    const res = await POST(makeRequest({
      event: 'TRACKING_UPDATED',
      data: {
        tracking_number: 'NOT-FOUND',
        courier_code: 'ups',
        delivery_status: 'transit',
        substatus: '',
      },
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.message).toContain('not found')
    expect(mockRelease).toHaveBeenCalled()
  })

  it('updates delivery when found', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ id: 'delivery-1' }],
    })

    const res = await POST(makeRequest({
      event: 'TRACKING_UPDATED',
      data: {
        tracking_number: '1Z999AA10123456784',
        courier_code: 'ups',
        delivery_status: 'transit',
        substatus: 'in_transit',
        latest_event: 'Package in transit',
        lastest_checkpoint_time: '2026-02-26T12:00:00Z',
        origin_info: {
          trackinfo: [
            { Date: '2026-02-25T10:00:00Z', Details: 'Shipped', checkpoint_status: 'transit', location: 'New York' },
          ],
        },
        destination_info: { trackinfo: [] },
      },
    }))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(mockRelease).toHaveBeenCalled()
  })

  it('extracts and sorts events from origin and destination info', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'delivery-1' }] })

    const { updateDeliveryEvents } = await import('@/lib/db/repositories/delivery.repository')

    await POST(makeRequest({
      event: 'TRACKING_UPDATED',
      data: {
        tracking_number: 'TEST123',
        courier_code: 'fedex',
        delivery_status: 'transit',
        substatus: '',
        origin_info: {
          trackinfo: [
            { Date: '2026-02-24T10:00:00Z', Details: 'First event', checkpoint_status: 'transit' },
          ],
        },
        destination_info: {
          trackinfo: [
            { Date: '2026-02-25T15:00:00Z', Details: 'Second event', checkpoint_status: 'transit', location: 'Berlin' },
          ],
        },
      },
    }))

    expect(updateDeliveryEvents).toHaveBeenCalled()
    const callArgs = (updateDeliveryEvents as ReturnType<typeof vi.fn>).mock.calls.at(-1)!
    const events = callArgs[2]
    // Events should be sorted newest first
    expect(events[0].description).toBe('Second event')
    expect(events[1].description).toBe('First event')
  })

  it('maps TrackingMore statuses correctly', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'delivery-1' }] })
    const { updateDeliveryEvents } = await import('@/lib/db/repositories/delivery.repository')

    // Test 'delivered' status mapping
    await POST(makeRequest({
      event: 'TRACKING_UPDATED',
      data: {
        tracking_number: 'DELIVERED-TEST',
        courier_code: 'ups',
        delivery_status: 'delivered',
        substatus: 'delivered_to_door',
      },
    }))

    const callArgs = (updateDeliveryEvents as ReturnType<typeof vi.fn>).mock.calls.at(-1)!
    expect(callArgs[3]).toBe('delivered') // mapped status
  })

  describe('webhook secret verification', () => {
    it('rejects request when secret is set but not provided', async () => {
      process.env.TRACKINGMORE_WEBHOOK_SECRET = 'test-secret-123'
      const res = await POST(makeRequest({ event: 'test', data: { tracking_number: 'X' } }))
      expect(res.status).toBe(401)
    })

    it('rejects request when secret does not match', async () => {
      process.env.TRACKINGMORE_WEBHOOK_SECRET = 'test-secret-123'
      const req = new Request('http://localhost:3000/api/webhooks/trackingmore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': 'wrong-secret',
        },
        body: JSON.stringify({ event: 'test', data: { tracking_number: 'X' } }),
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it('accepts request when secret matches via x-webhook-secret header', async () => {
      process.env.TRACKINGMORE_WEBHOOK_SECRET = 'test-secret-123'
      mockQuery.mockResolvedValue({ rows: [] })
      const req = new Request('http://localhost:3000/api/webhooks/trackingmore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': 'test-secret-123',
        },
        body: JSON.stringify({
          event: 'TRACKING_UPDATED',
          data: { tracking_number: 'TEST', courier_code: 'ups', delivery_status: 'transit' },
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('accepts request when secret matches via Authorization Bearer', async () => {
      process.env.TRACKINGMORE_WEBHOOK_SECRET = 'test-secret-123'
      mockQuery.mockResolvedValue({ rows: [] })
      const req = new Request('http://localhost:3000/api/webhooks/trackingmore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-secret-123',
        },
        body: JSON.stringify({
          event: 'TRACKING_UPDATED',
          data: { tracking_number: 'TEST', courier_code: 'ups', delivery_status: 'transit' },
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(200)
    })

    it('allows all requests when no secret is configured', async () => {
      // No TRACKINGMORE_WEBHOOK_SECRET set
      mockQuery.mockResolvedValue({ rows: [] })
      const res = await POST(makeRequest({
        event: 'TRACKING_UPDATED',
        data: { tracking_number: 'TEST', courier_code: 'ups', delivery_status: 'transit' },
      }))
      expect(res.status).toBe(200)
    })
  })
})
