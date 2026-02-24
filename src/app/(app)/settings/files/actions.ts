'use server'

import { readFile } from 'fs/promises'
import { resolve, normalize } from 'path'
import { getSession } from '@/lib/auth/session'
import { validateAction } from '@/lib/validation'
import { agentFilePathSchema } from '@/lib/validation-schemas'

const WORKSPACE = '/root/clawd'

export async function readAgentFile(relativePath: string): Promise<{ name: string; content: string } | { error: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }
  const v = validateAction(agentFilePathSchema, relativePath)
  if (v.error) return { error: v.error }

  // Prevent path traversal
  const normalized = normalize(relativePath)
  if (normalized.startsWith('..') || normalized.includes('/../') || normalized.startsWith('/')) {
    return { error: 'Invalid path' }
  }

  // Block sensitive paths
  if (normalized.startsWith('.credentials') || normalized.startsWith('.git')) {
    return { error: 'Access denied' }
  }

  const fullPath = resolve(WORKSPACE, normalized)
  if (!fullPath.startsWith(WORKSPACE)) return { error: 'Invalid path' }

  try {
    const content = await readFile(fullPath, 'utf-8')
    const name = normalized.split('/').pop() || normalized
    return { name, content }
  } catch {
    return { error: 'File not found' }
  }
}
