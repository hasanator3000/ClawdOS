/**
 * Client-safe logger for browser components.
 *
 * Same interface as createLogger() from '@/lib/logger', but uses
 * console.* internally since process.stdout is not available in the browser.
 *
 * In production builds, only warn/error are emitted. In dev, all levels work.
 */

const isDev = process.env.NODE_ENV === 'development'

export function createClientLogger(module: string) {
  const prefix = `[${module}]`

  return {
    debug: (msg: string, extra?: Record<string, unknown>) => {
      if (isDev) console.debug(prefix, msg, extra ?? '')
    },
    info: (msg: string, extra?: Record<string, unknown>) => {
      if (isDev) console.info(prefix, msg, extra ?? '')
    },
    warn: (msg: string, extra?: Record<string, unknown>) => {
      console.warn(prefix, msg, extra ?? '')
    },
    error: (msg: string, extra?: Record<string, unknown>) => {
      console.error(prefix, msg, extra ?? '')
    },
  }
}
