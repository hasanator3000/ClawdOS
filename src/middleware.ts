import { NextResponse, type NextRequest } from 'next/server'
import { checkRateLimit, type RateLimitResult } from '@/lib/security/rate-limiter'

const TOKEN_COOKIE = 'clawdos.access_token'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const CSRF_EXEMPT_PATHS = new Set(['/api/health', '/api/version', '/access'])

const RATE_LIMIT_EXEMPT_PATHS = new Set(['/api/health'])

function isPublicPath(pathname: string) {
  return (
    pathname === '/access' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/cron/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  )
}

function isCsrfExempt(pathname: string): boolean {
  if (CSRF_EXEMPT_PATHS.has(pathname)) return true
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/api/webhooks/')) return true
  if (pathname.startsWith('/api/cron/')) return true
  return false
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
  }
}

function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  const headers = rateLimitHeaders(result)
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

/** Attach request ID (and optionally rate-limit headers) to any Response. */
function tagResponse<T extends Response>(
  res: T,
  requestId: string,
  rlResult?: RateLimitResult | null
): T {
  res.headers.set('x-request-id', requestId)
  if (rlResult) {
    const rl = rateLimitHeaders(rlResult)
    Object.entries(rl).forEach(([k, v]) => res.headers.set(k, v))
  }
  return res
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Generate or propagate request ID for tracing
  const requestId = req.headers.get('x-request-id') || crypto.randomUUID()

  // Forward request ID to downstream handlers via request header
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-request-id', requestId)

  // CSRF origin validation for mutating requests (runs regardless of auth config)
  if (MUTATING_METHODS.has(req.method) && !isCsrfExempt(pathname)) {
    const origin = req.headers.get('origin')
    if (!origin) {
      return tagResponse(
        new Response(
          JSON.stringify({ error: 'Forbidden: missing Origin header' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        ),
        requestId
      )
    }

    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    try {
      const originHost = new URL(origin).host
      if (originHost !== host) {
        return tagResponse(
          new Response(
            JSON.stringify({ error: 'Forbidden: origin mismatch' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
          requestId
        )
      }
    } catch {
      return tagResponse(
        new Response(
          JSON.stringify({ error: 'Forbidden: invalid Origin header' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        ),
        requestId
      )
    }
  }

  // Rate limiting for API routes (after CSRF, before auth)
  let rateLimitResult: RateLimitResult | null = null
  if (pathname.startsWith('/api/') && !RATE_LIMIT_EXEMPT_PATHS.has(pathname)) {
    const ip = getClientIp(req)
    rateLimitResult = checkRateLimit(ip)

    if (!rateLimitResult.allowed) {
      const headers = rateLimitHeaders(rateLimitResult)
      return tagResponse(
        new Response(
          JSON.stringify({ error: 'Too many requests' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(Math.ceil(rateLimitResult.resetMs / 1000)),
              ...headers,
            },
          }
        ),
        requestId
      )
    }
  }

  // Auth check (only when ACCESS_TOKEN is configured)
  const required = process.env.ACCESS_TOKEN
  if (!required) {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    return rateLimitResult
      ? tagResponse(addRateLimitHeaders(res, rateLimitResult), requestId)
      : tagResponse(res, requestId)
  }

  if (isPublicPath(pathname)) {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    return rateLimitResult
      ? tagResponse(addRateLimitHeaders(res, rateLimitResult), requestId)
      : tagResponse(res, requestId)
  }

  const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value
  const headerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  const token = cookieToken || headerToken
  if (token === required) {
    const res = NextResponse.next({ request: { headers: requestHeaders } })
    return rateLimitResult
      ? tagResponse(addRateLimitHeaders(res, rateLimitResult), requestId)
      : tagResponse(res, requestId)
  }

  const url = req.nextUrl.clone()
  url.pathname = '/access'
  url.searchParams.set('next', pathname)
  return tagResponse(NextResponse.redirect(url), requestId)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
