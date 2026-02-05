import Link from 'next/link'

interface Task {
  id: string
  title: string
  status: string
  dueDate: string | null
  priority: number
}

interface RecentTasksWidgetProps {
  tasks: Task[]
}

export function RecentTasksWidget({ tasks }: RecentTasksWidgetProps) {
  const pendingTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').slice(0, 5)

  return (
    <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Tasks</div>
        <Link href="/tasks" className="text-xs text-[var(--muted)] hover:text-[var(--fg)]">
          View all
        </Link>
      </div>

      {pendingTasks.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--muted)]">
          <div className="text-2xl mb-2">✓</div>
          No pending tasks
        </div>
      ) : (
        <div className="space-y-2">
          {pendingTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--hover)] transition-colors"
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  task.status === 'in_progress'
                    ? 'bg-yellow-500'
                    : task.priority >= 3
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{task.title}</div>
                {task.dueDate && (
                  <div className="text-xs text-[var(--muted)]">
                    Due: {new Date(task.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
              {task.status === 'in_progress' && (
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                  In Progress
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
