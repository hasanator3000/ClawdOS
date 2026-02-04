'use client'

import { useEffect, useState } from 'react'

interface GreetingWidgetProps {
  username?: string
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 6) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function GreetingWidget({ username }: GreetingWidgetProps) {
  const [time, setTime] = useState(formatTime())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const interval = setInterval(() => {
      setTime(formatTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-[var(--border)]">
        <div className="h-20 animate-pulse bg-[var(--hover)] rounded" />
      </div>
    )
  }

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-[var(--border)]">
      <div className="text-4xl font-bold tabular-nums">{time}</div>
      <div className="mt-1 text-lg text-[var(--muted)]">{formatDate()}</div>
      <div className="mt-4 text-xl">
        {getGreeting()}
        {username && <span className="font-medium">, {username}</span>}
      </div>
    </div>
  )
}
