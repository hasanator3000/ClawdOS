import type { Skill } from '@/lib/clawdbot/skills-registry'

interface SkillCardProps {
  skill: Skill
}

export function SkillCard({ skill }: SkillCardProps) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      {/* Header row: name + category badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--fg)]">{skill.name}</h3>
        <span className="inline-block shrink-0 rounded bg-[var(--neon-dim)] px-2 py-1 text-xs text-[var(--neon)]">
          {skill.category}
        </span>
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-[var(--muted)]">{skill.description}</p>

      {/* Examples */}
      <div className="mt-3">
        <div className="text-xs font-medium text-[var(--fg)]">Examples:</div>
        <ul className="mt-1 space-y-1">
          {skill.examples.map((example, i) => (
            <li key={i} className="text-xs text-[var(--muted-2)]">
              • {example}
            </li>
          ))}
        </ul>
      </div>

      {/* Action type (if present) */}
      {skill.actionType && (
        <div className="mt-3 border-t border-[var(--border)] pt-2">
          <span className="text-xs text-[var(--cyan)]">Action: {skill.actionType}</span>
        </div>
      )}
    </div>
  )
}
