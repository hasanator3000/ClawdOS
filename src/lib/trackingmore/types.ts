/** TrackingMore API v3 types */

export interface TrackingMoreCarrier {
  courier_code: string
  courier_name: string
}

export interface TrackingMoreEvent {
  /** Actual API field names */
  checkpoint_date: string
  tracking_detail: string
  checkpoint_delivery_status: string
  checkpoint_delivery_substatus: string
  location?: string
  /** Legacy aliases (some docs show these) */
  Date?: string
  Details?: string
  checkpoint_status?: string
  substatus?: string
}

export interface TrackingMoreTracking {
  id: string
  tracking_number: string
  courier_code: string
  courier_name?: string
  order_number?: string
  delivery_status: TrackingMoreStatus
  substatus: string
  origin: string
  destination: string
  estimated_delivery_date?: string
  original_country?: string
  destination_country?: string
  latest_event?: string
  /** NOTE: TrackingMore v3 has a typo — "lastest" not "latest" */
  lastest_checkpoint_time?: string
  transit_time?: number
  origin_info?: {
    trackinfo: TrackingMoreEvent[]
  }
  destination_info?: {
    trackinfo: TrackingMoreEvent[]
  }
}

export type TrackingMoreStatus =
  | 'pending'
  | 'notfound'
  | 'transit'
  | 'pickup'
  | 'delivered'
  | 'expired'
  | 'undelivered'
  | 'exception'
  | 'inforeceived'

export interface TrackingMoreResponse<T> {
  /** v3 uses top-level code/message (not nested meta) */
  code: number
  message: string
  data: T
}

export interface TrackingMoreDetectResult {
  courier_code: string
  courier_name: string
}

export interface TrackingMoreCreateRequest {
  tracking_number: string
  courier_code?: string
  order_number?: string
  customer_name?: string
  title?: string
  language?: string
}

export interface TrackingMoreWebhookPayload {
  event: string
  data: TrackingMoreTracking
}
