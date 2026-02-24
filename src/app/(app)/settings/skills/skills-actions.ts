'use server'

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { exec } from 'child_process'
import { skillSlugSchema } from '@/lib/validation-schemas'

const WORKSPACE_SKILLS_DIR = '/root/clawd/skills'
const BUNDLED_SKILLS_DIR = '/usr/lib/node_modules/clawdbot/skills'
const CLAWDHUB_CWD = '/root/clawd'

export interface InstalledSkill {
  slug: string
  name: string
  description: string
  source: 'workspace' | 'bundled'
  hasLicense: boolean
}

/** Parse YAML frontmatter from SKILL.md */
function parseFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const lines = match[1].split('\n')
  const result: Record<string, string> = {}

  for (const line of lines) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let val = line.slice(colonIdx + 1).trim()
    // Remove surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    result[key] = val
  }

  return { name: result.name, description: result.description }
}

async function readSkillsFromDir(
  dir: string,
  source: 'workspace' | 'bundled'
): Promise<InstalledSkill[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const skills: InstalledSkill[] = []

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const skillDir = join(dir, entry.name)
      try {
        const skillMd = await readFile(join(skillDir, 'SKILL.md'), 'utf-8')
        const fm = parseFrontmatter(skillMd)
        const hasLicense = await readFile(join(skillDir, 'LICENSE.txt'), 'utf-8')
          .then(() => true)
          .catch(() => false)

        skills.push({
          slug: entry.name,
          name: fm.name || entry.name,
          description: fm.description || '',
          source,
          hasLicense,
        })
      } catch {
        // No SKILL.md — still list it
        skills.push({
          slug: entry.name,
          name: entry.name,
          description: '',
          source,
          hasLicense: false,
        })
      }
    }

    return skills
  } catch {
    return []
  }
}

export async function getInstalledSkills(): Promise<{
  workspace: InstalledSkill[]
  bundled: InstalledSkill[]
}> {
  const [workspace, bundled] = await Promise.all([
    readSkillsFromDir(WORKSPACE_SKILLS_DIR, 'workspace'),
    readSkillsFromDir(BUNDLED_SKILLS_DIR, 'bundled'),
  ])

  return {
    workspace: workspace.sort((a, b) => a.name.localeCompare(b.name)),
    bundled: bundled.sort((a, b) => a.name.localeCompare(b.name)),
  }
}

function runClawdhub(args: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    exec(`clawdhub ${args}`, { cwd: CLAWDHUB_CWD, timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) {
        resolve({ ok: false, output: stderr || err.message })
      } else {
        resolve({ ok: true, output: stdout })
      }
    })
  })
}

export async function installSkill(slug: string): Promise<{ ok: boolean; output: string }> {
  const parsed = skillSlugSchema.safeParse(slug)
  if (!parsed.success) return { ok: false, output: 'Invalid skill slug' }
  return runClawdhub(`install ${parsed.data} --no-input`)
}

export async function updateSkill(slug: string): Promise<{ ok: boolean; output: string }> {
  const parsed = skillSlugSchema.safeParse(slug)
  if (!parsed.success) return { ok: false, output: 'Invalid skill slug' }
  return runClawdhub(`update ${parsed.data} --no-input`)
}
