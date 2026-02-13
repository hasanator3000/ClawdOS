# ClawdOS — Agent Instructions

> This file is the canonical agent instruction set. Identical copies exist for other agents:
> `CLAUDE.md` (Claude Code), `.cursorrules` (Cursor), `.github/copilot-instructions.md` (GitHub Copilot), `.windsurfrules` (Windsurf).

## What is this?

ClawdOS is a self-hosted AI-powered personal operating system. Next.js 16 + PostgreSQL 16 + Clawdbot agent.

## If you're installing this project

Read [INSTALL.md](INSTALL.md) — step-by-step guide with pre-flight checks, one-command setup, Clawdbot wiring, and verification.

## If you're developing / adding features

Read the `RULES/` directory — 9 files covering everything from database migrations to frontend patterns:

- [RULES/00-OVERVIEW.md](RULES/00-OVERVIEW.md) — project structure, stack, file index
- [RULES/02-NEW-SECTION.md](RULES/02-NEW-SECTION.md) — step-by-step checklist for adding a new section
- [RULES/05-DATABASE.md](RULES/05-DATABASE.md) — migration cookbook, YAML registry, repository pattern
- [RULES/07-GOLDEN-RULES.md](RULES/07-GOLDEN-RULES.md) — 5 architectural prohibitions (read BEFORE writing code)

## Golden rules (never violate)

1. **No LLM SDK in this repo** — no `@anthropic-ai/sdk`, no `openai`. Clawdbot is the only AI runtime.
2. **No Telegram handlers** — Telegram is a Clawdbot channel, not a LifeOS feature.
3. **No tokens to browser** — `CLAWDBOT_TOKEN` stays server-side only.
4. **RLS on all queries** — use `withUser(userId, client => ...)` for every DB operation.
5. **No ORM** — raw `pg` with parameterized queries. No Prisma, no Drizzle.

## Key paths

```
src/app/(app)/           → Auth-protected pages (today, tasks, news, settings)
src/app/api/ai/chat/     → Clawdbot proxy + action executor (the big one)
src/lib/db/repositories/ → Database CRUD (raw pg + RLS)
src/lib/db/index.ts      → Connection pool + withUser()
db/migrations/           → SQL migrations (001-007)
db/schema_registry.yaml  → Schema manifest (YAML source of truth)
scripts/setup.mjs        → One-command setup
RULES/                   → Developer guide (9 files)
```

## Quick reference

```bash
npm run setup           # Install everything (DB + schema + user)
npm run dev             # Dev server on :3000
npm run db:migrate      # Apply pending migrations
npm run db:reset        # Destroy + recreate DB
```

## Before making changes

1. Read [RULES/07-GOLDEN-RULES.md](RULES/07-GOLDEN-RULES.md)
2. If adding a new section: follow [RULES/02-NEW-SECTION.md](RULES/02-NEW-SECTION.md)
3. If touching the database: follow [RULES/05-DATABASE.md](RULES/05-DATABASE.md)
4. If integrating with Clawdbot: read [RULES/06-CLAWDBOT-INTEGRATION.md](RULES/06-CLAWDBOT-INTEGRATION.md)
