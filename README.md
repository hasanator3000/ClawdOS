# LifeOS

AI-first personal operating system. Self-hosted, multi-tenant, powered by Next.js and PostgreSQL.

## Features

- **AI Agent Core** - Chat interface with tool execution (Clawdbot)
- **Multi-workspace** - Isolated data per workspace with PostgreSQL RLS
- **Local Auth** - Username/password with Argon2id + optional Telegram 2FA
- **Command Palette** - Quick navigation with `Cmd+K`
- **Dark Mode** - Automatic theme based on system preference

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4
- **Backend**: PostgreSQL 16 with Row-Level Security
- **Auth**: iron-session, Argon2id password hashing
- **Deployment**: Self-hosted (VPS + Tailscale recommended)

## For coding agents

If you are using Claude Code/Cursor/etc. for development, read these first:
- `docs/AGENT_MANIFEST.md` (source of truth: what already exists, what not to invent)
- `CODING_AGENT_RULES.md` (safe patterns for modules, DB, and Clawdbot integration)
- `docs/capabilities.json` (machine-readable map of endpoints/schemas)

## Quick Start

```bash
# 1. Configure environment
cp .env.local.example .env.local
# Edit .env.local with your DATABASE_URL and SESSION_PASSWORD

# 2. Start PostgreSQL
./scripts/db-up.sh

# 3. Run migrations
export DATABASE_URL=postgres://lifeos:lifeos@localhost:5432/lifeos
node scripts/migrate.mjs

# 4. Create a user
node scripts/create-user.mjs myuser 'MySecurePassword123'

# 5. Start development server
npm run dev
```

Open http://localhost:3000

## Project Structure

```
lifeos/
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── lib/           # Services, repositories, utilities
│   └── hooks/         # React hooks
├── db/
│   ├── migrations/    # SQL migrations
│   └── schema/        # Schema definitions
├── scripts/           # Utility scripts
├── docs/              # Documentation
│   ├── architecture.md
│   ├── principles.md
│   ├── roadmap.md
│   └── development/   # Dev planning docs
└── public/            # Static assets
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and data flow
- [Principles](docs/PRINCIPLES.md) - Development guidelines
- [Operations](docs/OPS.md) - Deployment and maintenance
- [Roadmap](docs/ROADMAP.md) - Feature planning

## Security

> **Important**: Do not expose this app publicly on a raw VPS IP.

Recommended access patterns:

1. **Tailscale** - Bind to localhost, access via tailnet
2. **SSH Tunnel** - `ssh -L 3000:127.0.0.1:3000 user@vps`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SESSION_PASSWORD` | Yes | Cookie encryption key (generate: `openssl rand -base64 48`) |
| `CLAWDBOT_URL` | Yes | Clawdbot gateway URL (default: `http://127.0.0.1:18789`) |
| `CLAWDBOT_TOKEN` | Yes | Bearer token for Clawdbot gateway (generate: `openssl rand -hex 24`) |
| `LIFEOS_CONSULT_TOKEN` | No | Token for `/api/consult` and `/api/news/refresh` endpoints |
| `ACCESS_TOKEN` | No | Gate token when exposing by IP (stored in cookie after first entry) |
| `SESSION_COOKIE_SECURE` | No | Set to `true` if behind HTTPS (default: `false`) |

## License

Private - All rights reserved.
