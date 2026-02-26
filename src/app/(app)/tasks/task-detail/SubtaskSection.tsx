'use client'

import type { Task } from '@/lib/db/repositories/task.repository'

interface SubtaskRowProps {
  task: Task
  onToggle: () => void
  onDelete: () => void
}

export function SubtaskRow({ task, onToggle, onDelete }: SubtaskRowProps) {
  const isDone = task.status === 'done'
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg group hover:bg-[var(--surface)] transition-colors">
      <button
        type="button"
        onClick={onToggle}
        className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors"
        style={{ borderColor: isDone ? 'var(--green)' : 'var(--border)', background: isDone ? 'var(--green)' : 'transparent' }}
      >
        {isDone && (
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="var(--bg)">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className={`flex-1 text-sm ${isDone ? 'line-through' : ''}`} style={{ color: isDone ? 'var(--muted)' : 'var(--fg)' }}>
        {task.title}
      </span>
      <button
        type="button"
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 p-0.5 transition-opacity text-[var(--muted)]"
        
      >
        <svg className="w-3 h-3 hover:text-[var(--red)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

interface SubtaskSectionProps {
  subtasks: Task[]
  doneCount: number
  newSubtask: string
  setNewSubtask: (v: string) => void
  isPending: boolean
  onAddSubtask: (e: React.FormEvent) => void
  onToggle: (sub: Task) => void
  onDelete: (subId: string) => void
}

export function SubtaskSection({
  subtasks,
  doneCount,
  newSubtask,
  setNewSubtask,
  isPending,
  onAddSubtask,
  onToggle,
  onDelete,
}: SubtaskSectionProps) {
  return (
    <>
      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="h-1 rounded-full mb-3 bg-[var(--surface)]" >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(doneCount / subtasks.length) * 100}%`, background: 'var(--green)' }}
          />
        </div>
      )}

      {/* Add form */}
      <form onSubmit={onAddSubtask} className="flex gap-2 mb-2">
        <input
          type="text"
          value={newSubtask}
          onChange={(e) => setNewSubtask(e.target.value)}
          placeholder="Add subtask..."
          className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent outline-none focus:border-[var(--neon)] transition-colors border border-[var(--border)] text-[var(--fg)]"
          
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={!newSubtask.trim() || isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 transition-opacity text-[var(--neon)] border border-[var(--neon-dim)]"
          
        >
          Add
        </button>
      </form>

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((sub) => (
          <SubtaskRow key={sub.id} task={sub} onToggle={() => onToggle(sub)} onDelete={() => onDelete(sub.id)} />
        ))}
      </div>
    </>
  )
}
