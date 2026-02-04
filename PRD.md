# Product Requirements Document: LifeOS / aiOS

## Vision

AI-first personal operating system. Clawdbot (AI agent) is the core — everything else (news, tasks, finance, files) are skills/extensions of the agent. Web UI is the rich workstation interface, Telegram is the remote console.

## Core Value

**The agent can do anything the user needs — web UI unlocks the full potential that Telegram can't provide.**

## Target User

Solo developer (AG) who wants a Bloomberg Terminal-level personal OS that's self-hosted and AI-powered.

## Existing Foundation

- Next.js 16 + React 19 + TypeScript + Tailwind 4
- PostgreSQL with Row-Level Security (RLS)
- Multi-workspace tenancy model
- Server Actions for mutations
- Repository pattern for data access
- Telegram 2FA via outbox pattern
- Basic news/digest pages (/today, /news)

## Success Metrics

1. User can interact with agent via web chat
2. Agent can execute skills (news, tasks)
3. Navigation is instant (no page reload lag)
4. All data is workspace-isolated via RLS

## Constraints

- **Tech stack**: Next.js + Postgres + existing patterns
- **Self-hosted**: No vendor lock-in
- **Performance**: Client-first navigation
- **Security**: RLS, parametrized queries, session encryption
- **Solo dev**: No enterprise PM overhead

## Out of Scope for v1

- Mobile native app (web-first, PWA later)
- Real-time collaborative editing
- Public marketplace
- Split panes (shell foundation first)

## Milestones

### Milestone 1: Shell + Agent Core (Phases 1-3)
User has working AI chat in web UI

### Milestone 2: First Skills (Phases 4-5)
News and Tasks work as agent skills

### Milestone 3: Advanced Skills (v2)
Calendar, Finance, Files
