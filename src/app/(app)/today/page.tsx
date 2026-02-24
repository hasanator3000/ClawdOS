import { withUser } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { getTasksByWorkspace } from '@/lib/db/repositories/task.repository'
import { findProcessesByWorkspace } from '@/lib/db/repositories/process.repository'
import {
  GreetingWidget,
  CurrencyWidget,
  AgentMetricsWidget,
  ProcessesWidget,
  QuickLinksWidget,
  RecentTasksWidget,
} from '@/components/dashboard'
import { WidgetErrorBoundary } from '@/components/ui/WidgetErrorBoundary'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [session, workspace] = await Promise.all([getSession(), getActiveWorkspace()])

  if (!session.userId) return null

  if (!workspace) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--muted)] mt-2">No workspaces found for this user.</p>
      </div>
    )
  }

  // Fetch tasks and processes in parallel (processes may fail if table is new)
  const [tasks, processes] = await Promise.all([
    withUser(session.userId, (client) =>
      getTasksByWorkspace(client, workspace.id, { limit: 10 })
    ),
    withUser(session.userId, (client) =>
      findProcessesByWorkspace(client, workspace.id)
    ).catch(() => [] as import('@/lib/db/repositories/process.repository').Process[]),
  ])

  return (
    <div className="space-y-5">
      {/* Top row: Greeting + Currency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WidgetErrorBoundary name="Greeting">
          <GreetingWidget username={session.username} />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary name="Currency">
          <CurrencyWidget />
        </WidgetErrorBoundary>
      </div>

      {/* Agent metrics */}
      <div className="grid grid-cols-1">
        <WidgetErrorBoundary name="AgentMetrics">
          <AgentMetricsWidget />
        </WidgetErrorBoundary>
      </div>

      {/* Processes */}
      <WidgetErrorBoundary name="Processes">
        <ProcessesWidget initialProcesses={processes} workspaceId={workspace.id} />
      </WidgetErrorBoundary>

      {/* Quick links */}
      <WidgetErrorBoundary name="QuickLinks">
        <QuickLinksWidget />
      </WidgetErrorBoundary>

      {/* Bottom row: Tasks */}
      <RecentTasksWidget tasks={tasks} />
    </div>
  )
}
