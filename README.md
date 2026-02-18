<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0--alpha-blueviolet?style=flat-square" alt="v0.1.0-alpha" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4" />
</p>

<h1 align="center">
  ClawdOS
  <br />
  <sub><sup>AI-powered personal operating system</sup></sub>
</h1>

<p align="center">
  Self-hosted. Private. Multi-workspace.<br/>
  An AI assistant that actually <em>does things</em>, not just talks about them.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &middot;
  <a href="#features">Features</a> &middot;
  <a href="#the-ai">The AI</a> &middot;
  <a href="#updates">Updates</a> &middot;
  <a href="INSTALL.md">Full Install Guide</a>
</p>

---

## Why ClawdOS?

Most "AI productivity apps" give you a chatbot that answers questions. ClawdOS gives you an **AI that controls your workspace** — it creates tasks, manages news feeds, navigates pages, and executes actions on your behalf, all through natural language.

Everything runs on **your own server**. No cloud accounts, no subscriptions, no data leaving your machine.

---

## Quick Start

**Prerequisites:** Node.js >= 22, Docker

```bash
git clone https://github.com/hasanator3000/ClawdOS.git && cd ClawdOS
npm install
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with the credentials created during setup.

> **Full guide with pre-flight checks, Clawdbot wiring, and troubleshooting:** [INSTALL.md](INSTALL.md)

---

## Features

### AI Chat Panel

Talk to Clawdbot, your personal agent. It doesn't just answer questions — it creates tasks, adds RSS feeds, switches pages, and more. Resizable side panel with streaming responses.

### Task Management

Workspace-scoped tasks with 4 priority levels, due dates, status tracking, and filters. Create them manually or tell the AI: *"remind me to call the bank tomorrow, high priority"*.

### News Aggregator

RSS/Atom/JSON feed reader with custom tabs, full-text search, and 50+ pre-configured sources (AI, tech, crypto, finance, world news). Add sources by pasting a URL or asking the AI.

### Dashboard

Live clock, personalized greeting, crypto & fiat rates with 24h change, recent tasks, and quick links. Everything at a glance.

### Multi-Workspace

Personal and shared workspaces with complete data isolation. Switch instantly. Every piece of data is workspace-scoped via PostgreSQL Row-Level Security.

### Command Palette

`Cmd+K` to search and jump anywhere — pages, workspaces, actions.

---

## Design

Void-black background. Glassmorphism cards. Neon purple accents. A collapsible sidebar that gets out of your way.

```
 Color System             Layout
 ────────────             ──────
 Background:  #06060a     ┌──────┬──────────────┬────────┐
 Neon:        #a78bfa     │ Rail │   Content    │  Chat  │
 Pink:        #f472b6     │ 64px │    flex      │ resize │
 Cyan:        #67e8f9     │      │              │  drag  │
 Glass:       4% white    └──────┴──────────────┴────────┘
```

---

## The AI

ClawdOS connects to **Clawdbot** — a separate agent runtime. The AI has a whitelisted set of actions:

| Action | What it does |
|--------|-------------|
| `task.create` | Creates a task with title, priority, description |
| `task.complete` | Marks a task as done |
| `task.reopen` | Reopens a completed task |
| `task.delete` | Deletes a task |
| `news.source.add` | Adds an RSS feed with optional tab assignment |
| `news.source.remove` | Removes a feed source |
| `news.tab.create` | Creates a new news category |
| `navigate` | Opens any page in the app |

**3-layer intent routing** keeps things fast:

1. **Regex patterns** — instant match for common phrases (< 1ms)
2. **Embeddings** — semantic similarity for fuzzy matches (~6ms)
3. **LLM** — full reasoning for complex requests

---

## Updates

ClawdOS has a built-in auto-update system that keeps your instance current without losing any of your data or customizations.

### How it works

Updates use **git merge** — the only strategy that correctly preserves your changes alongside upstream updates:

- **Your data** (tasks, chat, workspaces, RSS) lives in PostgreSQL — never touched
- **Your config** (`.env.local`) is gitignored — never touched
- **New files** you or the AI agent created — merge passes without conflict
- **Edited files** — auto-merged if changes are in different lines; clean rollback if not

### Check and apply

```bash
npm run update:check    # Just check (exit 0 = current, exit 2 = update available)
npm run update          # Apply update
```

### What happens during an update

1. Locks to prevent concurrent updates
2. Fetches latest version (git tags or remote HEAD)
3. Backs up current state
4. Merges upstream changes (`git merge --no-edit`)
5. Installs dependencies (`npm ci`)
6. Runs database migrations (additive only, always safe)
7. Builds the app (old version keeps serving until done)
8. Restarts the service
9. Health check — if anything fails, **automatic rollback**

### Automatic updates

When deployed via `auto-host.sh`, a systemd timer checks for updates every 6 hours. You can disable this per-user in Settings.

### Update from the UI

A banner appears when a new version is available. Click **Update** to apply, or **Dismiss** to skip until the next release.

### Rollback

```bash
bash scripts/update.sh --rollback    # Revert to the previous version
```

---

## User Settings

Customizations are stored **in the database**, not in files — so updates never affect them:

| Setting | Description |
|---------|-------------|
| Theme accent color | Personalize the UI color scheme |
| Locale | Interface language |
| Currencies | Which rates to show on the dashboard |
| Timezone | Your local timezone |
| Auto-update | Enable or disable automatic updates |

Manage via the Settings page or the `/api/settings` endpoint.

---

## Security

Built for self-hosting on a private network.

| Layer | Implementation |
|-------|---------------|
| Passwords | Argon2id hashing (GPU-resistant) |
| Sessions | iron-session with httpOnly, sameSite cookies |
| 2FA | Optional Telegram-based OTP codes |
| Data isolation | PostgreSQL Row-Level Security per workspace |
| AI tokens | Server-side only — never exposed to browser |
| Input validation | Zod schemas on all API routes |

> **Do not expose ClawdOS on a public IP.** Use [Tailscale](https://tailscale.com) or an SSH tunnel:
> ```bash
> ssh -L 3000:127.0.0.1:3000 user@your-vps
> ```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 with RLS |
| DB Client | Raw `pg` — no ORM |
| Auth | iron-session + Argon2id |
| Validation | Zod 4 |
| AI | Clawdbot gateway (SSE streaming) |
| RSS | fast-xml-parser |
| ML | @xenova/transformers (offline embeddings) |
| Testing | Vitest + Testing Library |

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run setup` | One-command setup (env + DB + schema + user) |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run db:up` | Start PostgreSQL |
| `npm run db:down` | Stop PostgreSQL |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:reset` | Destroy and recreate database |
| `npm run user:create` | Create or update a user |
| `npm run update` | Apply available updates |
| `npm run update:check` | Check for updates without applying |
| `npm test` | Run test suite |
| `npm run test:watch` | Run tests in watch mode |

