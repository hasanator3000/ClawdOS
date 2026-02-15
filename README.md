<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind 4" />
</p>

<h1 align="center">
  <br />
  ClawdOS
  <br />
  <sub><sup>AI-powered personal operating system</sup></sub>
</h1>

<p align="center">
  Self-hosted. Private. Multi-workspace. Built for people who want an AI assistant<br/>that actually <em>does things</em>, not just talks about them.
</p>

---

## 🤖 For AI Agents (Clawdbot, Claude, etc.)

**To deploy this project: run `./setup` from the repo root.** See [AI.md](AI.md) for details.

The script auto-detects your Clawdbot tokens from `~/.clawdbot/clawdbot.json`, finds free ports, sets up PostgreSQL, applies schema, creates admin user, builds, and starts the server. Output is JSON with URL + credentials.

---

## Why ClawdOS?

Most "AI productivity apps" give you a chatbot that answers questions. ClawdOS gives you an **AI that controls your workspace** — it creates tasks, manages news feeds, navigates pages, and executes actions on your behalf, all through natural language.

Everything runs on **your own server**. No cloud accounts, no subscriptions, no data leaving your machine.

### What it does

- **AI Chat Panel** — talk to Clawdbot, your personal agent. It doesn't just answer questions — it creates tasks, adds RSS feeds, switches pages, and more. All through a resizable side panel with streaming responses.

- **Task Management** — workspace-scoped tasks with 4 priority levels, due dates, status tracking, and filters. Create them manually or just tell the AI: *"remind me to call the bank tomorrow, high priority"*.

- **News Aggregator** — RSS/Atom/JSON feed reader with custom tabs, full-text search, and 50+ pre-configured sources (AI, tech, crypto, finance, world news). Add new sources by pasting a URL or asking the AI.

- **Dashboard** — live clock, personalized greeting, crypto & fiat rates with 24h change, recent tasks, and quick links. Everything at a glance.

- **Multi-Workspace** — personal and shared workspaces with complete data isolation. Switch between them instantly. Every piece of data is workspace-scoped via PostgreSQL Row-Level Security.

- **Command Palette** — `Cmd+K` to search and jump anywhere. Pages, workspaces, actions — all in one place.

---

## Design

Void-black background. Glassmorphism cards. Neon purple accents. A collapsible sidebar rail that gets out of your way.

```
 Color System             Layout
 ────────────             ──────
 Background:  #06060a     ┌──────┬──────────────┬────────┐
 Neon:        #a78bfa     │ Rail │   Content    │  Chat  │
 Pink:        #f472b6     │ 64px │    flex      │ resize │
 Cyan:        #67e8f9     │      │              │  drag  │
 Glass:       4% white    └──────┴──────────────┴────────┘
```

- **Collapsible sidebar** — 64px rail (icons) or 220px expanded (labels)
- **Resizable AI panel** — drag to resize, toggle with one click
- **Glass cards** — `backdrop-filter: blur` with subtle borders
- **Space Mono + Outfit** — monospace for data, sans-serif for UI

---

## Quick Start

**Prerequisites:** Node.js >= 22, Docker

```bash
git clone <repo> && cd clawdos
npm install
npm run setup
npm run dev
# Open http://localhost:3000
```

`npm run setup` creates secrets, starts PostgreSQL, applies the schema, and walks you through first-user creation.

> **Full guide with pre-flight checks, Clawdbot wiring, and troubleshooting:** [INSTALL.md](INSTALL.md)

---

## The AI

ClawdOS connects to **Clawdbot** — a separate agent runtime that runs alongside the app. The AI isn't just a chatbot. It has a whitelisted set of actions it can perform:

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

The AI sees your current page, active workspace, and task context. Ask it *"what's on my plate today?"* and it knows.

**3-layer intent routing** keeps things fast:
- **Layer 1:** Regex patterns — instant match for common phrases (< 1ms)
- **Layer 2:** Embeddings — semantic similarity for fuzzy matches (~6ms)
- **Layer 3:** LLM — full reasoning for complex requests

