import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { getTasksByWorkspace } from '@/lib/db/repositories/task.repository'
import { TaskList } from './TaskList'

export default async function TasksPage() {
  const session = await getSession()
  if (!session.userId) redirect('/login')

  const workspace = await getActiveWorkspace()
  if (!workspace) {
    return (
      <div className="p-6">
        <div className="text-center text-[var(--muted)]">Select a workspace to view tasks</div>
      </div>
    )
  }

  const tasks = await withUser(session.userId, async (client) => {
    return getTasksByWorkspace(client, workspace.id, { includeCompleted: true, limit: 100 })
  })

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tasks</h1>
      </div>

      <TaskList initialTasks={tasks} />
    </div>
  )
}
