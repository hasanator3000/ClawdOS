export default function NewsLoading() {
  return (
    <div className="animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-8 w-24 rounded-lg bg-[var(--hover)]" />
        <div className="flex gap-3">
          <div className="h-9 w-24 rounded-lg bg-[var(--hover)]" />
          <div className="h-9 w-20 rounded-lg bg-[var(--hover)]" />
          <div className="h-9 w-20 rounded-lg bg-[var(--hover)]" />
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-[var(--hover)]" />
        ))}
      </div>
    </div>
  )
}
