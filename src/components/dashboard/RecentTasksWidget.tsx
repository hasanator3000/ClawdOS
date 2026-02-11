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
      className="p-4 rounded-2xl"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="text-[10px] uppercase tracking-widest font-mono"
          style={{ color: 'var(--muted)' }}
        >
          Tasks
        </div>
        <Link
          href="/tasks"
          className="text-xs transition-colors"
          style={{ color: 'var(--muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--neon)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)' }}
        >
          View all
        </Link>
      </div>

      {pendingTasks.length === 0 ? (
        <div className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>
          No pending tasks
        </div>
      ) : (
        <div className="space-y-0.5">
          {pendingTasks.map((task, i) => {
            const color = getPriorityColor(task.priority, task.status)
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors"
                style={{
                  borderBottom: i < pendingTasks.length - 1 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Diamond priority indicator */}
                <div
                  className="flex-shrink-0"
                  style={{
                    width: 5,
                    height: 5,
                    transform: 'rotate(45deg)',
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: 'var(--fg)' }}>{task.title}</div>
                  {task.dueDate && (
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
                {task.status === 'in_progress' && (
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-mono"
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
