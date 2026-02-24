# ClawdOS — Agent Instructions

> Canonical source: [AGENTS.md](AGENTS.md). Keep this file in sync.
> Copies: `CLAUDE.md` (Claude Code), `AGENTS.md` (Codex), `.cursorrules` (Cursor), `.github/copilot-instructions.md` (Copilot), `.windsurfrules` (Windsurf).

## What is this?

ClawdOS is a self-hosted AI-powered personal operating system. Single-user productivity platform: tasks, news/RSS, AI chat, settings — controlled by AI agent and direct UI equally well.

**Stack:** Next.js 16 (App Router) + React 19 + Tailwind v4 (CSS config) + PostgreSQL 16 (raw `pg`, no ORM) + Zod v4 + Clawdbot agent gateway. Full stack details in [RULES/00-OVERVIEW.md](RULES/00-OVERVIEW.md).

## Required reading

Read these files BEFORE writing any code. They are not optional.

| File | What it covers | When to read |
|------|---------------|--------------|
| **This file (CLAUDE.md)** | Golden rules, quality gates, infrastructure context | Always |
| [RULES/00-OVERVIEW.md](RULES/00-OVERVIEW.md) | Stack, project structure, file index | First time |
| [RULES/01-STYLE-GUIDE.md](RULES/01-STYLE-GUIDE.md) | Design tokens, fonts, layout grid, component patterns | Any UI work |
| [RULES/02-NEW-SECTION.md](RULES/02-NEW-SECTION.md) | 10-step scaffold checklist for adding a new section | Adding a page/feature |
| [RULES/03-FRONTEND.md](RULES/03-FRONTEND.md) | SSR/CSR boundary, contexts, hooks, Tailwind v4 patterns | Any frontend work |
| [RULES/04-API.md](RULES/04-API.md) | API routes, Zod validation, session auth, server actions | Any API/action work |
| [RULES/05-DATABASE.md](RULES/05-DATABASE.md) | Migration cookbook, YAML registry, repository pattern, RLS | Any DB work |
| [RULES/06-CLAWDBOT-INTEGRATION.md](RULES/06-CLAWDBOT-INTEGRATION.md) | Chat proxy, action protocol, skill ecosystem | AI/agent integration |
| [RULES/07-GOLDEN-RULES.md](RULES/07-GOLDEN-RULES.md) | 5 architectural prohibitions | Always (before writing code) |
| [RULES/08-DEPLOY-CONTRACT.md](RULES/08-DEPLOY-CONTRACT.md) | ENV vars, health check, install flow, idempotency | New deps/config changes |
| [RULES/09-OBRATNAYA-SOVMESTIMOST.md](RULES/09-OBRATNAYA-SOVMESTIMOST.md) | Agent behavior: act in main instance, don't recreate | Agent operations |

## Golden rules (never violate)

1. **No LLM SDK in this repo** — no `@anthropic-ai/sdk`, no `openai`. Clawdbot is the only AI runtime.
2. **No Telegram handlers** — Telegram is a Clawdbot channel, not a ClawdOS feature.
3. **No tokens to browser** — `CLAWDBOT_TOKEN` stays server-side only.
4. **RLS on all queries** — use `withUser(userId, client => ...)` for every DB operation.
5. **No ORM** — raw `pg` with parameterized queries. No Prisma, no Drizzle.

Full context and rationale: [RULES/07-GOLDEN-RULES.md](RULES/07-GOLDEN-RULES.md)

## Key paths

```
src/app/(app)/              → Auth-protected pages (today, tasks, news, settings)
src/app/api/ai/chat/        → Clawdbot proxy + action executor
src/lib/db/repositories/    → Database CRUD (raw pg + RLS)
src/lib/db/index.ts         → Connection pool + withUser() + drainPool()
src/middleware.ts            → CSRF, rate limiting, auth gate
src/instrumentation.ts      → SIGTERM/SIGINT graceful shutdown
src/lib/logger.ts           → Structured server logger (JSON to stdout)
src/lib/client-logger.ts    → Client-safe logger (for 'use client' components)
src/lib/validation.ts       → withValidation(), validateAction(), formatZodErrors()
src/lib/validation-schemas.ts → Centralized Zod schemas for all data entry points
src/lib/security/rate-limiter.ts → Sliding-window rate limiter (in-memory)
db/migrations/              → SQL migrations (001-009)
db/schema_registry.yaml     → Schema manifest (YAML source of truth)
scripts/setup.mjs           → One-command setup
scripts/backup.sh           → pg_dump backup with retention
RULES/                      → Developer guide (10 files)
```

