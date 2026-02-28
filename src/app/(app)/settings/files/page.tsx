import { redirect } from 'next/navigation'
import { readdir, stat } from 'fs/promises'
import { join } from 'path'
import { getSession } from '@/lib/auth/session'
import { FilesList } from './FilesList'

export const dynamic = 'force-dynamic'

const WORKSPACE = '/root/clawd'

export type AgentFile = {
  name: string
  path: string
  category: 'core' | 'skills' | 'memory' | 'config' | 'rules'
  size: string
  modified: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function collectFiles(): Promise<AgentFile[]> {
  const files: AgentFile[] = []

  // Core .md files in root
  const rootEntries = await readdir(WORKSPACE)
  for (const entry of rootEntries) {
    if (!entry.endsWith('.md')) continue
    try {
      const s = await stat(join(WORKSPACE, entry))
      if (!s.isFile()) continue
      files.push({ name: entry, path: entry, category: 'core', size: formatSize(s.size), modified: s.mtime.toISOString() })
    } catch { /* skip */ }
  }

  // Skills: skills/*/SKILL.md
  try {
    const skillDirs = await readdir(join(WORKSPACE, 'skills'))
    for (const dir of skillDirs) {
      const skillPath = join('skills', dir, 'SKILL.md')
      try {
        const s = await stat(join(WORKSPACE, skillPath))
        if (s.isFile()) {
          files.push({ name: `${dir}/SKILL.md`, path: skillPath, category: 'skills', size: formatSize(s.size), modified: s.mtime.toISOString() })
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  // Memory
  async function walkMemory(dir: string, relPrefix: string) {
    try {
      const entries = await readdir(join(WORKSPACE, dir))
      for (const entry of entries) {
        const rel = join(relPrefix, entry)
        const full = join(WORKSPACE, dir, entry)
        try {
          const s = await stat(full)
          if (s.isDirectory()) {
            await walkMemory(join(dir, entry), rel)
          } else if (s.isFile()) {
            files.push({ name: rel, path: join(dir, entry), category: 'memory', size: formatSize(s.size), modified: s.mtime.toISOString() })
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  await walkMemory('memory', '')

  // Rules (agent behavior files, loaded into system prompt)
  try {
    const rulesEntries = await readdir(join(WORKSPACE, 'rules'))
    for (const entry of rulesEntries) {
      try {
        const s = await stat(join(WORKSPACE, 'rules', entry))
        if (s.isFile()) {
          files.push({ name: entry, path: join('rules', entry), category: 'rules', size: formatSize(s.size), modified: s.mtime.toISOString() })
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  // Config
  try {
    const configEntries = await readdir(join(WORKSPACE, 'config'))
    for (const entry of configEntries) {
      try {
        const s = await stat(join(WORKSPACE, 'config', entry))
        if (s.isFile()) {
          files.push({ name: entry, path: join('config', entry), category: 'config', size: formatSize(s.size), modified: s.mtime.toISOString() })
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }

  return files.sort((a, b) => a.name.localeCompare(b.name))
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
        Workspace files from Clawdbot agent. Core identity, skills, memory, rules, and configuration.
      </div>
      <FilesList files={files} />
    </div>
  )
}
