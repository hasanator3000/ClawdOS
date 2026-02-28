export default function DeliveriesLoading() {
  return (
    <div className="animate-pulse max-w-3xl mx-auto space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded-lg bg-[var(--hover)]" />
        <div className="h-9 w-32 rounded-lg bg-[var(--hover)]" />
      </div>
      <div className="h-10 w-full rounded-lg bg-[var(--hover)]" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-16 rounded bg-[var(--hover)]" />
            <div className="h-5 w-40 rounded bg-[var(--hover)]" />
          </div>
          <div className="h-4 w-60 rounded bg-[var(--hover)]" />
          <div className="h-3 w-32 rounded bg-[var(--hover)]" />
        </div>
      ))}
    </div>
  )
}
