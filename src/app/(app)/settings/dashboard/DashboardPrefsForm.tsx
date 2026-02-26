'use client'

import { useState, useTransition } from 'react'
import { saveCurrencyPrefs, saveWeatherCity, saveTimezone } from './actions'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('dashboard-prefs')

interface DashboardPrefsFormProps {
  currencies: { baseCurrency: string; fiat: string[]; crypto: string[] } | null
  weatherCity: string | null
  timezone: string | null
}

const COMMON_BASE_CURRENCIES = [
  { value: 'rub', label: 'RUB (₽)' },
  { value: 'usd', label: 'USD ($)' },
  { value: 'eur', label: 'EUR (€)' },
  { value: 'gbp', label: 'GBP (£)' },
  { value: 'gel', label: 'GEL (₾)' },
  { value: 'try', label: 'TRY (₺)' },
  { value: 'jpy', label: 'JPY (¥)' },
  { value: 'cny', label: 'CNY (¥)' },
]

const FIAT_OPTIONS = [
  'usd', 'eur', 'gbp', 'jpy', 'chf', 'cad', 'aud',
  'cny', 'inr', 'krw', 'try', 'gel', 'aed', 'pln',
  'czk', 'sek', 'nok', 'dkk', 'huf', 'brl', 'mxn',
  'sgd', 'hkd', 'thb', 'rub',
]

const CRYPTO_OPTIONS = [
  { id: 'bitcoin', label: 'BTC' },
  { id: 'ethereum', label: 'ETH' },
  { id: 'solana', label: 'SOL' },
  { id: 'binancecoin', label: 'BNB' },
  { id: 'ripple', label: 'XRP' },
  { id: 'cardano', label: 'ADA' },
  { id: 'dogecoin', label: 'DOGE' },
  { id: 'avalanche-2', label: 'AVAX' },
  { id: 'polkadot', label: 'DOT' },
  { id: 'chainlink', label: 'LINK' },
  { id: 'litecoin', label: 'LTC' },
  { id: 'toncoin', label: 'TON' },
]

const TIMEZONES = [
  'Asia/Tbilisi', 'Europe/Moscow', 'Europe/London', 'Europe/Berlin',
  'Europe/Paris', 'Europe/Istanbul', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Dubai', 'Asia/Singapore', 'Asia/Kolkata', 'Australia/Sydney',
  'Pacific/Auckland', 'America/Sao_Paulo', 'Africa/Cairo', 'Asia/Bangkok',
  'Europe/Kiev', 'Europe/Warsaw', 'Europe/Prague', 'Europe/Helsinki',
  'America/Toronto', 'America/Mexico_City',
]

function StatusMessage({ status }: { status: { type: 'success' | 'error'; message: string } | null }) {
  if (!status) return null
  return (
    <div
      className="text-sm mt-2 font-medium"
      style={{ color: status.type === 'success' ? 'var(--green)' : 'var(--red)' }}
    >
      {status.message}
    </div>
  )
}

