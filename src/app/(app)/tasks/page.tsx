import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { withUser } from '@/lib/db'
import { getTasksByWorkspace, getUniqueTags } from '@/lib/db/repositories/task.repository'
import { getProjectsByWorkspace } from '@/lib/db/repositories/project.repository'
import { TaskList } from './TaskList'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const [session, workspace] = await Promise.all([getSession(), getActiveWorkspace()])
  if (!session.userId) redirect('/login')
  if (!workspace) {
    return (
      <div className="p-6">
        <div className="text-center text-[var(--muted)]">Select a workspace to view tasks</div>
      </div>
    )
  }

  const [tasks, tags, projects] = await withUser(session.userId, async (client) => {
    return Promise.all([
      getTasksByWorkspace(client, workspace.id, { includeCompleted: true, limit: 100 }),
      getUniqueTags(client, workspace.id),
      getProjectsByWorkspace(client, workspace.id),
    ])
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tasks</h1>
      </div>

      <TaskList initialTasks={tasks} initialTags={tags} initialProjects={projects} />
    </div>
  )
}
