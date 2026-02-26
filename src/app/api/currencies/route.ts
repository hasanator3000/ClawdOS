import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { currencyQuerySchema } from '@/lib/validation-schemas'
import { formatZodErrors } from '@/lib/validation'

const log = createLogger('currencies')

export interface CurrencyRate {
  symbol: string
  name: string
  rate: number
  change24h?: number
  type: 'fiat' | 'crypto'
}

// Per-config cache (keyed by config hash), 5 min TTL
const cache = new Map<string, { rates: CurrencyRate[]; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000
const MAX_CACHE_ENTRIES = 20

// Defaults
const DEFAULT_BASE = 'rub'
const DEFAULT_FIAT = ['usd', 'eur']
const DEFAULT_CRYPTO = ['bitcoin', 'solana']

// Map of known currency names
const FIAT_NAMES: Record<string, string> = {
  usd: 'US Dollar', eur: 'Euro', gbp: 'British Pound', jpy: 'Japanese Yen',
  chf: 'Swiss Franc', cad: 'Canadian Dollar', aud: 'Australian Dollar',
  cny: 'Chinese Yuan', inr: 'Indian Rupee', krw: 'Korean Won',
  try: 'Turkish Lira', gel: 'Georgian Lari', aed: 'UAE Dirham',
  pln: 'Polish Zloty', czk: 'Czech Koruna', sek: 'Swedish Krona',
  nok: 'Norwegian Krone', dkk: 'Danish Krone', huf: 'Hungarian Forint',
  rub: 'Russian Ruble', brl: 'Brazilian Real', mxn: 'Mexican Peso',
  sgd: 'Singapore Dollar', hkd: 'Hong Kong Dollar', thb: 'Thai Baht',
}

const CRYPTO_NAMES: Record<string, { symbol: string; name: string }> = {
  bitcoin: { symbol: 'BTC', name: 'Bitcoin' },
  ethereum: { symbol: 'ETH', name: 'Ethereum' },
  solana: { symbol: 'SOL', name: 'Solana' },
  'binancecoin': { symbol: 'BNB', name: 'BNB' },
  cardano: { symbol: 'ADA', name: 'Cardano' },
  dogecoin: { symbol: 'DOGE', name: 'Dogecoin' },
  'avalanche-2': { symbol: 'AVAX', name: 'Avalanche' },
  polkadot: { symbol: 'DOT', name: 'Polkadot' },
  chainlink: { symbol: 'LINK', name: 'Chainlink' },
  litecoin: { symbol: 'LTC', name: 'Litecoin' },
  toncoin: { symbol: 'TON', name: 'Toncoin' },
  ripple: { symbol: 'XRP', name: 'XRP' },
}

// Base currency symbols
const BASE_SYMBOLS: Record<string, string> = {
  rub: '₽', usd: '$', eur: '€', gbp: '£', jpy: '¥',
  gel: '₾', try: '₺', krw: '₩', inr: '₹', cny: '¥',
}

function cacheKey(base: string, fiat: string[], crypto: string[]): string {
  return `${base}:${fiat.sort().join(',')}:${crypto.sort().join(',')}`
}

async function fetchFiatRates(baseCurrency: string, targets: string[]): Promise<CurrencyRate[]> {
  if (targets.length === 0) return []

  try {
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${baseCurrency}.json`,
      { cache: 'no-store', signal: AbortSignal.timeout(5_000) }
    )

    if (!response.ok) {
      log.error('Currency API (jsdelivr) error', { status: response.status })
      return []
    }

    const data = (await response.json()) as Record<string, Record<string, number>>
    const baseRates = data?.[baseCurrency]
    if (!baseRates) return []

    return targets.map((t) => {
      const raw = baseRates[t]
      return {
        symbol: t.toUpperCase(),
        name: FIAT_NAMES[t] || t.toUpperCase(),
        rate: typeof raw === 'number' ? 1 / raw : 0, // invert: base per 1 target
        type: 'fiat' as const,
      }
    }).filter((r) => r.rate > 0)
  } catch (error) {
    log.error('Failed to fetch fiat rates', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
}

async function fetchCryptoRates(coinIds: string[]): Promise<CurrencyRate[]> {
  if (coinIds.length === 0) return []

  try {
    const ids = coinIds.join(',')
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
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

    for (const coinId of coinIds) {
      const coin = data[coinId]
      if (!coin) continue

      const meta = CRYPTO_NAMES[coinId]
      rates.push({
        symbol: meta?.symbol || coinId.toUpperCase(),
        name: meta?.name || coinId,
        rate: coin.usd,
        change24h: coin.usd_24h_change,
        type: 'crypto',
      })
    }

    return rates
  } catch (error) {
    log.error('Failed to fetch crypto rates', { error: error instanceof Error ? error.message : String(error) })
    return []
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const parsed = currencyQuerySchema.safeParse({
    base: params.get('base') || undefined,
    fiat: params.get('fiat') || undefined,
    crypto: params.get('crypto') || undefined,
  })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', fields: formatZodErrors(parsed.error) }, { status: 400 })
  }

  const base = parsed.data.base || DEFAULT_BASE
  const fiat = parsed.data.fiat
    ? parsed.data.fiat.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_FIAT
  const crypto = parsed.data.crypto
    ? parsed.data.crypto.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
    : DEFAULT_CRYPTO

  const key = cacheKey(base, fiat, crypto)

  try {
    const cached = cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        rates: cached.rates,
        baseCurrency: base,
        baseSymbol: BASE_SYMBOLS[base] || base.toUpperCase(),
        cached: true,
      })
    }

    const [fiatRates, cryptoRates] = await Promise.all([
      fetchFiatRates(base, fiat),
      fetchCryptoRates(crypto),
    ])

    const rates = [...fiatRates, ...cryptoRates]

    // Evict oldest if full
    if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(key)) {
      let oldestKey = ''
      let oldestTs = Infinity
      for (const [k, v] of cache) {
        if (v.timestamp < oldestTs) {
          oldestTs = v.timestamp
          oldestKey = k
        }
      }
      if (oldestKey) cache.delete(oldestKey)
    }

    cache.set(key, { rates, timestamp: Date.now() })

    return NextResponse.json({
      rates,
      baseCurrency: base,
      baseSymbol: BASE_SYMBOLS[base] || base.toUpperCase(),
      cached: false,
    })
  } catch (error) {
    log.error('Currency API error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to fetch rates', rates: [] }, { status: 500 })
  }
}
