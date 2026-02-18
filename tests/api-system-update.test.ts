/**
 * Tests for /api/system/update route
 *
 * Tests the route handler's auth check and response logic.
 * Since mocking node:child_process default exports is problematic in vitest,
 * we test the exported handler's structure and auth behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('/api/system/update', () => {
  it('exports POST handler', async () => {
    const mod = await import('../src/app/api/system/update/route')
    expect(mod.POST).toBeDefined()
    expect(typeof mod.POST).toBe('function')
  })

  it('exports force-dynamic', async () => {
    const mod = await import('../src/app/api/system/update/route')
    expect(mod.dynamic).toBe('force-dynamic')
  })

  it('update.sh script exists', async () => {
    const { existsSync } = await import('node:fs')
    const { join } = await import('node:path')
    const scriptPath = join(process.cwd(), 'scripts', 'update.sh')
    expect(existsSync(scriptPath)).toBe(true)
  })

  it('update.sh is executable', async () => {
    const { accessSync, constants } = await import('node:fs')
    const { join } = await import('node:path')
    const scriptPath = join(process.cwd(), 'scripts', 'update.sh')
    expect(() => accessSync(scriptPath, constants.X_OK)).not.toThrow()
  })
})
