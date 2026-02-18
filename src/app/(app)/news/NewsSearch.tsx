'use client'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function NewsSearch({ value, onChange }: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search news..."
      className="px-3 py-1.5 bg-[var(--input-bg)] text-[var(--input-fg)] border border-[var(--border)] rounded-lg text-sm placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-48"
    />
  )
}
