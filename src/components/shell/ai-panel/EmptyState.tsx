'use client'

/* Empty state with bot orb and hint chips */
export function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 text-[var(--muted)]" >
      {/* Large orb */}
      <div className="relative mb-6" style={{ width: 64, height: 64 }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(var(--neon), var(--pink), var(--cyan), var(--neon))',
            animation: 'spin 4s linear infinite',
            opacity: 0.6,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            inset: 3,
            background: 'var(--bg)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 14,
            height: 14,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--neon)',
            boxShadow: '0 0 12px var(--neon-glow), 0 0 24px var(--neon-glow)',
            animation: 'orbPulse 2s ease-in-out infinite',
          }}
        />
      </div>

      <div className="font-semibold text-sm mb-1 text-[var(--fg)]" >
        Clawdbot
      </div>
      <div className="text-xs text-center mb-5 max-w-[220px] text-[var(--muted)]" >
        Your AI assistant for tasks, questions, and everything in between.
      </div>

      {/* Hint chips */}
      <div className="flex flex-wrap gap-2 justify-center max-w-[260px]">
        {['Create a task', 'Summarize my day', 'What can you do?'].map((hint) => (
          <HintChip key={hint} label={hint} />
        ))}
      </div>
    </div>
  )
}

function HintChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="px-3 py-1.5 rounded-full text-xs transition-colors bg-[var(--card)] border border-[var(--border)] text-[var(--muted)] hover:border-[var(--neon-dim)] hover:text-[var(--neon)] hover:bg-[var(--neon-dim)]"
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent('clawdos:ai-prefill', { detail: { message: label } })
        )
      }}
    >
      {label}
    </button>
  )
}
