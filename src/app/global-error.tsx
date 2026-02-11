'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ru">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 40, background: '#06060a', color: '#e2e0ec' }}>
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
      </body>
    </html>
  )
}
