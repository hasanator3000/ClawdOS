export default function TasksLoading() {
  return (
    <div className="animate-pulse max-w-4xl mx-auto space-y-6">
      {/* Heading */}
      <div className="h-8 w-32 rounded-lg bg-[var(--hover)]" />

      {/* View mode slider */}
      <div className="h-10 w-64 rounded-lg bg-[var(--hover)]" />

      {/* Create form */}
      <div className="h-12 rounded-lg bg-[var(--hover)]" />

      {/* Filter bar */}
      <div className="h-10 rounded-lg bg-[var(--hover)]" />

      {/* Task rows */}
      <div className="space-y-2">
        <div className="h-16 rounded-lg bg-[var(--hover)]" />
        <div className="h-16 rounded-lg bg-[var(--hover)]" />
        <div className="h-16 rounded-lg bg-[var(--hover)]" />
        <div className="h-16 rounded-lg bg-[var(--hover)]" />
        <div className="h-16 rounded-lg bg-[var(--hover)]" />
      </div>
    </div>
  )
}
