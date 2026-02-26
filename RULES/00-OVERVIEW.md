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
| [01-STYLE-GUIDE.md](01-STYLE-GUIDE.md) | Design tokens, layout pattern, visual standards, component patterns |
| [02-NEW-SECTION.md](02-NEW-SECTION.md) | Step-by-step scaffold checklist for adding a new section |
| [03-FRONTEND.md](03-FRONTEND.md) | SSR/CSR boundary, components, contexts, mobile layout, Tailwind v4 |
| [04-API.md](04-API.md) | API route structure, Zod validation, session auth, webhooks, error handling |
| [05-DATABASE.md](05-DATABASE.md) | Migrations (two systems), RLS, repositories, `withUser()`, raw `pg` |
| [06-CLAWDBOT-INTEGRATION.md](06-CLAWDBOT-INTEGRATION.md) | How ClawdOS talks to Clawdbot, action protocol, 3-layer intent router |
| [07-GOLDEN-RULES.md](07-GOLDEN-RULES.md) | Architectural prohibitions (what NOT to do) — 6 rules |
| [08-DEPLOY-CONTRACT.md](08-DEPLOY-CONTRACT.md) | Install contract: env vars, health check, systemd deploy, idempotency |
| [09-OBRATNAYA-SOVMESTIMOST.md](09-OBRATNAYA-SOVMESTIMOST.md) | Agent behavior rules: act in main instance, don't recreate |

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
      actions.ts        # Shared server actions
      loading.tsx       # Global loading skeleton
      error.tsx         # Global error boundary
      today/page.tsx    # Dashboard
      tasks/            # page.tsx + TaskList, TaskItem, TaskCreateForm, TaskFilters, FilterDropdown, DateTimePicker, actions.ts
      news/             # page.tsx + NewsShell, NewsSearch, components, actions.ts
      deliveries/       # page.tsx + DeliveryList, DeliveryCard, DeliveryDetail, AddDeliveryForm, actions.ts
      settings/         # page.tsx + sub-pages (telegram, password, dashboard, skills, files)
        skills/           # Skills & Marketplace (3 tabs: Installed, Commands, Marketplace)
    api/
      ai/
        chat/route.ts     # Clawdbot proxy + action executor + 3-layer intent router
        utils/gateway.ts  # Shared gateway helpers
      actions/task/route.ts  # Task CRUD API
      assistant/route.ts     # Simple Clawdbot passthrough
      build-id/route.ts      # Current build hash (GET)
      consult/route.ts       # Meta-query endpoint
      currencies/route.ts    # Currency rates (GET)
      health/route.ts        # Health check — DB + Clawdbot + pool metrics (GET, no auth)
      news/refresh/route.ts  # RSS refresh (POST)
      settings/route.ts      # User settings CRUD (GET, PUT, DELETE)
      system/
        status/route.ts      # System status (git, disk, memory, uptime)
        update/route.ts      # Git pull + rebuild trigger
      version/route.ts       # App version info (GET)
      weather/route.ts       # Weather data (GET)
      webhooks/
        trackingmore/route.ts # TrackingMore webhook receiver (POST, no auth/CSRF)
      workspaces/route.ts    # List workspaces (GET)
      workspaces/switch/route.ts # Switch workspace (POST)
    auth/
      actions.ts        # signIn, signOut server actions
    login/page.tsx      # Public login page
    access/page.tsx     # Access token gate page
  components/
    layout/             # Sidebar, SidebarClient, sidebar/nav-icons
    shell/              # Shell, ShellWrapper, AIPanel, ContentTopBar, CommandPalette
                        # BottomTabBar, MobileChatSheet, MobileDrawer
                        # ai-panel/ (EmptyState, MessageBubble)
    dashboard/          # GreetingWidget, CurrencyWidget, QuickLinksWidget, RecentTasksWidget
                        # ProcessesWidget, ProcessForm, ProcessModal, SystemStatusWidget, AgentMetricsWidget
    system/             # BuildGuard (stale-client detection), UpdateBanner (update notification)
    ui/                 # RouteErrorFallback, WidgetErrorBoundary
  contexts/             # WorkspaceContext, AIPanelContext
  hooks/
    useAIPanel.ts       # AI panel open/close/resize with localStorage persistence
    useChat.ts          # Chat message sending, SSE streaming, conversation management
    useCommandPalette.ts # Command palette open/close with Cmd+K shortcut
    useIsMobile.ts      # Mobile breakpoint detection (768px) via useSyncExternalStore
    chat-types.ts       # Chat message TypeScript types
    chat-stream-parser.ts # SSE stream parser for chat responses
  lib/
    ai/
      actions-executor.ts    # Action whitelist + handlers (11 action keys)
      stream-processor.ts    # SSE stream processor — filters <clawdos> blocks, executes actions
      fast-path-builders.ts  # Build SSE responses for fast-path results
      fast-path-news.ts      # News-specific fast-path builders
      conversation.ts        # Conversation creation + message persistence
      repository.ts          # AI conversation DB queries
      conversation.repository.ts # Conversation CRUD
      message.repository.ts  # Message CRUD
      artifact-memory.repository.ts # Artifact memory storage
      tool-call.repository.ts # Tool call tracking
      sse-utils.ts           # SSE encoding helpers
      types.ts               # AI-related TypeScript types
    auth/                    # session.ts, service.ts, challenge.ts, telegram.ts
    commands/
      chat-handlers.ts       # Regex fast-path command resolution (Layer 0)
      intent.ts              # Intent scoring utilities
      registry.ts            # Command registry
    db/
      index.ts               # Pool + withUser() + drainPool()
      repositories/          # 12 repositories (see below)
    intents/
      cards.ts               # Intent card definitions for embedding match
      embeddings.ts          # Embedding layer for semantic intent matching (Layer 1)
      router.ts              # 3-layer intent router (regex -> embeddings -> LLM)
    nav/
      sections.ts            # Section definitions — single source of truth for navigation
      resolve.ts             # Section path resolution utilities
    rss/                     # fetcher, parser, validator, live (RSS infrastructure)
    security/
      rate-limiter.ts        # Sliding-window rate limiter (in-memory)
    trackingmore/
      client.ts              # TrackingMore API v3 client (detect, create, realtime, delete, get)
      types.ts               # TrackingMore TypeScript types
    telegram/                # send.ts (Telegram message sending)
    workspace/
      index.ts               # getActiveWorkspace module
      service.ts             # Workspace service logic
    circuit-breaker.ts       # Circuit breaker for external service calls
    validation.ts            # withValidation(), validateAction(), formatZodErrors()
    validation-schemas.ts    # Centralized Zod schemas for all data entry points
    workspace.ts             # getActiveWorkspace, getWorkspacesForUser
    logger.ts                # Structured server logger (JSON to stdout)
    client-logger.ts         # Client-safe logger (for 'use client' components)
    constants.ts             # Shared constants
  types/                     # news.ts, session.ts, etc.
