import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all dependencies
vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'user-1' }),
}))

vi.mock('@/lib/workspace', () => ({
  getActiveWorkspace: vi.fn().mockResolvedValue({ id: 'ws-1', name: 'Test' }),
}))

const mockWithUser = vi.fn()
vi.mock('@/lib/db', () => ({
  withUser: (...args: unknown[]) => mockWithUser(...args),
}))

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

const mockDetectCarrier = vi.fn()
const mockCreateTracking = vi.fn()
const mockGetRealtimeTracking = vi.fn()
const mockDeleteTracking = vi.fn()

vi.mock('@/lib/trackingmore/client', () => ({
  detectCarrier: (...args: unknown[]) => mockDetectCarrier(...args),
  createTracking: (...args: unknown[]) => mockCreateTracking(...args),
  getRealtimeTracking: (...args: unknown[]) => mockGetRealtimeTracking(...args),
  deleteTracking: (...args: unknown[]) => mockDeleteTracking(...args),
}))

const mockCreateDeliveryRepo = vi.fn()
const mockFindByTracking = vi.fn()
const mockFindById = vi.fn()
const mockDeleteRepo = vi.fn()
const mockUpdateEvents = vi.fn()
const mockUpdateRepo = vi.fn()
const mockFindActive = vi.fn()

vi.mock('@/lib/db/repositories/delivery.repository', () => ({
  createDelivery: (...args: unknown[]) => mockCreateDeliveryRepo(...args),
  findDeliveryByTracking: (...args: unknown[]) => mockFindByTracking(...args),
  findDeliveryById: (...args: unknown[]) => mockFindById(...args),
  deleteDelivery: (...args: unknown[]) => mockDeleteRepo(...args),
  updateDeliveryEvents: (...args: unknown[]) => mockUpdateEvents(...args),
  updateDelivery: (...args: unknown[]) => mockUpdateRepo(...args),
  findActiveDeliveries: (...args: unknown[]) => mockFindActive(...args),
}))

import { addDelivery, removeDelivery, refreshDelivery } from '../actions'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'

const SAMPLE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  workspaceId: 'ws-1',
  trackingNumber: '1Z999AA10123456784',
  courierCode: 'ups',
  courierName: 'UPS',
  title: 'Test',
  status: 'pending' as const,
  substatus: null,
  origin: null,
  destination: null,
  eta: null,
  lastEvent: null,
  lastEventAt: null,
  trackingmoreId: null,
  events: [],
  createdBy: 'user-1',
  createdAt: '2026-02-26',
  updatedAt: '2026-02-26',
}

describe('delivery actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: withUser executes callback with mock client
    mockWithUser.mockImplementation(async (_userId: string, fn: (client: unknown) => Promise<unknown>) => fn({}))
  })

  describe('addDelivery', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getSession).mockResolvedValueOnce({ userId: undefined } as unknown as Awaited<ReturnType<typeof getSession>>)

      const result = await addDelivery({ trackingNumber: 'ABC123' })
      expect(result.error).toBe('Unauthorized')
    })

    it('returns error when no workspace', async () => {
      vi.mocked(getActiveWorkspace).mockResolvedValueOnce(null)

      const result = await addDelivery({ trackingNumber: 'ABC123' })
      expect(result.error).toBe('No workspace selected')
    })

    it('returns error for too short tracking number', async () => {
      const result = await addDelivery({ trackingNumber: 'AB' })
      expect(result.error).toBeDefined()
    })

    it('returns error when duplicate', async () => {
      mockFindByTracking.mockResolvedValue(SAMPLE)

      const result = await addDelivery({ trackingNumber: '1Z999AA10123456784' })
      expect(result.error).toContain('already being tracked')
    })

    it('creates delivery with detected carrier', async () => {
      mockFindByTracking.mockResolvedValue(null)
      mockDetectCarrier.mockResolvedValue([{ courier_code: 'ups', courier_name: 'UPS' }])
      mockCreateTracking.mockResolvedValue({
        id: 'tm-1',
        tracking_number: '1Z999AA10123456784',
        courier_code: 'ups',
        courier_name: 'UPS',
        delivery_status: 'pending',
        substatus: '',
        origin: '',
        destination: '',
      })
      mockCreateDeliveryRepo.mockResolvedValue(SAMPLE)

      const result = await addDelivery({ trackingNumber: '1Z999AA10123456784', title: 'Test' })
      expect(result.delivery).toBeDefined()
      expect(mockDetectCarrier).toHaveBeenCalledWith('1Z999AA10123456784')
    })

    it('still creates delivery when TrackingMore fails', async () => {
      mockFindByTracking.mockResolvedValue(null)
      mockDetectCarrier.mockRejectedValue(new Error('API down'))
      mockCreateTracking.mockRejectedValue(new Error('API down'))
      mockCreateDeliveryRepo.mockResolvedValue(SAMPLE)

      const result = await addDelivery({ trackingNumber: '1Z999AA10123456784' })
      expect(result.delivery).toBeDefined()
    })
  })

  describe('removeDelivery', () => {
    it('deletes from DB and TrackingMore', async () => {
      mockFindById.mockResolvedValue(SAMPLE)
      mockDeleteRepo.mockResolvedValue(true)
      mockDeleteTracking.mockResolvedValue(undefined)

      const result = await removeDelivery('550e8400-e29b-41d4-a716-446655440000')
      expect(result.success).toBe(true)
      expect(mockDeleteTracking).toHaveBeenCalledWith('1Z999AA10123456784', 'ups')
    })

    it('returns error for invalid UUID', async () => {
      const result = await removeDelivery('not-a-uuid')
      expect(result.error).toBeDefined()
    })

    it('returns error when not found', async () => {
      mockFindById.mockResolvedValue(null)

      const result = await removeDelivery('550e8400-e29b-41d4-a716-446655440000')
      expect(result.error).toBe('Delivery not found')
    })

    it('still deletes locally when TrackingMore fails', async () => {
      mockFindById.mockResolvedValue(SAMPLE)
      mockDeleteTracking.mockRejectedValue(new Error('API down'))
      mockDeleteRepo.mockResolvedValue(true)

      const result = await removeDelivery('550e8400-e29b-41d4-a716-446655440000')
      expect(result.success).toBe(true)
    })
  })

  describe('refreshDelivery', () => {
    it('fetches realtime data and updates events', async () => {
      mockFindById.mockResolvedValue(SAMPLE)
      mockGetRealtimeTracking.mockResolvedValue({
        delivery_status: 'transit',
        substatus: 'in_transit',
        latest_event: 'In transit',
        lastest_checkpoint_time: '2026-02-26T12:00:00Z',
        origin_info: {
          trackinfo: [{ Date: '2026-02-26', Details: 'Shipped', checkpoint_status: 'transit' }],
        },
        destination_info: { trackinfo: [] },
      })
      mockUpdateEvents.mockResolvedValue({ ...SAMPLE, status: 'transit' })

      const result = await refreshDelivery('550e8400-e29b-41d4-a716-446655440000')
      expect(result.delivery).toBeDefined()
      expect(mockGetRealtimeTracking).toHaveBeenCalledWith('1Z999AA10123456784', 'ups')
    })

    it('returns error when no carrier detected', async () => {
      mockFindById.mockResolvedValue({ ...SAMPLE, courierCode: null })

      const result = await refreshDelivery('550e8400-e29b-41d4-a716-446655440000')
      expect(result.error).toContain('No carrier detected')
    })
  })
})
