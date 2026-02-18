#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ClawdOS — Update Script
#
# Safely updates a ClawdOS instance using git merge.
# Preserves ALL user modifications (new files, edited files, DB data).
#
# Usage:
#   bash scripts/update.sh              # Full update
#   bash scripts/update.sh --check      # Check only (exit 0=current, 2=available)
#   bash scripts/update.sh --force      # Force update even if up-to-date
#   bash scripts/update.sh --rollback   # Rollback to last backup
#
# Exit codes:
#   0 = OK (up to date or update applied)
#   1 = Error
#   2 = Update available (--check mode only)
#   3 = Rollback triggered (build/health failure)
#   4 = Merge conflict (aborted cleanly, no changes made)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ───────────────────────────────────────────────────────────────────
R='\033[0;31m' G='\033[0;32m' C='\033[0;36m' Y='\033[0;33m' B='\033[1m' N='\033[0m'
log()  { echo -e "${C}[update]${N} $*"; }
ok()   { echo -e "${G}[update] ✓${N} $*"; }
warn() { echo -e "${Y}[update] !${N} $*"; }
fail() { echo -e "${R}[update] ✗${N} $*" >&2; }

# ── Parse args ───────────────────────────────────────────────────────────────
CHECK_ONLY=false
FORCE=false
DO_ROLLBACK=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --check)    CHECK_ONLY=true; shift ;;
    --force)    FORCE=true;      shift ;;
    --rollback) DO_ROLLBACK=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--check | --force | --rollback]"
      echo ""
      echo "  --check      Only check if update is available (exit 2 if yes)"
      echo "  --force      Force update even if versions match"
      echo "  --rollback   Rollback to the last backup"
      exit 0
      ;;
    *) fail "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Determine install directory ──────────────────────────────────────────────
# Script lives at <install-dir>/scripts/update.sh
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$INSTALL_DIR"

# Instance ID (same as auto-host.sh)
INSTANCE_ID=$(echo "$INSTALL_DIR" | md5sum | cut -c1-8)
SERVICE_NAME="clawdos-${INSTANCE_ID}"

# Update working directory
UPDATE_DIR="$INSTALL_DIR/.update"
BACKUP_DIR="$UPDATE_DIR/backups"
LOCK_DIR="$UPDATE_DIR/update.lock"
HISTORY_LOG="$UPDATE_DIR/history.log"

mkdir -p "$UPDATE_DIR" "$BACKUP_DIR"

# ── History logging ──────────────────────────────────────────────────────────
log_history() {
  echo "[$(date -Iseconds)] $*" >> "$HISTORY_LOG"
}

# ── Lock management ──────────────────────────────────────────────────────────
acquire_lock() {
  # Remove stale locks (older than 30 minutes)
  if [[ -d "$LOCK_DIR" ]]; then
    local lock_age
    lock_age=$(( $(date +%s) - $(stat -c %Y "$LOCK_DIR" 2>/dev/null || echo 0) ))
    if [[ $lock_age -gt 1800 ]]; then
      warn "Removing stale lock (${lock_age}s old)"
      rmdir "$LOCK_DIR" 2>/dev/null || true
    else
      fail "Another update is in progress (lock age: ${lock_age}s)"
      exit 1
    fi
  fi

  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    fail "Could not acquire update lock"
    exit 1
  fi
}

release_lock() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

# ── Cleanup trap ─────────────────────────────────────────────────────────────
cleanup() {
  release_lock
}
trap cleanup EXIT

# ── Rollback function ────────────────────────────────────────────────────────
do_rollback() {
  local saved_hash="$1"
  local backup_ts="$2"

  warn "Rolling back to commit ${saved_hash:0:8}..."
  log_history "ROLLBACK started (target: ${saved_hash:0:8})"

  # Restore code
  git reset --hard "$saved_hash" 2>/dev/null || true

  # Restore .next build if backup exists
  local backup_path="$BACKUP_DIR/$backup_ts"
  if [[ -d "$backup_path/dot-next" ]]; then
    rm -rf .next
    cp -al "$backup_path/dot-next" .next 2>/dev/null || cp -r "$backup_path/dot-next" .next
    ok "Restored .next from backup"
  fi

  # Restore node_modules if package.json changed
  if [[ -f "$backup_path/package.json" ]]; then
    cp "$backup_path/package.json" package.json
    npm ci --loglevel=warn 2>/dev/null || true
  fi

  # Restart service
  restart_service

  log_history "ROLLBACK complete (restored: ${saved_hash:0:8})"
  ok "Rollback complete"
}

