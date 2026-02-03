import { NextResponse, type NextRequest } from 'next/server'

const TOKEN_COOKIE = 'lifeos.access_token'

function isPublicPath(pathname: string) {
  return (
    pathname === '/access' ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  )
}

export function middleware(req: NextRequest) {
  const required = process.env.ACCESS_TOKEN
  if (!required) return NextResponse.next()

  const { pathname } = req.nextUrl
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
