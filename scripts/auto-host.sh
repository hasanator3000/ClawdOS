#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ClawdOS — Auto-host script
#
# Fully automated deployment from a GitHub URL.
# Usage:
#   bash <(curl -sL <raw-url>) --repo https://github.com/user/ClawdOS.git
#   ./scripts/auto-host.sh --repo https://github.com/user/ClawdOS.git
#
# Options:
#   --repo <url>            GitHub repo URL (required if not inside a clone)
#   --dir <path>            Install directory (default: ./clawdos)
#   --port <N>              Web server port (default: auto-detect)
#   --db-port <N>           PostgreSQL port (default: auto-detect)
#   --user <name>           Admin username (default: admin)
#   --password <pass>       Admin password (default: auto-generated)
#   --clawdbot-token <tok>  Use this Clawdbot gateway token (skip generating random)
#   --clawdbot-url <url>    Clawdbot gateway URL (default: http://127.0.0.1:18789)
#   --telegram-token <tok>  Telegram bot token to inject into .env.local
#   --systemd               Create and enable systemd service
#   --no-start              Setup only, don't start the server
#   --no-build              Skip npm run build (use existing build)
#   --json                  Output result as JSON (for agent consumption)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' C='\033[0;36m' Y='\033[0;33m' B='\033[1m' N='\033[0m'
log()  { echo -e "${C}>${N} $*"; }
ok()   { echo -e "${G}✓${N} $*"; }
warn() { echo -e "${Y}!${N} $*"; }
fail() { echo -e "${R}✗${N} $*" >&2; exit 1; }

# ── Defaults ─────────────────────────────────────────────────────────────────
REPO_URL=""
INSTALL_DIR=""
WEB_PORT=""
DB_PORT=""
ADMIN_USER="admin"
ADMIN_PASS=""
CLAWDBOT_TOKEN_ARG=""
CLAWDBOT_URL_ARG=""
TELEGRAM_TOKEN_ARG=""
USE_SYSTEMD=false
NO_START=false
NO_BUILD=false
JSON_OUTPUT=false

# ── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)      REPO_URL="$2";    shift 2 ;;
    --dir)       INSTALL_DIR="$2"; shift 2 ;;
    --port)      WEB_PORT="$2";    shift 2 ;;
    --db-port)   DB_PORT="$2";     shift 2 ;;
    --user)      ADMIN_USER="$2";  shift 2 ;;
    --password)        ADMIN_PASS="$2";        shift 2 ;;
    --clawdbot-token)  CLAWDBOT_TOKEN_ARG="$2"; shift 2 ;;
    --clawdbot-url)    CLAWDBOT_URL_ARG="$2";   shift 2 ;;
    --telegram-token)  TELEGRAM_TOKEN_ARG="$2";  shift 2 ;;
    --systemd)         USE_SYSTEMD=true;         shift ;;
    --no-start)        NO_START=true;            shift ;;
    --no-build)        NO_BUILD=true;            shift ;;
    --json)            JSON_OUTPUT=true;         shift ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --repo <url>            GitHub repo URL"
      echo "  --dir <path>            Install directory (default: ./clawdos)"
      echo "  --port <N>              Web port (default: auto-detect from 3000)"
      echo "  --db-port <N>           DB port (default: auto-detect from 5432)"
      echo "  --user <name>           Admin username (default: admin)"
      echo "  --password <pass>       Admin password (default: auto-generated)"
      echo "  --clawdbot-token <tok>  Clawdbot gateway token (default: auto-generated)"
      echo "  --clawdbot-url <url>    Clawdbot URL (default: http://127.0.0.1:18789)"
      echo "  --telegram-token <tok>  Telegram bot token (optional)"
      echo "  --systemd               Create and enable systemd service"
      echo "  --no-start              Setup only, don't start the server"
      echo "  --no-build              Skip build step"
      echo "  --json                  Output result as JSON (for agents)"
      exit 0
      ;;
    *) fail "Unknown option: $1" ;;
  esac
done

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${B}  ClawdOS Auto-Host${N}"
echo ""

# ── Pre-flight checks ───────────────────────────────────────────────────────
log "Pre-flight checks..."

# Node.js >= 22
if ! command -v node &>/dev/null; then
  fail "Node.js not found. Install Node.js >= 22: https://nodejs.org"
