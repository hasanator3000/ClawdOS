# LifeOS × Clawdbot — Agent Manifest (Source of Truth)

This document exists to prevent coding agents (Claude Code/Cursor/etc.) from inventing integrations.

## Roles

### Clawdbot (Agent Core)
- **Purpose:** agent runtime + tool execution + Telegram channel.
- **Gateway:** single multiplexed WS+HTTP server (Control UI + HTTP APIs).
- **Do not re-implement Telegram in LifeOS.** Telegram is already a Clawdbot channel.

### LifeOS (WebUI + Data)
- **Purpose:** IDE-style Web UI + Postgres data layer + RLS + safe server actions.
- LifeOS must **not** call Claude/Anthropic APIs directly.
- LifeOS talks to Clawdbot **server-to-server** via a proxy route.

## Current integration points (real, already in repo)

### Web chat → Clawdbot
- LifeOS route: `POST /api/ai/chat`
  - server-side proxy to Clawdbot Gateway `POST /v1/chat/completions`
  - streams SSE back to browser
  - adds system context (page/workspace + linked Telegram user id)
  - **token never goes to browser**

### Telegram identity bridge
- Postgres: `core.user.telegram_user_id`
- LifeOS injects this into web chat context so the agent can DM without asking for chat ids.

### Safe UI/data actions
- LifeOS supports minimal safe "agent actions" via `<lifeos>...</lifeos>` blocks parsed client-side.
- LifeOS server actions / APIs perform DB writes under RLS using `withUser()`.

## Hard security rules (do not break)

1) **No direct Claude/Anthropic API in LifeOS.**
   - Clawdbot is the agent core.

2) **No Telegram webhook/bot handler inside LifeOS.**
   - Telegram channel is configured in Clawdbot.

3) **No DOM selector actions from the model.**
   - Never execute `document.querySelector(modelProvidedSelector).click()`.
   - UI actions must be a strict whitelist (`navigate`, `toast`, `highlight` by entity id, etc.).

4) **Never expose gateway tokens to the browser.**
   - Clawdbot auth stays server-side (`.env.local`).

5) **DB writes only through RLS context.**
   - Use `withUser(userId, ...)` so `app.user_id` is set and RLS policies apply.

## Ports / endpoints (typical)
- LifeOS Web: `http://<host>:3100`
- Clawdbot Gateway (local only): `http://127.0.0.1:18789`
- Clawdbot OpenAI-compatible HTTP (if enabled): `POST /v1/chat/completions`
- Clawdbot tools invoke: `POST /tools/invoke`

> Note: Gateway HTTP endpoints may be disabled by config; prefer enabling in Clawdbot config rather than inventing new services.
