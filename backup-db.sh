#!/bin/bash
# Daily SQLite backup: dumps tasks.db as SQL text and commits to git
set -e

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$REPO/tasks.db"
BACKUP="$REPO/backups/tasks.sql"

mkdir -p "$REPO/backups"

# Dump database as SQL text
sqlite3 "$DB" .dump > "$BACKUP"

# Commit and push if there are changes
cd "$REPO"
git add backups/tasks.sql
if git diff --cached --quiet; then
  exit 0
fi
git commit -m "Automated DB backup $(date +%Y-%m-%d)"
git push origin main
