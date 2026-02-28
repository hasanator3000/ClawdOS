'use client'

import { useState } from 'react'

/** Common carriers for manual selection */
const COMMON_CARRIERS = [
  { code: '', label: 'Auto-detect' },
  { code: 'fedex', label: 'FedEx' },
  { code: 'ups', label: 'UPS' },
  { code: 'usps', label: 'USPS' },
  { code: 'dhl', label: 'DHL' },
  { code: 'cdek', label: 'CDEK' },
  { code: 'russianpost', label: 'Russian Post' },
  { code: 'yanwen', label: 'Yanwen' },
  { code: 'cainiao', label: 'Cainiao' },
  { code: 'dpd', label: 'DPD' },
  { code: 'tnt', label: 'TNT' },
  { code: 'china-ems', label: 'China EMS' },
  { code: 'china-post', label: 'China Post' },
]

interface AddDeliveryFormProps {
  onSubmit: (trackingNumber: string, title?: string, courierCode?: string) => void
  onCancel: () => void
  disabled: boolean
}

export function AddDeliveryForm({ onSubmit, onCancel, disabled }: AddDeliveryFormProps) {
  const [trackingNumber, setTrackingNumber] = useState('')
  const [title, setTitle] = useState('')
  const [courierCode, setCourierCode] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = trackingNumber.trim()
    if (trimmed.length < 4) return
    onSubmit(trimmed, title.trim() || undefined, courierCode || undefined)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3"
    >
      <input
        type="text"
        value={trackingNumber}
        onChange={(e) => setTrackingNumber(e.target.value)}
        placeholder="Tracking number"
        className="w-full px-4 py-2 text-sm rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-colors"
        autoFocus
        disabled={disabled}
      />
      <div className="flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Label (optional) — e.g. AliExpress headphones"
          className="flex-1 px-4 py-2 text-sm rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-colors"
          disabled={disabled}
        />
        <select
          value={courierCode}
          onChange={(e) => setCourierCode(e.target.value)}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--fg)] focus:outline-none focus:border-[var(--neon)] focus:shadow-[0_0_0_1px_var(--neon-dim)] transition-colors"
          disabled={disabled}
        >
          {COMMON_CARRIERS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={disabled || trackingNumber.trim().length < 4}
          className="px-4 py-2 text-sm rounded-lg bg-[var(--neon)] text-[var(--bg)] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {disabled ? 'Adding...' : 'Add Delivery'}
        </button>
      </div>
    </form>
  )
}
