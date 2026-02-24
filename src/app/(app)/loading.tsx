export default function AppLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-[var(--hover)]" />
        <div className="h-2 w-16 rounded bg-[var(--hover)]" />
      </div>
    </div>
  )
}
