# AI Agent Setup Instructions

## To deploy ClawdOS:

```bash
./setup
```

That's it. Run from repo root. The script will:
- Auto-detect your Clawdbot token from `~/.clawdbot/clawdbot.json`
- Auto-detect your Telegram token from the same file
- Find free ports automatically
- Install dependencies, create PostgreSQL container, apply schema
- Create admin user with auto-generated password
- Build and start the application
- Output JSON with URL and credentials

## Expected output (JSON):

```json
{"ok":true,"url":"http://localhost:3000","username":"admin","password":"...","db_port":5432,"web_port":3000,...}
```

Report the URL, username, and password to the user.

## If deployment fails:

Read [DEPLOY.md](DEPLOY.md) for troubleshooting and manual options.
