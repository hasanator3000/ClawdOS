# Contributing to ClawdOS

Technical guide for developers and contributors. For product overview, see [README.md](README.md).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React Server Components) |
| UI | React 19, Tailwind CSS 4 (CSS-based config, not JS) |
| Language | TypeScript 5 (strict mode) |
| Database | PostgreSQL 16 with Row-Level Security |
| DB Client | Raw `pg` — no ORM, parameterized queries only |
| Auth | iron-session + Argon2id |
| Validation | Zod 4 on every API route and server action |
| AI Runtime | OpenClaw gateway (OpenAI-compatible, SSE streaming) |
| RSS | fast-xml-parser |
| ML | @xenova/transformers (offline embeddings for intent routing) |
| Testing | Vitest + Testing Library |

---

## Architecture

```
Browser  ──POST /api/ai/chat──▶  ClawdOS (Next.js :3000)  ──POST /v1/chat/completions──▶  OpenClaw (:18789)
         ◀──SSE stream──────────                           ◀──SSE stream────────────────
```

**Three-column layout:**

```
┌──────┬──────────────┬────────┐
│ Rail │   Content    │  Chat  │
│ 64px │    flex      │ resize │
│      │              │  drag  │
└──────┴──────────────┴────────┘
```

### AI Intent Routing (3 layers)

Not every message needs an LLM call:

1. **Regex** — instant match for common phrases like "open tasks" (< 1ms)
2. **Embeddings** — offline semantic similarity via @xenova/transformers (~6ms, no API call)
3. **OpenClaw LLM** — full reasoning for complex requests (500–2000ms)

Simple commands resolve locally. Only genuinely complex requests hit the AI.

### Action Protocol

When OpenClaw decides to act, it returns structured actions inside `<clawdos>` tags:

```json
<clawdos>{"actions":[{"k":"task.create","p":{"title":"Call bank","priority":3}}]}</clawdos>
```

ClawdOS parses these, validates with Zod, executes server-side, and streams results back via SSE.

---

## Design Tokens

Void-dark theme. All colors via CSS variables — **never hardcode HEX in components**.

```
Background:  var(--bg)      #06060a
Foreground:  var(--fg)      #e2e0ec
Neon purple: var(--neon)    #a78bfa
Green:       var(--green)   #6ee7b7
Warm yellow: var(--warm)    #fbbf24
Red:         var(--red)     #fb7185
Card:        var(--card)    rgba(255,255,255,0.04)
Border:      var(--border)  rgba(255,255,255,0.07)
```

**Fonts:** Outfit (UI text) + Space Mono (code/data)

**Rules:**
- Dark theme only
- No inline styles, no `!important`
- Mobile-first Tailwind breakpoints: `sm` → `md` → `lg` → `xl`
- Glassmorphism cards: `bg-[var(--card)] backdrop-blur-md border border-[var(--border)]`

Full design guide: [RULES/01-STYLE-GUIDE.md](RULES/01-STYLE-GUIDE.md)

---

## Project Structure

```
src/
  app/(app)/                  # Auth-protected pages
    today/                    #   Dashboard (greeting, weather, rates, gauges)
    tasks/                    #   Task management (list, kanban, calendar, timeline)
    news/                     #   RSS aggregator (tabs, search, 50+ sources)
    deliveries/               #   Package tracking (1500+ carriers)
    settings/                 #   User settings, skills marketplace
      skills/                 #   3-tab skill manager (installed/commands/marketplace)
      files/                  #   File manager
  app/api/
    ai/chat/                  #   OpenClaw proxy + action executor
    currencies/               #   Crypto & fiat exchange rates
    webhooks/                 #   TrackingMore callbacks
    consult/                  #   Meta-query endpoint for agents
    health/                   #   Health check (DB + OpenClaw connectivity)
  components/
    shell/                    #   App shell: sidebar, top bar, chat panel, command palette
    dashboard/                #   Dashboard widgets (9 total)
    layout/                   #   Sidebar, nav icons
  lib/
    db/                       #   Database layer
      index.ts                #     Connection pool, withUser() for RLS, drainPool()
      repositories/           #     CRUD operations (raw pg, parameterized queries)
    ai/                       #   AI integration
      actions-executor.ts     #     Parses and executes OpenClaw actions
      stream-processor.ts     #     SSE stream parsing and forwarding
      fast-path-*.ts          #     Regex + embedding intent matchers
    auth/                     #     Sessions (iron-session), passwords (Argon2id), 2FA
    nav/sections.ts           #     Navigation registry (sidebar items + aliases)
    validation.ts             #     withValidation(), validateAction(), formatZodErrors()
    validation-schemas.ts     #     All Zod schemas in one place
    security/rate-limiter.ts  #     Sliding-window rate limiter
    logger.ts                 #     Structured server logger (JSON to stdout)
    client-logger.ts          #     Client-safe logger (dev-only debug/info)
  middleware.ts               #   CSRF → rate limiting → auth gate → route handler
  instrumentation.ts          #   Graceful shutdown (SIGTERM/SIGINT → drainPool)
db/
  schema.sql                  # Complete baseline schema (fresh installs)
  schema_registry.yaml        # Schema manifest (YAML source of truth)
  migrations/                 # Incremental SQL migrations (001–012)
scripts/
  setup.mjs                   # One-command setup (env + Docker + schema + user)
  auto-host.sh                # Automated deploy (systemd, auto-detect tokens)
  backup.sh                   # pg_dump backup with retention
  migrate.mjs                 # Migration runner
RULES/                        # Developer guide (10 files, see below)
```

