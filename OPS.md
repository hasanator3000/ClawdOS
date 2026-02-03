# LifeOS Ops (VPS, no public domain)

Goal: run LifeOS on the same VPS securely without exposing the raw IP to the public internet.

## Threat model (practical)
- Keep the web app bound to localhost.
- Only allow access from your devices.
- Avoid opening port 3000 (or 80/443) publicly.

## Recommended access

### A) Tailscale (best)
1. Install on VPS:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   tailscale up
   ```
2. Install on your laptop/phone and join same tailnet.
3. Access patterns:

**A1: SSH tunnel over tailnet**
```bash
ssh -L 3000:127.0.0.1:3100 root@<vps-tailscale-ip>
# open http://localhost:3100
```

**A2: Tailscale Serve (tailnet-only)**
On VPS:
```bash
# assumes app listens on 127.0.0.1:3100
sudo tailscale serve --http=3000 3000
```
Then open `http://<vpsname>.<tailnet>.ts.net:3100` (or whatever Serve prints), only inside tailnet.

> Avoid Tailscale Funnel unless you explicitly want public access.

### B) Plain SSH tunnel (works, but relies on open SSH)
If you already expose SSH:
```bash
ssh -L 3000:127.0.0.1:3100 root@<vps-ip>
```

## Deployment layout
This repo: `/root/clawd/apps/lifeos`

### Environment
Create `.env.local`:
- `DATABASE_URL=postgres://lifeos:lifeos@localhost:5432/lifeos`
- `SESSION_PASSWORD=<openssl rand -base64 48>`

## Postgres (Docker)

```bash
cd /root/clawd/apps/lifeos
./scripts/db-up.sh
export DATABASE_URL=postgres://lifeos:lifeos@localhost:5432/lifeos
node scripts/migrate.mjs
```

## Create/rotate users

```bash
cd /root/clawd/apps/lifeos
export DATABASE_URL=postgres://lifeos:lifeos@localhost:5432/lifeos
node scripts/create-user.mjs ag '<NEW_STRONG_PASSWORD>'
node scripts/create-user.mjs german '<NEW_STRONG_PASSWORD>'
node scripts/assign-default-memberships.mjs ag german
```

## Production process (systemd)

### 1) Build
```bash
cd /root/clawd/apps/lifeos
npm ci
npm run build
```

### 2) systemd unit
Create `/etc/systemd/system/lifeos.service`:
```ini
[Unit]
Description=LifeOS (Next.js)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/root/clawd/apps/lifeos
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/root/clawd/apps/lifeos/.env.local
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lifeos
sudo systemctl status lifeos
```

### 3) Bind to localhost only
By default Next.js binds to 0.0.0.0 unless configured. Run it behind a local proxy or set host binding.
Simplest approach: run via a reverse proxy that listens only on 127.0.0.1, or use firewall rules.

If you want strict localhost binding, run Next with:
```bash
next start -H 127.0.0.1 -p 3000
```
You can modify `package.json` start script accordingly.

## Firewall
- Keep port 5432 closed to the internet.
- Keep port 3000 closed to the internet.
- If using Tailscale Serve, it’s tailnet-only by default.

## RLS (DB tenancy)
- App sets `set_config('app.user_id', <uuid>, true)` for each transaction.
- RLS policies restrict reads/writes by workspace membership.
- This protects against accidental cross-tenant queries.

