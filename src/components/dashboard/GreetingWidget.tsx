'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { WeatherData } from '@/app/api/weather/route'
import type { SystemStatus } from '@/app/api/system/status/route'

interface GreetingWidgetProps {
  username?: string
  timezone?: string | null
  weatherCity?: string | null
}

function getGreeting(tz?: string | null): string {
  const hour = tz
    ? parseInt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()), 10)
    : new Date().getHours()
  if (hour < 6) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Subscription for time updates - fires once per minute
const listeners: Set<() => void> = new Set()
let intervalId: ReturnType<typeof setInterval> | null = null
let tick = 0

function subscribeToTime(callback: () => void) {
  listeners.add(callback)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    intervalId = setInterval(() => {
      tick++
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

function getTickSnapshot() {
  return tick
}

function getServerTickSnapshot() {
  return 0
}

// --- Compact circular gauge (like AirPods battery) ---
const RING_SIZE = 44
const RING_STROKE = 4
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function ringColor(percent: number): string {
  if (percent >= 90) return 'var(--red)'
  if (percent >= 70) return 'var(--warm)'
  return 'var(--neon)'
}

function GaugeRing({ percent, label }: { percent: number; label: string }) {
  const color = ringColor(percent)
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={RING_STROKE}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.7s ease, stroke 0.3s ease',
            }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-[11px] font-mono font-semibold tabular-nums text-[var(--fg)]"
          
        >
          {percent}
        </span>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]" >
        {label}
      </span>
    </div>
  )
}

export function GreetingWidget({ username, timezone, weatherCity }: GreetingWidgetProps) {
  useSyncExternalStore(subscribeToTime, getTickSnapshot, getServerTickSnapshot)

  const tz = timezone || undefined

  const timeFmt = useMemo(
    () => new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }),
    [tz]
  )
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: tz }),
    [tz]
  )

  const [time, setTime] = useState('--:--')
  const [date, setDate] = useState('')
  const [greeting, setGreeting] = useState('')
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [system, setSystem] = useState<SystemStatus | null>(null)

  const updateTime = useCallback(() => {
    const now = new Date()
    setTime(timeFmt.format(now))
    setDate(dateFmt.format(now))
    setGreeting(getGreeting(tz))
  }, [timeFmt, dateFmt, tz])

  useEffect(() => {
    updateTime()
  }, [updateTime])

  // Re-trigger on tick changes
  useEffect(() => {
    updateTime()
  })

  // Fetch weather on mount + every 15 min
  useEffect(() => {
    const controller = new AbortController()
    const cityParam = weatherCity ? `?city=${encodeURIComponent(weatherCity)}` : ''

    async function fetchWeather() {
      try {
        const res = await fetch(`/api/weather${cityParam}`, { signal: controller.signal })
        const data = await res.json()
        if (data.weather) setWeather(data.weather)
      } catch {
        // Silently fail — weather is non-critical
      }
    }

    fetchWeather()
    const interval = setInterval(fetchWeather, 15 * 60 * 1000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [weatherCity])

  // Fetch system status on mount + every 30s
  useEffect(() => {
    const controller = new AbortController()

    async function fetchSystem() {
      try {
        const res = await fetch('/api/system/status', { signal: controller.signal })
        const data = await res.json()
        if (data.system) setSystem(data.system)
      } catch {
        // Non-critical
      }
    }

    fetchSystem()
    const interval = setInterval(fetchSystem, 30_000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [])

  return (
    <div
      className="p-6 rounded-2xl"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      {/* Top row: time+date | weather */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div
            className="font-mono tabular-nums font-bold"
            style={{
              fontSize: '3.5rem',
              lineHeight: 1.1,
              background: 'linear-gradient(180deg, var(--fg), var(--muted))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {time}
          </div>
          <div className="mt-1.5 text-sm font-light text-[var(--muted)]" >
            {date}
            {tz && (
              <span className="ml-2 text-xs font-mono opacity-60">
                {tz.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Weather block */}
        {weather && (
          <div className="text-right shrink-0">
            <div className="text-2xl leading-none">{weather.icon}</div>
            <div
              className="mt-1 text-xl font-mono font-bold tabular-nums text-[var(--fg)]"
              
            >
              {weather.temp}°
            </div>
            <div className="text-xs text-[var(--muted)]" >
              {weather.condition}
            </div>
            <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[10px] text-[var(--muted)]" >
              <span>💧{weather.humidity}%</span>
              <span>💨{weather.wind}km/h</span>
            </div>
          </div>
        )}
      </div>

      {/* Greeting */}
      <div className="mt-3 text-lg font-light text-[var(--fg)]" >
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

      {/* System gauges row */}
      {system && (
        <div
          className="mt-4 pt-4 flex items-center gap-5 border-t border-t-[var(--border)]"
          
        >
          <GaugeRing percent={system.cpu.usage} label="CPU" />
          <GaugeRing percent={system.memory.percent} label="RAM" />
          <GaugeRing percent={system.disk.percent} label="Disk" />
          <div className="ml-auto flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-1.5">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--green)', boxShadow: '0 0 4px var(--green)' }}
              />
              <span className="text-xs font-mono text-[var(--muted)]" >
                {system.hostname}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--muted)]" >
              up {system.uptime.formatted}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
