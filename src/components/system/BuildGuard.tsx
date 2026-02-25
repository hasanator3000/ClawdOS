'use client'

import { useEffect, useRef } from 'react'

const CHECK_INTERVAL_MS = 3 * 60 * 1000 // 3 minutes

/**
 * Detects when the server has been rebuilt (new build ID) and forces
 * a full page reload so the client picks up new JS chunks and
 * server-action IDs. Without this, stale clients get 500 errors on
 * every server action because the action ID hashes change per build.
 */
export function BuildGuard({ buildId }: { buildId: string }) {
  const initialId = useRef(buildId)

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/build-id', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data.buildId && data.buildId !== initialId.current) {
          // Build changed — force full reload to pick up new chunks + action IDs
          window.location.reload()
        }
      } catch {
        // Network error — ignore, will retry
      }
    }

    // Check periodically
    const timer = setInterval(check, CHECK_INTERVAL_MS)

    // Also check on window focus (user returning to tab)
    function onFocus() {
      void check()
    }
    window.addEventListener('focus', onFocus)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  return null
}
