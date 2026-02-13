# ClawdOS — Installation Guide

Complete step-by-step installation with verification. Designed to be followed by a human or an AI agent.

---

## Pre-flight Checks

Before starting, verify all prerequisites. Every check must pass.

### 1. Node.js >= 22

```bash
node --version
# Expected: v22.x.x or higher
```

If missing: install via [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org)

### 2. Docker is running

```bash
docker info > /dev/null 2>&1 && echo "OK" || echo "FAIL"
# Expected: OK
```

If missing: install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine

### 3. Port 5432 is free (PostgreSQL)

```bash
lsof -i :5432 2>/dev/null | grep LISTEN || echo "Port free"
# Expected: "Port free" or already running lifeos-db container
```

### 4. Port 3000 is free (ClawdOS web)

```bash
lsof -i :3000 2>/dev/null | grep LISTEN || echo "Port free"
# Expected: "Port free"
```

### 5. Port 18789 is free (Clawdbot gateway)

```bash
lsof -i :18789 2>/dev/null | grep LISTEN || echo "Port free"
# Expected: "Port free" (unless Clawdbot is already running)
```

---

## Step 1: Clone and Install

```bash
git clone <repo-url> && cd lifeos
npm install
```

**Verify:**
```bash
ls node_modules/.package-lock.json && echo "OK"
# Expected: OK
```

---

## Step 2: Run Setup

```bash
npm run setup
```

This single command does everything:

1. Creates `.env.local` from `.env.local.example`
2. Generates secrets: `SESSION_PASSWORD`, `CLAWDBOT_TOKEN`, `LIFEOS_CONSULT_TOKEN`
3. Starts PostgreSQL via `docker compose up -d`
4. Waits for DB readiness (up to 30 seconds)
5. Detects fresh vs existing DB:
   - **Fresh:** applies `db/schema.sql` (complete baseline)
   - **Existing:** runs `scripts/migrate.mjs` (incremental)
6. Prompts for first user credentials (interactive)

**Verify:**
```bash
# .env.local exists with generated secrets
grep SESSION_PASSWORD .env.local | grep -v "^#" && echo "OK"

# PostgreSQL is running
docker compose ps --status=running -q db && echo "DB running"

# Database has tables
docker compose exec -T db psql -U lifeos -d lifeos -c "SELECT count(*) FROM core.\"user\"" 2>/dev/null && echo "Schema OK"
```

---

## Step 3: Connect Clawdbot

ClawdOS is the UI. **Clawdbot is the AI brain.** They communicate over HTTP on localhost.

### Architecture

```
Browser  ──POST /api/ai/chat──>  ClawdOS (Next.js)  ──POST /v1/chat/completions──>  Clawdbot
         <──SSE stream──────────                     <──SSE stream────────────────
```

### API Contract

ClawdOS sends requests to Clawdbot using an **OpenAI-compatible** chat completions API:

**Endpoint:** `POST ${CLAWDBOT_URL}/v1/chat/completions`

**Headers:**
```
Authorization: Bearer ${CLAWDBOT_TOKEN}
Content-Type: application/json
x-clawdbot-agent-id: main
```

**Request body:**
```json
{
  "model": "clawdbot",
  "stream": true,
  "user": "lifeos:<userId>:ws:<workspaceId>",
  "messages": [
    { "role": "system", "content": "You are Clawdbot running inside LifeOS WebUI..." },
    { "role": "user", "content": "User's message here" }
  ]
}
```

**Response:** OpenAI-compatible SSE stream (or JSON when `stream: false`)

```
data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}

data: {"choices":[{"delta":{"content":" there!"},"index":0}]}

data: [DONE]
```

### Token Exchange

ClawdOS and Clawdbot must share the same `CLAWDBOT_TOKEN`. This token was auto-generated during setup.

**Read the token from ClawdOS:**
```bash
grep CLAWDBOT_TOKEN .env.local | cut -d= -f2
```

**Configure Clawdbot** to accept this token on port `18789`. The exact configuration depends on your Clawdbot setup — the key requirements are:

1. Listen on `http://127.0.0.1:18789` (loopback only — never expose to network)
2. Accept `Authorization: Bearer <token>` matching the token above
3. Serve `POST /v1/chat/completions` with OpenAI-compatible request/response
4. Support `stream: true` (SSE) and `stream: false` (JSON)

