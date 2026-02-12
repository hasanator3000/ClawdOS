'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'
import { getWorkspacesForUser } from '@/lib/workspace'

// UUID v4 regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function setActiveWorkspace(workspaceId: string) {
  // Validate UUID format to prevent injection
  if (!UUID_REGEX.test(workspaceId)) {
    throw new Error('Invalid workspace ID')
  }

  // Verify user has access to this workspace (IDOR protection)
  const workspaces = await getWorkspacesForUser()
  const hasAccess = workspaces.some((w) => w.id === workspaceId)

  if (!hasAccess) {
    throw new Error('Access denied')
  }

  const cookieStore = await cookies()

  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  // Revalidate only the pages that depend on workspace data.
  // Using '/' would nuke the entire RSC cache and cause full re-render of all pages.
  revalidatePath('/today')
  revalidatePath('/tasks')
  revalidatePath('/news')
  revalidatePath('/settings')
}