# ── Restart service ──────────────────────────────────────────────────────────
restart_service() {
  if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    log "Restarting systemd service: $SERVICE_NAME"
    systemctl restart "$SERVICE_NAME"
  else
    # Try to find and restart a running process
    local pid_file="/tmp/clawdos-${INSTANCE_ID}.pid"
    if [[ -f "$pid_file" ]]; then
      local old_pid
      old_pid=$(cat "$pid_file")
      kill "$old_pid" 2>/dev/null || true
      sleep 1
    fi

    # Load env and start
    if [[ -f "$INSTALL_DIR/.env.local" ]]; then
      set -a
      source "$INSTALL_DIR/.env.local"
      set +a
    fi
    PORT="${PORT:-3000}" nohup npm start > "/tmp/clawdos-${INSTANCE_ID}.log" 2>&1 &
    echo $! > "$pid_file"
    ok "Restarted (PID: $!)"
  fi
}

# ── Health check ─────────────────────────────────────────────────────────────
health_check() {
  # Determine port
  local port="${PORT:-3000}"
  if [[ -f "$INSTALL_DIR/.env.local" ]]; then
    local env_port
    env_port=$(grep -oP 'APP_URL=http://localhost:\K[0-9]+' "$INSTALL_DIR/.env.local" 2>/dev/null || echo "")
    if [[ -n "$env_port" ]]; then
      port="$env_port"
    fi
  fi

  log "Health check on port $port..."
  for i in $(seq 1 20); do
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${port}/login" 2>/dev/null || echo "000")
    if [[ "$status" == "200" || "$status" == "307" || "$status" == "302" ]]; then
      ok "Server is healthy (HTTP $status)"
      return 0
    fi
    sleep 2
  done

  fail "Health check failed after 40 seconds"
  return 1
}

# ── Get current version ──────────────────────────────────────────────────────
get_current_version() {
  if [[ -f package.json ]]; then
    node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "unknown"
  else
    echo "unknown"
  fi
}

# ── Get latest version from remote ───────────────────────────────────────────
get_latest_version() {
  # Fetch latest from remote
  git fetch --tags origin 2>/dev/null || {
    warn "Could not fetch from remote"
    echo ""
    return
  }

  # Try to find latest tag
  local latest_tag
  latest_tag=$(git tag -l 'v*' --sort=-version:refname 2>/dev/null | head -1)

  if [[ -n "$latest_tag" ]]; then
    echo "$latest_tag"
  else
    # No tags — use remote HEAD
    echo "origin/master"
  fi
}

# ── Check if update is needed ────────────────────────────────────────────────
check_update_needed() {
  local target="$1"

  if [[ "$target" == "origin/master" ]]; then
    # Compare local HEAD with remote HEAD
    local local_head remote_head
    local_head=$(git rev-parse HEAD)
    remote_head=$(git rev-parse origin/master 2>/dev/null || echo "")

    if [[ -z "$remote_head" ]]; then
      warn "Cannot determine remote HEAD"
      return 1
    fi

    if [[ "$local_head" == "$remote_head" ]]; then
      return 1  # up to date
    fi

    # Check if remote is ancestor of local (local is ahead)
    if git merge-base --is-ancestor "$remote_head" HEAD 2>/dev/null; then
      return 1  # local is ahead or same
    fi

    return 0  # update available
  else
    # Tag-based: check if current HEAD is at or after the tag
    if git merge-base --is-ancestor "$target" HEAD 2>/dev/null; then
      return 1  # already at or past this tag
    fi
    return 0  # update available
  fi
}

# ══════════════════════════════════════════════════════════════════════════════
# Manual rollback mode
# ══════════════════════════════════════════════════════════════════════════════
if [[ "$DO_ROLLBACK" == true ]]; then
  acquire_lock

  # Find latest backup
  latest_backup=$(ls -1 "$BACKUP_DIR" 2>/dev/null | sort -r | head -1)

  if [[ -z "$latest_backup" ]]; then
    fail "No backups found in $BACKUP_DIR"
    exit 1
  fi

  saved_hash=$(cat "$BACKUP_DIR/$latest_backup/commit-hash" 2>/dev/null || echo "")

  if [[ -z "$saved_hash" ]]; then
    fail "No commit hash found in backup $latest_backup"
    exit 1
  fi

  do_rollback "$saved_hash" "$latest_backup"
  exit 3
fi

# ══════════════════════════════════════════════════════════════════════════════
# Main update flow
# ══════════════════════════════════════════════════════════════════════════════

log "ClawdOS Update — $(date)"
log "Directory: $INSTALL_DIR"

# ── Step 1: Fetch & determine target ─────────────────────────────────────────
log "Fetching from remote..."
TARGET=$(get_latest_version)

if [[ -z "$TARGET" ]]; then
  fail "Could not determine update target"
  exit 1
fi

CURRENT_VERSION=$(get_current_version)
if [[ "$TARGET" == "origin/master" ]]; then
  TARGET_VERSION="latest"
else
  TARGET_VERSION="${TARGET#v}"
fi

