import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { execSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scriptPath = join(process.cwd(), 'scripts', 'update.sh')
  if (!existsSync(scriptPath)) {
    return NextResponse.json({ error: 'Update script not found' }, { status: 500 })
  }

  // Check if update is actually available first
  try {
    execSync('bash scripts/update.sh --check', {
      cwd: process.cwd(),
      timeout: 30_000,
      stdio: 'ignore',
    })
    // Exit 0 means up to date
    return NextResponse.json({ error: 'Already up to date' }, { status: 409 })
  } catch (err: any) {
    if (err.status === 2) {
      // Exit 2 = update available, proceed
    } else {
      return NextResponse.json({ error: 'Failed to check for updates' }, { status: 500 })
    }
  }

  // Launch update in background (survives server restart)
  const child = spawn('bash', [scriptPath], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  })
  child.unref()

  return NextResponse.json({
    ok: true,
    message: 'Update started. The server will restart when complete.',
    pid: child.pid,
  })
}
