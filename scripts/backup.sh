#!/bin/bash
# ClawdOS database backup script
# Usage: ./scripts/backup.sh [output_dir]
# Cron:  0 2 * * * /path/to/clawdos/scripts/backup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load environment
# shellcheck disable=SC1091
source "${PROJECT_DIR}/.env" 2>/dev/null || true

DB_URL="${DATABASE_URL:?DATABASE_URL not set}"
BACKUP_DIR="${1:-${PROJECT_DIR}/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/clawdos_${TIMESTAMP}.sql.gz"
RETAIN_DAYS=7

mkdir -p "$BACKUP_DIR"

echo "Backing up to ${BACKUP_FILE}..."
pg_dump "$DB_URL" | gzip > "$BACKUP_FILE"

# Remove backups older than RETAIN_DAYS
find "$BACKUP_DIR" -name "clawdos_*.sql.gz" -mtime +${RETAIN_DAYS} -delete

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Done. Size: ${SIZE}"
