'use client'

import { useState, useTransition } from 'react'
import type { Process } from '@/lib/db/repositories/process.repository'

interface ProcessFormProps {
  process?: Process | null
  onSubmit: (data: ProcessFormData) => Promise<void>
  onCancel: () => void
}

export interface ProcessFormData {
  title: string
  description?: string
  schedule: string
  actionType: string
  actionConfig?: Record<string, unknown>
}

export function ProcessForm({ process, onSubmit, onCancel }: ProcessFormProps) {
  const [title, setTitle] = useState(process?.title || '')
  const [description, setDescription] = useState(process?.description || '')
  const [schedule, setSchedule] = useState(process?.schedule || '')
  const [actionType, setActionType] = useState(process?.actionType || 'send_digest')
  const [actionConfig, setActionConfig] = useState(
    process?.actionConfig ? JSON.stringify(process.actionConfig, null, 2) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate required fields
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!schedule.trim()) {
      setError('Schedule is required')
      return
    }
    if (!actionType) {
      setError('Action type is required')
      return
    }

    // Parse action config JSON if provided
    let parsedConfig: Record<string, unknown> | undefined
    if (actionConfig.trim()) {
      try {
        parsedConfig = JSON.parse(actionConfig)
      } catch (err) {
        setError('Invalid JSON in action config')
        return
      }
    }

    const formData: ProcessFormData = {
      title: title.trim(),
      description: description.trim() || undefined,
      schedule: schedule.trim(),
      actionType,
      actionConfig: parsedConfig,
    }

    startTransition(async () => {
      await onSubmit(formData)
      // Clear form if creating (process is null)
      if (!process) {
        setTitle('')
        setDescription('')
        setSchedule('')
        setActionType('send_digest')
        setActionConfig('')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          className="p-3 rounded-md text-sm"
          style={{
            background: 'var(--error-bg)',
            color: 'var(--error-fg)',
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="title"
          className="block text-sm mb-1.5 text-[var(--muted)]"
          
        >
          Title *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Daily morning digest"
          className="w-full px-3 py-2 rounded-md border text-sm"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'var(--border)',
            color: 'var(--fg)',
          }}
          required
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm mb-1.5 text-[var(--muted)]"
          
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description..."
          rows={2}
          className="w-full px-3 py-2 rounded-md border text-sm resize-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'var(--border)',
            color: 'var(--fg)',
          }}
        />
      </div>

      <div>
        <label
          htmlFor="schedule"
          className="block text-sm mb-1.5 text-[var(--muted)]"
          
        >
          Schedule (cron format) *
        </label>
        <input
          id="schedule"
          type="text"
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="0 9 * * *"
          className="w-full px-3 py-2 rounded-md border text-sm font-mono"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'var(--border)',
            color: 'var(--fg)',
          }}
          required
        />
      </div>

      <div>
        <label
          htmlFor="actionType"
          className="block text-sm mb-1.5 text-[var(--muted)]"
          
        >
          Action Type *
        </label>
        <select
          id="actionType"
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="w-full px-3 py-2 rounded-md border text-sm"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'var(--border)',
            color: 'var(--fg)',
          }}
          required
        >
          <option value="send_digest">Send Digest</option>
          <option value="send_reminder">Send Reminder</option>
          <option value="run_backup">Run Backup</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="actionConfig"
          className="block text-sm mb-1.5 text-[var(--muted)]"
          
        >
          Action Config (JSON)
        </label>
        <textarea
          id="actionConfig"
          value={actionConfig}
          onChange={(e) => setActionConfig(e.target.value)}
          placeholder="{}"
          rows={4}
          className="w-full px-3 py-2 rounded-md border text-sm font-mono resize-none"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'var(--border)',
            color: 'var(--fg)',
          }}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 rounded-md text-sm font-medium transition-opacity"
          style={{
            background: 'var(--neon)',
            color: 'var(--bg)',
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? 'Saving...' : process ? 'Update Process' : 'Create Process'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-4 py-2 rounded-md border text-sm transition-colors"
          style={{
            background: 'transparent',
            borderColor: 'var(--border)',
            color: 'var(--fg)',
          }}
          onMouseEnter={(e) => {
            if (!isPending) e.currentTarget.style.background = 'var(--hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
