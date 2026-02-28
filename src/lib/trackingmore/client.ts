import { createLogger } from '@/lib/logger'
import type {
  TrackingMoreResponse,
  TrackingMoreTracking,
  TrackingMoreDetectResult,
  TrackingMoreCreateRequest,
} from './types'

const log = createLogger('trackingmore')

const BASE_URL = 'https://api.trackingmore.com/v3'

function getApiKey(): string {
  const key = process.env.TRACKINGMORE_API_KEY
  if (!key) throw new Error('TRACKINGMORE_API_KEY is not set')
  return key
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { method = 'GET', body } = options
  const url = `${BASE_URL}${path}`

  const headers: Record<string, string> = {
    'Tracking-Api-Key': getApiKey(),
    'Content-Type': 'application/json',
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = (await res.json()) as TrackingMoreResponse<T>

  if (!res.ok || json.code >= 400) {
    const msg = json.message || `TrackingMore error ${res.status}`
    log.error('TrackingMore API error', { path, status: res.status, message: msg })
    throw new Error(msg)
  }

  return json.data
}

/**
 * Auto-detect carrier from tracking number
 */
export async function detectCarrier(
  trackingNumber: string
): Promise<TrackingMoreDetectResult[]> {
  return request<TrackingMoreDetectResult[]>('/trackings/detect', {
    method: 'POST',
    body: { tracking_number: trackingNumber },
  })
}

/**
 * Create a tracking in TrackingMore (registers for updates)
 */
export async function createTracking(
  params: TrackingMoreCreateRequest
): Promise<TrackingMoreTracking> {
  return request<TrackingMoreTracking>('/trackings/create', {
    method: 'POST',
    body: params,
  })
}

/**
 * Get realtime tracking status (creates + gets in v4)
 */
export async function getRealtimeTracking(
  trackingNumber: string,
  courierCode: string
): Promise<TrackingMoreTracking> {
  return request<TrackingMoreTracking>('/trackings/realtime', {
    method: 'POST',
    body: { tracking_number: trackingNumber, courier_code: courierCode },
  })
}

/**
 * Delete a tracking from TrackingMore
 */
export async function deleteTracking(
  trackingNumber: string,
  courierCode: string
): Promise<void> {
  await request('/trackings/delete', {
    method: 'DELETE',
    body: { tracking_number: trackingNumber, courier_code: courierCode },
  })
}

/**
 * Get single tracking by number + courier
 */
export async function getTracking(
  trackingNumber: string,
  courierCode: string
): Promise<TrackingMoreTracking> {
  return request<TrackingMoreTracking>(
    `/trackings/${courierCode}/${trackingNumber}`
  )
}
