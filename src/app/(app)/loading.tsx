export default function AppLoading() {
  return (
    <div className="animate-pulse space-y-5">
      {/* Header skeleton */}
      <div className="h-8 w-48 rounded-lg bg-[var(--hover)]" />

      {/* Content skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-32 rounded-xl bg-[var(--hover)]" />
        <div className="h-32 rounded-xl bg-[var(--hover)]" />
      </div>

      <div className="space-y-3">
        <div className="h-12 rounded-lg bg-[var(--hover)]" />
        <div className="h-12 rounded-lg bg-[var(--hover)]" />
        <div className="h-12 rounded-lg bg-[var(--hover)]" />
      </div>
    </div>
  )
}