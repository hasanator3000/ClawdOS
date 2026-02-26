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

function getPriorityColor(priority: number, status: string): string {
  if (status === 'in_progress') return 'var(--warm)'
  if (priority >= 3) return 'var(--red)'
  if (priority >= 2) return 'var(--neon)'
  return 'var(--cyan)'
}

export function RecentTasksWidget({ tasks }: RecentTasksWidgetProps) {
  const pendingTasks = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').slice(0, 5)

  return (
    <div
      className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="text-[11px] uppercase tracking-widest font-mono font-medium text-[var(--muted)]"
          
        >
          Tasks
        </div>
        <Link
          href="/tasks"
          className="text-sm text-[var(--muted)] hover:text-[var(--neon)] transition-colors"
        >
          View all
        </Link>
      </div>

      {pendingTasks.length === 0 ? (
        <div className="py-8 text-center text-sm text-[var(--muted)]" >
          No pending tasks
        </div>
      ) : (
        <div className="space-y-1.5">
          {pendingTasks.map((task) => {
            const color = getPriorityColor(task.priority, task.status)
            return (
              <div
                key={task.id}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors border border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
              >
                {/* Priority left accent */}
                <div
                  className="flex-shrink-0 w-1 self-stretch rounded-full"
                  style={{
                    background: color,
                    boxShadow: `0 0 8px ${color}`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium truncate text-[var(--fg)]" >{task.title}</div>
                  {task.dueDate && (
                    <div className="text-sm mt-0.5 text-[var(--muted)]" >
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {task.status === 'in_progress' && (
                  <span
                    className="text-[11px] px-2.5 py-1 rounded-full font-mono font-medium"
                    style={{
                      background: 'rgba(251,191,36,0.1)',
                      color: 'var(--warm)',
                    }}
                  >
                    Active
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
