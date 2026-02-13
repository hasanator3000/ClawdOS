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
      <h2 style={{ color: 'var(--red, #fb7185)', marginBottom: 12, fontWeight: 600 }}>Something went wrong</h2>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          background: 'var(--card, rgba(255,255,255,0.04))',
          border: '1px solid var(--border, rgba(255,255,255,0.07))',
          padding: 16,
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--muted, #5c5a6a)',
          fontFamily: 'var(--font-space-mono, monospace)',
        }}
      >
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      {error.digest && (
        <p style={{ color: 'var(--muted, #5c5a6a)', fontSize: 12, marginTop: 8 }}>Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        style={{
          marginTop: 16,
          padding: '8px 20px',
          background: 'var(--neon, #a78bfa)',
          color: 'var(--bg, #06060a)',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 500,
        }}
      >
        Try again
      </button>
    </div>
  )
}
