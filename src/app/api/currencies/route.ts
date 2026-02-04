import { NextResponse } from 'next/server'

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
  try {
    // Frankfurter moved from .app to .dev (the .app endpoint may return 404).
    // We'll use the new API. Base currency is RUB (user is Russian).
    // Docs: https://frankfurter.dev (public API: https://api.frankfurter.dev)
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=RUB&symbols=USD,EUR')

    if (!response.ok) {
      console.error('Frankfurter API error:', response.status)
      return []
    }

    const data = await response.json()

    // Convert to our format (show how many RUB per 1 USD/EUR)
    return [
      {
        symbol: 'USD',
        name: 'US Dollar',
        rate: data.rates.USD ? 1 / data.rates.USD : 0,
        type: 'fiat',
      },
      {
        symbol: 'EUR',
        name: 'Euro',
        rate: data.rates.EUR ? 1 / data.rates.EUR : 0,
        type: 'fiat',
      },
    ]
  } catch (error) {
    console.error('Failed to fetch fiat rates:', error)
    return []
  }
}

async function fetchCryptoRates(): Promise<CurrencyRate[]> {
  try {
    // Using CoinGecko free API - no key required for basic usage
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,solana&vs_currencies=usd&include_24hr_change=true',
      {
        headers: {
          Accept: 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('CoinGecko API error:', response.status)
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
    console.error('Failed to fetch crypto rates:', error)
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
    console.error('Currency API error:', error)
    return NextResponse.json({ error: 'Failed to fetch rates', rates: [] }, { status: 500 })
  }
}