db/
  migrations/                # 001-012: main numbered migrations
  schema/core/migrations/    # 0001-0005: namespace migrations
  schema/content/schema.yaml # Content schema YAML definitions
  functions/                 # SQL helper functions
  STATE.md                   # Current migration state documentation
  schema_registry.yaml       # Schema manifest
scripts/
  migrate.mjs               # Migration runner
  create-user.mjs           # User creation
  bootstrap-workspaces.mjs  # Workspace setup
  setup.mjs                 # One-command setup
  backup.sh                 # pg_dump backup with retention
```

## API routes (complete)

| Route | Methods | Auth | Purpose |
|-------|---------|------|---------|
| `/api/ai/chat` | GET, POST, DELETE | Session | Chat proxy, history, archive |
| `/api/actions/task` | POST, PATCH, DELETE | Session | Task CRUD |
| `/api/assistant` | POST | Session | Simple Clawdbot passthrough |
| `/api/build-id` | GET | None | Current build hash |
| `/api/consult` | POST | Session OR token | Meta-query endpoint |
| `/api/currencies` | GET | Session | Currency rates |
| `/api/health` | GET | None | DB + Clawdbot + pool metrics |
| `/api/news/refresh` | POST | Session OR token | RSS refresh |
| `/api/settings` | GET, PUT, DELETE | Session | User settings CRUD |
| `/api/system/status` | GET | Session | System info (git, disk, memory) |
| `/api/system/update` | POST | Session | Git pull + rebuild trigger |
| `/api/version` | GET | None | App version info |
| `/api/weather` | GET | Session | Weather data |
| `/api/webhooks/trackingmore` | POST | None (webhook) | TrackingMore status updates |
| `/api/workspaces` | GET | Session | List workspaces |
| `/api/workspaces/switch` | POST | Session | Switch active workspace |

## Migrations (001-012)

| File | Content |
|------|---------|
| `001_init.sql` | Core schema: user, workspace, membership, RLS functions, news_item, digest |
| `002_data_contracts.sql` | Event log, entity/links, settings, files schema |
| `003_ai_schema.sql` | conversation, message tables |
| `004_tasks_schema.sql` | task table with full feature set |
| `005_news_sources.sql` | news_source, news_tab, news_source_tab junction |
| `006_news_image.sql` | image_url column on news_item |
| `007_news_perf_indexes.sql` | Performance indexes for news |
| `008_processes_schema.sql` | Scheduled processes table with RLS |
| `009_task_duration.sql` | start_date and start_time columns for duration-based tasks |
| `010_projects_schema.sql` | Project grouping for tasks |
| `011_task_recurrence.sql` | recurrence_rule JSONB column for recurring tasks |
| `012_deliveries_schema.sql` | Package tracking with TrackingMore integration |

## Repositories (12)

| Repository | Entity | Complexity |
|-----------|--------|-----------|
| `task.repository.ts` | Tasks | Full CRUD, dynamic UPDATE, status logic, array ops, subtasks |
| `news-source.repository.ts` | RSS sources | Status tracking, error counting, stale detection |
| `news-tab.repository.ts` | News tabs | Junction table management, bulk reorder |
| `news.repository.ts` | News items | Dynamic WHERE builder, cursor pagination, ILIKE search, batch upsert |
| `digest.repository.ts` | Digests | Digest CRUD |
| `workspace.repository.ts` | Workspaces | Minimal query with JOIN |
| `user.repository.ts` | Users | Profile, password, telegram link |
| `user-setting.repository.ts` | User settings | Key-value settings store |
| `auth-challenge.repository.ts` | Auth challenges | 2FA challenge flow |
| `process.repository.ts` | Processes | Scheduled process management |
| `project.repository.ts` | Projects | Task project grouping |
| `delivery.repository.ts` | Deliveries | Package tracking, event updates, status management |
