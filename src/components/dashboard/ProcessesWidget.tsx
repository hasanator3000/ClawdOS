'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { Process } from '@/lib/db/repositories/process.repository'
import { toggleProcessAction } from '@/app/(app)/today/actions'
import { createClientLogger } from '@/lib/client-logger'

const ProcessModal = dynamic(
  () => import('./ProcessModal').then((m) => m.ProcessModal),
  { ssr: false }
)

const log = createClientLogger('processes-widget')

interface ProcessesWidgetProps {
  initialProcesses: Process[]
  workspaceId: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ProcessesWidget({ initialProcesses, workspaceId }: ProcessesWidgetProps) {
  const [processes, setProcesses] = useState(initialProcesses)
  const [modalOpen, setModalOpen] = useState(false)
  const [isToggling, setIsToggling] = useState<string | null>(null)

  const enabledProcesses = processes.filter((p) => p.enabled)

  const handleToggle = async (id: string) => {
    setIsToggling(id)
    try {
      const result = await toggleProcessAction(id)
      if (result.error) {
        log.error('Toggle failed', { error: result.error })
      } else if (result.data) {
        // Update local state with toggled process
        setProcesses((prev) =>
          prev.map((p) => (p.id === id ? result.data! : p))
        )
      }
    } catch (error) {
      log.error('Toggle error', { error: error instanceof Error ? error.message : String(error) })
    } finally {
      setIsToggling(null)
    }
  }

  const handleRefresh = (updatedProcesses: Process[]) => {
    setProcesses(updatedProcesses)
  }

  return (
    <>
      <div
        className="p-6 rounded-2xl"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-5">
          <h2 className="text-lg font-semibold text-[var(--fg)] truncate" >
            Active Processes
          </h2>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3 md:px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:border-[var(--neon-dim)] shrink-0"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--fg)',
              background: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Manage
          </button>
        </div>

        <div className="space-y-3">
          {enabledProcesses.length === 0 ? (
            <p className="text-sm text-center py-8 text-[var(--muted)]" >
              No active processes
            </p>
          ) : (
            enabledProcesses.slice(0, 5).map((process) => (
              <div
                key={process.id}
                className="px-4 py-3.5 rounded-xl border transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-[15px] font-medium text-[var(--fg)]" >
                      {process.title}
                    </h3>
                    <p className="text-sm mt-0.5 text-[var(--muted)]" >
                      {process.schedule}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(process.id)}
                    disabled={isToggling === process.id}
                    className="ml-3 text-lg transition-opacity"
                    style={{
                      color: process.enabled ? 'var(--neon)' : 'var(--muted)',
                      opacity: isToggling === process.id ? 0.5 : 1,
                    }}
                    aria-label={process.enabled ? 'Disable process' : 'Enable process'}
                  >
                    {process.enabled ? '●' : '○'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {modalOpen && (
        <ProcessModal
          processes={processes}
          onClose={() => setModalOpen(false)}
          onRefresh={handleRefresh}
        />
      )}
    </>
  )
}
