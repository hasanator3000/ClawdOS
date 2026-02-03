'use server'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { usernameRegex, verifyUser } from '@/lib/auth'

export async function signIn(formData: FormData) {
  const username = String(formData.get('username') || '').trim()
  const password = String(formData.get('password') || '')

  if (!usernameRegex.test(username) || password.length < 8) {
    redirect('/login?error=Invalid%20credentials')
  }

  const user = await verifyUser(username, password)
  if (!user) redirect('/login?error=Invalid%20credentials')

  const session = await getSession()

  // If Telegram is linked, require a second factor.
  if (user.telegramUserId) {
    const challenge = await (await import('@/lib/auth')).createAuthChallenge(user.id, 'login')
    await (await import('@/lib/auth')).enqueueTelegram(
      user.telegramUserId,
      `LifeOS login code: ${challenge.code} (valid 10 min)`
    )

    session.pendingUserId = user.id
    session.pendingUsername = user.username
    session.pendingChallengeId = challenge.id
    await session.save()
    redirect('/login/verify')
  }

  session.userId = user.id
  session.username = user.username
  await session.save()

  redirect('/today')
}

export async function signOut() {
  const session = await getSession()
  session.destroy()
  redirect('/login')
}
