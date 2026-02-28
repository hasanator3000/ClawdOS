import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must mock before imports
vi.stubEnv('TRACKINGMORE_API_KEY', 'test-api-key-123')

import { detectCarrier, createTracking, getRealtimeTracking, deleteTracking, getTracking } from '../client'

const BASE_URL = 'https://api.trackingmore.com/v3'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockApiResponse<T>(data: T, code = 200, message = 'Success') {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ code, message, data }),
  }
}

function mockApiError(code: number, message: string) {
  return {
    ok: false,
    status: code,
    json: vi.fn().mockResolvedValue({
      code,
      message,
      data: null,
    }),
  }
}

describe('TrackingMore client', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('detectCarrier', () => {
    it('sends correct request', async () => {
      const carriers = [{ courier_code: 'ups', courier_name: 'UPS' }]
      mockFetch.mockResolvedValue(mockApiResponse(carriers))

      const result = await detectCarrier('1Z999AA10123456784')

      expect(result).toEqual(carriers)
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/trackings/detect`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Tracking-Api-Key': 'test-api-key-123',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ tracking_number: '1Z999AA10123456784' }),
        })
      )
    })
  })

  describe('createTracking', () => {
    it('creates tracking with courier code', async () => {
      const tracking = {
        id: 'tm-1',
        tracking_number: '1Z999AA10123456784',
        courier_code: 'ups',
        delivery_status: 'pending',
        substatus: '',
        origin: '',
        destination: '',
      }
      mockFetch.mockResolvedValue(mockApiResponse(tracking))

      const result = await createTracking({
        tracking_number: '1Z999AA10123456784',
        courier_code: 'ups',
      })

      expect(result.id).toBe('tm-1')
      expect(result.courier_code).toBe('ups')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.tracking_number).toBe('1Z999AA10123456784')
      expect(body.courier_code).toBe('ups')
    })

    it('creates tracking without courier code', async () => {
      const tracking = {
        id: 'tm-2',
        tracking_number: 'EA152563254CN',
        courier_code: 'china-ems',
        delivery_status: 'pending',
        substatus: '',
        origin: '',
        destination: '',
      }
      mockFetch.mockResolvedValue(mockApiResponse(tracking))

      const result = await createTracking({ tracking_number: 'EA152563254CN' })

      expect(result.courier_code).toBe('china-ems')
    })
  })

  describe('getRealtimeTracking', () => {
    it('sends tracking number and courier code', async () => {
      const tracking = {
        id: 'tm-1',
        tracking_number: '1Z999AA10123456784',
        courier_code: 'ups',
        delivery_status: 'transit',
        substatus: 'in_transit',
        origin: 'US',
        destination: 'DE',
        latest_event: 'In transit to destination',
        origin_info: { trackinfo: [] },
        destination_info: { trackinfo: [] },
      }
      mockFetch.mockResolvedValue(mockApiResponse(tracking))

      const result = await getRealtimeTracking('1Z999AA10123456784', 'ups')

      expect(result.delivery_status).toBe('transit')
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.tracking_number).toBe('1Z999AA10123456784')
      expect(body.courier_code).toBe('ups')
    })
  })

  describe('deleteTracking', () => {
    it('sends delete request', async () => {
      mockFetch.mockResolvedValue(mockApiResponse(null))

      await deleteTracking('1Z999AA10123456784', 'ups')

      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/trackings/delete`,
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('getTracking', () => {
    it('fetches by courier/tracking path', async () => {
      const tracking = {
        id: 'tm-1',
        tracking_number: '1Z999AA10123456784',
        courier_code: 'ups',
        delivery_status: 'delivered',
        substatus: '',
        origin: '',
        destination: '',
      }
      mockFetch.mockResolvedValue(mockApiResponse(tracking))

      const result = await getTracking('1Z999AA10123456784', 'ups')

      expect(result.delivery_status).toBe('delivered')
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/trackings/ups/1Z999AA10123456784`,
        expect.objectContaining({ method: 'GET' })
      )
    })
  })

  describe('error handling', () => {
    it('throws on API error', async () => {
      mockFetch.mockResolvedValue(mockApiError(401, 'Invalid API key.'))

      await expect(detectCarrier('ABC')).rejects.toThrow('Invalid API key.')
    })

    it('throws on HTTP error without message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ code: 500, message: '', data: null }),
      })

      await expect(detectCarrier('ABC')).rejects.toThrow('TrackingMore error 500')
    })
  })

  describe('auth header', () => {
    it('uses TRACKINGMORE_API_KEY env var', async () => {
      mockFetch.mockResolvedValue(mockApiResponse([]))

      await detectCarrier('TEST123')

      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers['Tracking-Api-Key']).toBe('test-api-key-123')
    })
  })
})
