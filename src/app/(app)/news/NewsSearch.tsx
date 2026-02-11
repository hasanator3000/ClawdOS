'use client'

import { useState, useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
}

export function NewsSearch({ value, onChange }: Props) {
  const [local, setLocal] = useState(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Sync external value changes
  useEffect(() => {
    setLocal(value)
  }, [value])

  // Debounced update — use ref for onChange to avoid re-running on parent re-render
  useEffect(() => {
    const timer = setTimeout(() => {
      if (local !== value) onChangeRef.current(local)
    }, 300)
    return () => clearTimeout(timer)
  }, [local, value])

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
