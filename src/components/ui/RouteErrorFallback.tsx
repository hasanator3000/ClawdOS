'use client'

import { useEffect, useState } from 'react'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('RouteError')

interface RouteErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
}

function isStaleClientError(error: Error): boolean {
  const msg = error.message || ''
  return (
    msg.includes('Failed to find Server Action') ||
    msg.includes('Failed to fetch') ||
    msg.includes('ChunkLoadError') ||
    msg.includes('Loading chunk') ||
    msg.includes('dynamically imported module')
  )
}

export function RouteErrorFallback({ error, reset }: RouteErrorFallbackProps) {
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    log.error(error.message, { digest: error.digest })

    if (isStaleClientError(error)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show "updating" before reload
      setReloading(true)
      window.location.reload()
    }
  }, [error])

  if (reloading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 max-w-md mx-auto mt-12 text-center">
        <p className="text-sm text-[var(--muted)]">Updating to latest version...</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 max-w-md mx-auto mt-12 text-center">
      <svg
        className="mx-auto mb-4 text-[var(--red)]"
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx={12} cy={12} r={10} />
        <line x1={12} y1={8} x2={12} y2={12} />
        <line x1={12} y1={16} x2={12.01} y2={16} />
      </svg>

      <h2 className="text-lg font-semibold text-[var(--fg)] mb-2">
        Something went wrong
      </h2>

      <p className="text-sm text-[var(--muted)] mb-1">
        {error.message?.slice(0, 200) || 'An unexpected error occurred.'}
      </p>

      {error.digest && (
        <p className="text-xs text-[var(--muted)] font-mono mb-4">
          Digest: {error.digest}
        </p>
      )}

      <button
        onClick={reset}
        className="mt-4 bg-[var(--neon)] text-[var(--bg)] px-5 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  )
}
