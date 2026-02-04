# LifeOS (Local Next.js + Local Postgres)

Multi-tenant personal OS scaffold intended to run on the same VPS:
- Next.js (App Router)
- Local PostgreSQL (docker-compose)
- DB-enforced tenancy with Postgres RLS (via `app.user_id` session variable)
- Local auth: username + password (argon2id hash stored in DB)
- Minimal UI:
  - Sidebar workspace switcher (AG / German / Shared)
  - Pages: **Today** (digests) and **News** (news items)

## Security / access model (recommended)

Do **not** expose the app publicly on a raw VPS IP.
Recommended secure access patterns:

### Option A: Tailscale (tailnet-only)
- Install Tailscale on the VPS and on your client machine.
- Bind the app to `127.0.0.1` and access via:
  - an SSH tunnel over Tailscale, or
  - Tailscale Serve to publish it only inside the tailnet.

### Option B: SSH tunnel
Run the app bound to localhost and forward a local port:

```bash
ssh -L 3000:127.0.0.1:3000 root@<vps>
# open http://localhost:3000
```

## 1) Configure environment

```bash
cd apps/lifeos
cp .env.local.example .env.local
# edit .env.local
```

Generate `SESSION_PASSWORD` (must be long, random). Example:

```bash
openssl rand -base64 48
```

## 2) Start Postgres

```bash
cd apps/lifeos
./scripts/db-up.sh
```

## 3) Run migrations

```bash
cd apps/lifeos
export DATABASE_URL=postgres://lifeos:lifeos@localhost:5432/lifeos
node scripts/migrate.mjs
```

This creates schema under `app.*` and seeds the **AG**, **German**, **Shared** workspaces.

### RLS model (how it works)
RLS policies depend on a per-transaction setting `app.user_id`.
The app sets it automatically via `withUser(userId, fn)`.

## 4) Create users (local auth)

Create/update users (argon2id hash stored in DB):

```bash
cd apps/lifeos
export DATABASE_URL=postgres://lifeos:lifeos@localhost:5432/lifeos
node scripts/create-user.mjs ag '<STRONG_PASSWORD>'
node scripts/create-user.mjs german '<STRONG_PASSWORD>'
```

## 5) Assign memberships (AG/German/Shared)

```bash
cd apps/lifeos
export DATABASE_URL=postgres://lifeos:lifeos@localhost:5432/lifeos
node scripts/assign-default-memberships.mjs ag german
```

This assigns:
- `ag` → workspaces `ag` + `shared`
- `german` → workspaces `german` + `shared`

## 6) Run the app

```bash
cd apps/lifeos
npm run dev
```

Open (via tailnet-only / tunnel): <http://localhost:3000>

## Ops notes

### Running in production
Typical pattern:
- run Postgres via docker compose
- build Next.js and run `next start` behind a local-only reverse proxy (or just localhost)
- access only via Tailscale or SSH tunnel

### Environment variables
- `DATABASE_URL`: connection string for Postgres
- `SESSION_PASSWORD`: cookie encryption key for `iron-session` (keep secret)

### Workspace switching
Active workspace is stored in a cookie `lifeos.active_workspace`.

## Next steps / TODO
- Add admin-only UI to manage memberships
- Add create/edit flows for digests/news
- Add background job for generating daily digests
