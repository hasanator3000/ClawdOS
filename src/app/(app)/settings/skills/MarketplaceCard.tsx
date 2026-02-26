'use client'

import { useState } from 'react'
import type { MarketplaceSkill } from './marketplace-actions'
import { installSkill } from './skills-actions'

interface MarketplaceCardProps {
  skill: MarketplaceSkill
  isInstalled: boolean
  onInstalled: () => void
}

function securityColor(score: number) {
  if (score >= 80) return { text: 'var(--green)', bg: 'rgba(110,231,183,0.1)' }
  if (score >= 60) return { text: 'var(--warm)', bg: 'rgba(251,191,36,0.1)' }
  return { text: 'var(--red)', bg: 'rgba(251,113,133,0.1)' }
}

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export function MarketplaceCard({ skill, isInstalled, onInstalled }: MarketplaceCardProps) {
  const sec = securityColor(skill.security.score)
  const [installing, setInstalling] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; output: string } | null>(null)

  const handleInstall = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setInstalling(true)
    setResult(null)
    const res = await installSkill(skill.slug)
    setResult(res)
    setInstalling(false)
    if (res.ok) onInstalled()
  }

  return (
    <div className="group relative flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition-colors hover:border-[var(--neon-dim)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-[var(--fg)]">
            {skill.name}
          </h3>
          <div className="mt-0.5 text-sm text-[var(--muted)]">
            by {skill.author}
          </div>
        </div>
        {/* Security score badge */}
        <span
          className="shrink-0 rounded-md px-2 py-1 text-xs font-mono font-medium"
          style={{ color: sec.text, background: sec.bg }}
        >
          {skill.security.score}
        </span>
      </div>

      {/* Description */}
      <p className="mt-2 line-clamp-2 flex-1 text-sm text-[var(--muted)]">
        {skill.description || 'No description'}
      </p>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-3 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {formatDownloads(skill.downloads)}
        </span>

        <span className="flex items-center gap-1">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          {skill.stars}
        </span>

        <span className="font-mono text-[var(--muted-2)]">v{skill.version}</span>

        {skill.community.is_verified && (
          <span className="rounded bg-[var(--cyan-dim)] px-1.5 py-0.5 text-[var(--cyan)]">
            verified
          </span>
        )}
        {skill.community.is_featured && (
          <span className="rounded bg-[var(--pink-dim)] px-1.5 py-0.5 text-[var(--pink)]">
            featured
          </span>
        )}
      </div>

      {/* Security flags */}
      {skill.security.flags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {skill.security.flags.slice(0, 3).map((flag) => (
            <span
              key={flag}
              className="rounded px-1.5 py-0.5 text-[10px] text-[var(--muted)] bg-[var(--surface)]"
            >
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
          {skill.security.flags.length > 3 && (
            <span className="text-[10px] text-[var(--muted)]">
              +{skill.security.flags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Install row */}
      <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2">
        <a
          href={skill.clawdtm_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
        >
          Details
        </a>

        {isInstalled ? (
          <span className="rounded bg-[var(--success-bg)] px-2 py-1 text-xs text-[var(--success-fg)]">
            Installed
          </span>
        ) : (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="relative z-10 rounded bg-[var(--neon-dim)] px-3 py-1 text-xs font-medium text-[var(--neon)] transition-colors hover:bg-[var(--neon-glow)] disabled:opacity-50"
          >
            {installing ? 'Installing...' : 'Install'}
          </button>
        )}
      </div>

      {/* Install result feedback */}
      {result && !result.ok && (
        <div className="mt-2 rounded bg-[var(--error-bg)] px-2 py-1 text-[10px] text-[var(--error-fg)]">
          {result.output.slice(0, 200)}
        </div>
      )}
    </div>
  )
}
