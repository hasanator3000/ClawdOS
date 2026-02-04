# LifeOS — Rules for Coding Agents (Claude Code/Cursor/etc.)

Read **docs/AGENT_MANIFEST.md** first.

These rules exist to prevent unsafe or redundant integrations.

## Golden rules (do not break)

1) **LifeOS never calls Claude/Anthropic APIs directly.**
   - AI runtime is **Clawdbot**.
   - LifeOS talks to Clawdbot only via a **server-side proxy route**.

2) **Do not implement Telegram bots/webhooks in LifeOS.**
   - Telegram channel is configured in Clawdbot.

3) **Never execute model-provided DOM selectors.**
   - No `document.querySelector(selectorFromModel).click()`.
   - UI actions must be strict whitelist and must map to known handlers.

4) **Never expose gateway tokens to the browser.**
   - Tokens live only in `.env.local` on the server.

5) **All DB writes must run under RLS context.**
   - Use `withUser(userId, fn)` so `app.user_id` is set.

## How to add a new workflow/module (standard pattern)

1) **Database**
   - Add a migration under `db/schema/<domain>/migrations/` (or existing domain).
   - Ensure tables include `workspace_id` and RLS policies reference `core.current_user_id()`.

2) **Repository**
   - Add a repository in `src/lib/db/repositories/<name>.repository.ts`.
   - Repository functions accept a `PoolClient`.

3) **Safe server actions / API**
   - Add a route under `src/app/api/actions/<name>/route.ts`.
   - Validate input with `zod`.
   - Require session (`getSession()`), then run DB calls inside `withUser()`.

4) **UI**
   - Add a page under `src/app/(app)/<module>/page.tsx`.
   - Prefer client components for fast interaction; keep layout stable.

5) **Agent integration**
   - The Web chat endpoint is `POST /api/ai/chat`.
   - If you need the agent to trigger UI/data actions, use a **whitelisted protocol**.
   - Current v0 protocol: `<lifeos>{"actions":[...]}</lifeos>` blocks parsed client-side.

## Existing integration points (do not duplicate)

- Web chat proxy: `POST /api/ai/chat` → Clawdbot Gateway `POST /v1/chat/completions` (SSE)
- Telegram identity bridge: `core.user.telegram_user_id` (inject into system context)

## Environment variables

- `CLAWDBOT_URL` (default `http://127.0.0.1:18789`)
- `CLAWDBOT_TOKEN` (gateway auth token; server-side only)
- `DATABASE_URL`, `SESSION_PASSWORD`

## What NOT to add

- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL` inside LifeOS
- Any direct LLM SDK usage (`@anthropic-ai/sdk`, OpenAI SDK) inside LifeOS for chat
- Any screen control that uses arbitrary selectors from model output
