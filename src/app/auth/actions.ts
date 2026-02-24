'use server'

import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { verifyUser, createAuthChallenge, enqueueTelegram } from '@/lib/auth'
import { signInSchema } from '@/lib/validation-schemas'

export async function signIn(formData: FormData) {
  const username = String(formData.get('username') || '').trim()
  const password = String(formData.get('password') || '')

  const parsed = signInSchema.safeParse({ username, password })
  if (!parsed.success) {
    redirect('/login?error=Invalid%20credentials')
  }

  const user = await verifyUser(username, password)
  if (!user) redirect('/login?error=Invalid%20credentials')

  const session = await getSession()

  // If Telegram is linked, require a second factor.
  if (user.telegramUserId) {
    const challenge = await createAuthChallenge(user.id, 'login')
    await enqueueTelegram(user.telegramUserId, `ClawdOS login code: ${challenge.code} (valid 10 min)`)

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
