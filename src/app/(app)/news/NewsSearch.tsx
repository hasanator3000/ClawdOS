'use client'

import { useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function NewsSearch({ value, onChange }: Props) {
  const [local, setLocal] = useState(value)

  // Sync external value changes
  useEffect(() => {
    setLocal(value)
  }, [value])

  // Debounced update
  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChange(local)
    }, 300)
    return () => clearTimeout(timer)
  }, [local, value, onChange])

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder="Search news..."
      className="px-3 py-1.5 bg-[var(--input-bg)] text-[var(--input-fg)] border border-[var(--border)] rounded-lg text-sm placeholder:text-[var(--input-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] w-48"
    />
  )
}