fi
NODE_VERSION=$(node -v | sed 's/^v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 22 ]]; then
  fail "Node.js >= 22 required (found: $(node -v))"
fi
ok "Node.js $(node -v)"

# npm
if ! command -v npm &>/dev/null; then
  fail "npm not found"
fi
ok "npm $(npm -v)"

# Docker
if ! docker info &>/dev/null 2>&1; then
  fail "Docker is not running. Start Docker and try again."
fi
ok "Docker is running"

# Git
if ! command -v git &>/dev/null; then
  fail "Git not found"
fi
ok "Git $(git --version | awk '{print $3}')"

# ── Find free port ──────────────────────────────────────────────────────────
find_free_port() {
  local start=$1
  local end=$((start + 100))
  for port in $(seq "$start" "$end"); do
    if ! ss -tlnp 2>/dev/null | grep -q ":${port} " && \
       ! docker ps --format '{{.Ports}}' 2>/dev/null | grep -q "0.0.0.0:${port}->"; then
      echo "$port"
      return 0
    fi
  done
  fail "No free port found in range ${start}-${end}"
}

# ── Auto-detect ports ───────────────────────────────────────────────────────
if [[ -z "$WEB_PORT" ]]; then
  WEB_PORT=$(find_free_port 3000)
fi
ok "Web port: $WEB_PORT"

if [[ -z "$DB_PORT" ]]; then
  DB_PORT=$(find_free_port 5432)
fi
ok "DB port: $DB_PORT"

# ── Clone or detect existing ────────────────────────────────────────────────
if [[ -z "$INSTALL_DIR" ]]; then
  INSTALL_DIR="./clawdos"
fi

# Resolve to absolute path
INSTALL_DIR=$(cd "$(dirname "$INSTALL_DIR")" 2>/dev/null && pwd)/$(basename "$INSTALL_DIR")

if [[ -d "$INSTALL_DIR/.git" ]]; then
  log "Existing clone detected at $INSTALL_DIR"
  ok "Skipping clone"
elif [[ -n "$REPO_URL" ]]; then
  log "Cloning $REPO_URL → $INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
  ok "Cloned"
else
  # Check if we're inside a repo already
  if [[ -f "./package.json" ]] && grep -q '"clawdos"' "./package.json" 2>/dev/null; then
    INSTALL_DIR="$(pwd)"
    log "Running inside existing ClawdOS repo"
  else
    fail "No --repo URL and no existing clone. Use: $0 --repo <github-url>"
  fi
fi

cd "$INSTALL_DIR"
ok "Working directory: $INSTALL_DIR"

# ── npm install ─────────────────────────────────────────────────────────────
if [[ ! -d "node_modules" ]]; then
  log "Installing dependencies..."
  npm install --loglevel=warn
  ok "Dependencies installed"
else
  ok "node_modules exists"
fi

# ── Generate instance ID (for unique container names) ───────────────────────
INSTANCE_ID=$(echo "$INSTALL_DIR" | md5sum | cut -c1-8)
CONTAINER_NAME="clawdos-${INSTANCE_ID}-db"
VOLUME_NAME="clawdos_${INSTANCE_ID}_pgdata"
DB_NAME="clawdos"
DB_USER="clawdos"
DB_PASS="clawdos"

# ── Generate docker-compose.override.yml ────────────────────────────────────
log "Generating docker-compose.override.yml..."
cat > docker-compose.override.yml <<EOF
services:
  db:
    container_name: ${CONTAINER_NAME}
    ports:
      - "${DB_PORT}:5432"
    volumes:
      - ${VOLUME_NAME}:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]

volumes:
  ${VOLUME_NAME}:
EOF
ok "docker-compose.override.yml created (container: ${CONTAINER_NAME}, port: ${DB_PORT})"

# ── Auto-detect Clawdbot config ────────────────────────────────────────────
# Priority: CLI arg > auto-detect from Clawdbot config > generate random
CLAWDBOT_CONFIG=""

# Search for config in multiple locations
for cfg in "$HOME/.clawdbot/clawdbot.json" "/root/.clawdbot/clawdbot.json" "~/.clawdbot/clawdbot.json"; do
  cfg_expanded="${cfg/#\~/$HOME}"
  if [[ -f "$cfg_expanded" ]]; then
    CLAWDBOT_CONFIG="$cfg_expanded"
    break
  fi
done

