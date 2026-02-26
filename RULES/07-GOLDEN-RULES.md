# 07 — Golden Rules (Architectural Prohibitions)

> Canonical source: `dev/CODING_AGENT_RULES.md`
> This file summarises the prohibitions. Refer to the canonical source for full context.

## The 6 golden rules

### 1. No Claude/Anthropic API in ClawdOS

ClawdOS **never** calls Claude, OpenAI, or any LLM API directly. Clawdbot is the single agent runtime.

- DO NOT install `@anthropic-ai/sdk`, `openai`, or any LLM SDK
- DO NOT create API routes that call LLM endpoints directly
- All AI goes through Clawdbot gateway at `POST /api/ai/chat` -> `POST ${CLAWDBOT_URL}/v1/chat/completions`

### 2. No Telegram in ClawdOS

Telegram is a Clawdbot channel, configured in the Clawdbot repo — NOT in ClawdOS.

- DO NOT create `/api/telegram/webhook` or any Telegram bot handler
- DO NOT install `telegraf`, `node-telegram-bot-api`, or similar
- The only Telegram interaction in ClawdOS is sending auth codes via the Bot API (one-way)
- Identity bridge: `core.user.telegram_user_id` column in DB

### 3. No DOM selectors from model output

When Clawdbot wants to trigger UI actions, it uses the `<clawdos>{...}</clawdos>` structured protocol — NOT arbitrary DOM selectors.

- DO NOT execute `document.querySelector(modelProvided)` or similar
- DO NOT allow the model to specify CSS selectors, XPath, or element IDs to click
- Actions are a whitelisted set (11 keys): `navigate`, `task.create`, `task.complete`, `task.reopen`, `task.delete`, `task.priority`, `news.source.add`, `news.source.remove`, `news.tab.create`, `delivery.track`, `delivery.remove`
- Adding a new action = adding it to the whitelist in `src/lib/ai/actions-executor.ts`

### 4. No tokens to browser

`CLAWDBOT_TOKEN`, `CLAWDOS_CONSULT_TOKEN`, and any other service tokens stay **server-side only**.

- DO NOT pass tokens via `NEXT_PUBLIC_*` env vars
- DO NOT include tokens in client-side fetches
- DO NOT expose gateway URLs to the frontend
- The browser talks to Next.js API routes, which proxy to Clawdbot with the token

### 5. RLS for all DB writes

Every database operation that reads or writes user data MUST run under RLS context.

- Always use `withUser(userId, async (client) => { ... })`
- Never use `getPool().query()` directly for user data
- `withUser()` sets `app.user_id` via `set_config()` → enables `core.current_user_id()` → RLS policies check `core.is_workspace_member(workspace_id)`

**Exception: webhook routes.** External service callbacks (e.g., `/api/webhooks/trackingmore`) need to do cross-user lookups by identifiers like tracking numbers. These routes intentionally use `getPool().query()` directly because there is no user session context. This is documented and acceptable — see [05-DATABASE.md](05-DATABASE.md).

### 6. Build & deploy through systemd

Production runs via `clawdos.service` (systemd, `Restart=always`, `RestartSec=2`). NEVER kill the Next.js process directly.

- DO NOT use `kill <pid>` then `npm start &` — systemd will race you
- DO NOT `rm -rf .next` without stopping the service first — server serves 404 on chunks
- DO NOT use `npm run dev` in production

**Correct deploy sequence:**
```bash
systemctl stop clawdos        # 1. Stop service first
rm -rf .next && npm run build  # 2. Clean build
systemctl start clawdos        # 3. Start service
systemctl status clawdos --no-pager  # 4. Verify
```

See [08-DEPLOY-CONTRACT.md](08-DEPLOY-CONTRACT.md) for full details.

## PostgreSQL constraint

PostgreSQL 16.11 does **NOT** support `CREATE POLICY IF NOT EXISTS`.

**Solution:** The migration runner preprocesses SQL to strip `IF NOT EXISTS` from `CREATE POLICY` statements. Write migrations without `IF NOT EXISTS` on policies — use idempotent patterns instead (see [05-DATABASE.md](05-DATABASE.md)).

## Quick reference: what NOT to install

| Package | Why not |
|---------|---------|
| `@anthropic-ai/sdk` | Rule 1: no direct LLM API |
| `openai` | Rule 1: no direct LLM API |
| `telegraf` / `node-telegram-bot-api` | Rule 2: no Telegram in ClawdOS |
| `@shadcn/ui` / `@radix-ui/*` | Custom UI only |
| `prisma` / `drizzle-orm` / `typeorm` | Raw `pg` only |
| `tailwindcss` config-based plugins | Tailwind v4 uses CSS config |
