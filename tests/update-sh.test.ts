/**
 * Tests for scripts/update.sh
 *
 * These tests run the actual bash script in a temporary git repo
 * to verify its behavior end-to-end.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { execSync, type ExecSyncOptions } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const SCRIPT_PATH = join(__dirname, '..', 'scripts', 'update.sh')

function createTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'clawdos-update-test-'))

  const opts: ExecSyncOptions = { cwd: dir, stdio: 'pipe' }

  // Init a bare "remote" repo
  const remoteDir = join(dir, 'remote.git')
  execSync(`git init --bare "${remoteDir}"`, opts)

  // Create a "local" clone that mimics a ClawdOS install
  const localDir = join(dir, 'local')
  execSync(`git clone "${remoteDir}" "${localDir}"`, { ...opts, stdio: 'pipe' })

  const localOpts: ExecSyncOptions = { cwd: localDir, stdio: 'pipe' }

  // Configure git user for commits
  execSync('git config user.email "test@test.com"', localOpts)
  execSync('git config user.name "Test"', localOpts)

  // Create package.json
  writeFileSync(join(localDir, 'package.json'), JSON.stringify({
    name: 'clawdos',
    version: '0.1.0',
    scripts: { build: 'echo build ok', start: 'echo start' },
  }))

  // Copy update.sh into scripts/
  mkdirSync(join(localDir, 'scripts'), { recursive: true })
  execSync(`cp "${SCRIPT_PATH}" "${localDir}/scripts/update.sh"`, opts)

  // Create a stub migrate.mjs
  writeFileSync(join(localDir, 'scripts', 'migrate.mjs'), 'console.log("migrate ok")')

  // Initial commit
  execSync('git add -A', localOpts)
  execSync('git commit -m "Initial commit"', localOpts)
  execSync('git push origin master', localOpts)

  return dir
}

function pushNewVersion(dir: string, version: string, tag?: string): void {
  // Clone remote into a temp "upstream" dir, make changes, push
  const upstreamDir = join(dir, 'upstream')
  if (existsSync(upstreamDir)) rmSync(upstreamDir, { recursive: true })

  const remoteDir = join(dir, 'remote.git')
  execSync(`git clone "${remoteDir}" "${upstreamDir}"`, { cwd: dir, stdio: 'pipe' })

  const upOpts: ExecSyncOptions = { cwd: upstreamDir, stdio: 'pipe' }
  execSync('git config user.email "test@test.com"', upOpts)
  execSync('git config user.name "Test"', upOpts)

  // Update package.json version
  const pkg = JSON.parse(readFileSync(join(upstreamDir, 'package.json'), 'utf8'))
  pkg.version = version
  writeFileSync(join(upstreamDir, 'package.json'), JSON.stringify(pkg))

  execSync('git add -A', upOpts)
  execSync(`git commit -m "Release ${version}"`, upOpts)

  if (tag) {
    execSync(`git tag ${tag}`, upOpts)
    execSync(`git push origin master --tags`, upOpts)
  } else {
    execSync('git push origin master', upOpts)
  }
}

function runUpdate(dir: string, args: string = ''): { stdout: string; exitCode: number } {
  const localDir = join(dir, 'local')
  try {
    const stdout = execSync(`bash scripts/update.sh ${args}`, {
      cwd: localDir,
      stdio: 'pipe',
      timeout: 30_000,
      env: { ...process.env, PATH: process.env.PATH },
    }).toString()
    return { stdout, exitCode: 0 }
  } catch (err: any) {
    return { stdout: (err.stdout?.toString() ?? '') + (err.stderr?.toString() ?? ''), exitCode: err.status ?? 1 }
  }
}

describe('update.sh', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempRepo()
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('--help exits 0 and shows usage', () => {
    const { stdout, exitCode } = runUpdate(tempDir, '--help')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage')
    expect(stdout).toContain('--check')
    expect(stdout).toContain('--force')
    expect(stdout).toContain('--rollback')
  })

  it('--check exits 0 when up to date', () => {
    const { exitCode, stdout } = runUpdate(tempDir, '--check')
    expect(exitCode).toBe(0)
    expect(stdout).toContain('up to date')
  })

  it('--check exits 2 when update is available', () => {
    pushNewVersion(tempDir, '0.2.0', 'v0.2.0')
    const { exitCode, stdout } = runUpdate(tempDir, '--check')
    expect(exitCode).toBe(2)
    expect(stdout).toContain('available')
  })

  it('creates .update directory structure', () => {
    const localDir = join(tempDir, 'local')
    runUpdate(tempDir, '--check')
    expect(existsSync(join(localDir, '.update'))).toBe(true)
    expect(existsSync(join(localDir, '.update', 'backups'))).toBe(true)
  })

  it('creates lock and removes it after run', () => {
    const localDir = join(tempDir, 'local')
    // After a successful --check, lock should be released
    runUpdate(tempDir, '--check')
    expect(existsSync(join(localDir, '.update', 'update.lock'))).toBe(false)
  })

  it('detects update via tag and reports version', () => {
    pushNewVersion(tempDir, '0.2.0', 'v0.2.0')
    const { exitCode, stdout } = runUpdate(tempDir, '--check')
    expect(exitCode).toBe(2)
    expect(stdout).toMatch(/0\.1\.0/)
    expect(stdout).toMatch(/0\.2\.0/)
  })

  it('detects update via remote master when no tags', () => {
    pushNewVersion(tempDir, '0.2.0') // no tag
    const { exitCode } = runUpdate(tempDir, '--check')
    expect(exitCode).toBe(2)
  })

  it('writes to history.log on check', () => {
    const localDir = join(tempDir, 'local')
    runUpdate(tempDir, '--check')
    const historyPath = join(localDir, '.update', 'history.log')
    expect(existsSync(historyPath)).toBe(true)
    const content = readFileSync(historyPath, 'utf8')
    expect(content).toContain('CHECK')
  })

  it('--rollback fails when no backups exist', () => {
    const localDir = join(tempDir, 'local')
    mkdirSync(join(localDir, '.update', 'backups'), { recursive: true })
    const { exitCode, stdout } = runUpdate(tempDir, '--rollback')
    expect(exitCode).not.toBe(0)
    expect(stdout).toContain('No backups found')
  })

  it('rejects unknown flags', () => {
    const { exitCode, stdout } = runUpdate(tempDir, '--invalid-flag')
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Unknown option')
  })
})
