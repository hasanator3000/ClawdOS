import { cookies } from 'next/headers'
import { getIronSession, type IronSession } from 'iron-session'
import type { SessionData } from '@/types/session'

const sessionOptions = {
  cookieName: 'lifeos.session',
  password: process.env.SESSION_PASSWORD!,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  if (!process.env.SESSION_PASSWORD) {
    throw new Error('SESSION_PASSWORD is not set')
  }
  const cookieStore = await cookies()
  return getIronSession<SessionData>(cookieStore as any, sessionOptions)
}
