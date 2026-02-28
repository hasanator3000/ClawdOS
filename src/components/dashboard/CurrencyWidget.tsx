'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CurrencyRate } from '@/app/api/currencies/route'

interface CurrencyPreferences {
  baseCurrency: string
  fiat: string[]
  crypto: string[]
}

interface CurrencyWidgetProps {
  preferences?: CurrencyPreferences | null
}

const cryptoFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const cryptoFmtSmall = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function RateCard({ rate, baseSymbol }: { rate: CurrencyRate; baseSymbol: string }) {
  return (
    <div
      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-colors"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="font-mono text-sm uppercase tracking-wide font-semibold shrink-0 text-[var(--fg)]"
          
        >
          {rate.symbol}
        </span>
        <span className="text-xs truncate text-[var(--muted)]" >{rate.name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span
          className="text-[15px] font-mono font-bold tabular-nums text-[var(--fg)]"
          
        >
          {rate.type === 'crypto' ? (
            <>${rate.rate < 10 ? cryptoFmtSmall.format(rate.rate) : cryptoFmt.format(rate.rate)}</>
          ) : (
            <>{rate.rate.toFixed(2)} {baseSymbol}</>
          )}
        </span>
        {rate.type === 'crypto' && rate.change24h !== undefined && (
          <span
            className="text-xs font-mono font-medium px-1.5 py-0.5 rounded-md"
            style={{
              color: rate.change24h >= 0 ? 'var(--green)' : 'var(--red)',
              background: rate.change24h >= 0 ? 'rgba(110,231,183,0.1)' : 'rgba(251,113,133,0.1)',
            }}
          >
            {rate.change24h >= 0 ? '+' : ''}
            {rate.change24h.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

export function CurrencyWidget({ preferences }: CurrencyWidgetProps) {
  const [rates, setRates] = useState<CurrencyRate[]>([])
  const [baseSymbol, setBaseSymbol] = useState('₽')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUrl = useMemo(() => {
    if (!preferences) return '/api/currencies'
    const params = new URLSearchParams()
    params.set('base', preferences.baseCurrency)
    if (preferences.fiat.length > 0) params.set('fiat', preferences.fiat.join(','))
    if (preferences.crypto.length > 0) params.set('crypto', preferences.crypto.join(','))
    return `/api/currencies?${params.toString()}`
  }, [preferences])

  useEffect(() => {
    const controller = new AbortController()

    async function fetchRates() {
      try {
        const response = await fetch(fetchUrl, { signal: controller.signal })
        const data = await response.json()

        if (data.error) {
          setError(data.error)
        } else {
          setRates(data.rates)
          if (data.baseSymbol) setBaseSymbol(data.baseSymbol)
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return
        setError('Failed to load rates')
      } finally {
        setLoading(false)
      }
    }

    fetchRates()

    let interval: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (!interval) interval = setInterval(fetchRates, 2 * 60 * 1000)
    }
    const stop = () => {
      if (interval) { clearInterval(interval); interval = null }
    }
    const onVisibility = () => document.hidden ? stop() : start()

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      controller.abort()
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [fetchUrl])

  if (loading) {
    return (
      <div
        className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
        
      >
        <div
          className="text-[11px] uppercase tracking-widest font-mono mb-3 font-medium text-[var(--muted)]"
          
        >
          Currencies
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-11 animate-pulse rounded-xl bg-[var(--hover)]"
              
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
        
      >
        <div
          className="text-[11px] uppercase tracking-widest font-mono mb-3 font-medium text-[var(--muted)]"
          
        >
          Currencies
        </div>
        <div className="text-sm text-[var(--muted)]" >{error}</div>
      </div>
    )
  }

  return (
    <div
      className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div
        className="text-[11px] uppercase tracking-widest font-mono mb-3 font-medium text-[var(--muted)]"
        
      >
        Currencies
      </div>
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {rates.map((rate) => (
          <RateCard key={rate.symbol} rate={rate} baseSymbol={baseSymbol} />
        ))}
      </div>
    </div>
  )
}
