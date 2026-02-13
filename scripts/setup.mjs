#!/usr/bin/env node
/**
 * ClawdOS — One-command setup
 *
 * Usage:
 *   npm run setup
 *
 * What it does:
 *   1. Starts PostgreSQL via docker compose (if not running)
 *   2. Waits for DB readiness
 *   3. Initialises schema (baseline for fresh DB, migrations for existing)
 *   4. Creates owner user + workspace (interactive prompts)
 *
 * Safe to re-run — all operations are idempotent.
 */
import { execSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import path from 'node:path'
import crypto from 'node:crypto'

const ROOT = path.resolve(import.meta.dirname, '..')
const ENV_FILE = path.join(ROOT, '.env.local')
const ENV_EXAMPLE = path.join(ROOT, '.env.local.example')

// ── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) { console.log(`\x1b[36m>\x1b[0m ${msg}`) }
function ok(msg) { console.log(`\x1b[32m✓\x1b[0m ${msg}`) }
function warn(msg) { console.log(`\x1b[33m!\x1b[0m ${msg}`) }
function fail(msg) { console.error(`\x1b[31m✗\x1b[0m ${msg}`); process.exit(1) }

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    rl.question(`  ${question} `, (answer) => { rl.close(); resolve(answer.trim()) })
  })
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: opts.silent ? 'pipe' : 'inherit', ...opts })
  } catch (e) {
    if (!opts.ignoreError) fail(`Command failed: ${cmd}`)
    return null
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// ── Step 1: Environment ─────────────────────────────────────────────────────

async function ensureEnv() {
  if (existsSync(ENV_FILE)) {
    ok('.env.local exists')
    return
  }

  log('Creating .env.local from example...')
  copyFileSync(ENV_EXAMPLE, ENV_FILE)

  // Generate secrets
  let content = readFileSync(ENV_FILE, 'utf8')
  if (!content.includes('SESSION_PASSWORD=') || content.match(/SESSION_PASSWORD=\s*$/m)) {
    const pw = crypto.randomBytes(48).toString('base64')
    content = content.replace(/SESSION_PASSWORD=.*/, `SESSION_PASSWORD=${pw}`)
  }
  if (!content.includes('CLAWDBOT_TOKEN=') || content.match(/CLAWDBOT_TOKEN=\s*$/m)) {
    const token = crypto.randomBytes(24).toString('hex')
    content = content.replace(/CLAWDBOT_TOKEN=.*/, `CLAWDBOT_TOKEN=${token}`)
  }
  if (!content.includes('LIFEOS_CONSULT_TOKEN=') || content.match(/LIFEOS_CONSULT_TOKEN=\s*$/m)) {
    const token = crypto.randomBytes(24).toString('hex')
    content = content.replace(/LIFEOS_CONSULT_TOKEN=.*/, `LIFEOS_CONSULT_TOKEN=${token}`)
  }
  writeFileSync(ENV_FILE, content)
  ok('.env.local created with generated secrets')
}

// ── Step 2: Docker Postgres ─────────────────────────────────────────────────

async function ensurePostgres() {
  // Check if docker is available
  const docker = spawnSync('docker', ['info'], { stdio: 'pipe' })
  if (docker.status !== 0) {
    fail('Docker is not running. Please start Docker and try again.')
  }

  // Check if container is already running
  const ps = spawnSync('docker', ['compose', 'ps', '--status=running', '-q', 'db'], {
    cwd: ROOT, stdio: 'pipe',
  })
  if (ps.stdout?.toString().trim()) {
    ok('PostgreSQL is running')
    return
  }

  log('Starting PostgreSQL...')
  run('docker compose up -d')
  ok('PostgreSQL started')
}

// ── Step 3: Wait for DB ─────────────────────────────────────────────────────

async function waitForDb() {
  log('Waiting for database...')
  for (let i = 0; i < 30; i++) {
    const result = spawnSync('docker', ['compose', 'exec', '-T', 'db', 'pg_isready', '-U', 'lifeos', '-d', 'lifeos'], {
      cwd: ROOT, stdio: 'pipe',
    })
    if (result.status === 0) {
      ok('Database is ready')
      return
    }
    await sleep(1000)
  }
  fail('Database did not become ready in 30 seconds')
}

// ── Step 4: Apply schema ────────────────────────────────────────────────────

async function applySchema() {
  // Load env for DATABASE_URL
  const envContent = readFileSync(ENV_FILE, 'utf8')
  const dbUrl = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim()
  if (!dbUrl) fail('DATABASE_URL not found in .env.local')

  process.env.DATABASE_URL = dbUrl

  const pg = await import('pg')
  const pool = new pg.default.Pool({ connectionString: dbUrl })

  try {
    // Check if schema exists (core.user table = DB is initialised)
    const check = await pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema='core' AND table_name='user' LIMIT 1"
    ).catch(() => ({ rows: [] }))

    if (check.rows.length === 0) {
      // Fresh install — apply baseline schema
      log('Fresh database detected — applying baseline schema...')
      const schema = readFileSync(path.join(ROOT, 'db', 'schema.sql'), 'utf8')
      await pool.query(schema)
      ok('Baseline schema applied')
    } else {
      // Existing install — run migrations
      log('Existing database detected — running migrations...')
      run(`node ${path.join(ROOT, 'scripts', 'migrate.mjs')}`, { silent: false })
      ok('Migrations applied')
    }
  } finally {
    await pool.end()
  }
}

// ── Step 5: Create user + workspace ─────────────────────────────────────────

async function seedUser() {
  const envContent = readFileSync(ENV_FILE, 'utf8')
  const dbUrl = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim()
  process.env.DATABASE_URL = dbUrl

  const pg = await import('pg')
  const pool = new pg.default.Pool({ connectionString: dbUrl })

  try {
    // Check if any user exists
    const users = await pool.query('SELECT username FROM core."user" LIMIT 1')
    if (users.rows.length > 0) {
      ok(`User "${users.rows[0].username}" already exists`)
      await pool.end()
      return
    }

    // No users — ask for credentials
    console.log()
    log('No users found. Let\'s create the first one.')
    const username = await ask('Username:') || 'admin'
    const password = await ask('Password (min 8 chars):')
    if (!password || password.length < 8) fail('Password must be at least 8 characters')

    // Create user
    run(`node ${path.join(ROOT, 'scripts', 'create-user.mjs')} ${username} '${password.replace(/'/g, "'\\''")}'`, { silent: true })
    ok(`User "${username}" created`)

    // Bootstrap workspace
    process.env.OWNER = username
    run(`node ${path.join(ROOT, 'scripts', 'bootstrap-workspaces.mjs')}`, { silent: true })
    ok(`Workspace "${username}" created`)
  } finally {
    await pool.end()
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log()
console.log('\x1b[1m  ClawdOS Setup\x1b[0m')
console.log()

await ensureEnv()
await ensurePostgres()
await waitForDb()
await applySchema()
await seedUser()

console.log()
console.log('\x1b[32m  Setup complete!\x1b[0m')
console.log()
console.log('  Next steps:')
console.log('    npm run dev        — start development server')
console.log('    npm run build      — build for production')
console.log('    npm start          — start production server')
console.log()
console.log('  Open: \x1b[36mhttp://localhost:3000\x1b[0m')
console.log()
