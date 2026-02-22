'use client'

export function AgentMetricsWidget() {
  // TODO: Wire to real Clawdbot metrics in Phase 3

  return (
    <div
      className="p-6 rounded-2xl"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      <h3 className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
        Agent Status
      </h3>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status metric */}
        <div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            Status
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--green)' }}
            />
            <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
              Online
            </span>
          </div>
        </div>

        {/* Messages Today metric */}
        <div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            Messages Today
          </div>
          <div className="mt-1 text-sm font-medium" style={{ color: 'var(--fg)' }}>
            0 messages
          </div>
        </div>

        {/* Uptime metric */}
        <div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            Uptime
          </div>
          <div className="mt-1 text-sm font-medium" style={{ color: 'var(--fg)' }}>
            Active
          </div>
        </div>

        {/* Last Activity metric */}
        <div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>
            Last Activity
          </div>
          <div className="mt-1 text-sm font-medium" style={{ color: 'var(--fg)' }}>
            Just now
          </div>
        </div>
      </div>
    </div>
  )
}
