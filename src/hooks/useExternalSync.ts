'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Revisions = Record<string, number>

const POLL_INTERVAL = 3_000 // 3 seconds

/**
 * Polls /api/revision every 3s and calls router.refresh() when
 * any domain revision changes. This catches mutations from webhooks,
 * Telegram, other browser tabs, background cron, etc.
 *
 * Zero impact when nothing changes — just a tiny JSON fetch.
 * When something does change, Next.js re-fetches RSC data and
 * React reconciles the DOM (existing client state preserved).
 */
export function useExternalSync() {
  const router = useRouter()
  const lastRef = useRef<Revisions | null>(null)
  const visibleRef = useRef(true)

  useEffect(() => {
    // Track tab visibility — don't poll when hidden
    const handleVisibility = () => {
      visibleRef.current = document.visibilityState === 'visible'
      // Immediate check when tab becomes visible again
      if (visibleRef.current) poll()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    async function poll() {
      if (!visibleRef.current) return

      try {
        const res = await fetch('/api/revision', { cache: 'no-store' })
        if (!res.ok) return

        const current: Revisions = await res.json()

        if (lastRef.current === null) {
          // First poll — just save baseline, don't refresh
          lastRef.current = current
          return
        }

        // Check if any domain changed
        const changed = Object.keys(current).some(
          (key) => current[key] !== lastRef.current![key]
        )

        if (changed) {
          lastRef.current = current
          router.refresh()
        }
      } catch {
        // Network error — skip this cycle
      }
    }

    // Initial baseline fetch
    poll()

    const interval = setInterval(poll, POLL_INTERVAL)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [router])
}
