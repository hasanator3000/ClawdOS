/**
 * Structured JSON logger for ClawdOS.
 *
 * Outputs JSON lines to stdout/stderr for easy parsing by log aggregators.
 * Falls back to readable format when NODE_ENV=development.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  msg: string
  module?: string
  [key: string]: unknown
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const minLevel = LOG_LEVELS[(process.env.LOG_LEVEL as LogLevel) ?? 'info'] ?? 1
const isDev = process.env.NODE_ENV === 'development'

function emit(entry: LogEntry) {
  if (LOG_LEVELS[entry.level] < minLevel) return

  const payload = {
    ts: new Date().toISOString(),
    ...entry,
  }

  if (isDev) {
    // Human-readable in dev
    const { ts, level, msg, module: mod, ...rest } = payload
    const prefix = mod ? `[${mod}]` : ''
    const extra = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(`${ts} ${level.toUpperCase()} ${prefix} ${msg}${extra}`)
  } else {
    // JSON lines in production
    const out = entry.level === 'error' ? process.stderr : process.stdout
    out.write(JSON.stringify(payload) + '\n')
  }
}

/**
 * Create a scoped logger for a module.
 *
 * Usage:
 * ```ts
 * const log = createLogger('rss')
 * log.info('Fetched 5 sources', { count: 5 })
 * log.error('Feed parse failed', { url, error: err.message })
 * ```
 */
export function createLogger(module: string) {
  return {
    debug: (msg: string, extra?: Record<string, unknown>) =>
      emit({ level: 'debug', msg, module, ...extra }),
    info: (msg: string, extra?: Record<string, unknown>) =>
      emit({ level: 'info', msg, module, ...extra }),
    warn: (msg: string, extra?: Record<string, unknown>) =>
      emit({ level: 'warn', msg, module, ...extra }),
    error: (msg: string, extra?: Record<string, unknown>) =>
      emit({ level: 'error', msg, module, ...extra }),
  }
}