---

## Developer Guide (RULES/)

Read these before writing code:

| File | What it covers |
|------|---------------|
| [00-OVERVIEW.md](RULES/00-OVERVIEW.md) | Stack, project structure, file index |
| [01-STYLE-GUIDE.md](RULES/01-STYLE-GUIDE.md) | Design tokens, fonts, layout grid, component patterns |
| [02-NEW-SECTION.md](RULES/02-NEW-SECTION.md) | 10-step scaffold checklist for adding a new page |
| [03-FRONTEND.md](RULES/03-FRONTEND.md) | SSR/CSR boundary, contexts, hooks, Tailwind v4 |
| [04-API.md](RULES/04-API.md) | API routes, Zod validation, session auth, server actions |
| [05-DATABASE.md](RULES/05-DATABASE.md) | Migration cookbook, YAML registry, repository pattern, RLS |
| [06-CLAWDBOT-INTEGRATION.md](RULES/06-CLAWDBOT-INTEGRATION.md) | Chat proxy, action protocol, skill ecosystem |
| [07-GOLDEN-RULES.md](RULES/07-GOLDEN-RULES.md) | 5 architectural prohibitions (read this first) |
| [08-DEPLOY-CONTRACT.md](RULES/08-DEPLOY-CONTRACT.md) | ENV vars, health check, install flow |
| [09-OBRATNAYA-SOVMESTIMOST.md](RULES/09-OBRATNAYA-SOVMESTIMOST.md) | Backward compatibility rules |

---

## Golden Rules

1. **No LLM SDK in this repo** — no `@anthropic-ai/sdk`, no `openai`. OpenClaw is the only AI runtime.
2. **No Telegram handlers** — Telegram is an OpenClaw channel, not a ClawdOS feature.
3. **No tokens to browser** — `CLAWDBOT_TOKEN` stays server-side only.
4. **RLS on all queries** — use `withUser(userId, client => ...)` for every DB operation.
5. **No ORM** — raw `pg` with parameterized queries. No Prisma, no Drizzle.

---

## Setup & Deploy

Installation, configuration, and production deploy are fully automated. See [INSTALL.md](INSTALL.md) and [DEPLOY.md](DEPLOY.md).

### Dev Commands

```bash
npm run dev             # Dev server (hot reload)
npm run build           # Production build (Turbopack)
npm run lint            # ESLint (no-console enforced)
npx tsc --noEmit        # Type check
npm run test            # Vitest
npm run analyze         # Bundle size analysis
npm run db:migrate      # Apply pending migrations
```

---

## Quality Gates

Every change must pass before merge:

```bash
npm run build          # Clean build
npm run lint           # Zero errors
npx tsc --noEmit       # Zero type errors
```

**Code limits:**
- Components: < 300 lines
- Utilities: < 400 lines
- Functions: < 50 lines
- Nesting: < 4 levels

**Security checklist:**
- No hardcoded secrets
- All user input validated with Zod
- SQL uses `$1`, `$2` — never string interpolation
- Error responses don't leak internals

---

## AI Agent Instruction Files

The same development guide is available for all major coding assistants:

| File | Agent |
|------|-------|
| [CLAUDE.md](CLAUDE.md) | Claude Code |
| [AGENTS.md](AGENTS.md) | OpenAI Codex |
| [.cursorrules](.cursorrules) | Cursor |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | GitHub Copilot |
| [.windsurfrules](.windsurfrules) | Windsurf |
