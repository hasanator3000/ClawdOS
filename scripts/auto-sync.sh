#!/bin/bash
# Auto-commit and push script for ClawdOS
# Scans for secrets before committing

set -e

cd /root/clawd/apps/clawdos

# Check for changes
if [ -z "$(git status --porcelain)" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] No changes to commit"
    exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Changes detected, scanning for secrets..."

# Scan ALL files (not just staged) for secrets before adding
gitleaks detect --no-banner --exit-code 1 --redact

if [ $? -ne 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Secrets detected! Aborting auto-sync."
    exit 1
fi

# Add all changes (respecting .gitignore)
git add -A

# Create commit with timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
git commit -m "Auto-sync: $TIMESTAMP"

# Push to remote
git push origin master

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Successfully synced to GitHub"