### Consult Endpoint (Optional)

ClawdOS also has a meta-query endpoint at `POST /api/consult`. This lets Clawdbot (or other agents) ask questions about ClawdOS architecture and capabilities.

**Auth:** Session cookie OR `x-lifeos-consult-token` header

```bash
# Token was auto-generated during setup:
grep LIFEOS_CONSULT_TOKEN .env.local | cut -d= -f2
```

### Environment Variables for Clawdbot Connection

These are already set in `.env.local` after setup:

| Variable | Value | Purpose |
|----------|-------|---------|
| `CLAWDBOT_URL` | `http://127.0.0.1:18789` | Where ClawdOS sends AI requests |
| `CLAWDBOT_TOKEN` | *(auto-generated hex)* | Shared auth token |
| `LIFEOS_CONSULT_TOKEN` | *(auto-generated hex)* | Auth for `/api/consult` endpoint |

If Clawdbot runs on a different host/port, update `CLAWDBOT_URL` in `.env.local`.

---

## Step 4: Start ClawdOS

```bash
# Development
npm run dev

# Production
npm run build && npm start
```

**Verify:**
```bash
# App is responding
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
# Expected: 200
```

---

## Step 5: Post-Install Verification

Run through this checklist to confirm everything works:

### Basic functionality
- [ ] Open `http://localhost:3000` — login page loads
- [ ] Log in with the credentials created during setup
- [ ] Dashboard shows greeting, time, and quick links
- [ ] Navigate to Tasks, News, Settings via sidebar

### AI chat (requires Clawdbot running)
- [ ] Click chat toggle — AI panel opens
- [ ] Send a message — get a streaming response
- [ ] Say "create a task called Test" — task appears in Tasks page
- [ ] Say "navigate to news" — page switches to News

### Workspace isolation
- [ ] Workspace name shows in sidebar
- [ ] Data is scoped to the active workspace

### If something fails

| Symptom | Cause | Fix |
|---------|-------|-----|
| Login page doesn't load | App not running | `npm run dev` |
| "Unauthorized" after login | Bad session secret | Delete `.env.local`, re-run `npm run setup` |
| Database connection error | PostgreSQL not running | `npm run db:up` |
| Chat says "Upstream error" | Clawdbot not running or wrong token | Start Clawdbot, verify token matches |
| Chat says "CLAWDBOT_TOKEN is not set" | Missing env var | Check `.env.local` has `CLAWDBOT_TOKEN=...` |
| 502 on chat | Clawdbot unreachable | Verify Clawdbot is on `127.0.0.1:18789` |
| Tasks don't save | RLS issue | Check user has workspace membership |

---

## Optional: Telegram 2FA

For password recovery via Telegram:

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Get the bot token
3. Add to `.env.local`:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```
4. Restart the app
5. Go to Settings → Telegram → link your Telegram account

---

## Optional: Access Gate

If exposing ClawdOS over IP (not recommended), add a gate token:

```bash
# Generate token
openssl rand -base64 32

# Add to .env.local
ACCESS_TOKEN=<paste-token-here>
```

Users will need to enter this token once to access the app. Stored in a cookie after first entry.

---

## All Scripts

| Command | What it does |
|---------|-------------|
| `npm run setup` | Full setup: env + Docker + schema + user |
| `npm run dev` | Start dev server on :3000 |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run db:up` | Start PostgreSQL container |
| `npm run db:down` | Stop PostgreSQL container |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:reset` | Destroy + recreate database from scratch |
| `npm run user:create -- <user> <pass>` | Create or update a user |

---

## File Structure (Key Files)

```
.env.local              ← Your secrets (gitignored, auto-generated)
.env.local.example      ← Template for .env.local
docker-compose.yml      ← PostgreSQL container definition
db/schema.sql           ← Complete baseline schema (fresh installs)
db/migrations/          ← Incremental migrations (upgrades)
scripts/setup.mjs       ← One-command setup script
src/app/api/ai/chat/    ← Clawdbot proxy (where AI requests go)
src/app/api/consult/    ← Meta-query endpoint for agents
CLAUDE.md               ← AI agent entry point (read this file first)
RULES/                  ← Developer guide (9 files)
```
