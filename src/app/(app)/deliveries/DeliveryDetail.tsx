'use client'

import { useState } from 'react'
import type { Delivery } from '@/lib/db/repositories/delivery.repository'
import { STATUS_COLORS, formatDateLong } from '@/lib/delivery-utils'
import { updateDeliveryInfo } from './actions'

interface DeliveryDetailProps {
  delivery: Delivery
  onClose: () => void
  onUpdate?: (updated: Delivery) => void
}

export function DeliveryDetail({ delivery, onClose, onUpdate }: DeliveryDetailProps) {
  const events = delivery.events ?? []
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(delivery.title || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!editTitle.trim()) return
    setSaving(true)
    const result = await updateDeliveryInfo(delivery.id, { title: editTitle.trim() })
    setSaving(false)
    if (result.delivery) {
      onUpdate?.(result.delivery)
      setEditing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:max-w-lg max-h-[80vh] overflow-y-auto rounded-t-xl sm:rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave()
                    if (e.key === 'Escape') setEditing(false)
                  }}
                  className="flex-1 text-sm bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-[var(--fg)] outline-none focus:border-[var(--neon)]"
                  disabled={saving}
                />
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="text-xs px-2 py-1 rounded bg-[var(--neon)] text-[var(--bg)] font-medium disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="group/title flex items-center gap-1.5">
                <h2 className="text-base font-semibold text-[var(--fg)] truncate">
                  {delivery.title || delivery.trackingNumber}
                </h2>
                <button
                  onClick={() => { setEditTitle(delivery.title || ''); setEditing(true) }}
                  className="opacity-0 group-hover/title:opacity-100 p-0.5 rounded text-[var(--muted)] hover:text-[var(--fg)] transition-all"
                  title="Edit title"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3">
                    <path d="M11.5 1.5l3 3L5 14H2v-3z" />
                  </svg>
                </button>
              </div>
            )}
            {delivery.title && !editing && (
              <p className="text-xs font-mono text-[var(--muted)] mt-0.5">
                {delivery.trackingNumber}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors shrink-0"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <InfoItem label="Status" value={delivery.status} color={STATUS_COLORS[delivery.status]} />
          <InfoItem label="Carrier" value={delivery.courierName || delivery.courierCode || 'Unknown'} />
          {delivery.origin && <InfoItem label="Origin" value={delivery.origin} />}
          {delivery.destination && <InfoItem label="Destination" value={delivery.destination} />}
          {delivery.eta && <InfoItem label="ETA" value={formatDateLong(delivery.eta)} color="var(--warm)" />}
          {delivery.substatus && <InfoItem label="Substatus" value={delivery.substatus} />}
        </div>

        {/* Event timeline */}
        <div>
          <h3 className="text-xs font-medium text-[var(--muted)] mb-2">Tracking History</h3>
          {events.length === 0 ? (
            <p className="text-xs text-[var(--muted)] py-4 text-center">
              No tracking events yet. Try refreshing.
            </p>
          ) : (
            <div className="relative pl-4 space-y-0">
              {/* Vertical line */}
              <div
                className="absolute left-[5px] top-1.5 bottom-1.5 w-px"
                style={{ backgroundColor: 'var(--border)' }}
              />

              {events.map((event, i) => (
                <div key={i} className="relative pb-3 last:pb-0">
                  {/* Dot */}
                  <div
                    className="absolute left-[-13px] top-1.5 w-2.5 h-2.5 rounded-full border-2"
                    style={{
                      borderColor: i === 0 ? STATUS_COLORS[delivery.status] : 'var(--border)',
                      backgroundColor: i === 0 ? STATUS_COLORS[delivery.status] : 'var(--bg)',
                    }}
                  />

                  <p className="text-xs text-[var(--fg)]">{event.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--muted)]">
                    <span>{formatDateLong(event.date)}</span>
                    {event.location && <span>{event.location}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md bg-[var(--card)] border border-[var(--border)] p-2">
      <p className="text-[10px] text-[var(--muted)]">{label}</p>
      <p className="text-xs font-medium capitalize" style={color ? { color } : { color: 'var(--fg)' }}>
        {value}
      </p>
    </div>
  )
}
