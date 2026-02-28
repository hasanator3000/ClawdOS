'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { verifyUser, createAuthChallenge, enqueueTelegram } from '@/lib/auth'
import { withUser } from '@/lib/db'
import { findWorkspacesByUserId } from '@/lib/db/repositories/workspace.repository'
import { signInSchema } from '@/lib/validation-schemas'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'

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

  // Set active workspace cookie to the user's first workspace (personal > shared)
  // so stale cookies from a previous user session never carry over.
  const workspaces = await withUser(user.id, (client) => findWorkspacesByUserId(client))
  if (workspaces.length > 0) {
    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaces[0].id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  }

  redirect('/today')
}

export async function signOut() {
  const session = await getSession()
  session.destroy()

  // Clear the workspace cookie so it doesn't leak into the next user session
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE)

  redirect('/login')
}
