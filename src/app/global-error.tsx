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
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 40, background: '#111', color: '#eee' }}>
        <h1 style={{ color: '#f55' }}>Client Error</h1>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#222', padding: 16, borderRadius: 8, fontSize: 14 }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        {error.digest && <p style={{ color: '#888' }}>Digest: {error.digest}</p>}
        <button
          onClick={reset}
          style={{ marginTop: 16, padding: '8px 20px', background: '#333', color: '#eee', border: '1px solid #555', borderRadius: 6, cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  )
}
