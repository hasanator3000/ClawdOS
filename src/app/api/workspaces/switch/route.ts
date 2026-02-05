import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSession } from '@/lib/auth/session'
import { getWorkspacesForUser } from '@/lib/workspace'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

export const dynamic = 'force-dynamic'

/**
 * Switch workspace by type (personal/shared).
 * Used by chat fast-path for commands like "открой личные задачи".
 */
export async function POST(request: Request) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { type?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { type } = body
  if (type !== 'personal' && type !== 'shared') {
    return NextResponse.json({ error: 'Invalid type. Must be "personal" or "shared"' }, { status: 400 })
  }

  const workspaces = await getWorkspacesForUser()
  const target = workspaces.find((w) => w.type === type)

  if (!target) {
    return NextResponse.json(
      { error: `No ${type} workspace found`, available: workspaces.map((w) => w.type) },
      { status: 404 }
    )
  }

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, target.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath('/')

  return NextResponse.json({
    switched: true,
    workspace: { id: target.id, name: target.name, type: target.type },
  })
}
