'use client'

import type { Delivery } from '@/lib/db/repositories/delivery.repository'
import { STATUS_CONFIG, formatDate } from '@/lib/delivery-utils'

interface DeliveryCardProps {
  delivery: Delivery
  isSelected: boolean
  onSelect: () => void
  onRefresh: () => void
  onRemove: () => void
  isPending: boolean
}

export function DeliveryCard({ delivery, isSelected, onSelect, onRefresh, onRemove, isPending }: DeliveryCardProps) {
  const statusCfg = STATUS_CONFIG[delivery.status]

  return (
    <div
      onClick={onSelect}
      className={`p-2.5 rounded-lg group/card transition-colors cursor-pointer ${
        isSelected
          ? 'border border-[var(--neon)] bg-[var(--neon-dim)]'
          : 'border border-[var(--border)] bg-[var(--card)]'
      }`}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {/* Title + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] px-1.5 py-px rounded font-medium"
              style={{ color: statusCfg.color, background: statusCfg.bg }}
            >
              {statusCfg.label}
            </span>
            <span className="text-sm leading-tight truncate" style={{ color: 'var(--fg)' }}>
              {delivery.title || delivery.trackingNumber}
            </span>
          </div>

          {/* Tracking number (when title is shown) */}
          {delivery.title && (
            <p className="text-xs text-[var(--muted)] font-mono mt-0.5">
              {delivery.trackingNumber}
            </p>
          )}

          {/* Last event */}
          {delivery.lastEvent && (
            <p className="text-xs text-[var(--muted)] mt-1 line-clamp-1">
              {delivery.lastEvent}
            </p>
          )}

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1">
            {delivery.courierName && (
              <span className="text-[10px] text-[var(--muted)]">{delivery.courierName}</span>
            )}
            {delivery.lastEventAt && (
              <span className="text-[10px] text-[var(--muted)]">{formatDate(delivery.lastEventAt)}</span>
            )}
            {delivery.eta && (
              <span className="text-[10px]" style={{ color: 'var(--warm)' }}>
                ETA: {formatDate(delivery.eta)}
              </span>
            )}
            {delivery.origin && delivery.destination && (
              <span className="text-[10px] text-[var(--muted)]">{delivery.origin} → {delivery.destination}</span>
            )}
          </div>
        </div>

        {/* Actions (visible on hover like TaskCard delete) */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onRefresh}
            disabled={isPending}
            className="opacity-0 group-hover/card:opacity-100 p-1 rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-all disabled:opacity-50"
            title="Refresh tracking"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M1.5 8a6.5 6.5 0 0 1 11.25-4.5M14.5 8a6.5 6.5 0 0 1-11.25 4.5" />
              <path d="M12.75 0.75v3h-3M3.25 15.25v-3h3" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            disabled={isPending}
            className="opacity-0 group-hover/card:opacity-100 p-1 rounded text-[var(--muted)] hover:text-[var(--red)] transition-all disabled:opacity-50"
            title="Remove delivery"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
