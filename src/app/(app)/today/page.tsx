import { withUser } from '@/lib/db'
import { getSession } from '@/lib/auth/session'
import { getActiveWorkspace } from '@/lib/workspace'
import { getTasksByWorkspace } from '@/lib/db/repositories/task.repository'
import { findProcessesByWorkspace } from '@/lib/db/repositories/process.repository'
import { getUserSettings } from '@/lib/db/repositories/user-setting.repository'
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

const PREF_KEYS = ['dashboard:currencies', 'dashboard:weather_city', 'dashboard:timezone'] as const

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

  // Fetch tasks, processes, and user preferences in parallel
  const [tasks, processes, settings] = await Promise.all([
    withUser(session.userId, (client) =>
      getTasksByWorkspace(client, workspace.id, { limit: 10 })
    ),
    withUser(session.userId, (client) =>
      findProcessesByWorkspace(client, workspace.id)
    ).catch(() => [] as import('@/lib/db/repositories/process.repository').Process[]),
    withUser(session.userId, (client) =>
      getUserSettings(client, [...PREF_KEYS])
    ).catch(() => []),
  ])

  // Extract preferences from settings
  const prefs = Object.fromEntries(settings.map((s) => [s.key, s.value]))
  const currencyPrefs = prefs['dashboard:currencies'] as {
    baseCurrency: string; fiat: string[]; crypto: string[]
  } | undefined
  const weatherCity = prefs['dashboard:weather_city'] as string | undefined
  const timezone = prefs['dashboard:timezone'] as string | undefined

  return (
    <div className="space-y-5">
      {/* Row 1: Greeting (time+weather+system gauges) | Currency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <WidgetErrorBoundary name="Greeting">
          <GreetingWidget
            username={session.username}
            timezone={timezone}
            weatherCity={weatherCity}
          />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary name="Currency">
          <CurrencyWidget preferences={currencyPrefs} />
        </WidgetErrorBoundary>
      </div>

      {/* Row 2: Agent Metrics | Processes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <WidgetErrorBoundary name="AgentMetrics">
          <AgentMetricsWidget />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary name="Processes">
          <ProcessesWidget initialProcesses={processes} workspaceId={workspace.id} />
        </WidgetErrorBoundary>
      </div>

      {/* Row 3: Recent Tasks | Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <WidgetErrorBoundary name="RecentTasks">
          <RecentTasksWidget tasks={tasks} />
        </WidgetErrorBoundary>
        <WidgetErrorBoundary name="QuickLinks">
          <QuickLinksWidget />
        </WidgetErrorBoundary>
      </div>
    </div>
  )
}
