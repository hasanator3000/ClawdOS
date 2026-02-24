'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ACTIVE_WORKSPACE_COOKIE } from '@/lib/constants'
import { getWorkspacesForUser } from '@/lib/workspace'
import { validateAction } from '@/lib/validation'
import { workspaceIdSchema } from '@/lib/validation-schemas'

export async function setActiveWorkspace(workspaceId: string) {
  const v = validateAction(workspaceIdSchema, workspaceId)
  if (v.error) throw new Error('Invalid workspace ID')

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
