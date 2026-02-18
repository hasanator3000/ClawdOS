import { cache } from 'react'
import { cookies } from 'next/headers'
import { getIronSession, type IronSession } from 'iron-session'
import type { SessionData } from '@/types/session'

const sessionOptions = {
  cookieName: 'clawdos.session',
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax' as const,
    // We often run ClawdOS over plain HTTP on a private VPS/tailnet.
    // Setting `secure=true` would make the cookie disappear on http:// and break login ("Session expired").
    // Enable secure cookies only when explicitly configured and you serve via HTTPS.
    secure: process.env.SESSION_COOKIE_SECURE === 'true',
    path: '/',
  },
}

/**
 * Returns the current session.
 * Wrapped in React.cache() so multiple calls within the same RSC request
 * hit the cookie jar only once (layout + page both call getSession).
 */
export const getSession = cache(async (): Promise<IronSession<SessionData>> => {
  if (!process.env.SESSION_PASSWORD) {
    throw new Error('SESSION_PASSWORD is not set')
  }
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore as any, sessionOptions)
})
