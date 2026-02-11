'use client'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: 40 }}>
      <h2 style={{ color: '#f55', marginBottom: 12 }}>Something went wrong</h2>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: 'var(--hover, #222)', padding: 16, borderRadius: 8, fontSize: 13 }}>
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      {error.digest && <p style={{ color: 'var(--muted, #888)', fontSize: 12 }}>Digest: {error.digest}</p>}
      <button
        onClick={reset}
        style={{ marginTop: 16, padding: '8px 20px', background: 'var(--card, #333)', color: 'var(--fg, #eee)', border: '1px solid var(--border, #555)', borderRadius: 6, cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  )
}
