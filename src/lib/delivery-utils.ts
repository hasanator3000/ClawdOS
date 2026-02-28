import type { DeliveryStatus, TrackingEvent } from '@/lib/db/repositories/delivery.repository'
import type { TrackingMoreTracking } from '@/lib/trackingmore/types'

// ── Status display maps (single source of truth) ────────────

export const STATUS_EMOJI: Record<DeliveryStatus, string> = {
  pending: '\u{23F3}',    // hourglass
  transit: '\u{1F69A}',   // truck
  pickup: '\u{1F4E6}',    // package
  delivered: '\u{2705}',  // check mark
  expired: '\u{274C}',    // cross
  undelivered: '\u{26A0}', // warning
}

export const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Pending',
  transit: 'In Transit',
  pickup: 'Out for Delivery',
  delivered: 'Delivered',
  expired: 'Expired',
  undelivered: 'Not Delivered',
}

export const STATUS_CONFIG: Record<DeliveryStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'var(--muted)', bg: 'var(--hover)' },
  transit: { label: 'In Transit', color: 'var(--neon)', bg: 'var(--neon-dim)' },
  pickup: { label: 'Ready for Pickup', color: 'var(--warm)', bg: 'rgba(251,191,36,0.1)' },
  delivered: { label: 'Delivered', color: 'var(--green)', bg: 'rgba(110,231,183,0.1)' },
  expired: { label: 'Expired', color: 'var(--muted)', bg: 'var(--hover)' },
  undelivered: { label: 'Not Delivered', color: 'var(--warm)', bg: 'rgba(251,191,36,0.1)' },
}

export const STATUS_COLORS: Record<DeliveryStatus, string> = {
  pending: 'var(--muted)',
  transit: 'var(--neon)',
  pickup: 'var(--warm)',
  delivered: 'var(--green)',
  expired: 'var(--muted)',
  undelivered: 'var(--warm)',
}

// ── TrackingMore status mapping ─────────────────────────────

export function mapTmStatus(tmStatus: string): DeliveryStatus {
  switch (tmStatus) {
    case 'transit':
    case 'inforeceived':
      return 'transit'
    case 'pickup':
      return 'pickup'
    case 'delivered':
      return 'delivered'
    case 'expired':
      return 'expired'
    case 'undelivered':
    case 'exception':
      return 'undelivered'
    case 'pending':
    case 'notfound':
    default:
      return 'pending'
  }
}

// ── Event extraction ────────────────────────────────────────

export function extractEvents(data: Pick<TrackingMoreTracking, 'origin_info' | 'destination_info'>): TrackingEvent[] {
  const events: TrackingEvent[] = []

  const infos = [
    ...(data.origin_info?.trackinfo ?? []),
    ...(data.destination_info?.trackinfo ?? []),
  ]

  for (const evt of infos) {
    events.push({
      date: evt.checkpoint_date ?? evt.Date ?? '',
      description: evt.tracking_detail ?? evt.Details ?? '',
      location: evt.location,
      status: evt.checkpoint_delivery_status ?? evt.checkpoint_status ?? '',
    })
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return events
}

// ── Date formatting (SSR-safe, no hydration mismatch) ───────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Parse date — handles Date objects, ISO strings, and TM "2026-02-13 10:45:00" format */
export function toDate(val: unknown): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  if (typeof val === 'string') {
    const normalized = val.includes('T') ? val : val.replace(' ', 'T') + '+00:00'
    return new Date(normalized)
  }
  return new Date(String(val))
}

/** Format date with time (short: "Feb 13, 10:45") — uses UTC to avoid hydration mismatch */
export function formatDate(dateStr: unknown): string {
  const d = toDate(dateStr)
  if (!d || isNaN(d.getTime())) return ''
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

/** Format date with year (long: "Feb 13, 2026 10:45") — uses UTC */
export function formatDateLong(dateStr: unknown): string {
  const d = toDate(dateStr)
  if (!d || isNaN(d.getTime())) return typeof dateStr === 'string' ? dateStr : ''
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

// ── Telegram notification helper ────────────────────────────

export function buildStatusChangeMessage(
  title: string,
  courierName: string,
  newStatus: DeliveryStatus,
  lastEvent: string | null
): string {
  const emoji = STATUS_EMOJI[newStatus] || '\u{1F4E6}'
  const label = STATUS_LABEL[newStatus] || newStatus
  const lastEvtText = lastEvent ? `\n${lastEvent}` : ''
  return `${emoji} ${title}\n${courierName} \u2014 ${label}${lastEvtText}`
}
