# LifeOS Ops (VPS, no public domain)

Goal: run LifeOS on the same VPS securely.

## Threat model (practical)
- Default: keep the web app bound to localhost.
- Only allow access from your devices.
- If you must expose by raw IP, require an access token gate and preferably add HTTPS later.

## Recommended access

### A) Tailscale (best)
(keeps the app private; preferred)

1. Install on VPS:
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   tailscale up
   ```
2. Install on your laptop/phone and join same tailnet.

**A1: SSH tunnel over tailnet**
```bash
ssh -L 3000:127.0.0.1:3000 root@<vps-tailscale-ip>
# open http://localhost:3000
```

**A2: Tailscale Serve (tailnet-only)**
On VPS:
```bash
# assumes app listens on 127.0.0.1:3000
sudo tailscale serve --http=3000 127.0.0.1:3000
```

> Avoid Tailscale Funnel unless you explicitly want public access.

### B) Plain SSH tunnel (works, but relies on open SSH)
If you already expose SSH:
```bash
ssh -L 3000:127.0.0.1:3000 root@<vps-ip>
```

### C) Expose by IP + token gate (what we use if you want http://IP:PORT)
This exposes a port on the server, but every request requires `ACCESS_TOKEN`.

1) Set token in `.env.local`:
```bash
ACCESS_TOKEN=$(openssl rand -base64 32)
```

2) Run dev server bound to all interfaces:
```bash
npm run dev -- --hostname 0.0.0.0 --port 3000
```

3) Open:
- `http://<SERVER_IP>:3000/access`

4) Firewall (if using ufw):
```bash
sudo ufw allow 3000/tcp
```

## Deployment layout
This repo: `/root/clawd/apps/lifeos`

## Environment
Create `.env.local`:
- `DATABASE_URL=postgres://lifeos:lifeos@localhost:5432/lifeos`
- `SESSION_PASSWORD=<openssl rand -base64 48>`
- (optional) `ACCESS_TOKEN=<openssl rand -base64 32>`

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

## Firewall
- Keep Postgres (5432) closed to the internet.
- If you enable IP access, open only the chosen app port (e.g. 3000) and consider restricting by source IP.
