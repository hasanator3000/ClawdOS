'use client'

import { useState, useEffect, useCallback } from 'react'

interface VersionInfo {
  current: string
  latest: string
  updateAvailable: boolean
}

const POLL_INTERVAL = 30 * 60 * 1000 // 30 minutes

export function UpdateBanner() {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/version')
      if (!res.ok) return
      const data: VersionInfo = await res.json()
      setInfo(data)
    } catch {
      // Silently ignore — banner just won't show
    }
  }, [])

  useEffect(() => {
    checkVersion()
    const id = setInterval(checkVersion, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [checkVersion])

  const handleUpdate = async () => {
    setUpdating(true)
    setError(null)
    try {
      const res = await fetch('/api/system/update', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Update failed')
        setUpdating(false)
        return
      }
      // Update started — show status message
      // The server will restart, so eventually the page will reconnect
    } catch {
      setError('Failed to start update')
      setUpdating(false)
    }
  }

  const handleDismiss = () => {
    if (info) setDismissed(info.latest)
  }

  // Don't render if no update available or dismissed this version
  if (!info?.updateAvailable) return null
  if (dismissed === info.latest) return null

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm mb-4"
      style={{
        background: 'rgba(167, 139, 250, 0.08)',
        border: '1px solid rgba(167, 139, 250, 0.2)',
        color: 'var(--fg)',
      }}
    >
      {/* Icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--neon)', flexShrink: 0 }}
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>

      {/* Message */}
      <span className="flex-1">
        {updating ? (
          <span style={{ color: 'var(--neon)' }}>Updating... Server will restart shortly.</span>
        ) : error ? (
          <span style={{ color: 'var(--error, #ef4444)' }}>{error}</span>
        ) : (
          <>
            Update available:{' '}
            <span style={{ color: 'var(--muted)' }}>v{info.current}</span>
            {' → '}
            <span style={{ color: 'var(--neon)' }}>v{info.latest}</span>
          </>
        )}
      </span>

      {/* Actions */}
      {!updating && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleUpdate}
            className="px-3 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: 'var(--neon-dim)',
              color: 'var(--neon)',
              border: '1px solid var(--neon)',
            }}
          >
            Update
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded transition-colors hover:bg-[var(--hover)]"
            style={{ color: 'var(--muted)' }}
            aria-label="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
