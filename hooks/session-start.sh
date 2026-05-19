#!/usr/bin/env bash
# SessionStart Hook
# Injects current priority + scope context at session start.
# Reads Claude memory for priority context and tasks.db for active work.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="$ROOT/tasks.db"
TASKCTL="$ROOT/scripts/taskctl"
PROJECT_CONTEXT="$ROOT/scripts/project-context"

# Auto-detect Claude memory directory for this project.
# Claude Code stores memory at ~/.claude/projects/-{path-with-dashes}/memory/
REAL_ROOT="$(cd "$ROOT" && pwd -P)"
MEMORY_SLUG="$(printf '%s' "$REAL_ROOT" | sed 's|/|-|g')"
MEMORY_DIR="$HOME/.claude/projects/${MEMORY_SLUG}/memory"
PRIORITY_FILE="$MEMORY_DIR/project_current_priority.md"

# Fail-safe: if anything errors, output nothing and exit clean
trap 'exit 0' ERR

# --- 1. Current priority from memory file ---
PRIORITY=""
if [[ -f "$PRIORITY_FILE" ]]; then
  PRIORITY=$(grep -m1 '^## Priority 1' "$PRIORITY_FILE" | sed 's/^## //' || echo "")
fi

# --- 2. High-priority in-progress tasks via shared script (fallback to direct SQL) ---
ACTIVE_TASKS_JSON='[]'
if [[ -x "$TASKCTL" ]]; then
  ACTIVE_TASKS_JSON="$($TASKCTL active-high-json 2>/dev/null || echo '[]')"
fi
if [[ "$ACTIVE_TASKS_JSON" == "[]" && -f "$DB" ]]; then
  ACTIVE_TASKS_JSON=$(sqlite3 "$DB" "
    SELECT COALESCE(
      json_group_array(json_object('title', title, 'project', project)),
      '[]'
    )
    FROM (
      SELECT t.title AS title, COALESCE(p.name, '-') AS project
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.status = 'in-progress' AND t.priority IN ('high', 'critical')
      ORDER BY t.updated_at DESC
      LIMIT 3
    );
  " 2>/dev/null || echo '[]')
fi

# --- 3. Match CWD to a known project via shared script (fallback to direct SQL) ---
PROJECT_JSON=""
if [[ -x "$PROJECT_CONTEXT" ]]; then
  PROJECT_JSON="$($PROJECT_CONTEXT "$PWD" 2>/dev/null || echo '')"
fi
if [[ -z "$PROJECT_JSON" && -f "$DB" ]]; then
  CWD_FRAGMENT=$(basename "$PWD")
  PROJECT_ROW=$(sqlite3 "$DB" "
    SELECT p.name,
           COALESCE(o.name, 'no org') AS org_name,
           COALESCE(o.jira_project_key, '') AS jira_key,
           CASE WHEN COALESCE(o.discord_webhook_url, '') != '' THEN 1 ELSE 0 END AS has_discord
    FROM projects p
    LEFT JOIN organizations o ON p.organization_id = o.id
    WHERE p.local_path LIKE '%${CWD_FRAGMENT}%'
    LIMIT 1;
  " 2>/dev/null || echo "")
  if [[ -n "$PROJECT_ROW" ]]; then
    IFS='|' read -r proj_name org_name jira_key has_discord <<< "$PROJECT_ROW"
    PROJECT_JSON=$(jq -n \
      --arg name "$proj_name" \
      --arg org_name "$org_name" \
      --arg jira_project_key "$jira_key" \
      --argjson has_discord_webhook "${has_discord:-0}" \
      '{name: $name, org_name: $org_name, jira_project_key: $jira_project_key, has_discord_webhook: $has_discord_webhook}')
  fi
fi

# --- 4. Build context string ---
CONTEXT="FOCUS CONTEXT (injected by session-start hook):"

if [[ -n "$PRIORITY" ]]; then
  CONTEXT="$CONTEXT\nCurrent priority: $PRIORITY"
fi

if [[ -n "$ACTIVE_TASKS_JSON" && "$ACTIVE_TASKS_JSON" != '[]' ]]; then
  CONTEXT="$CONTEXT\nActive high-priority tasks:"
  while IFS=$'\t' read -r title project; do
    [[ -n "$title" ]] || continue
    CONTEXT="$CONTEXT\n  - $title ($project)"
  done < <(printf '%s' "$ACTIVE_TASKS_JSON" | jq -r '.[] | [.title, .project] | @tsv')
fi

if [[ -n "$PROJECT_JSON" && "$PROJECT_JSON" != 'null' ]]; then
  proj_name=$(printf '%s' "$PROJECT_JSON" | jq -r '.name // empty')
  org_name=$(printf '%s' "$PROJECT_JSON" | jq -r '.org_name // "no org"')
  jira_key=$(printf '%s' "$PROJECT_JSON" | jq -r '.jira_project_key // empty')
  has_discord=$(printf '%s' "$PROJECT_JSON" | jq -r '.has_discord_webhook // 0')
  if [[ -n "$proj_name" ]]; then
    CONTEXT="$CONTEXT\nDetected project: $proj_name ($org_name)"
    [[ -n "$jira_key" ]] && CONTEXT="$CONTEXT | Jira: $jira_key"
    [[ "$has_discord" == "1" ]] && CONTEXT="$CONTEXT | Discord: configured"
  fi
fi

CONTEXT="$CONTEXT\n\nFOCUS GUARD: If the user asks about anything outside the current priority project, say: 'That's outside current priority. Park it or switch?' Do NOT silently drift."

# --- 5. Output JSON ---
jq -n --arg ctx "$CONTEXT" '{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": $ctx
  }
}'

exit 0
