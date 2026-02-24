import { NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'

const log = createLogger('currencies')

export interface CurrencyRate {
  symbol: string
  name: string
  rate: number
  change24h?: number
  type: 'fiat' | 'crypto'
}

// Cache for 5 minutes
let cache: { rates: CurrencyRate[]; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000

async function fetchFiatRates(): Promise<CurrencyRate[]> {
  // Note: Frankfurter (ECB) doesn't provide RUB, so using it as base will 404.
  // Use a public JSON currency feed for RUB→(USD, EUR) and invert to get RUB per 1 unit.
  try {
    const response = await fetch(
      'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/rub.json',
      { cache: 'no-store', signal: AbortSignal.timeout(5_000) }
    )

    if (!response.ok) {
      log.error('Currency API (jsdelivr) error', { status: response.status })
      return []
    }

    const data = (await response.json()) as any
    const rub = data?.rub
    const rubToUsd = typeof rub?.usd === 'number' ? rub.usd : null // 1 RUB = X USD
    const rubToEur = typeof rub?.eur === 'number' ? rub.eur : null // 1 RUB = X EUR

    return [
      {
        symbol: 'USD',
        name: 'US Dollar',
        rate: rubToUsd ? 1 / rubToUsd : 0, // RUB per 1 USD
        type: 'fiat',
      },
      {
        symbol: 'EUR',
        name: 'Euro',
        rate: rubToEur ? 1 / rubToEur : 0, // RUB per 1 EUR
        type: 'fiat',
      },
    ]
  } catch (error) {
    log.error('Failed to fetch fiat rates', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
}

async function fetchCryptoRates(): Promise<CurrencyRate[]> {
  try {
    // Using CoinGecko free API - no key required for basic usage
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana&vs_currencies=usd&include_24hr_change=true',
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5_000),
      }
    )

    if (!response.ok) {
      log.error('CoinGecko API error', { status: response.status })
      return []
    }

    const data = await response.json()

    const rates: CurrencyRate[] = []

    if (data.bitcoin) {
      rates.push({
        symbol: 'BTC',
        name: 'Bitcoin',
        rate: data.bitcoin.usd,
        change24h: data.bitcoin.usd_24h_change,
        type: 'crypto',
      })
    }

    if (data.solana) {
      rates.push({
        symbol: 'SOL',
        name: 'Solana',
        rate: data.solana.usd,
        change24h: data.solana.usd_24h_change,
        type: 'crypto',
      })
    }

    return rates
  } catch (error) {
    log.error('Failed to fetch crypto rates', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
}

export async function GET() {
  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({ rates: cache.rates, cached: true })
    }

    // Fetch both fiat and crypto in parallel
    const [fiatRates, cryptoRates] = await Promise.all([fetchFiatRates(), fetchCryptoRates()])

    const rates = [...fiatRates, ...cryptoRates]

    // Update cache
    cache = { rates, timestamp: Date.now() }

    return NextResponse.json({ rates, cached: false })
  } catch (error) {
    log.error('Currency API error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to fetch rates', rates: [] }, { status: 500 })
  }
}
