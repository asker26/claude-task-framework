#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"

if [[ ! -f "$DB" ]]; then
  echo "tasks.db not found. Run init-db.sh first." >&2
  exit 1
fi

echo "Migrating tasks.db to v3 schema..."

# Add depends_on to tasks if missing
if ! sqlite3 "$DB" "SELECT depends_on FROM tasks LIMIT 0;" 2>/dev/null; then
  sqlite3 "$DB" "ALTER TABLE tasks ADD COLUMN depends_on TEXT;"
  echo "  added tasks.depends_on"
else
  echo "  tasks.depends_on already exists"
fi

# Recreate agents table with new schema
sqlite3 "$DB" "DROP TABLE IF EXISTS agents;"
sqlite3 "$DB" "
CREATE TABLE agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    worker_name TEXT NOT NULL DEFAULT 'agent',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    cli_session_id TEXT,
    tmux_pane TEXT,
    pid INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    result TEXT,
    heartbeat_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"
echo "  recreated agents table"

echo "Migration complete."
