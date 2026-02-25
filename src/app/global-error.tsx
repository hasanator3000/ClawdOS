'use client'

import { useEffect, useState } from 'react'

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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    if (isStaleClientError(error)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show "updating" before reload
      setReloading(true)
      window.location.reload()
    }
  }, [error])

  // Inline styles intentional — global error replaces the entire document,
  // so the app stylesheet (CSS variables) is NOT available.
  return (
    <html lang="ru">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 40, background: '#06060a', color: '#e2e0ec' }}>
        {reloading ? (
          <p style={{ color: '#5c5a6a' }}>Updating to latest version...</p>
        ) : (
          <>
            <h1 style={{ color: '#fb7185' }}>Client Error</h1>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
                padding: 16,
                borderRadius: 8,
                fontSize: 14,
                color: '#5c5a6a',
              }}
            >
              {error.message}
              {'\n\n'}
              {error.stack}
            </pre>
            {error.digest && <p style={{ color: '#5c5a6a', fontSize: 12 }}>Digest: {error.digest}</p>}
            <button
              onClick={reset}
              style={{
                marginTop: 16,
                padding: '8px 20px',
                background: '#a78bfa',
                color: '#06060a',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Try again
            </button>
          </>
        )}
      </body>
    </html>
  )
}
