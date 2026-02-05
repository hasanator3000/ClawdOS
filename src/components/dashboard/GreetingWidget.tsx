'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

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

// Subscription for time updates - fires once per minute instead of every second
let listeners: Set<() => void> = new Set()
let intervalId: ReturnType<typeof setInterval> | null = null

function subscribeToTime(callback: () => void) {
  listeners.add(callback)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    // Update every 60 seconds - we only show hours:minutes
    intervalId = setInterval(() => {
      listeners.forEach((l) => l())
    }, 60_000)
  }
  return () => {
    listeners.delete(callback)
    if (listeners.size === 0 && intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }
}

function getTimeSnapshot() {
  return formatTime()
}

function getServerSnapshot() {
  return '--:--' // Placeholder for SSR
}

export function GreetingWidget({ username }: GreetingWidgetProps) {
  // useSyncExternalStore handles hydration correctly without cascading renders
  const time = useSyncExternalStore(subscribeToTime, getTimeSnapshot, getServerSnapshot)
  const [date, setDate] = useState(formatDate)
  const [greeting, setGreeting] = useState(getGreeting)

  // Update date and greeting when time changes (once per minute is enough)
  useEffect(() => {
    setDate(formatDate())
    setGreeting(getGreeting())
  }, [time])

  return (
    <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-[var(--border)]">
      <div className="text-4xl font-bold tabular-nums">{time}</div>
      <div className="mt-1 text-lg text-[var(--muted)]">{date}</div>
      <div className="mt-4 text-xl">
        {greeting}
        {username && <span className="font-medium">, {username}</span>}
      </div>
    </div>
  )
}
