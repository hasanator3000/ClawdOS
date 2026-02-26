'use client'

import { useEffect, useState } from 'react'
import type { SystemStatus } from '@/app/api/system/status/route'

function formatMb(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

function barColor(percent: number): string {
  if (percent >= 90) return 'var(--red)'
  if (percent >= 70) return 'var(--warm)'
  return 'var(--neon)'
}

interface MetricProps {
  label: string
  value: string
  percent: number
  detail?: string
}

function Metric({ label, value, percent, detail }: MetricProps) {
  const color = barColor(percent)
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-[var(--muted)]" >{label}</span>
        <span className="text-[15px] font-semibold font-mono tabular-nums text-[var(--fg)]" >
          {value}
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden bg-[var(--surface)]"
        
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${percent}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
      </div>
      {detail && (
        <div className="mt-1 text-xs text-[var(--muted)]" >{detail}</div>
      )}
    </div>
  )
}

export function SystemStatusWidget() {
  const [status, setStatus] = useState<SystemStatus | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetchStatus() {
      try {
        const res = await fetch('/api/system/status', { signal: controller.signal })
        const data = await res.json()
        if (data.system) setStatus(data.system)
      } catch {
        // Non-critical, silently fail
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 30_000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  return (
    <div
      className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div className="flex items-center justify-between mb-5">
        <div
          className="text-[11px] uppercase tracking-widest font-mono font-medium text-[var(--muted)]"
          
        >
          System
        </div>
        {status && (
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }}
            />
            <span className="text-sm font-mono text-[var(--muted)]" >
              {status.hostname}
            </span>
          </div>
        )}
      </div>

      {!status ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-[var(--hover)]"  />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <Metric
            label="CPU"
            value={`${status.cpu.usage}%`}
            percent={status.cpu.usage}
            detail={`${status.cpu.cores} cores`}
          />
          <Metric
            label="Memory"
            value={`${status.memory.percent}%`}
            percent={status.memory.percent}
            detail={`${formatMb(status.memory.used)} / ${formatMb(status.memory.total)}`}
          />
          <Metric
            label="Disk"
            value={`${status.disk.percent}%`}
            percent={status.disk.percent}
            detail={`${formatMb(status.disk.used)} / ${formatMb(status.disk.total)}`}
          />

          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
            <span className="text-sm text-[var(--muted)]" >Uptime</span>
            <span className="text-[15px] font-semibold font-mono text-[var(--fg)]" >
              {status.uptime.formatted}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