## Quick reference

```bash
npm run setup           # Install everything (DB + schema + user)
npm run dev             # Dev server on :3000
npm run build           # Production build
npm run lint            # ESLint (no-console enforced)
npm run analyze         # Bundle size analysis
npm run db:migrate      # Apply pending migrations
npm run db:reset        # Destroy + recreate DB
npm run test            # Run vitest
```

## Infrastructure context (not in RULES/)

This section documents cross-cutting infrastructure that isn't covered by individual RULES files.

### Security layers (middleware.ts)

Request flow: CSRF check → Rate limiting → Auth gate → Route handler.

- **CSRF**: Origin header validated for mutating methods (POST/PUT/PATCH/DELETE). Exempt: `/api/health`, `/api/version`, `/access`, `/_next/*`
- **Rate limiting**: Sliding window, 10 req/sec per IP, in-memory Map. Returns 429 with `Retry-After`. Exempt: `/api/health`
- **Auth gate**: Only active when `ACCESS_TOKEN` env is set. Checks cookie (`clawdos.access_token`) → `Authorization: Bearer` header. Redirects to `/access` if invalid.
- **Security headers**: 7 headers in `next.config.ts` — CSP (with `unsafe-inline`/`unsafe-eval` for Next.js RSC), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-DNS-Prefetch-Control

### Validation utilities (validation.ts)

- **`withValidation(schema, handler)`** — wrapper for API routes: parses body with Zod, returns 400 on failure, passes validated data to handler
- **`validateAction(schema, data)`** — for server actions: returns `{ data }` or `{ error }` union
- **`formatZodErrors(error)`** — converts Zod errors to `{ fieldErrors, formErrors }` format
- **All schemas** centralized in `src/lib/validation-schemas.ts`

### Structured logging

- **Server**: `createLogger(module)` from `src/lib/logger.ts` — JSON to stdout, levels: debug/info/warn/error
- **Client**: `createClientLogger(module)` from `src/lib/client-logger.ts` — console.* wrapper, dev-only for debug/info
- **ESLint `no-console` rule** enforced globally. Only logger files are exempt.
- **Slow queries**: `>100ms` auto-logged as warnings with query text and duration (in `src/lib/db/index.ts`)

### Reliability

- **Graceful shutdown**: `src/instrumentation.ts` registers SIGTERM/SIGINT handlers → `drainPool()` → exit 0
- **Pool health**: `/api/health` returns pool metrics (`total`, `idle`, `waiting` connections) + DB/Clawdbot connectivity
- **Circuit breaker**: Available in `src/lib/circuit-breaker.ts` for external service calls

### Frontend resilience

- **Loading states**: Every `(app)/` route segment has `loading.tsx` with skeleton UI
- **Error boundaries**: Every `(app)/` route segment has `error.tsx` with `RouteErrorFallback` (shared component)
- **Lazy loading**: CalendarView, KanbanView, TimelineView loaded via `next/dynamic` with `ssr: false`
- **Images**: `next/image` with `unoptimized` for external URLs (RSS)

## Quality Gates

| Rule | Status | Enforcement |
|------|--------|-------------|
| Files <400 lines | Enforced | Code review |
| Components <300 lines | Enforced | Code review |
| Rate limiting on API routes | Enforced | Middleware auto-applies |
| CSP + security headers | Enforced | next.config.ts |
| Slow query logging (>100ms) | Enforced | Pool wrapper |
| No raw console.* | Enforced | ESLint `no-console` rule |
| Zod validation on all routes | Enforced | withValidation() / validateAction() |
| CSRF on mutations | Enforced | Middleware auto-applies |
| Bundle analysis | Available | `npm run analyze` |
| DB backup | Available | `scripts/backup.sh` |

## Before making changes

1. Read [RULES/07-GOLDEN-RULES.md](RULES/07-GOLDEN-RULES.md)
2. If adding a new section: follow [RULES/02-NEW-SECTION.md](RULES/02-NEW-SECTION.md)
3. If touching the database: follow [RULES/05-DATABASE.md](RULES/05-DATABASE.md)
4. If integrating with Clawdbot: read [RULES/06-CLAWDBOT-INTEGRATION.md](RULES/06-CLAWDBOT-INTEGRATION.md)
5. If changing UI: read [RULES/01-STYLE-GUIDE.md](RULES/01-STYLE-GUIDE.md) for design tokens
6. If adding ENV vars: read [RULES/08-DEPLOY-CONTRACT.md](RULES/08-DEPLOY-CONTRACT.md)

