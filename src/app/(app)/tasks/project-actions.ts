'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { createLogger } from '@/lib/logger'
import { validateAction } from '@/lib/validation'
import { projectNameSchema, uuidSchema } from '@/lib/validation-schemas'
import {
  createProject as createProjectRepo,
  getProjectsByWorkspace,
  deleteProject as deleteProjectRepo,
  type Project,
} from '@/lib/db/repositories/project.repository'

const log = createLogger('project-actions')

export async function fetchProjects(): Promise<{ projects?: Project[]; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace' }

  try {
    const projects = await withUser(session.userId, async (client) => {
      return getProjectsByWorkspace(client, workspace.id)
    })
    return { projects }
  } catch (error) {
    log.error('fetchProjects failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to fetch projects' }
  }
}

export async function createProject(name: string): Promise<{ project?: Project; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const v = validateAction(projectNameSchema, name)
  if (v.error) return { error: v.error }

  const workspace = await getActiveWorkspace()
  if (!workspace) return { error: 'No workspace' }

  const trimmed = name.trim()

  try {
    const project = await withUser(session.userId, async (client) => {
      return createProjectRepo(client, workspace.id, trimmed)
    })
    revalidatePath('/tasks')
    return { project }
  } catch (error) {
    log.error('createProject failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to create project' }
  }
}

export async function deleteProject(projectId: string): Promise<{ success?: boolean; error?: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const idV = validateAction(uuidSchema, projectId)
  if (idV.error) return { error: 'Invalid project ID' }

  try {
    const deleted = await withUser(session.userId, async (client) => {
      return deleteProjectRepo(client, projectId)
    })
    if (!deleted) return { error: 'Project not found' }
    revalidatePath('/tasks')
    return { success: true }
  } catch (error) {
    log.error('deleteProject failed', { error: error instanceof Error ? error.message : String(error) })
    return { error: 'Failed to delete project' }
  }
}
