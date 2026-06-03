#!/usr/bin/env bash
# v4 migration: add sprints (time-boxed task buckets).
# Idempotent — safe to run repeatedly. Creates the sprints table and adds
# tasks.sprint_id if they are missing. New DBs get this from init-db.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"

if [[ ! -f "$DB" ]]; then
  echo "tasks.db not found at: $DB. Run init-db.sh first." >&2
  exit 1
fi

echo "Migrating tasks.db: sprints (v4)..."

# 1. sprints table
if ! sqlite3 "$DB" "SELECT 1 FROM sprints LIMIT 0;" 2>/dev/null; then
  sqlite3 "$DB" "
    CREATE TABLE sprints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        project_id INTEGER REFERENCES projects(id),
        goal TEXT,
        status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'completed', 'cancelled')),
        start_date TEXT,
        end_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
    );
    CREATE INDEX IF NOT EXISTS idx_sprints_project_status ON sprints(project_id, status);
    CREATE TRIGGER update_sprints_timestamp AFTER UPDATE ON sprints
    BEGIN
        UPDATE sprints SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
  "
  echo "  created sprints table (+ index, trigger)"
else
  echo "  sprints table already exists"
fi

# 2. tasks.sprint_id column
if ! sqlite3 "$DB" "SELECT sprint_id FROM tasks LIMIT 0;" 2>/dev/null; then
  sqlite3 "$DB" "ALTER TABLE tasks ADD COLUMN sprint_id INTEGER REFERENCES sprints(id);"
  sqlite3 "$DB" "CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);"
  echo "  added tasks.sprint_id (+ index)"
else
  echo "  tasks.sprint_id already exists"
fi

echo "Migration complete."
