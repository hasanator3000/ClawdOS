'use client'

import { useState, useEffect } from 'react'
import type { Process } from '@/lib/db/repositories/process.repository'
import { ProcessForm, type ProcessFormData } from './ProcessForm'
import {
  createProcessAction,
  updateProcessAction,
  deleteProcessAction,
} from '@/app/(app)/today/actions'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('process-modal')

interface ProcessModalProps {
  processes: Process[]
  onClose: () => void
  onRefresh: (processes: Process[]) => void
}

export function ProcessModal({ processes, onClose, onRefresh }: ProcessModalProps) {
  const [editingProcess, setEditingProcess] = useState<Process | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [localProcesses, setLocalProcesses] = useState(processes)

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleCreate = () => {
    setEditingProcess(null)
    setShowForm(true)
  }

  const handleEdit = (process: Process) => {
    setEditingProcess(process)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this process?')) {
      return
    }

    const result = await deleteProcessAction(id)
    if (result.error) {
      log.error('Delete failed', { error: result.error })
    } else {
      const updated = localProcesses.filter((p) => p.id !== id)
      setLocalProcesses(updated)
      onRefresh(updated)
    }
  }

  const handleFormSubmit = async (data: ProcessFormData) => {
    if (editingProcess) {
      // Update existing process
      const result = await updateProcessAction(editingProcess.id, data)
      if (result.error) {
        log.error('Update failed', { error: result.error })
      } else if (result.data) {
        const updated = localProcesses.map((p) =>
          p.id === editingProcess.id ? result.data! : p
        )
        setLocalProcesses(updated)
        onRefresh(updated)
        setShowForm(false)
        setEditingProcess(null)
      }
    } else {
      // Create new process
      const result = await createProcessAction(data)
      if (result.error) {
        log.error('Create failed', { error: result.error })
      } else if (result.data) {
        const updated = [result.data, ...localProcesses]
        setLocalProcesses(updated)
        onRefresh(updated)
        setShowForm(false)
      }
    }
  }

  const handleFormCancel = () => {
    setShowForm(false)
    setEditingProcess(null)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="fixed inset-0 md:inset-10 rounded-xl overflow-auto"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 border-b flex items-center justify-between"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--border)',
          }}
        >
          <h2 className="text-xl font-medium text-[var(--fg)]" >
            Manage Processes
          </h2>
          <button
            onClick={onClose}
            className="text-2xl w-8 h-8 flex items-center justify-center rounded-md transition-colors text-[var(--muted)]"
            
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hover)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
            }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Create button */}
          {!showForm && (
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-md text-sm font-medium transition-opacity"
              style={{
                background: 'var(--neon)',
                color: 'var(--bg)',
              }}
            >
              Create New Process
            </button>
          )}

          {/* Form section */}
          {showForm && (
            <div
              className="p-4 rounded-lg border"
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'var(--border)',
              }}
            >
              <h3 className="text-sm font-medium mb-4 text-[var(--fg)]" >
                {editingProcess ? 'Edit Process' : 'Create Process'}
              </h3>
              <ProcessForm
                process={editingProcess}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
              />
            </div>
          )}

          {/* Process list */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[var(--muted)]" >
              All Processes ({localProcesses.length})
            </h3>
            {localProcesses.length === 0 ? (
              <p className="text-sm text-center py-8 text-[var(--muted)]" >
                No processes yet. Create one to get started.
              </p>
            ) : (
              localProcesses.map((process) => (
                <div
                  key={process.id}
                  className="p-4 rounded-lg border transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderColor: 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-[var(--fg)]" >
                          {process.title}
                        </h4>
                        <span
                          className="px-2 py-0.5 rounded text-xs"
                          style={{
                            background: process.enabled
                              ? 'var(--success-bg)'
                              : 'rgba(255,255,255,0.05)',
                            color: process.enabled ? 'var(--success-fg)' : 'var(--muted)',
                          }}
                        >
                          {process.enabled ? '● Enabled' : '○ Disabled'}
                        </span>
                      </div>
                      <p className="text-xs mt-1 text-[var(--muted)]" >
                        {process.description || 'No description'}
                      </p>
                      <p className="text-xs mt-1 font-mono text-[var(--muted)]" >
                        Schedule: {process.schedule}
                      </p>
                      <p className="text-xs mt-0.5 text-[var(--muted)]" >
                        Action: {process.actionType}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(process)}
                        className="px-3 py-1.5 rounded-md border text-sm transition-colors"
                        style={{
                          background: 'transparent',
                          borderColor: 'var(--border)',
                          color: 'var(--fg)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(process.id)}
                        className="px-3 py-1.5 rounded-md border text-sm transition-colors"
                        style={{
                          background: 'transparent',
                          borderColor: 'var(--border)',
                          color: 'var(--red)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(251,113,133,0.1)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
