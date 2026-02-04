'use client'

import { useEffect, useState } from 'react'
import type { CurrencyRate } from '@/app/api/currencies/route'

export function CurrencyWidget() {
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRates() {
      try {
        const response = await fetch('/api/currencies')
        const data = await response.json()

        if (data.error) {
          setError(data.error)
        } else {
          setRates(data.rates)
        }
      } catch (err) {
        setError('Failed to load rates')
      } finally {
        setLoading(false)
      }
    }

    fetchRates()

    // Refresh every 5 minutes
    const interval = setInterval(fetchRates, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">Currencies</div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse bg-[var(--hover)] rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">Currencies</div>
        <div className="text-sm text-[var(--muted)]">{error}</div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-3">Currencies</div>
      <div className="grid grid-cols-2 gap-3">
        {rates.map((rate) => (
          <div
            key={rate.symbol}
            className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{rate.symbol}</span>
              {rate.type === 'crypto' && rate.change24h !== undefined && (
                <span
                  className={`text-xs ${
                    rate.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {rate.change24h >= 0 ? '+' : ''}
                  {rate.change24h.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="text-lg font-semibold tabular-nums">
              {rate.type === 'crypto' ? (
                <>
                  ${rate.rate.toLocaleString('en-US', { maximumFractionDigits: rate.rate < 10 ? 2 : 0 })}
                </>
              ) : (
                <>
                  {rate.rate.toFixed(2)} ₽
                </>
              )}
            </div>
            <div className="text-xs text-[var(--muted)]">{rate.name}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
