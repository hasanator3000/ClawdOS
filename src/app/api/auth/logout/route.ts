import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'

export async function POST() {
  const session = await getSession()
  session.destroy()

  // Clear the workspace cookie so it doesn't leak into the next user session
  const cookieStore = await cookies()
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE)

  return Response.json({ ok: true })
}
