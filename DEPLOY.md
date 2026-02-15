# ClawdOS — Agent Auto-Deploy Instructions

> This file is for **Clawdbot** (or any AI agent with shell access).
> When a user sends you a GitHub URL for ClawdOS, follow these steps to fully deploy it.

## Prerequisites

You need `exec` (shell), `read`/`write` (files), and `gateway` (self-config) tools.
The target server must have: Node.js >= 22, Docker (running), Git, ~2GB free disk.

## Step-by-step deploy

### 1. Read your own tokens

You will inject your gateway token and Telegram bot token into the new instance so it connects to you automatically.

```bash
# Read your gateway auth token
CLAWDBOT_TOKEN=$(python3 -c "import json; c=json.load(open('/root/.clawdbot/clawdbot.json')); print(c['gateway']['auth']['token'])")

# Read your Telegram bot token (may be empty if not configured)
TELEGRAM_TOKEN=$(python3 -c "import json; c=json.load(open('/root/.clawdbot/clawdbot.json')); print(c.get('channels',{}).get('telegram',{}).get('botToken',''))" 2>/dev/null || echo "")
```

### 2. Clone the repo

```bash
REPO_URL="<the URL the user gave you>"
INSTALL_DIR="/root/clawd/instances/clawdos-$(date +%s)"

git clone "$REPO_URL" "$INSTALL_DIR"
```

### 3. Run auto-host.sh

The script handles everything: dependencies, DB, schema, user, build, start.

```bash
bash "$INSTALL_DIR/scripts/auto-host.sh" \
  --dir "$INSTALL_DIR" \
  --clawdbot-token "$CLAWDBOT_TOKEN" \
  --telegram-token "$TELEGRAM_TOKEN" \
  --systemd \
  --json
```

**Flags explained:**
- `--dir` — where the repo was cloned
- `--clawdbot-token` — your own gateway token (so the instance talks to you)
- `--telegram-token` — your Telegram bot token (for 2FA/recovery)
- `--systemd` — create a systemd service (auto-restarts on reboot)
- `--json` — output result as JSON for you to parse

**The script auto-detects free ports.** No need to specify `--port` or `--db-port` unless you want specific ones.

### 4. Parse the result

With `--json`, the last line of output is:

```json
{
  "ok": true,
  "url": "http://localhost:3001",
  "username": "admin",
  "password": "xK7mN2pQ...",
  "db_port": 5433,
  "web_port": 3001,
  "container": "clawdos-a1b2c3d4-db",
  "directory": "/root/clawd/instances/clawdos-...",
  "clawdbot_token": "...",
  "consult_token": "...",
  "service": "clawdos-a1b2c3d4",
  "pid": 0
}
```

### 5. Verify the deployment

```bash
# Check the web server responds
curl -s -o /dev/null -w "%{http_code}" "http://localhost:<web_port>/login"
# Expected: 200

# Check the AI chat endpoint is wired to you
curl -s -X POST "http://localhost:<web_port>/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping"}' 2>&1 | head -100
# Expected: SSE stream or JSON response (not "CLAWDBOT_TOKEN is not set")
```

### 6. Report to the user

Send the user:
- The URL (e.g., `http://localhost:3001` or `http://<server-ip>:3001`)
- Username and password
- Confirmation that AI chat is connected

Example message:
```
ClawdOS deployed!

URL: http://localhost:3001
Username: admin
Password: xK7mN2pQ...

AI chat is connected and working.
Telegram 2FA is enabled.
```

## Multiple instances

The script is designed for multi-instance deployments:
- Each instance gets a unique container name (based on directory hash)
- Ports are auto-detected (no conflicts)
- Each instance has its own PostgreSQL container and volume
- Systemd services have unique names

## Updating an existing instance

```bash
cd <install-dir>
git pull origin master
npm install
npm run build
sudo systemctl restart <service-name>
```

## Removing an instance

```bash
cd <install-dir>
sudo systemctl stop <service-name>
sudo systemctl disable <service-name>
sudo rm /etc/systemd/system/<service-name>.service
docker compose down -v   # removes DB container + data
cd .. && rm -rf <install-dir>
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `auto-host.sh` fails at "Node.js not found" | Install Node.js >= 22 |
| `auto-host.sh` fails at "Docker is not running" | Start Docker: `systemctl start docker` |
| Build fails | Check `npm install` completed; check disk space |
| "Upstream error" in chat | Verify Clawdbot is running on the expected URL/port |
| Login redirect loop | Clear cookies; check `SESSION_PASSWORD` is set in `.env.local` |
| Port conflict | Let the script auto-detect, or pass `--port` / `--db-port` manually |

## Environment variables reference

| Variable | Source | Description |
|----------|--------|-------------|
| `CLAWDBOT_TOKEN` | Your gateway config | Shared auth token — you provide this |
| `CLAWDBOT_URL` | Default `http://127.0.0.1:18789` | Your gateway address |
| `TELEGRAM_BOT_TOKEN` | Your Telegram channel config | For 2FA codes and password recovery |
| `SESSION_PASSWORD` | Auto-generated | iron-session encryption (random per instance) |
| `DATABASE_URL` | Auto-generated | PostgreSQL connection string (unique per instance) |
| `CLAWDOS_CONSULT_TOKEN` | Auto-generated | Auth for `/api/consult` meta-query endpoint |
| `APP_URL` | Auto-set from `--port` | Base URL of the instance |