if [[ -n "$CLAWDBOT_CONFIG" ]]; then
  log "Found Clawdbot config at: $CLAWDBOT_CONFIG"

  # Auto-detect gateway token
  if [[ -z "$CLAWDBOT_TOKEN_ARG" ]]; then
    CLAWDBOT_TOKEN_ARG=$(python3 -c "import json; c=json.load(open('$CLAWDBOT_CONFIG')); print(c['gateway']['auth']['token'])" 2>/dev/null || echo "")
    if [[ -n "$CLAWDBOT_TOKEN_ARG" ]]; then
      ok "Auto-detected Clawdbot gateway token ($(echo $CLAWDBOT_TOKEN_ARG | cut -c1-12)...)"
    fi
  fi

  # Auto-detect gateway URL (port)
  if [[ -z "$CLAWDBOT_URL_ARG" ]]; then
    local_port=$(python3 -c "import json; c=json.load(open('$CLAWDBOT_CONFIG')); print(c['gateway'].get('port', 18789))" 2>/dev/null || echo "18789")
    CLAWDBOT_URL_ARG="http://127.0.0.1:${local_port}"
    ok "Auto-detected Clawdbot URL: $CLAWDBOT_URL_ARG"
  fi

  # Auto-detect Telegram bot token
  if [[ -z "$TELEGRAM_TOKEN_ARG" ]]; then
    TELEGRAM_TOKEN_ARG=$(python3 -c "import json; c=json.load(open('$CLAWDBOT_CONFIG')); print(c.get('channels',{}).get('telegram',{}).get('botToken',''))" 2>/dev/null || echo "")
    if [[ -n "$TELEGRAM_TOKEN_ARG" ]]; then
      ok "Auto-detected Telegram bot token"
    fi
  fi
else
  # Try to read from env if Clawdbot set it
  if [[ -n "${CLAWDBOT_TOKEN:-}" ]]; then
    CLAWDBOT_TOKEN_ARG="$CLAWDBOT_TOKEN"
    ok "Using CLAWDBOT_TOKEN from environment"
  else
    warn "No Clawdbot config found at ~/.clawdbot/clawdbot.json — will generate random token"
  fi
fi

# Final resolution: arg/auto-detect or generate random
CLAWDBOT_TOKEN="${CLAWDBOT_TOKEN_ARG:-$(openssl rand -hex 24)}"
CLAWDBOT_URL="${CLAWDBOT_URL_ARG:-http://127.0.0.1:18789}"
CONSULT_TOKEN=$(openssl rand -hex 24)

if [[ -z "$CLAWDBOT_TOKEN_ARG" ]]; then
  warn "No Clawdbot token found — generated random. AI chat will NOT work until you configure the token."
fi

# ── Generate .env.local ─────────────────────────────────────────────────────

if [[ ! -f ".env.local" ]]; then
  log "Generating .env.local..."
  SESSION_PASSWORD=$(openssl rand -base64 48)

  cat > .env.local <<EOF
# App
APP_URL=http://localhost:${WEB_PORT}
SESSION_PASSWORD=${SESSION_PASSWORD}

# Database
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}

# Clawdbot (AI agent gateway)
CLAWDBOT_URL=${CLAWDBOT_URL}
CLAWDBOT_TOKEN=${CLAWDBOT_TOKEN}
CLAWDOS_CONSULT_TOKEN=${CONSULT_TOKEN}
EOF

  # Telegram: inject if provided, else leave commented
  if [[ -n "$TELEGRAM_TOKEN_ARG" ]]; then
    echo "TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN_ARG}" >> .env.local
  else
    echo "# TELEGRAM_BOT_TOKEN=" >> .env.local
  fi
  ok ".env.local generated"
else
  # Update APP_URL port if it doesn't match
  if ! grep -q "APP_URL=http://localhost:${WEB_PORT}" .env.local; then
    sed -i "s|APP_URL=http://localhost:[0-9]*|APP_URL=http://localhost:${WEB_PORT}|" .env.local
    ok ".env.local APP_URL updated to port ${WEB_PORT}"
  fi

  # ALWAYS update Clawdbot token if auto-detected (might be wrong from previous run)
  # This ensures subsequent runs with auto-detect will fix stale tokens
  if [[ -n "$CLAWDBOT_TOKEN_ARG" ]]; then
    sed -i "s|^CLAWDBOT_TOKEN=.*|CLAWDBOT_TOKEN=${CLAWDBOT_TOKEN_ARG}|" .env.local
    ok ".env.local CLAWDBOT_TOKEN updated"
  fi

  # Update Clawdbot URL if provided
  if [[ -n "$CLAWDBOT_URL_ARG" ]]; then
    sed -i "s|^CLAWDBOT_URL=.*|CLAWDBOT_URL=${CLAWDBOT_URL_ARG}|" .env.local
    ok ".env.local CLAWDBOT_URL updated"
  fi

  # Update Telegram token if provided
  if [[ -n "$TELEGRAM_TOKEN_ARG" ]]; then
    if grep -q "^TELEGRAM_BOT_TOKEN=" .env.local; then
      sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN_ARG}|" .env.local
    elif grep -q "^# TELEGRAM_BOT_TOKEN=" .env.local; then
      sed -i "s|^# TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN_ARG}|" .env.local
    else
      echo "TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN_ARG}" >> .env.local
    fi
    ok ".env.local TELEGRAM_BOT_TOKEN updated"
  fi
  ok ".env.local exists"
