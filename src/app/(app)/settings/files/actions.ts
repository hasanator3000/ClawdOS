'use server'

import { readFile, writeFile } from 'fs/promises'
import { resolve, normalize } from 'path'
import { getSession } from '@/lib/auth/session'
import { validateAction } from '@/lib/validation'
import { agentFilePathSchema, agentFileContentSchema } from '@/lib/validation-schemas'

const WORKSPACE = '/root/clawd'

/** Validate and resolve a relative path within the workspace. Returns full path or error. */
function resolveSafePath(relativePath: string): { fullPath: string } | { error: string } {
  const normalized = normalize(relativePath)

  if (normalized.startsWith('..') || normalized.includes('/../') || normalized.startsWith('/')) {
    return { error: 'Invalid path' }
  }

  if (normalized.startsWith('.credentials') || normalized.startsWith('.git')) {
    return { error: 'Access denied' }
  }

  const fullPath = resolve(WORKSPACE, normalized)
  if (!fullPath.startsWith(WORKSPACE)) return { error: 'Invalid path' }

  return { fullPath }
}

export async function readAgentFile(relativePath: string): Promise<{ name: string; content: string } | { error: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const v = validateAction(agentFilePathSchema, relativePath)
  if (v.error) return { error: v.error }

  const resolved = resolveSafePath(relativePath)
  if ('error' in resolved) return resolved

  try {
    const content = await readFile(resolved.fullPath, 'utf-8')
    const name = normalize(relativePath).split('/').pop() || relativePath
    return { name, content }
  } catch {
    return { error: 'File not found' }
  }
}

export async function writeAgentFile(
  relativePath: string,
  content: string
): Promise<{ ok: true } | { error: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  const pathV = validateAction(agentFilePathSchema, relativePath)
  if (pathV.error) return { error: pathV.error }

  const contentV = validateAction(agentFileContentSchema, content)
  if (contentV.error) return { error: contentV.error }

  const resolved = resolveSafePath(relativePath)
  if ('error' in resolved) return resolved

  try {
    await writeFile(resolved.fullPath, content, 'utf-8')
    return { ok: true }
  } catch {
    return { error: 'Failed to write file' }
  }
}
