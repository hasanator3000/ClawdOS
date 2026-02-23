import { NextResponse, type NextRequest } from 'next/server'

const TOKEN_COOKIE = 'clawdos.access_token'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

const CSRF_EXEMPT_PATHS = new Set(['/api/health', '/api/version', '/access'])

function isPublicPath(pathname: string) {
  return (
    pathname === '/access' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  )
}

function isCsrfExempt(pathname: string): boolean {
  if (CSRF_EXEMPT_PATHS.has(pathname)) return true
  if (pathname.startsWith('/_next')) return true
  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // CSRF origin validation for mutating requests (runs regardless of auth config)
  if (MUTATING_METHODS.has(req.method) && !isCsrfExempt(pathname)) {
    const origin = req.headers.get('origin')
    if (!origin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: missing Origin header' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    try {
      const originHost = new URL(origin).host
      if (originHost !== host) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: origin mismatch' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'Forbidden: invalid Origin header' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Auth check (only when ACCESS_TOKEN is configured)
  const required = process.env.ACCESS_TOKEN
  if (!required) return NextResponse.next()

  if (isPublicPath(pathname)) return NextResponse.next()

  const cookieToken = req.cookies.get(TOKEN_COOKIE)?.value
  const headerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const queryToken = req.nextUrl.searchParams.get('token')

  const token = cookieToken || headerToken || queryToken
  if (token === required) {
    // If user passed token via ?token=..., persist it as a cookie.
    if (!cookieToken && queryToken === required) {
      const res = NextResponse.next()
      res.cookies.set(TOKEN_COOKIE, required, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // set true when behind HTTPS
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
      })
      return res
    }
    return NextResponse.next()
  }

  const url = req.nextUrl.clone()
  url.pathname = '/access'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
