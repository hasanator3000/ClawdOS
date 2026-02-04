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

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_PASSWORD` | Cookie encryption key (generate with `openssl rand -base64 48`) |
| `ACCESS_TOKEN` | Optional gate token for additional access control |

## License

Private - All rights reserved.
