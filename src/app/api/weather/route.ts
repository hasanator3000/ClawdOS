import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/logger'
import { weatherQuerySchema } from '@/lib/validation-schemas'
import { formatZodErrors } from '@/lib/validation'

const log = createLogger('weather')

export interface WeatherData {
  temp: number
  feelsLike: number
  condition: string
  icon: string
  humidity: number
  wind: number
  city: string
}

// Per-city cache, max 10 entries, 15 min TTL
const cache = new Map<string, { data: WeatherData; timestamp: number }>()
const CACHE_TTL = 15 * 60 * 1000
const MAX_CACHE_ENTRIES = 10

// Map wttr.in weather codes to emoji icons
function weatherIcon(code: string): string {
  const c = parseInt(code, 10)
  if (c === 113) return '☀️'
  if (c === 116) return '⛅'
  if (c === 119 || c === 122) return '☁️'
  if (c === 143 || c === 248 || c === 260) return '🌫️'
  if ([176, 263, 266, 293, 296, 299, 302, 305, 308, 311, 314, 353, 356, 359].includes(c)) return '🌧️'
  if ([179, 182, 185, 227, 230, 317, 320, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374, 377].includes(c)) return '🌨️'
  if ([200, 386, 389, 392, 395].includes(c)) return '⛈️'
  return '🌤️'
}

const DEFAULT_CITY = process.env.WEATHER_CITY || 'Tbilisi'

async function fetchWeather(city: string): Promise<WeatherData> {
  const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'curl/8.0' },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`wttr.in returned ${response.status}`)
  }

  const data = await response.json()
  const current = data.current_condition?.[0]

  if (!current) {
    throw new Error('No current condition in wttr.in response')
  }

  return {
    temp: parseInt(current.temp_C, 10),
    feelsLike: parseInt(current.FeelsLikeC, 10),
    condition: current.weatherDesc?.[0]?.value || 'Unknown',
    icon: weatherIcon(current.weatherCode),
    humidity: parseInt(current.humidity, 10),
    wind: parseInt(current.windspeedKmph, 10),
    city,
  }
}

export async function GET(request: NextRequest) {
  const rawCity = request.nextUrl.searchParams.get('city')
  const parsed = weatherQuerySchema.safeParse({ city: rawCity || DEFAULT_CITY })

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query parameters', fields: formatZodErrors(parsed.error) }, { status: 400 })
  }

  const city = parsed.data.city
  const cacheKey = city.toLowerCase().trim()

  try {
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ weather: cached.data, cached: true })
    }

    const weather = await fetchWeather(city)

    // Evict oldest entry if cache is full
    if (cache.size >= MAX_CACHE_ENTRIES && !cache.has(cacheKey)) {
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

    cache.set(cacheKey, { data: weather, timestamp: Date.now() })

    return NextResponse.json({ weather, cached: false })
  } catch (error) {
    log.error('Weather API error', { error: error instanceof Error ? error.message : String(error), city })

    // Return cached data even if stale
    const cached = cache.get(cacheKey)
    if (cached) {
      return NextResponse.json({ weather: cached.data, cached: true, stale: true })
    }

    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 })
  }
}
