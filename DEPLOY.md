# ClawdOS — Auto-Deploy

> For **Clawdbot** or any AI agent with shell access.

## IMPORTANT: Always use auto-host.sh

**DO NOT** set up ClawdOS manually. **DO NOT** create .env.local by hand. **DO NOT** generate random tokens.

The `scripts/auto-host.sh` script does EVERYTHING automatically:
- Installs dependencies
- Creates PostgreSQL container with unique name/port
- **Auto-detects your Clawdbot gateway token** from `~/.clawdbot/clawdbot.json`
- **Auto-detects your Telegram bot token** from the same config
- Generates all other secrets
- Applies DB schema, creates user, builds, starts server
- Verifies connectivity

## Deploy (one command)

```bash
git clone <REPO_URL> <DIR> && bash <DIR>/scripts/auto-host.sh --dir <DIR> --systemd --json
```

That's it. The script reads `~/.clawdbot/clawdbot.json` automatically.

### Example

```bash
git clone https://github.com/user/ClawdOS.git /root/clawd/instances/test && \
  bash /root/clawd/instances/test/scripts/auto-host.sh \
    --dir /root/clawd/instances/test \
    --systemd \
    --json
```

### JSON output (last line)

```json
{"ok":true,"url":"http://localhost:3001","username":"admin","password":"xK7mN2pQ...","db_port":5433,"web_port":3001,"container":"clawdos-a1b2c3d4-db","directory":"...","clawdbot_token":"...","consult_token":"...","service":"clawdos-a1b2c3d4","pid":0}
```

Report URL + username + password to the user.

## What auto-host.sh auto-detects

| What | How | Fallback |
|------|-----|----------|
| Clawdbot gateway token | Reads `~/.clawdbot/clawdbot.json` → `gateway.auth.token` | Random (AI chat won't work) |
| Clawdbot URL | Reads `gateway.port` from config | `http://127.0.0.1:18789` |
| Telegram bot token | Reads `channels.telegram.botToken` from config | None (2FA disabled) |
| Web port | Scans from 3000 for free port | `--port` flag |
| DB port | Scans from 5432 for free port | `--db-port` flag |
| Admin password | Auto-generated 16-char | `--password` flag |

## Override tokens (only if auto-detect fails)

```bash
bash scripts/auto-host.sh \
  --dir <DIR> \
  --clawdbot-token <TOKEN> \
  --telegram-token <TOKEN> \
  --systemd --json
```

## Update existing instance

```bash
cd <DIR> && git pull && npm install && npm run build && sudo systemctl restart <SERVICE>
```

## Remove instance

```bash
sudo systemctl stop <SERVICE> && sudo systemctl disable <SERVICE>
sudo rm /etc/systemd/system/<SERVICE>.service && sudo systemctl daemon-reload
cd <DIR> && docker compose down -v
rm -rf <DIR>
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "No Clawdbot config found" warning | Token auto-detect failed — pass `--clawdbot-token` manually |
| "Upstream error" in chat | Clawdbot not running or token mismatch |
| "generated random" warning | Script couldn't find Clawdbot config — AI chat won't work |
| Port conflict | Script auto-detects free ports; use `--port`/`--db-port` to override |
