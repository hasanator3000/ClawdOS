# 08 — Deployment Contract

## Environment variables

### Current contract (`.env.example`)

| Variable | Required | Type | How to generate | Description |
|----------|----------|------|-----------------|-------------|
| `APP_URL` | Optional | URL | `http://localhost:3000` | App base URL |
| `SESSION_PASSWORD` | **Required** | Base64 string (48+ bytes) | `openssl rand -base64 48` | iron-session encryption key |
| `DATABASE_URL` | **Required** | Postgres URI | Manual | `postgres://user:pass@host:5432/db` |
| `CLAWDBOT_URL` | **Required** | URL | Default: `http://127.0.0.1:18789` | Clawdbot gateway address |
| `CLAWDBOT_TOKEN` | **Required** | Hex string (24 bytes) | `openssl rand -hex 24` | Gateway auth token |
| `LIFEOS_CONSULT_TOKEN` | Optional | Hex string (24 bytes) | `openssl rand -hex 24` | Meta-query auth token |
| `TELEGRAM_BOT_TOKEN` | Optional | String | From @BotFather | For 2FA codes |
| `ACCESS_TOKEN` | Optional | Base64 string | `openssl rand -base64 32` | IP-access gate token |
| `SESSION_COOKIE_SECURE` | Optional | `"true"` | Set if HTTPS | Secure cookie flag |

### Rules for adding new ENV variables

- [ ] Add to `.env.example` with placeholder value and generation instruction
- [ ] Add to `.env.local.example` with empty value
- [ ] Mark as **Required** or **Optional** in comment
- [ ] Document in this table
- [ ] If auto-generatable (random token): provide `openssl` command
- [ ] If user-provided (API key, bot token): explain where to get it
- [ ] **NEVER** commit real values — `.env*` is in `.gitignore`
- [ ] **NEVER** use `NEXT_PUBLIC_` prefix for secrets — they get bundled into client JS

## Secrets security

### Rules

- [ ] All secrets in `.env.local` only (gitignored)
- [ ] Tokens accessed only in server-side code (API routes, server components, server actions)
- [ ] No `NEXT_PUBLIC_*` for any secret or token
- [ ] `CLAWDBOT_TOKEN` used only in `src/app/api/ai/chat/route.ts`, `src/app/api/assistant/route.ts`, `src/app/api/consult/route.ts`
- [ ] `TELEGRAM_BOT_TOKEN` used only in `src/lib/telegram/send.ts`

### When adding a new external service

- [ ] Token goes in `.env.local` only
- [ ] Access token in server-side code only
- [ ] Add to both `.env.example` and `.env.local.example`
- [ ] Document in this file

## Health check

Currently there is **no dedicated `/api/health` endpoint**. If you add one:

### Recommended `/api/health` pattern

```typescript
export async function GET() {
  const checks: Record<string, 'ok' | 'error'> = {}

  // DB connectivity
  try {
    const pool = getPool()
    await pool.query('SELECT 1')
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }

  // Clawdbot connectivity (optional)
  try {
    const res = await fetch(`${process.env.CLAWDBOT_URL}/health`, { signal: AbortSignal.timeout(3000) })
    checks.clawdbot = res.ok ? 'ok' : 'error'
  } catch {
    checks.clawdbot = 'error'
  }

  const allOk = Object.values(checks).every((v) => v === 'ok')
  return NextResponse.json({ status: allOk ? 'healthy' : 'degraded', checks }, { status: allOk ? 200 : 503 })
}
```

### Rules for health checks

- [ ] If your section adds a new external dependency (new service, new port), add it to health checks
- [ ] Health endpoint must NOT require auth (for monitoring tools)
- [ ] Health endpoint must respond within 5 seconds
- [ ] Return 200 for healthy, 503 for degraded

## Database idempotency

### Migration idempotency

- [ ] Use `CREATE TABLE IF NOT EXISTS` for tables
- [ ] Use `CREATE INDEX IF NOT EXISTS` for indexes
- [ ] Use `DROP POLICY IF EXISTS` + `CREATE POLICY` for RLS policies (no `IF NOT EXISTS` for policies in PG 16.11)
- [ ] Use `CREATE OR REPLACE FUNCTION` for functions
- [ ] Wrap in `BEGIN; ... COMMIT;` for transactional safety

### Script idempotency

- [ ] `scripts/migrate.mjs` — tracks applied migrations, skips already-applied ones
- [ ] `scripts/bootstrap-workspaces.mjs` — uses `ON CONFLICT ... DO UPDATE` (safe to re-run)
- [ ] `scripts/create-user.mjs` — checks existence before creating

### Rules

- [ ] Re-running any migration must not fail or corrupt data
- [ ] Re-running any setup script must not duplicate records
- [ ] All scripts return clear exit codes (0 = success, 1 = error)

## Install flow for new users

```bash
# 1. Clone
git clone <repo> && cd lifeos

# 2. Install deps
npm ci

# 3. Start database
docker compose up -d
# Wait for healthcheck to pass

# 4. Configure environment
cp .env.local.example .env.local
# Edit .env.local — fill in SESSION_PASSWORD, CLAWDBOT_TOKEN, etc.

# 5. Run migrations
node scripts/migrate.mjs

# 6. Create user
node scripts/create-user.mjs <username> <password>

# 7. Bootstrap workspace
OWNER=<username> node scripts/bootstrap-workspaces.mjs

# 8. Build & start
npm run build
npm start
```

### Rules for maintaining install flow

- [ ] Every new DB table must have a migration — no manual SQL
- [ ] New features must NOT require manual DB changes beyond running `migrate.mjs`
- [ ] New ENV variables must have sensible defaults or clear error messages
- [ ] `npm run build` must succeed with only required ENV variables set

## Manifest updates

When adding a new section with API or DB:

- [ ] Update `dev/capabilities.json` — add routes, tables
- [ ] Update `dev/AGENT_MANIFEST.md` — if adding new integration points
- [ ] Update `RULES/00-OVERVIEW.md` project structure — if adding new directories

## Anti-patterns (DO NOT)

- **DO NOT** commit `.env.local` or any file with real secrets
- **DO NOT** use `NEXT_PUBLIC_` for secrets
- **DO NOT** create migrations that fail on re-run
- **DO NOT** require manual SQL execution for setup
- **DO NOT** add services that require separate manual installation (unless documented)
- **DO NOT** hardcode ports, URLs, or credentials in source files
- **DO NOT** skip updating `.env.example` when adding new variables
