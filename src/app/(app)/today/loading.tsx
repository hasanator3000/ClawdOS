export default function TodayLoading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Greeting + Currency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-32 rounded-xl bg-[var(--hover)]" />
        <div className="h-32 rounded-xl bg-[var(--hover)]" />
      </div>

      {/* Agent Metrics */}
      <div className="h-24 rounded-xl bg-[var(--hover)]" />

      {/* Processes */}
      <div className="h-40 rounded-xl bg-[var(--hover)]" />

      {/* Quick Links */}
      <div className="h-20 rounded-xl bg-[var(--hover)]" />

      {/* Recent Tasks */}
      <div className="h-48 rounded-xl bg-[var(--hover)]" />
    </div>
  )
}
