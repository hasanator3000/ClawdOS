# ClawdOS — Auto-Deploy

> For **OpenClaw**, **Clawdbot**, or any AI agent with shell access.
> This is the only file you need. Run one command — get a working instance.

## Deploy (one command)

```bash
git clone https://github.com/hasanator3000/ClawdOS.git /path/to/clawdos && cd /path/to/clawdos && ./setup
```

That's it. The `setup` script calls `scripts/auto-host.sh` which does **everything**:

1. Installs npm dependencies
2. Creates PostgreSQL container with unique name/port
3. **Auto-detects your OpenClaw gateway token** from `~/.clawdbot/clawdbot.json`
4. **Auto-detects your Telegram bot token** from the same config
5. Generates all other secrets (`SESSION_PASSWORD`, `CLAWDOS_CONSULT_TOKEN`)
6. Creates `.env.local` with all variables
7. Applies DB schema, creates admin user
8. Builds production bundle, starts via systemd
9. Verifies connectivity — returns JSON result

**No manual steps. No prompts. No config files to edit.**

### JSON output (last line of stdout)

```json
{"ok":true,"url":"http://localhost:3001","username":"admin","password":"xK7mN2pQ...","db_port":5433,"web_port":3001,"container":"clawdos-a1b2c3d4-db","directory":"...","clawdbot_token":"...","consult_token":"...","service":"clawdos-a1b2c3d4","pid":0}
```

**Report `url` + `username` + `password` to the user.** Everything else is internal.

---

## What auto-host.sh auto-detects

| What | How | Fallback |
|------|-----|----------|
| OpenClaw gateway token | Reads `~/.clawdbot/clawdbot.json` → `gateway.auth.token` | Random (AI chat won't work) |
| OpenClaw gateway URL | Reads `gateway.port` from config | `http://127.0.0.1:18789` |
| Telegram bot token | Reads `channels.telegram.botToken` from config | None (2FA disabled) |
| Web port | Scans from 3000 for first free port | `--port` flag |
| DB port | Scans from 5432 for first free port | `--db-port` flag |
| Admin password | Auto-generated 16-char | `--password` flag |

---

## Custom options (only if auto-detect fails)

```bash
bash scripts/auto-host.sh \
  --dir /path/to/clawdos \
  --clawdbot-token <TOKEN> \
  --telegram-token <TOKEN> \
  --port 3001 \
  --db-port 5433 \
  --password "custom-pass" \
  --systemd --json
```

---

## Update existing instance

```bash
cd /path/to/clawdos && git pull && npm install && npm run build && sudo systemctl restart <SERVICE>
```

Replace `<SERVICE>` with the service name from the deploy JSON output (e.g., `clawdos-a1b2c3d4`).

---

## Remove instance

```bash
sudo systemctl stop <SERVICE> && sudo systemctl disable <SERVICE>
sudo rm /etc/systemd/system/<SERVICE>.service && sudo systemctl daemon-reload
cd /path/to/clawdos && docker compose down -v
rm -rf /path/to/clawdos
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "No Clawdbot config found" warning | OpenClaw config not at `~/.clawdbot/clawdbot.json` — pass `--clawdbot-token` manually |
| "Upstream error" in chat | OpenClaw not running or token mismatch |
| "generated random" warning | Script couldn't find OpenClaw config — AI chat won't work until token matches |
| Port conflict | Script auto-detects free ports; use `--port`/`--db-port` to override |
| Service won't start | Check `journalctl -u <SERVICE> -n 50` for errors |