---

## Environment Variables

All secrets are auto-generated by `npm run setup`. Manual configuration is optional.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Auto | PostgreSQL connection string |
| `SESSION_PASSWORD` | Auto | Cookie encryption key |
| `CLAWDBOT_URL` | Auto | Agent gateway URL |
| `CLAWDBOT_TOKEN` | Auto | Agent auth token |
| `TELEGRAM_BOT_TOKEN` | No | For 2FA codes via [@BotFather](https://t.me/BotFather) |
| `CLAWDOS_CONSULT_TOKEN` | No | Meta-query endpoint token |
| `ACCESS_TOKEN` | No | IP-based access gate |

---

## Project Structure

```
src/
  app/(app)/              # Auth-protected pages
    today/                #   Dashboard
    tasks/                #   Task management
    news/                 #   RSS aggregator
    settings/             #   User settings
  app/api/
    ai/chat/              #   Clawdbot proxy + actions
    version/              #   Version check
    system/update/        #   Update trigger
    settings/             #   User settings CRUD
    currencies/           #   Crypto & fiat rates
  components/
    shell/                # Shell, AI panel, command palette
    layout/               # Sidebar, navigation
    dashboard/            # Dashboard widgets
    system/               # Update banner
  lib/
    db/repositories/      # Raw pg + RLS queries
    auth/                 # Session, passwords, 2FA
    commands/             # Intent routing
    rss/                  # Feed fetching & parsing
db/
  schema.sql              # Baseline schema
  migrations/             # Incremental migrations
scripts/
  setup.mjs               # One-command setup
  update.sh               # Update engine
  auto-host.sh            # Production deployment
tests/                    # Vitest test suite
RULES/                    # Developer guide
```

---

## For Developers

ClawdOS is designed to be extended. Start with [CLAUDE.md](CLAUDE.md) for an overview of architecture, key paths, and golden rules.

The [RULES/](RULES/) directory has everything you need:

| File | Covers |
|------|--------|
| [00-OVERVIEW.md](RULES/00-OVERVIEW.md) | Stack reference, file index |
| [02-NEW-SECTION.md](RULES/02-NEW-SECTION.md) | Step-by-step scaffold checklist |
| [05-DATABASE.md](RULES/05-DATABASE.md) | Migration cookbook, repository pattern |
| [07-GOLDEN-RULES.md](RULES/07-GOLDEN-RULES.md) | 5 architectural prohibitions |

<details>
<summary>AI agent instruction files</summary>

The same development instructions are available for all major coding assistants:

| File | Agent |
|------|-------|
| [CLAUDE.md](CLAUDE.md) | Claude Code |
| [AGENTS.md](AGENTS.md) | OpenAI Codex |
| [.cursorrules](.cursorrules) | Cursor |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | GitHub Copilot |
| [.windsurfrules](.windsurfrules) | Windsurf |

For automated deployment, see [.clawdbot-deploy](.clawdbot-deploy) and [AI.md](AI.md).

</details>

---

## License

Private — All rights reserved.
