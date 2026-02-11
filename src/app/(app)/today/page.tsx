import { withUser } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { getTasksByWorkspace } from '@/lib/db/repositories/task.repository'
import {
  GreetingWidget,
  CurrencyWidget,
  QuickLinksWidget,
  RecentTasksWidget,
} from '@/components/dashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await getSession()
  const workspace = await getActiveWorkspace()

  if (!session.userId) return null

  if (!workspace) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--muted)] mt-2">No workspaces found for this user.</p>
      </div>
    )
  }

  // Fetch tasks for the widget
  const tasks = await withUser(session.userId, (client) =>
    getTasksByWorkspace(client, workspace.id, { limit: 10 })
  )

  return (
    <div className="space-y-5">
      {/* Top row: Greeting + Currency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GreetingWidget username={session.username} />
        <CurrencyWidget />
      </div>

      {/* Quick links */}
      <QuickLinksWidget />

      {/* Bottom row: Tasks */}
      <RecentTasksWidget tasks={tasks} />
    </div>
  )
}
