'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import {
  createProcess,
  toggleProcess,
  updateProcess,
  deleteProcess,
  type CreateProcessParams,
  type UpdateProcessParams,
} from '@/lib/db/repositories/process.repository'
import { createLogger } from '@/lib/logger'

const log = createLogger('today-actions')

export async function createProcessAction(
  params: Omit<CreateProcessParams, 'workspaceId'>
) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  const workspace = await getActiveWorkspace()
  if (!workspace) {
    return { error: 'No workspace selected' }
  }

  try {
    const process = await withUser(session.userId, async (client) => {
      return createProcess(client, {
        ...params,
        workspaceId: workspace.id,
      })
    })

    revalidatePath('/today')
    return { data: process }
  } catch (error) {
    log.error('Create process failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to create process' }
  }
}

export async function toggleProcessAction(id: string) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const process = await withUser(session.userId, async (client) => {
      return toggleProcess(client, id)
    })

    if (!process) {
      return { error: 'Process not found' }
    }

    revalidatePath('/today')
    return { success: true, data: process }
  } catch (error) {
    log.error('Toggle process failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to toggle process' }
  }
}

export async function updateProcessAction(
  id: string,
  params: UpdateProcessParams
) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const process = await withUser(session.userId, async (client) => {
      return updateProcess(client, id, params)
    })

    if (!process) {
      return { error: 'Process not found' }
    }

    revalidatePath('/today')
    return { data: process }
  } catch (error) {
    log.error('Update process failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to update process' }
  }
}

export async function deleteProcessAction(id: string) {
  const session = await getSession()
  if (!session.userId) {
    return { error: 'Unauthorized' }
  }

  try {
    const deleted = await withUser(session.userId, async (client) => {
      return deleteProcess(client, id)
    })

    if (!deleted) {
      return { error: 'Process not found' }
    }

    revalidatePath('/today')
    return { success: true }
  } catch (error) {
    log.error('Delete process failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to delete process' }
  }
}
