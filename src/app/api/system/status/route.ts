import { NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createLogger } from '@/lib/logger'

const log = createLogger('system-status')

export interface SystemStatus {
  cpu: { usage: number; cores: number }
  memory: { used: number; total: number; percent: number }
  disk: { used: number; total: number; percent: number }
  uptime: { seconds: number; formatted: string }
  hostname: string
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

function getCpuUsage(): { usage: number; cores: number } {
  try {
    const stat = readFileSync('/proc/stat', 'utf-8')
    const cpuLine = stat.split('\n')[0]
    const parts = cpuLine.split(/\s+/).slice(1).map(Number)
    const idle = parts[3] + (parts[4] || 0)
    const total = parts.reduce((a, b) => a + b, 0)

    // Count cores
    const cpuinfo = readFileSync('/proc/cpuinfo', 'utf-8')
    const cores = (cpuinfo.match(/^processor/gm) || []).length

    // Instant CPU is tricky — use loadavg 1min as % approximation
    const loadavg = readFileSync('/proc/loadavg', 'utf-8').trim().split(' ')
    const load1 = parseFloat(loadavg[0])
    const usage = Math.min(Math.round((load1 / cores) * 100), 100)

    return { usage, cores }
  } catch {
    return { usage: 0, cores: 1 }
  }
}

function getMemory(): { used: number; total: number; percent: number } {
  try {
    const meminfo = readFileSync('/proc/meminfo', 'utf-8')
    const getKb = (key: string): number => {
      const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`))
      return match ? parseInt(match[1], 10) : 0
    }

    const totalKb = getKb('MemTotal')
    const availKb = getKb('MemAvailable')
    const usedKb = totalKb - availKb

    return {
      total: Math.round(totalKb / 1024),
      used: Math.round(usedKb / 1024),
      percent: Math.round((usedKb / totalKb) * 100),
    }
  } catch {
    return { used: 0, total: 0, percent: 0 }
  }
}

function getDisk(): { used: number; total: number; percent: number } {
  try {
    const output = execSync("df -BM / | tail -1", { timeout: 3000 }).toString().trim()
    const parts = output.split(/\s+/)
    const totalMb = parseInt(parts[1], 10)
    const usedMb = parseInt(parts[2], 10)
    return {
      total: totalMb,
      used: usedMb,
      percent: Math.round((usedMb / totalMb) * 100),
    }
  } catch {
    return { used: 0, total: 0, percent: 0 }
  }
}

function getUptime(): { seconds: number; formatted: string } {
  try {
    const raw = readFileSync('/proc/uptime', 'utf-8').trim()
    const seconds = Math.floor(parseFloat(raw.split(' ')[0]))
    return { seconds, formatted: formatUptime(seconds) }
  } catch {
    return { seconds: 0, formatted: '0m' }
  }
}

function getHostname(): string {
  try {
    return readFileSync('/etc/hostname', 'utf-8').trim()
  } catch {
    return 'unknown'
  }
}

// Cache for 30 seconds
let cache: { data: SystemStatus; timestamp: number } | null = null
const CACHE_TTL = 30_000

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json({ system: cache.data, cached: true })
    }

    const status: SystemStatus = {
      cpu: getCpuUsage(),
      memory: getMemory(),
      disk: getDisk(),
      uptime: getUptime(),
      hostname: getHostname(),
    }

    cache = { data: status, timestamp: Date.now() }

    return NextResponse.json({ system: status, cached: false })
  } catch (error) {
    log.error('System status error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Failed to get system status' }, { status: 500 })
  }
}