log "Current: v${CURRENT_VERSION} | Target: ${TARGET} (${TARGET_VERSION})"

# ── Step 2: Check if update is needed ────────────────────────────────────────
if [[ "$FORCE" != true ]]; then
  if ! check_update_needed "$TARGET"; then
    ok "Already up to date (v${CURRENT_VERSION})"
    log_history "CHECK v${CURRENT_VERSION} — up to date"

    if [[ "$CHECK_ONLY" == true ]]; then
      exit 0
    fi
    exit 0
  fi
fi

# In check-only mode, report and exit
if [[ "$CHECK_ONLY" == true ]]; then
  log "Update available: v${CURRENT_VERSION} → ${TARGET_VERSION}"
  log_history "CHECK v${CURRENT_VERSION} → ${TARGET_VERSION} — available"
  exit 2
fi

# ── Step 3: Acquire lock ─────────────────────────────────────────────────────
acquire_lock
log_history "UPDATE started: v${CURRENT_VERSION} → ${TARGET_VERSION}"

# ── Step 4: Backup ───────────────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
SAVED_HASH=$(git rev-parse HEAD)
BACKUP_PATH="$BACKUP_DIR/$TIMESTAMP"
mkdir -p "$BACKUP_PATH"

# Save commit hash for rollback
echo "$SAVED_HASH" > "$BACKUP_PATH/commit-hash"
echo "$CURRENT_VERSION" > "$BACKUP_PATH/version"

# Backup .next build (hardlinks for speed, fallback to copy)
if [[ -d .next ]]; then
  cp -al .next "$BACKUP_PATH/dot-next" 2>/dev/null || cp -r .next "$BACKUP_PATH/dot-next"
  ok "Backed up .next"
fi

# Backup package.json (in case deps change)
cp package.json "$BACKUP_PATH/package.json"

ok "Backup created: $TIMESTAMP (commit: ${SAVED_HASH:0:8})"

# ── Step 5: Git merge ────────────────────────────────────────────────────────
log "Merging ${TARGET}..."

if ! git merge "$TARGET" --no-edit 2>&1; then
  # Merge conflict — abort cleanly
  warn "Merge conflict detected!"
  git merge --abort 2>/dev/null || true
  log_history "UPDATE CONFLICT: v${CURRENT_VERSION} → ${TARGET_VERSION} (merge aborted)"
  fail "Merge conflict. Your local changes conflict with upstream."
  fail "No changes were made. Run 'git merge ${TARGET}' manually to resolve."
  exit 4
fi

ok "Merge successful"
NEW_VERSION=$(get_current_version)

# ── Step 6: Dependencies ─────────────────────────────────────────────────────
# Only run npm ci if package.json or package-lock.json changed
if ! git diff --quiet "$SAVED_HASH" HEAD -- package.json package-lock.json 2>/dev/null; then
  log "Dependencies changed, running npm ci..."
  if ! npm ci --loglevel=warn 2>&1; then
    fail "npm ci failed"
    do_rollback "$SAVED_HASH" "$TIMESTAMP"
    log_history "UPDATE FAILED: npm ci (rolled back)"
    exit 3
  fi
  ok "Dependencies updated"
else
  ok "Dependencies unchanged, skipping npm ci"
fi

# ── Step 7: Migrations ───────────────────────────────────────────────────────
log "Running migrations..."
if ! node scripts/migrate.mjs 2>&1; then
  warn "Migration failed (non-fatal, continuing...)"
  log_history "WARNING: migration failed during update"
fi

# ── Step 8: Build ────────────────────────────────────────────────────────────
log "Building..."
if ! npm run build 2>&1; then
  fail "Build failed"
  do_rollback "$SAVED_HASH" "$TIMESTAMP"
  log_history "UPDATE FAILED: build (rolled back to ${SAVED_HASH:0:8})"
  exit 3
fi
ok "Build complete"

# ── Step 9: Restart ──────────────────────────────────────────────────────────
restart_service

# ── Step 10: Health check ────────────────────────────────────────────────────
if ! health_check; then
  fail "Health check failed after restart"
  do_rollback "$SAVED_HASH" "$TIMESTAMP"
  log_history "UPDATE FAILED: health check (rolled back to ${SAVED_HASH:0:8})"
  exit 3
fi

# ── Step 11: Cleanup old backups (keep last 5) ───────────────────────────────
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l)
if [[ "$BACKUP_COUNT" -gt 5 ]]; then
  ls -1 "$BACKUP_DIR" | sort | head -n -5 | while read -r old; do
    rm -rf "$BACKUP_DIR/$old"
  done
  ok "Cleaned old backups (kept last 5)"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
log_history "UPDATE OK: v${CURRENT_VERSION} → v${NEW_VERSION} (commit: $(git rev-parse --short HEAD))"
ok "Update complete: v${CURRENT_VERSION} → v${NEW_VERSION}"