---

## Security

ClawdOS is built for self-hosting on a private network.

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
| `npm run user:create -- <user> <pass>` | Create or update a user |

---

## Environment Variables

All secrets are auto-generated by `npm run setup`. You only need to configure optional features manually.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Auto | PostgreSQL connection string |
| `SESSION_PASSWORD` | Auto | Cookie encryption key |
| `CLAWDBOT_URL` | Auto | Agent gateway URL |
| `CLAWDBOT_TOKEN` | Auto | Agent auth token |
| `TELEGRAM_BOT_TOKEN` | No | For 2FA codes (from [@BotFather](https://t.me/BotFather)) |
| `CLAWDOS_CONSULT_TOKEN` | No | Meta-query endpoint token |
| `ACCESS_TOKEN` | No | IP-based access gate |

---

## Project Structure

```
src/
  app/(app)/              # Auth-protected pages
    today/                #   Dashboard with widgets
    tasks/                #   Task management
    news/                 #   RSS feed aggregator
    settings/             #   User settings + 2FA
  app/api/                # API routes
    ai/chat/              #   Clawdbot proxy + action executor
    actions/              #   Task & news mutations
    currencies/           #   Crypto & fiat rates
  components/
    shell/                # Shell, AI panel, command palette
    layout/               # Sidebar, navigation
    dashboard/            # Dashboard widgets
  hooks/                  # useChat, useAIPanel, useCommandPalette
  lib/
    db/repositories/      # Raw pg + RLS queries
    auth/                 # Session, passwords, 2FA
    commands/             # Fast-path intent routing
    rss/                  # Feed fetching & parsing
db/
  schema.sql              # Baseline schema (fresh installs)
  migrations/             # Incremental migrations
  schema_registry.yaml    # Schema documentation
scripts/
  setup.mjs               # One-command setup
RULES/                    # Developer guide (9 files)
```

---

## For Developers & AI Agents

Start with [CLAUDE.md](CLAUDE.md) — the entry point for coding agents. It links to rules, key paths, and golden prohibitions.

ClawdOS is designed to be extended. The `RULES/` directory contains everything you need to add new sections:

| File | What it covers |
|------|---------------|
| [00-OVERVIEW.md](RULES/00-OVERVIEW.md) | Full stack reference and file index |
| [01-STYLE-GUIDE.md](RULES/01-STYLE-GUIDE.md) | Design tokens, layout grid, component patterns |
| [02-NEW-SECTION.md](RULES/02-NEW-SECTION.md) | Step-by-step scaffold checklist |
| [03-FRONTEND.md](RULES/03-FRONTEND.md) | Server/client components, hooks, TypeScript |
| [04-API.md](RULES/04-API.md) | API route templates, Zod validation, auth |
| [05-DATABASE.md](RULES/05-DATABASE.md) | Migration cookbook, YAML registry, repository pattern |
| [06-CLAWDBOT-INTEGRATION.md](RULES/06-CLAWDBOT-INTEGRATION.md) | AI proxy, action protocol, intent routing |
| [07-GOLDEN-RULES.md](RULES/07-GOLDEN-RULES.md) | Architectural prohibitions |
| [08-DEPLOY-CONTRACT.md](RULES/08-DEPLOY-CONTRACT.md) | ENV contract, health checks, DB idempotency |

Want to add a new section? Follow [02-NEW-SECTION.md](RULES/02-NEW-SECTION.md) — it's a 10-step checklist from database to AI integration.

### Agent instruction files

The same instructions are provided in formats for all major AI coding agents:

| File | Agent |
|------|-------|
| [CLAUDE.md](CLAUDE.md) | Claude Code |
| [AGENTS.md](AGENTS.md) | OpenAI Codex (canonical source) |
| [.cursorrules](.cursorrules) | Cursor |
| [.github/copilot-instructions.md](.github/copilot-instructions.md) | GitHub Copilot |
| [.windsurfrules](.windsurfrules) | Windsurf |

---

## License

Private — All rights reserved.
