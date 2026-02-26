function CardSkeleton({ hasImage }: { hasImage: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
      {hasImage && <div className="aspect-video bg-[var(--hover)]" />}
      <div className="p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="h-3 w-16 rounded bg-[var(--hover)]" />
          <div className="h-3 w-10 rounded bg-[var(--hover)]" />
        </div>
        <div className="h-4 w-full rounded bg-[var(--hover)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--hover)]" />
        <div className="h-3 w-full rounded bg-[var(--hover)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--hover)]" />
      </div>
    </div>
  )
}

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

      {/* Tab bar */}
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 rounded-lg bg-[var(--hover)]" />
        ))}
      </div>

      {/* Card grid — alternating with/without images */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <CardSkeleton hasImage />
        <CardSkeleton hasImage={false} />
        <CardSkeleton hasImage />
        <CardSkeleton hasImage />
        <CardSkeleton hasImage={false} />
        <CardSkeleton hasImage />
      </div>
    </div>
  )
}