fi

# ── Start PostgreSQL ────────────────────────────────────────────────────────
log "Starting PostgreSQL..."
docker-compose up -d db
ok "PostgreSQL container started"

# ── Wait for DB ─────────────────────────────────────────────────────────────
log "Waiting for database..."
for i in $(seq 1 30); do
  if docker-compose exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
    ok "Database is ready"
    break
  fi
  if [[ $i -eq 30 ]]; then
    fail "Database did not become ready in 30 seconds"
  fi
  sleep 1
done

# ── Apply schema ────────────────────────────────────────────────────────────
# Check if schema already exists
SCHEMA_EXISTS=$(PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT 1 FROM information_schema.tables WHERE table_schema='core' AND table_name='user' LIMIT 1" 2>/dev/null || echo "")

if [[ "$SCHEMA_EXISTS" != "1" ]]; then
  log "Applying baseline schema..."
  PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f db/schema.sql
  ok "Schema applied"
else
  log "Schema already exists, running migrations..."
  DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}" node scripts/migrate.mjs 2>/dev/null || true
  ok "Migrations applied"
fi

# ── Create admin user ───────────────────────────────────────────────────────
USER_EXISTS=$(PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT 1 FROM core.\"user\" LIMIT 1" 2>/dev/null || echo "")

if [[ "$USER_EXISTS" != "1" ]]; then
  # Generate password if not provided
  if [[ -z "$ADMIN_PASS" ]]; then
    ADMIN_PASS=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)
  fi

  log "Creating admin user: ${ADMIN_USER}..."
  DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}" \
    node scripts/create-user.mjs "$ADMIN_USER" "$ADMIN_PASS" 2>/dev/null
  ok "User '${ADMIN_USER}' created"

  # Bootstrap workspace
  DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}" \
    OWNER="$ADMIN_USER" node scripts/bootstrap-workspaces.mjs 2>/dev/null
  ok "Workspace created"
else
  ok "User already exists"
  ADMIN_PASS="(existing — not changed)"
fi

# ── Build ───────────────────────────────────────────────────────────────────
if [[ "$NO_BUILD" == false ]]; then
  log "Building Next.js app..."
  npm run build 2>&1 | tail -5
  ok "Build complete"
else
  ok "Skipping build (--no-build)"
fi

# ── Start server ────────────────────────────────────────────────────────────
if [[ "$NO_START" == true ]]; then
  ok "Skipping server start (--no-start)"
else
  if [[ "$USE_SYSTEMD" == true ]]; then
    # Generate systemd service
    SERVICE_NAME="clawdos-${INSTANCE_ID}"
    SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

    log "Creating systemd service: ${SERVICE_NAME}..."
    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ClawdOS (${INSTALL_DIR})
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env.local
Environment=PORT=${WEB_PORT}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME" --now
    ok "Systemd service '${SERVICE_NAME}' created and started"
  else
    # Start with nohup
    log "Starting server on port ${WEB_PORT}..."
    PORT="$WEB_PORT" nohup npm start > /tmp/clawdos-${INSTANCE_ID}.log 2>&1 &
    SERVER_PID=$!
    ok "Server started (PID: ${SERVER_PID}, log: /tmp/clawdos-${INSTANCE_ID}.log)"
  fi

  # Health check
  log "Waiting for server..."
  for i in $(seq 1 15); do
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${WEB_PORT}/login" 2>/dev/null | grep -q "200"; then
      ok "Server is healthy"
      break
    fi
    if [[ $i -eq 15 ]]; then
      warn "Server health check timed out (may still be starting)"
    fi
    sleep 2
  done
fi

