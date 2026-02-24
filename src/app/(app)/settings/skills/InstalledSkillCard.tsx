'use client'

import { useState } from 'react'
import type { InstalledSkill } from './skills-actions'
import { updateSkill } from './skills-actions'

interface InstalledSkillCardProps {
  skill: InstalledSkill
  onUpdated: () => void
}

export function InstalledSkillCard({ skill, onUpdated }: InstalledSkillCardProps) {
  const [updating, setUpdating] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; output: string } | null>(null)

  const handleUpdate = async () => {
    setUpdating(true)
    setResult(null)
    const res = await updateSkill(skill.slug)
    setResult(res)
    setUpdating(false)
    if (res.ok) onUpdated()
  }

  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--fg)]">{skill.name}</h3>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs ${
            skill.source === 'workspace'
              ? 'bg-[var(--neon-dim)] text-[var(--neon)]'
              : 'bg-[var(--surface)] text-[var(--muted)]'
          }`}
        >
          {skill.source === 'workspace' ? 'workspace' : 'built-in'}
        </span>
      </div>

      {/* Description */}
      <p className="mt-2 line-clamp-3 flex-1 text-xs text-[var(--muted)]">
        {skill.description || 'No description available'}
      </p>

      {/* Slug */}
      <div className="mt-3 text-xs font-mono text-[var(--muted-2)]">{skill.slug}</div>

      {/* Actions for workspace skills */}
      {skill.source === 'workspace' && (
        <div className="mt-2 border-t border-[var(--border)] pt-2">
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="rounded bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition-colors hover:text-[var(--fg)] disabled:opacity-50"
          >
            {updating ? 'Updating...' : 'Check for update'}
          </button>

          {result && (
            <div
              className={`mt-1.5 rounded px-2 py-1 text-[10px] ${
                result.ok
                  ? 'bg-[var(--success-bg)] text-[var(--success-fg)]'
                  : 'bg-[var(--error-bg)] text-[var(--error-fg)]'
              }`}
            >
              {result.output.slice(0, 200)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
