'use server'

import { validateAction } from '@/lib/validation'
import { marketplaceSearchSchema } from '@/lib/validation-schemas'

const CLAWDTM_API = 'https://clawdtm.com/api/v1/skills/search'

export interface MarketplaceSkill {
  slug: string
  name: string
  author: string
  description: string | null
  category: string | null
  version: string
  downloads: number
  stars: number
  installs: number
  security: {
    score: number
    risk: 'low' | 'medium' | 'high' | 'critical'
    flags: string[]
    last_scanned_at: number
  }
  community: {
    avg_rating: number | null
    review_count: number
    is_verified: boolean
    is_featured: boolean
  }
  install_command: string
  clawdtm_url: string
}

interface SearchResponse {
  success: boolean
  query: string
  result_count: number
  results: MarketplaceSkill[]
}

export async function searchMarketplaceSkills(
  query: string,
  limit = 30
): Promise<{ skills: MarketplaceSkill[]; total: number; error?: string }> {
  const v = validateAction(marketplaceSearchSchema, { query, limit })
  if (v.error) return { skills: [], total: 0, error: v.error }

  try {
    const url = new URL(CLAWDTM_API)
    url.searchParams.set('q', query || 'e')
    url.searchParams.set('limit', String(limit))

    const res = await fetch(url.toString(), {
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      return { skills: [], total: 0, error: `API error: ${res.status}` }
    }

    const data: SearchResponse = await res.json()

    if (!data.success) {
      return { skills: [], total: 0, error: 'API returned unsuccessful response' }
    }

    return { skills: data.results, total: data.result_count }
  } catch (err) {
    return { skills: [], total: 0, error: String(err) }
  }
}