function TagPicker({
  options,
  selected,
  onChange,
  getLabel,
}: {
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
  getLabel?: (val: string) => string
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => {
              if (active) {
                onChange(selected.filter((s) => s !== opt))
              } else {
                onChange([...selected, opt])
              }
            }}
            className="px-3 py-1.5 rounded-lg text-sm font-mono font-medium transition-colors border"
            style={{
              borderColor: active ? 'var(--neon)' : 'var(--border)',
              background: active ? 'var(--neon-dim)' : 'transparent',
              color: active ? 'var(--neon)' : 'var(--muted)',
            }}
          >
            {getLabel ? getLabel(opt) : opt.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

export function DashboardPrefsForm({ currencies, weatherCity, timezone }: DashboardPrefsFormProps) {
  // Currency state
  const [baseCurrency, setBaseCurrency] = useState(currencies?.baseCurrency || 'rub')
  const [fiat, setFiat] = useState<string[]>(currencies?.fiat || ['usd', 'eur'])
  const [crypto, setCrypto] = useState<string[]>(currencies?.crypto || ['bitcoin', 'solana'])
  const [currencyStatus, setCurrencyStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Weather state
  const [city, setCity] = useState(weatherCity || '')
  const [cityStatus, setCityStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Timezone state
  const [tz, setTz] = useState(timezone || '')
  const [tzStatus, setTzStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const [isPending, startTransition] = useTransition()

  const handleSaveCurrencies = () => {
    setCurrencyStatus(null)
    startTransition(async () => {
      const result = await saveCurrencyPrefs({ baseCurrency, fiat, crypto })
      if (result.error) {
        setCurrencyStatus({ type: 'error', message: result.error })
        log.error('Save currencies failed', { error: result.error })
      } else {
        setCurrencyStatus({ type: 'success', message: 'Saved! Refresh dashboard to see changes.' })
      }
    })
  }

  const handleSaveCity = () => {
    setCityStatus(null)
    startTransition(async () => {
      const result = await saveWeatherCity(city)
      if (result.error) {
        setCityStatus({ type: 'error', message: result.error })
      } else {
        setCityStatus({ type: 'success', message: city ? 'Saved!' : 'Reset to default (Tbilisi).' })
      }
    })
  }

  const handleSaveTimezone = () => {
    setTzStatus(null)
    startTransition(async () => {
      const result = await saveTimezone(tz)
      if (result.error) {
        setTzStatus({ type: 'error', message: result.error })
      } else {
        setTzStatus({ type: 'success', message: tz ? 'Saved!' : 'Reset to browser default.' })
      }
    })
  }

  const btnClass = 'rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--fg)] transition-colors hover:bg-[var(--hover)] hover:border-[var(--neon-dim)] disabled:opacity-50'

  return (
    <div className="space-y-6">
      {/* Currencies */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold">Currencies</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Choose your base currency and which fiat/crypto rates to display.
        </p>

        <div className="mt-5 space-y-5">
          {/* Base currency */}
          <div>
            <label className="text-sm font-medium text-[var(--muted)] block mb-2">Base currency</label>
            <select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] font-mono"
            >
              {COMMON_BASE_CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Fiat currencies */}
          <div>
            <label className="text-sm font-medium text-[var(--muted)] block mb-2">
              Fiat currencies ({fiat.length} selected)
            </label>
            <TagPicker
              options={FIAT_OPTIONS.filter((f) => f !== baseCurrency)}
              selected={fiat}
              onChange={setFiat}
            />
          </div>

          {/* Crypto */}
          <div>
            <label className="text-sm font-medium text-[var(--muted)] block mb-2">
              Crypto ({crypto.length} selected)
            </label>
            <TagPicker
              options={CRYPTO_OPTIONS.map((c) => c.id)}
              selected={crypto}
              onChange={setCrypto}
              getLabel={(id) => CRYPTO_OPTIONS.find((c) => c.id === id)?.label || id}
            />
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSaveCurrencies} disabled={isPending || fiat.length === 0} className={btnClass}>
              {isPending ? 'Saving...' : 'Save currencies'}
            </button>
            <StatusMessage status={currencyStatus} />
          </div>
        </div>
      </section>

      {/* Weather */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold">Weather</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Set your city for the weather widget. Leave empty for default (Tbilisi).
        </p>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="text-sm font-medium text-[var(--muted)] block mb-2">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Tbilisi"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] placeholder-[var(--muted)]"
            />
          </div>
          <button onClick={handleSaveCity} disabled={isPending} className={btnClass}>
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
        <StatusMessage status={cityStatus} />
      </section>

      {/* Timezone */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="text-base font-semibold">Timezone</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Set your timezone for the clock widget. Leave empty for browser default.
        </p>

        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1 max-w-xs">
            <label className="text-sm font-medium text-[var(--muted)] block mb-2">Timezone</label>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)]"
            >
              <option value="">Browser default</option>
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleSaveTimezone} disabled={isPending} className={btnClass}>
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
        <StatusMessage status={tzStatus} />
      </section>
    </div>
  )
}
