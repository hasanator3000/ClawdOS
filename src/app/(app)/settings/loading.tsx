function SectionSkeleton({ buttonCount = 1 }: { buttonCount?: number }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="h-5 w-24 rounded bg-[var(--hover)]" />
      <div className="h-4 w-72 rounded bg-[var(--hover)] mt-3" />
      <div className="mt-4 flex gap-3">
        {Array.from({ length: buttonCount }).map((_, i) => (
          <div key={i} className="h-10 w-36 rounded-lg border border-[var(--border)] bg-[var(--hover)]" />
        ))}
      </div>
    </section>
  )
}

export default function SettingsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Heading + username */}
      <div className="flex items-baseline justify-between pr-12">
        <div className="h-7 w-24 rounded-lg bg-[var(--hover)]" />
        <div className="h-4 w-28 rounded bg-[var(--hover)]" />
      </div>

      {/* Security */}
      <SectionSkeleton />

      {/* Telegram */}
      <SectionSkeleton />

      {/* Dashboard */}
      <SectionSkeleton />

      {/* Clawdbot */}
      <SectionSkeleton buttonCount={2} />

      {/* Account */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="h-5 w-20 rounded bg-[var(--hover)]" />
        <div className="h-4 w-48 rounded bg-[var(--hover)] mt-3" />
        <div className="h-4 w-64 rounded bg-[var(--hover)] mt-2" />
        <div className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--hover)] mt-5" />
      </section>
    </div>
  )
}
