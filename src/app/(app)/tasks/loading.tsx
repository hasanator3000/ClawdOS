function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
      {/* Checkbox */}
      <div className="w-5 h-5 rounded-full border-2 border-[var(--border)] shrink-0" />
      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 w-3/5 rounded bg-[var(--hover)]" />
        <div className="flex items-center gap-2">
          <div className="h-3 w-14 rounded bg-[var(--hover)]" />
          <div className="h-3 w-16 rounded bg-[var(--hover)]" />
        </div>
      </div>
      {/* Priority badge */}
      <div className="h-3 w-10 rounded bg-[var(--hover)] shrink-0" />
    </div>
  )
}

export default function TasksLoading() {
  return (
    <div className="animate-pulse max-w-4xl mx-auto space-y-5">
      {/* Heading */}
      <div className="h-8 w-32 rounded-lg bg-[var(--hover)]" />

      {/* View mode slider */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--card)] border border-[var(--border)] w-fit">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-md bg-[var(--hover)]" />
        ))}
      </div>

      {/* Create form */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="h-5 w-5 rounded bg-[var(--hover)]" />
        <div className="h-4 w-48 rounded bg-[var(--hover)]" />
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-24 rounded-lg bg-[var(--hover)]" />
        <div className="h-9 w-24 rounded-lg bg-[var(--hover)]" />
        <div className="h-9 w-28 rounded-lg bg-[var(--hover)]" />
        <div className="ml-auto h-9 w-32 rounded-lg bg-[var(--hover)]" />
      </div>

      {/* Task rows */}
      <div className="space-y-2">
        <TaskRowSkeleton />
        <TaskRowSkeleton />
        <TaskRowSkeleton />
        <TaskRowSkeleton />
        <TaskRowSkeleton />
      </div>
    </div>
  )
}
