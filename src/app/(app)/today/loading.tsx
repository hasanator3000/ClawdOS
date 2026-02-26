function GaugeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-11 h-11 rounded-full border-4 border-[var(--border)] bg-transparent" />
      <div className="h-2.5 w-6 rounded bg-[var(--hover)]" />
    </div>
  )
}

function GreetingSkeleton() {
  return (
    <div
      className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          {/* Time */}
          <div className="h-14 w-40 rounded-lg bg-[var(--hover)]" />
          {/* Date */}
          <div className="h-4 w-48 rounded bg-[var(--hover)] mt-2" />
        </div>
        {/* Weather */}
        <div className="text-right space-y-1.5">
          <div className="h-7 w-7 rounded bg-[var(--hover)] ml-auto" />
          <div className="h-6 w-12 rounded bg-[var(--hover)] ml-auto" />
          <div className="h-3 w-16 rounded bg-[var(--hover)] ml-auto" />
        </div>
      </div>
      {/* Greeting */}
      <div className="h-5 w-56 rounded bg-[var(--hover)] mt-4" />
      {/* System gauges */}
      <div className="mt-4 pt-4 flex items-center gap-5 border-t border-t-[var(--border)]" >
        <GaugeSkeleton />
        <GaugeSkeleton />
        <GaugeSkeleton />
        <div className="ml-auto space-y-1">
          <div className="h-3 w-20 rounded bg-[var(--hover)]" />
          <div className="h-2.5 w-14 rounded bg-[var(--hover)] ml-auto" />
        </div>
      </div>
    </div>
  )
}

function CurrencySkeleton() {
  return (
    <div
      className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 rounded bg-[var(--hover)]" />
        <div className="h-3 w-16 rounded bg-[var(--hover)]" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
            
          >
            <div className="flex items-center gap-3">
              <div className="h-4 w-10 rounded bg-[var(--hover)]" />
              <div className="h-3 w-20 rounded bg-[var(--hover)]" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-16 rounded bg-[var(--hover)]" />
              <div className="h-3 w-10 rounded bg-[var(--hover)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentMetricsSkeleton() {
  return (
    <div
      className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div className="h-5 w-28 rounded bg-[var(--hover)]" />
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
            <div className="h-3 w-16 rounded bg-[var(--hover)]" />
            <div className="h-4 w-12 rounded bg-[var(--hover)] mt-3" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ProcessesSkeleton() {
  return (
    <div
      className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div className="flex items-center justify-between mb-5">
        <div className="h-5 w-32 rounded bg-[var(--hover)]" />
        <div className="h-9 w-20 rounded-lg bg-[var(--hover)]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-4 py-3.5 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-36 rounded bg-[var(--hover)]" />
                <div className="h-3 w-24 rounded bg-[var(--hover)]" />
              </div>
              <div className="w-5 h-5 rounded-full bg-[var(--hover)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentTasksSkeleton() {
  return (
    <div
      className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-12 rounded bg-[var(--hover)]" />
        <div className="h-3 w-14 rounded bg-[var(--hover)]" />
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)]"
          >
            <div className="w-1 self-stretch rounded-full bg-[var(--hover)]" style={{ minHeight: 32 }} />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 rounded bg-[var(--hover)]" />
              <div className="h-3 w-24 rounded bg-[var(--hover)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickLinksSkeleton() {
  return (
    <div
      className="p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)]"
      
    >
      <div className="h-3 w-24 rounded bg-[var(--hover)] mb-4" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center justify-center p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
          >
            <div className="w-6 h-6 rounded bg-[var(--hover)]" />
            <div className="h-3.5 w-12 rounded bg-[var(--hover)] mt-2.5" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TodayLoading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Row 1: Greeting | Currency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <GreetingSkeleton />
        <CurrencySkeleton />
      </div>

      {/* Row 2: Agent Metrics | Processes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <AgentMetricsSkeleton />
        <ProcessesSkeleton />
      </div>

      {/* Row 3: Recent Tasks | Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <RecentTasksSkeleton />
        <QuickLinksSkeleton />
      </div>
    </div>
  )
}