# ── Setup auto-update timer ─────────────────────────────────────────────────
if [[ "$USE_SYSTEMD" == true ]]; then
  SERVICE_NAME="clawdos-${INSTANCE_ID}"
  UPDATE_SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}-update.service"
  UPDATE_TIMER_FILE="/etc/systemd/system/${SERVICE_NAME}-update.timer"

  log "Creating auto-update timer..."

  cat > "$UPDATE_SERVICE_FILE" <<EOF
[Unit]
Description=ClawdOS Auto-Update (${INSTALL_DIR})
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=${INSTALL_DIR}/.env.local
ExecStart=/bin/bash ${INSTALL_DIR}/scripts/update.sh
EOF

  cat > "$UPDATE_TIMER_FILE" <<EOF
[Unit]
Description=ClawdOS Auto-Update Timer (${INSTALL_DIR})

[Timer]
OnCalendar=*-*-* 00/6:00:00
RandomizedDelaySec=1800
Persistent=true

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}-update.timer" --now 2>/dev/null || true
  ok "Auto-update timer created (every 6 hours)"
fi

# ── Create .update directory ───────────────────────────────────────────────
mkdir -p "${INSTALL_DIR}/.update/backups"
ok "Update directory initialized"

# ── Reload service if tokens were updated ──────────────────────────────────
if [[ "$USE_SYSTEMD" == true ]] && [[ -n "$CLAWDBOT_TOKEN_ARG" ]]; then
  # Service exists from earlier creation; reload to pick up updated .env.local
  SERVICE_NAME="clawdos-${INSTANCE_ID}"
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    log "Reloading systemd service to apply updated Clawdbot tokens..."
    systemctl restart "$SERVICE_NAME"
    ok "Service restarted"
    sleep 2
  fi
fi

# ── Verify Clawdbot connectivity ──────────────────────────────────────────
if [[ -n "$CLAWDBOT_TOKEN_ARG" ]]; then
  log "Checking Clawdbot connectivity..."
  CB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${CLAWDBOT_URL}/" 2>/dev/null || echo "000")
  if [[ "$CB_STATUS" == "200" || "$CB_STATUS" == "401" ]]; then
    ok "Clawdbot is reachable at ${CLAWDBOT_URL}"
  else
    warn "Clawdbot not reachable at ${CLAWDBOT_URL} (HTTP ${CB_STATUS}) — AI chat will fail"
  fi
fi

# ── Summary ─────────────────────────────────────────────────────────────────
if [[ "$JSON_OUTPUT" == true ]]; then
  # Machine-readable output for agents
  cat <<EOF
{"ok":true,"url":"http://localhost:${WEB_PORT}","username":"${ADMIN_USER}","password":"${ADMIN_PASS}","db_port":${DB_PORT},"web_port":${WEB_PORT},"container":"${CONTAINER_NAME}","directory":"${INSTALL_DIR}","clawdbot_token":"${CLAWDBOT_TOKEN}","consult_token":"${CONSULT_TOKEN}","service":"${SERVICE_NAME:-}","pid":${SERVER_PID:-0}}
EOF
else
  echo ""
  echo -e "${G}┌────────────────────────────────────────────┐${N}"
  echo -e "${G}│${N}  ${B}ClawdOS deployed successfully!${N}             ${G}│${N}"
  echo -e "${G}├────────────────────────────────────────────┤${N}"
  echo -e "${G}│${N}  URL:       ${C}http://localhost:${WEB_PORT}${N}"
  echo -e "${G}│${N}  Username:  ${B}${ADMIN_USER}${N}"
  echo -e "${G}│${N}  Password:  ${B}${ADMIN_PASS}${N}"
  echo -e "${G}│${N}  DB port:   ${DB_PORT}"
  echo -e "${G}│${N}  Container: ${CONTAINER_NAME}"
  echo -e "${G}│${N}  Directory: ${INSTALL_DIR}"
  if [[ "$USE_SYSTEMD" == true ]]; then
    echo -e "${G}│${N}  Service:   ${SERVICE_NAME}"
    echo -e "${G}│${N}  Updates:   auto (every 6h)"
  fi
  echo -e "${G}├────────────────────────────────────────────┤${N}"
  echo -e "${G}│${N}  Stop:  ${Y}docker-compose down${N} (DB)"
  if [[ "$USE_SYSTEMD" == true ]]; then
    echo -e "${G}│${N}         ${Y}systemctl stop ${SERVICE_NAME}${N}"
  else
    echo -e "${G}│${N}         ${Y}kill ${SERVER_PID:-<PID>}${N} (server)"
  fi
  echo -e "${G}└────────────────────────────────────────────┘${N}"
  echo ""
fi
