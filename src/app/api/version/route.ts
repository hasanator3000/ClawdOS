import { NextResponse } from 'next/server'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const dynamic = 'force-dynamic'

/** Cache latest version for 30 minutes to avoid hammering git remote */
let cachedLatest: { version: string; tag: string; checkedAt: number } | null = null
const CACHE_TTL = 30 * 60 * 1000

function getCurrentVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    return pkg.version || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function getLatestVersion(): { version: string; tag: string } | null {
  const now = Date.now()
  if (cachedLatest && now - cachedLatest.checkedAt < CACHE_TTL) {
    return { version: cachedLatest.version, tag: cachedLatest.tag }
  }

  try {
    // Fetch tags from remote (timeout 10s)
    execSync('git fetch --tags origin 2>/dev/null', {
      cwd: process.cwd(),
      timeout: 10_000,
      stdio: 'ignore',
    })

    // Find latest semver tag
    const latestTag = execSync("git tag -l 'v*' --sort=-version:refname 2>/dev/null | head -1", {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 5_000,
    }).trim()

    if (latestTag) {
      const version = latestTag.replace(/^v/, '')
      cachedLatest = { version, tag: latestTag, checkedAt: now }
      return { version, tag: latestTag }
    }

    // No tags — compare with remote master
    const localHead = execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 5_000,
    }).trim()

    const remoteHead = execSync('git rev-parse origin/master 2>/dev/null', {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 5_000,
    }).trim()

    if (localHead !== remoteHead) {
      // Check if remote has new commits
      try {
        execSync(`git merge-base --is-ancestor origin/master HEAD`, {
          cwd: process.cwd(),
          timeout: 5_000,
          stdio: 'ignore',
        })
        // Remote is ancestor of local — we're ahead or same
        cachedLatest = { version: getCurrentVersion(), tag: 'origin/master', checkedAt: now }
      } catch {
        // Remote is NOT ancestor — update available
        cachedLatest = { version: `${getCurrentVersion()}+`, tag: 'origin/master', checkedAt: now }
        return { version: cachedLatest.version, tag: 'origin/master' }
      }
    } else {
      cachedLatest = { version: getCurrentVersion(), tag: 'origin/master', checkedAt: now }
    }

    return { version: cachedLatest.version, tag: cachedLatest.tag }
  } catch {
    return null
  }
}

export async function GET() {
  const current = getCurrentVersion()
  const latest = getLatestVersion()

  const updateAvailable = latest
    ? latest.version !== current && latest.version.endsWith('+')
      ? true
      : latest.tag.startsWith('v') && latest.version !== current
    : false

  return NextResponse.json({
    current,
    latest: latest?.version ?? current,
    updateAvailable,
    checkedAt: new Date().toISOString(),
  })
}
