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

// Pre-create formatters to avoid re-creating them on every call
const dateFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })

function formatDate(): string {
  return dateFmt.format(new Date())
}

function formatTime(): string {
  return timeFmt.format(new Date())
}

// Subscription for time updates - fires once per minute instead of every second
let listeners: Set<() => void> = new Set()
let intervalId: ReturnType<typeof setInterval> | null = null

function subscribeToTime(callback: () => void) {
  listeners.add(callback)
  if (listeners.size === 1 && typeof window !== 'undefined') {
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
  return '--:--'
}

export function GreetingWidget({ username }: GreetingWidgetProps) {
  const time = useSyncExternalStore(subscribeToTime, getTimeSnapshot, getServerSnapshot)
  // Use empty defaults to avoid hydration mismatch (server date != client date across midnight)
  const [date, setDate] = useState('')
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    setDate(formatDate())
    setGreeting(getGreeting())
  }, [time])

  return (
    <div
      className="p-6 rounded-2xl"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        className="font-mono tabular-nums font-bold"
        style={{
          fontSize: '3.25rem',
          lineHeight: 1.1,
          background: 'linear-gradient(180deg, var(--fg), var(--muted))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {time}
      </div>
      <div
        className="mt-1.5 text-sm font-light"
        style={{ color: 'var(--muted)' }}
      >
        {date}
      </div>
      <div className="mt-4 text-lg font-light" style={{ color: 'var(--fg)' }}>
        {greeting}
        {username && (
          <span
            className="font-medium"
            style={{
              color: 'var(--neon)',
              textShadow: '0 0 20px var(--neon-glow)',
            }}
          >
            , {username}
          </span>
        )}
      </div>
    </div>
  )
}
