'use client'

import { useState } from 'react'
import type { Process } from '@/lib/db/repositories/process.repository'
import { toggleProcessAction } from '@/app/(app)/today/actions'
import { ProcessModal } from './ProcessModal'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('processes-widget')

interface ProcessesWidgetProps {
  initialProcesses: Process[]
  workspaceId: string
}

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium" style={{ color: 'var(--fg)' }}>
            Active Processes
          </h2>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3 py-1.5 rounded-md border text-sm transition-colors"
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
            <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
              No active processes
            </p>
          ) : (
            enabledProcesses.slice(0, 5).map((process) => (
              <div
                key={process.id}
                className="p-3 rounded-lg border transition-colors"
                style={{
                  borderColor: 'var(--border)',
                  background: 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--fg)' }}>
                      {process.title}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
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
