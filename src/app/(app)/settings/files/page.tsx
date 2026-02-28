import { redirect } from 'next/navigation'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { getSession } from '@/lib/auth/session'
import { FilesList } from './FilesList'

export const dynamic = 'force-dynamic'

const AGENT_WORKSPACE = '/root/clawd'
const CLAWDOS_ROOT = '/root/clawd/apps/clawdos'
const CLAUDE_RULES = '/root/.claude/rules'

export type FileCategory =
  | 'agent-core'
  | 'agent-rules'
  | 'clawdos-rules'
  | 'skills'
  | 'memory'
  | 'config'
  | 'claude-rules'

export type AgentFile = {
  name: string
  /** Path relative to its root directory — used by actions.ts to resolve full path */
  path: string
  category: FileCategory
  size: string
  modified: string
  readOnly?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function safeReaddir(dir: string): Promise<string[]> {
  try { return await readdir(dir) } catch { return [] }
}

async function safeStat(path: string) {
  try { return await stat(path) } catch { return null }
}

async function collectDir(
  dir: string,
  category: FileCategory,
  pathPrefix: string,
  opts?: { readOnly?: boolean; namePrefix?: string; recurse?: boolean }
): Promise<AgentFile[]> {
  const files: AgentFile[] = []
  const entries = await safeReaddir(dir)

  for (const entry of entries) {
    const full = join(dir, entry)
    const s = await safeStat(full)
    if (!s) continue

    if (s.isDirectory() && opts?.recurse) {
      const sub = await collectDir(full, category, join(pathPrefix, entry), opts)
      files.push(...sub)
    } else if (s.isFile()) {
      const displayName = opts?.namePrefix ? `${opts.namePrefix}${entry}` : entry
      files.push({
        name: displayName,
        path: join(pathPrefix, entry),
        category,
        size: formatSize(s.size),
        modified: s.mtime.toISOString(),
        readOnly: opts?.readOnly,
      })
    }
  }
  return files
}

async function collectFiles(): Promise<AgentFile[]> {
  const groups = await Promise.all([
    // Agent Core: /root/clawd/*.md
    (async () => {
      const entries = await safeReaddir(AGENT_WORKSPACE)
      const files: AgentFile[] = []
      for (const e of entries) {
        if (!e.endsWith('.md')) continue
        const s = await safeStat(join(AGENT_WORKSPACE, e))
        if (s?.isFile()) {
          files.push({ name: e, path: e, category: 'agent-core', size: formatSize(s.size), modified: s.mtime.toISOString() })
        }
      }
      return files
    })(),

    // Agent Rules: /root/clawd/rules/
    collectDir(join(AGENT_WORKSPACE, 'rules'), 'agent-rules', 'rules'),

    // ClawdOS Rules: RULES/ in project
    collectDir(join(CLAWDOS_ROOT, 'RULES'), 'clawdos-rules', 'RULES'),

    // Workspace Skills: /root/clawd/skills/*/SKILL.md
    (async () => {
      const files: AgentFile[] = []
      const dirs = await safeReaddir(join(AGENT_WORKSPACE, 'skills'))
      for (const dir of dirs) {
        const skillPath = join('skills', dir, 'SKILL.md')
        const s = await safeStat(join(AGENT_WORKSPACE, skillPath))
        if (s?.isFile()) {
          files.push({ name: `${dir}/SKILL.md`, path: skillPath, category: 'skills', size: formatSize(s.size), modified: s.mtime.toISOString() })
        }
      }
      return files
    })(),

    // Memory: /root/clawd/memory/ (recursive)
    collectDir(join(AGENT_WORKSPACE, 'memory'), 'memory', 'memory', { recurse: true }),

    // Config: /root/clawd/config/
    collectDir(join(AGENT_WORKSPACE, 'config'), 'config', 'config'),

    // Claude Rules: ~/.claude/rules/
    collectDir(CLAUDE_RULES, 'claude-rules', 'claude-rules'),
  ])

  return groups.flat().sort((a, b) => a.name.localeCompare(b.name))
}

export default async function FilesPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const files = await collectFiles()

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between pr-12">
        <h1 className="text-xl font-semibold">Agent Files</h1>
        <div className="text-sm text-[var(--muted)]">{files.length} files</div>
      </div>
      <div className="text-sm text-[var(--muted)]">
        Browse and edit agent workspace files — identity, rules, skills, memory, and configuration.
      </div>
      <FilesList files={files} />
    </div>
  )
}
