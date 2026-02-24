export default function SettingsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Heading */}
      <div className="h-7 w-32 rounded-lg bg-[var(--hover)]" />

      {/* Section cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4"
        >
          <div className="h-5 w-24 rounded bg-[var(--hover)]" />
          <div className="h-4 w-48 rounded bg-[var(--hover)] mt-2" />
          <div className="h-4 w-32 rounded bg-[var(--hover)] mt-3" />
        </div>
      ))}
    </div>
  )
}
