'use server'

import { readFile, writeFile, mkdir } from 'fs/promises'
import { resolve, normalize, dirname } from 'path'
import { getSession } from '@/lib/auth/session'
import { validateAction } from '@/lib/validation'
import { agentFilePathSchema, agentFileContentSchema } from '@/lib/validation-schemas'
import type { FileCategory } from './page'

const AGENT_WORKSPACE = '/root/clawd'
const CLAWDOS_ROOT = '/root/clawd/apps/clawdos'
const CLAUDE_RULES = '/root/.claude/rules'

/** Map relative path prefix → root for read/write operations */
function rootForPath(relativePath: string): string {
  if (relativePath.startsWith('RULES/') || relativePath.startsWith('RULES\\')) return CLAWDOS_ROOT
  if (relativePath.startsWith('claude-rules/') || relativePath.startsWith('claude-rules\\')) return resolve(CLAUDE_RULES, '..')
  return AGENT_WORKSPACE
}

/** Validate and resolve a relative path within the appropriate root. Returns full path or error. */
function resolveSafePath(relativePath: string, root?: string): { fullPath: string } | { error: string } {
  const normalized = normalize(relativePath)

  if (normalized.startsWith('..') || normalized.includes('/../') || normalized.startsWith('/')) {
    return { error: 'Invalid path' }
  }

  const blocked = ['.credentials', '.git', '.env', 'node_modules', '.next']
  for (const b of blocked) {
    if (normalized.startsWith(b)) return { error: 'Access denied' }
  }

  const baseDir = root ?? rootForPath(relativePath)
  const fullPath = resolve(baseDir, normalized)
  if (!fullPath.startsWith(baseDir)) return { error: 'Invalid path' }

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

/** Allowed directories for creating new files, keyed by category */
const CREATABLE_DIRS: Record<string, { root: string; prefix: string }> = {
  'agent-core': { root: AGENT_WORKSPACE, prefix: '' },
  'agent-rules': { root: AGENT_WORKSPACE, prefix: 'rules' },
  'clawdos-rules': { root: CLAWDOS_ROOT, prefix: 'RULES' },
  'memory': { root: AGENT_WORKSPACE, prefix: 'memory' },
  'config': { root: AGENT_WORKSPACE, prefix: 'config' },
  'claude-rules': { root: resolve(CLAUDE_RULES, '..'), prefix: 'rules' },
}

export async function createAgentFile(
  category: FileCategory,
  fileName: string,
  content: string
): Promise<{ ok: true; path: string } | { error: string }> {
  const session = await getSession()
  if (!session.userId) return { error: 'Unauthorized' }

  // Validate file name
  const nameV = validateAction(agentFilePathSchema, fileName)
  if (nameV.error) return { error: nameV.error }

  const contentV = validateAction(agentFileContentSchema, content)
  if (contentV.error) return { error: contentV.error }

  const dirInfo = CREATABLE_DIRS[category]
  if (!dirInfo) return { error: `Cannot create files in category: ${category}` }

  // Build the relative path from category prefix + fileName
  const relativePath = dirInfo.prefix ? `${dirInfo.prefix}/${fileName}` : fileName

  const resolved = resolveSafePath(relativePath, dirInfo.root)
  if ('error' in resolved) return resolved

  // Ensure parent directory exists
  try {
    await mkdir(dirname(resolved.fullPath), { recursive: true })
  } catch {
    return { error: 'Failed to create directory' }
  }

  // Check if file already exists
  try {
    await readFile(resolved.fullPath)
    return { error: 'File already exists' }
  } catch {
    // Good — file doesn't exist yet
  }

  try {
    await writeFile(resolved.fullPath, content, 'utf-8')
    return { ok: true, path: relativePath }
  } catch {
    return { error: 'Failed to create file' }
  }
}
