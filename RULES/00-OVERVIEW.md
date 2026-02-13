# ClawdOS — Developer Rules & Standards

## What is this?

This directory contains everything a developer (or coding agent) needs to add new sections, features, and integrations to ClawdOS without breaking existing contracts.

## Stack (facts, not assumptions)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| UI | React | 19.2.3 |
| Styles | Tailwind CSS v4 | 4.x (config via CSS `@theme`, NOT `tailwind.config.js`) |
| Components | 100% custom | No shadcn, No Radix, No component libraries |
| Database | PostgreSQL | 16.11 via `pg` directly (No ORM, No Prisma, No Drizzle) |
| Validation | Zod | v4 |
| Auth | iron-session + argon2id | Cookie-based, `getSession()` in server components |
| Agent | Clawdbot | External gateway at `127.0.0.1:18789` |
| Runtime | Node.js | NOT Docker (Docker only for Postgres) |

## File index

| File | Purpose |
|------|---------|
| [01-STYLE-GUIDE.md](01-STYLE-GUIDE.md) | Design tokens, layout pattern, visual standards |
| [02-NEW-SECTION.md](02-NEW-SECTION.md) | Step-by-step scaffold checklist for adding a new section |
| [03-FRONTEND.md](03-FRONTEND.md) | SSR/CSR boundary, components, contexts, Tailwind v4 |
| [04-API.md](04-API.md) | API route structure, Zod validation, session auth, error handling |
| [05-DATABASE.md](05-DATABASE.md) | Migrations (two systems), RLS, repositories, `withUser()`, raw `pg` |
| [06-CLAWDBOT-INTEGRATION.md](06-CLAWDBOT-INTEGRATION.md) | How ClawdOS talks to Clawdbot, action protocol, manifest updates |
| [07-GOLDEN-RULES.md](07-GOLDEN-RULES.md) | Architectural prohibitions (what NOT to do) |
| [08-DEPLOY-CONTRACT.md](08-DEPLOY-CONTRACT.md) | Install contract: env vars, health, idempotency, secrets |

## Key references (not duplicated here)

- `dev/CODING_AGENT_RULES.md` — golden rules & safe patterns (canonical source)
- `dev/AGENT_MANIFEST.md` — what exists, what NOT to invent
- `dev/capabilities.json` — machine-readable capabilities map
- `.env.example` — environment variable contract

## Project structure

```
src/
  app/
    (app)/              # Auth-protected route group
      layout.tsx        # Server layout: session check -> WorkspaceProvider -> Shell
      today/page.tsx    # Dashboard
      tasks/            # page.tsx + TaskList.tsx + actions.ts
      news/             # page.tsx + NewsShell.tsx + components + actions.ts
      settings/         # page.tsx + sub-pages (telegram, password)
    api/
      ai/chat/route.ts  # Clawdbot proxy (the big one: 1000+ lines)
      actions/task/      # Task CRUD API
      consult/           # Meta-query endpoint
      news/refresh/      # RSS refresh API
      workspaces/        # Workspace switching
      currencies/        # Currency rates
    login/page.tsx       # Public login page
  components/
    layout/              # Sidebar, SidebarClient
    shell/               # Shell, ShellWrapper, AIPanel, ContentTopBar, CommandPalette
    dashboard/           # GreetingWidget, CurrencyWidget, QuickLinksWidget, RecentTasksWidget
    ui/                  # GlitchText (decorative)
  contexts/              # WorkspaceContext, AIPanelContext
  hooks/                 # useAIPanel, useChat, useCommandPalette
  lib/
    auth/                # session.ts, service.ts, challenge.ts, telegram.ts
    db/
      index.ts           # Pool + withUser()
      repositories/      # user, workspace, task, news-source, news-tab, news, digest, auth-challenge
    rss/                 # fetcher, parser, validator, live (RSS infrastructure)
    commands/            # chat-handlers.ts (intent router layer 0)
    intents/             # cards.ts (intent definitions)
    telegram/            # send.ts (Telegram message sending)
    workspace.ts         # getActiveWorkspace, getWorkspacesForUser
  types/                 # news.ts, session.ts, etc.
db/
  migrations/            # 001-007: main numbered migrations
  schema/core/migrations/ # 0001-0005: namespace migrations
  functions/             # SQL helper functions
  STATE.md               # Current migration state documentation
  schema_registry.yaml   # Schema manifest
scripts/
  migrate.mjs            # Migration runner
  create-user.mjs        # User creation
  bootstrap-workspaces.mjs # Workspace setup
```
