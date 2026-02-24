import { createLogger } from '@/lib/logger'

export async function register() {
  // Only run shutdown hooks on the server (not Edge runtime)
  if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'nodejs') {
    const log = createLogger('shutdown')

    const shutdown = async (signal: string) => {
      log.info('Shutdown signal received', { signal })

      // Dynamic import to avoid bundling in Edge
      const { drainPool } = await import('@/lib/db')
      await drainPool()

      log.info('Shutdown complete, exiting')
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))

    const initLog = createLogger('init')
    initLog.info('Shutdown handlers registered')
  }
}