## After completing changes (MANDATORY)

Every feature, refactor, bugfix, or config change MUST pass this quality gate before being considered done. Walk through each category, fix violations, then commit.

### Smoke test (run every time)

```bash
npm run build          # Must pass clean
npm run lint           # Zero errors (no-console enforced)
npx tsc --noEmit       # Zero type errors
```

### Quality checklist by category

**Architecture (8.5)**
- No file >300 lines (components) / 400 lines (utilities)
- No circular dependencies; feature-organized, not type-organized
- New components have clear interfaces, are independently testable

**Security (9.0)**
- No hardcoded secrets/tokens/credentials
- All user input validated with Zod at system boundary
- SQL uses parameterized values (`$1`, `$2`), never interpolation
- Error responses don't leak internals (stack traces, query text, paths)

**Backend (8.0)**
- New API routes: Zod via `withValidation()` or inline `safeParse`
- New server actions: Zod via `validateAction()`
- DB operations use `withUser()` for RLS; repository pattern for CRUD

**Frontend (8.5)**
- New route segments have `loading.tsx` + `error.tsx`
- Heavy components lazy-loaded with `next/dynamic`
- Colors via CSS vars only (`var(--neon)`, etc.) — no hardcoded HEX. See [RULES/01-STYLE-GUIDE.md](RULES/01-STYLE-GUIDE.md)
- Images use `next/image` (with `unoptimized` for external URLs)
- No inline styles, no `!important`; mobile-first Tailwind

**Reliability (8.0)**
- Logging via `createLogger` (server) / `createClientLogger` (client)
- Zero raw `console.*` (ESLint enforced)
- Errors handled explicitly — never silently swallowed

**Code Quality (7.0 -> 8.0)**
- Functions <50 lines, nesting <4 levels
- Immutable patterns (new objects, no mutation)
- No dead code (unused imports, commented blocks)
- Clear naming (no mystery abbreviations)

**DevOps (5.5 -> 7.0)**
- `npm run build` succeeds
- No unjustified new dependencies
- Sensitive files in `.gitignore`

### Audit score reference

| Category | Score | Do not drop below |
|----------|-------|--------------------|
| Architecture | 8.0 | 7.5 |
| Security | 8.5 | 8.0 |
| Backend | 8.0 | 7.5 |
| Frontend | 8.0 | 7.5 |
| Reliability | 7.5 | 7.0 |
| Code Quality | 5.5 | 5.5 |
| DevOps | 4.5 | 4.5 |
| **Overall** | **7.1** | **6.5** |

Any change that drops a category below its floor is a blocker — fix before merging.

## Dev notes rule

When adding a feature that uses external repos, APIs, or CLIs — document it in CLAUDE.md under "Dev Notes" below:
- **What** was added (feature name, route)
- **External deps** — repo URL, API endpoint, CLI tool name+version, auth requirements
- **Files** created/modified
- **How it works** — data flow in 3-5 bullet points

## Dev Notes

### Skill Marketplace (2026-02-23)

3-tab UI at `/settings/skills`: Installed | Commands | Marketplace.

**External deps:**
- **ClawdTM API** — `GET https://clawdtm.com/api/v1/skills/search?q=&limit=` (no auth, public). Repo: https://github.com/0xmythril/clawdtm
- **ClawdHub CLI** — `/usr/bin/clawdhub` v0.3.0. Registry: `https://clawdhub.com`. Manages skill install/update/search.
- **Clawdbot skills** — dirs with `SKILL.md` (YAML frontmatter). Workspace: `/root/clawd/skills/`. Built-in: `/usr/lib/node_modules/clawdbot/skills/`.

**Files:** `settings/skills/skills-actions.ts` (disk read + clawdhub CLI), `marketplace-actions.ts` (ClawdTM proxy), `InstalledSkillCard.tsx`, `MarketplaceCard.tsx`, `SkillsList.tsx` (3-tab orchestrator).

**Flow:** Marketplace search → ClawdTM API → cards with Install button → server action runs `clawdhub install <slug>` → refreshes installed list from disk.
