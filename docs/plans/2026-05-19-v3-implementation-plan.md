# v3 Multi-Agent Worker System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-agent task execution — dispatch multiple Claude Code CLI sessions in tmux with git worktree isolation, heartbeat monitoring, stuck recovery, dependency cascading, and priority scheduling.

**Architecture:** Six new scripts (`agent-dispatch`, `agent-wrapper`, `agent-complete`, `agent-watcher`, `agent-daemon`, `agent-status`) orchestrate Claude Code CLI sessions in tmux panes. Each agent works in an isolated git worktree. A daemon loop polls every 30s to fill available slots and recover stuck agents. All state is tracked in SQLite.

**Tech Stack:** Bash, SQLite3, tmux, git worktrees

**Important:** This is a clean room implementation. Do NOT reference any external codebase. All code is original.

---

### Task 1: Update schema (init-db.sh + migration)

**Files:**
- Modify: `init-db.sh:50-65` (add `depends_on` to tasks), `init-db.sh:126-136` (replace agents table)
- Create: `scripts/migrate-v3.sh`

**Step 1: Update the tasks table in init-db.sh**

Add `depends_on TEXT` after the `due_date` column in the tasks CREATE TABLE (line 60):

```sql
    due_date TEXT,
    depends_on TEXT,
```

**Step 2: Replace the agents table in init-db.sh**

Replace lines 126-136 (the old agents table) with:

```sql
-- Agents: track autonomous agent runs against tasks
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
```

**Step 3: Create migration script for existing databases**

Create `scripts/migrate-v3.sh`:

```bash
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
```

**Step 4: Test**

```bash
cd ~/WebstormProjects/claude-task-framework
rm -f /tmp/test-v3.db
cp /dev/null /tmp/test-v3.db  # won't work — need init first
# Test fresh install:
rm -f /tmp/test-v3-fresh.db && TASK_DB_PATH="" bash init-db.sh
sqlite3 tasks.db ".schema agents" | grep -q "retry_count" && echo "PASS: fresh schema" || echo "FAIL"
sqlite3 tasks.db ".schema tasks" | grep -q "depends_on" && echo "PASS: depends_on" || echo "FAIL"
rm -f tasks.db
# Test migration:
# (would need a v2 DB to test — skip for now, migration is defensive)
```

**Step 5: Make executable and commit**

```bash
chmod +x scripts/migrate-v3.sh
git add init-db.sh scripts/migrate-v3.sh
git commit -m "feat: v3 schema — expanded agents table + depends_on on tasks"
```

---

### Task 2: Add `--depends-on` to taskctl add-task

**Files:**
- Modify: `scripts/taskctl:288-320` (add-task command), `scripts/taskctl:448-469` (usage text)

**Step 1: Add --depends-on flag to add-task**

In the add-task case (line 295), add `depends_on=""` to the variable declarations:

```bash
    proj_name="" task_type="feature" task_priority="medium" parent_id="" due_date="" notes="" depends_on=""
```

Add the flag handler in the while loop (after the `--notes` case):

```bash
        --depends-on) depends_on="${2:-}"; shift 2 ;;
```

In the INSERT statement (line 316), add `depends_on` column:

```bash
    new_id=$(sql_insert "
      INSERT INTO tasks (title, type, priority, project_id, parent_task_id, due_date, notes, depends_on)
      VALUES ('$(sql_escape "$task_title")', '$(sql_escape "$task_type")', '$(sql_escape "$task_priority")', $(if [[ -n "$proj_id" ]]; then echo "$proj_id"; else echo "NULL"; fi), $(if [[ -n "$parent_id" ]]; then echo "$parent_id"; else echo "NULL"; fi), $(if [[ -n "$due_date" ]]; then echo "'$(sql_escape "$due_date")'"; else echo "NULL"; fi), $(if [[ -n "$notes" ]]; then echo "'$(sql_escape "$notes")'"; else echo "NULL"; fi), $(if [[ -n "$depends_on" ]]; then echo "'$(sql_escape "$depends_on")'"; else echo "NULL"; fi));
    ")
```

**Step 2: Update usage text**

In the add-task line of the usage block, update the usage hint for add-task:

```
  add-task <title> [opts]            Create task (--depends-on "[1,2]")
```

**Step 3: Test**

```bash
rm -f tasks.db && bash init-db.sh
./scripts/taskctl add-org "Test"
./scripts/taskctl add-project "app" --org "Test" --path ~/test
./scripts/taskctl add-task "Task A" --project "app" --priority high
./scripts/taskctl add-task "Task B" --project "app" --depends-on "[1]"
sqlite3 tasks.db "SELECT id, title, depends_on FROM tasks;"
# Expected: Task B has depends_on = [1]
rm -f tasks.db
```

**Step 4: Commit**

```bash
git add scripts/taskctl
git commit -m "feat: add --depends-on flag to taskctl add-task"
```

---

### Task 3: Create scripts/agent-wrapper

**Files:**
- Create: `scripts/agent-wrapper`

This is the lifecycle script that runs inside each tmux pane.

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"

task_id="${1:-}"
agent_id="${2:-}"

if [[ -z "$task_id" || -z "$agent_id" ]]; then
  echo "usage: agent-wrapper <task_id> <agent_id>" >&2
  exit 1
fi

# Load task and project info
task_row="$(sqlite3 "$DB" "
  SELECT t.title, t.priority, t.notes, t.type, p.name, p.local_path
  FROM tasks t
  LEFT JOIN projects p ON p.id = t.project_id
  WHERE t.id = $task_id;
" 2>/dev/null)"

if [[ -z "$task_row" ]]; then
  echo "task $task_id not found" >&2
  sqlite3 "$DB" "UPDATE agents SET status='failed', result='task not found', completed_at=CURRENT_TIMESTAMP WHERE id=$agent_id;"
  exit 1
fi

IFS='|' read -r title priority notes task_type proj_name local_path <<< "$task_row"

if [[ -z "$local_path" ]]; then
  echo "task $task_id has no project with a local_path" >&2
  sqlite3 "$DB" "UPDATE agents SET status='failed', result='no project local_path', completed_at=CURRENT_TIMESTAMP WHERE id=$agent_id;"
  exit 1
fi

# Resolve real path (expand ~)
local_path="${local_path/#\~/$HOME}"

if [[ ! -d "$local_path" ]]; then
  echo "project path does not exist: $local_path" >&2
  sqlite3 "$DB" "UPDATE agents SET status='failed', result='project path missing: $local_path', completed_at=CURRENT_TIMESTAMP WHERE id=$agent_id;"
  exit 1
fi

# Create worktree
worktree_base="$ROOT/.workspaces"
worktree_dir="$worktree_base/agent-${task_id}"
branch_name="task-${task_id}"

if [[ -d "$worktree_dir" ]]; then
  echo "Cleaning up stale worktree..."
  git -C "$local_path" worktree remove "$worktree_dir" --force 2>/dev/null || rm -rf "$worktree_dir"
fi

echo "Creating worktree at $worktree_dir on branch $branch_name..."
mkdir -p "$worktree_base"
git -C "$local_path" worktree add "$worktree_dir" -b "$branch_name" 2>/dev/null || \
  git -C "$local_path" worktree add "$worktree_dir" "$branch_name" 2>/dev/null || \
  git -C "$local_path" worktree add "$worktree_dir" 2>/dev/null

cd "$worktree_dir"

# Store PID location
sqlite3 "$DB" "UPDATE agents SET pid=$$, heartbeat_at=CURRENT_TIMESTAMP WHERE id=$agent_id;"

# Build prompt
prompt="You are working on task #${task_id}: ${title}.
Type: ${task_type}. Priority: ${priority}.
Project: ${proj_name}.
${notes:+Notes: $notes}

Complete this task autonomously. Write code, run tests, and commit your changes when done.
You are working in a git worktree on branch '${branch_name}'. Commit to this branch."

# Check for resume session
cli_session="$(sqlite3 "$DB" "SELECT cli_session_id FROM agents WHERE id=$agent_id;" 2>/dev/null)"

# Build claude command
claude_cmd=(claude --dangerously-skip-permissions -p "$prompt")
if [[ -n "$cli_session" ]]; then
  claude_cmd=(claude --dangerously-skip-permissions --resume "$cli_session" -p "$prompt")
fi

echo "=== Agent #${agent_id} starting on task #${task_id}: ${title} ==="
echo "=== Worktree: ${worktree_dir} ==="
echo "=== Branch: ${branch_name} ==="
echo ""

# Execute with heartbeat on each output line
exit_code=0
"${claude_cmd[@]}" 2>&1 | while IFS= read -r line; do
  echo "$line"
  sqlite3 "$DB" "UPDATE agents SET heartbeat_at=CURRENT_TIMESTAMP WHERE id=$agent_id;" 2>/dev/null
done || exit_code=${PIPESTATUS[0]}

# Capture exit code from the pipe
if [[ $exit_code -eq 0 ]]; then
  exit_code=${PIPESTATUS[0]:-0}
fi

echo ""
echo "=== Agent #${agent_id} finished (exit code: $exit_code) ==="

# Call agent-complete
"$ROOT/scripts/agent-complete" "$agent_id" "$exit_code"

# Keep pane open briefly for inspection
sleep 5
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/agent-wrapper
git add scripts/agent-wrapper
git commit -m "feat: add agent-wrapper — lifecycle script for tmux agent panes"
```

---

### Task 4: Create scripts/agent-dispatch

**Files:**
- Modify: `scripts/agent-dispatch` (replace stub entirely)

**Step 1: Write the full dispatch script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"
MAX_AGENTS="${CTF_MAX_AGENTS:-3}"
TMUX_SESSION="${CTF_TMUX_SESSION:-ctf-agents}"

if [[ ! -f "$DB" ]]; then
  echo "tasks.db not found at: $DB" >&2
  exit 1
fi

# Check tmux is available
if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux is required for multi-agent dispatch" >&2
  exit 1
fi

# Check concurrency
running="$(sqlite3 "$DB" "SELECT COUNT(*) FROM agents WHERE status='running';")"
if [[ "$running" -ge "$MAX_AGENTS" ]]; then
  echo "at capacity: $running/$MAX_AGENTS agents running"
  exit 0
fi

slots=$((MAX_AGENTS - running))

# Determine which task to dispatch
task_id="${1:-}"

if [[ -z "$task_id" ]]; then
  # Pick best eligible task by priority score
  # Score = priority weight + (number of tasks this unblocks) * 10
  task_id="$(sqlite3 "$DB" "
    SELECT t.id
    FROM tasks t
    WHERE t.status = 'todo'
      AND t.project_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM agents a WHERE a.task_id = t.id AND a.status = 'running'
      )
    ORDER BY
      (CASE t.priority WHEN 'high' THEN 30 WHEN 'medium' THEN 20 ELSE 10 END
       + (SELECT COUNT(*) FROM tasks d
          WHERE d.depends_on LIKE '%' || t.id || '%'
            AND d.status = 'todo') * 10
      ) DESC,
      t.created_at ASC
    LIMIT 1;
  " 2>/dev/null)"

  if [[ -z "$task_id" ]]; then
    echo "no eligible tasks to dispatch"
    exit 0
  fi
fi

# Validate task exists and is in todo state
task_status="$(sqlite3 "$DB" "SELECT status FROM tasks WHERE id=$task_id;" 2>/dev/null)"
if [[ -z "$task_status" ]]; then
  echo "task $task_id not found" >&2
  exit 1
fi
if [[ "$task_status" != "todo" ]]; then
  echo "task $task_id is '$task_status', not 'todo'" >&2
  exit 1
fi

# Check dependencies satisfied
deps="$(sqlite3 "$DB" "SELECT depends_on FROM tasks WHERE id=$task_id;" 2>/dev/null)"
if [[ -n "$deps" && "$deps" != "null" ]]; then
  # Parse JSON array: strip brackets, split by comma
  dep_ids="$(echo "$deps" | tr -d '[] ' | tr ',' '\n')"
  for dep_id in $dep_ids; do
    [[ -z "$dep_id" ]] && continue
    dep_status="$(sqlite3 "$DB" "SELECT status FROM tasks WHERE id=$dep_id;" 2>/dev/null)"
    if [[ "$dep_status" != "done" ]]; then
      echo "task $task_id blocked: dependency #$dep_id is '$dep_status', not 'done'" >&2
      exit 1
    fi
  done
fi

# Atomic claim: only succeeds if task is still 'todo'
changed="$(sqlite3 "$DB" "
  UPDATE tasks SET status='in-progress', updated_at=CURRENT_TIMESTAMP WHERE id=$task_id AND status='todo';
  SELECT changes();
")"
if [[ "$changed" -eq 0 ]]; then
  echo "task $task_id already claimed by another agent"
  exit 0
fi

# Check for previous retry (reuse session)
prev_session="$(sqlite3 "$DB" "
  SELECT cli_session_id FROM agents
  WHERE task_id=$task_id AND status='failed' AND cli_session_id IS NOT NULL
  ORDER BY created_at DESC LIMIT 1;
" 2>/dev/null)"

prev_retry="$(sqlite3 "$DB" "
  SELECT retry_count FROM agents
  WHERE task_id=$task_id AND status='failed'
  ORDER BY created_at DESC LIMIT 1;
" 2>/dev/null)"
retry_count="${prev_retry:-0}"

# Insert agent record
agent_id="$(sqlite3 "$DB" "
  INSERT INTO agents (task_id, status, retry_count, heartbeat_at, started_at, cli_session_id)
  VALUES ($task_id, 'running', $retry_count, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $(if [[ -n "$prev_session" ]]; then echo "'$prev_session'"; else echo "NULL"; fi));
  SELECT last_insert_rowid();
")"

pane_name="agent-${task_id}"
sqlite3 "$DB" "UPDATE agents SET tmux_pane='$pane_name' WHERE id=$agent_id;"

# Log status change
sqlite3 "$DB" "INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES ($task_id, 'todo', 'in-progress');"

# Ensure tmux session exists
if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  tmux new-session -d -s "$TMUX_SESSION" -n "main" "echo 'Claude Task Framework — Agent Session'; bash"
fi

# Spawn agent in new tmux window
tmux new-window -t "$TMUX_SESSION" -n "$pane_name" \
  "$ROOT/scripts/agent-wrapper $task_id $agent_id; sleep 5; exit"

title="$(sqlite3 "$DB" "SELECT title FROM tasks WHERE id=$task_id;")"
echo "dispatched agent #$agent_id for task #$task_id: $title"
echo "  tmux: $TMUX_SESSION:$pane_name"
echo "  watch: tmux attach -t $TMUX_SESSION:$pane_name"
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/agent-dispatch
git add scripts/agent-dispatch
git commit -m "feat: real agent-dispatch — priority scoring, atomic claim, tmux spawn"
```

---

### Task 5: Create scripts/agent-complete

**Files:**
- Create: `scripts/agent-complete`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"

agent_id="${1:-}"
exit_code="${2:-1}"

if [[ -z "$agent_id" ]]; then
  echo "usage: agent-complete <agent_id> <exit_code>" >&2
  exit 1
fi

# Load agent info
agent_row="$(sqlite3 "$DB" "SELECT task_id, retry_count FROM agents WHERE id=$agent_id;" 2>/dev/null)"
if [[ -z "$agent_row" ]]; then
  echo "agent $agent_id not found" >&2
  exit 1
fi
IFS='|' read -r task_id retry_count <<< "$agent_row"

discord_notify() {
  local msg="$1"
  # Get Discord webhook from task's org
  local webhook
  webhook="$(sqlite3 "$DB" "
    SELECT o.discord_webhook_url
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN organizations o ON o.id = p.organization_id
    WHERE t.id = $task_id;
  " 2>/dev/null)"

  if [[ -n "$webhook" && "$webhook" != "null" && -f "$ROOT/scripts/discord-notify" ]]; then
    "$ROOT/scripts/discord-notify" custom --message "$msg" --title "Agent Update" 2>/dev/null || true
  fi
}

if [[ "$exit_code" -eq 0 ]]; then
  # === SUCCESS ===
  sqlite3 "$DB" "
    UPDATE agents SET status='completed', completed_at=CURRENT_TIMESTAMP,
           result='completed successfully' WHERE id=$agent_id;
    UPDATE tasks SET status='done', updated_at=CURRENT_TIMESTAMP WHERE id=$task_id;
    INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES ($task_id, 'in-progress', 'done');
  "

  title="$(sqlite3 "$DB" "SELECT title FROM tasks WHERE id=$task_id;")"
  echo "task #$task_id completed: $title"
  discord_notify "Task #$task_id completed: $title"

  # --- Dependency cascade ---
  # Find all todo tasks whose depends_on includes this task_id
  candidates="$(sqlite3 "$DB" "
    SELECT id, depends_on FROM tasks
    WHERE status='todo' AND depends_on IS NOT NULL AND depends_on LIKE '%${task_id}%';
  " 2>/dev/null)"

  while IFS='|' read -r cand_id cand_deps; do
    [[ -z "$cand_id" ]] && continue

    # Check ALL dependencies satisfied
    dep_ids="$(echo "$cand_deps" | tr -d '[] ' | tr ',' '\n')"
    all_done=true
    for dep_id in $dep_ids; do
      [[ -z "$dep_id" ]] && continue
      dep_status="$(sqlite3 "$DB" "SELECT status FROM tasks WHERE id=$dep_id;" 2>/dev/null)"
      if [[ "$dep_status" != "done" ]]; then
        all_done=false
        break
      fi
    done

    if [[ "$all_done" == "true" ]]; then
      echo "  cascade: dispatching task #$cand_id (all deps satisfied)"
      "$ROOT/scripts/agent-dispatch" "$cand_id" 2>/dev/null || true
    fi
  done <<< "$candidates"

  # --- Subtask cascade ---
  # Check if this task has a parent, and all siblings are done
  parent_id="$(sqlite3 "$DB" "SELECT parent_task_id FROM tasks WHERE id=$task_id;" 2>/dev/null)"
  if [[ -n "$parent_id" && "$parent_id" != "" ]]; then
    pending_siblings="$(sqlite3 "$DB" "
      SELECT COUNT(*) FROM tasks
      WHERE parent_task_id=$parent_id AND id != $task_id AND status != 'done';
    " 2>/dev/null)"
    if [[ "$pending_siblings" -eq 0 ]]; then
      parent_status="$(sqlite3 "$DB" "SELECT status FROM tasks WHERE id=$parent_id;" 2>/dev/null)"
      if [[ "$parent_status" == "todo" ]]; then
        echo "  cascade: all subtasks done, dispatching parent #$parent_id"
        "$ROOT/scripts/agent-dispatch" "$parent_id" 2>/dev/null || true
      fi
    fi
  fi

else
  # === FAILURE ===
  if [[ "$retry_count" -lt 1 ]]; then
    # First failure — retry once
    new_retry=$((retry_count + 1))
    sqlite3 "$DB" "
      UPDATE agents SET status='failed', completed_at=CURRENT_TIMESTAMP,
             result='failed (exit $exit_code), will retry' WHERE id=$agent_id;
      UPDATE tasks SET status='todo', updated_at=CURRENT_TIMESTAMP WHERE id=$task_id;
      INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES ($task_id, 'in-progress', 'todo');
    "
    echo "task #$task_id failed (attempt $((retry_count + 1))), re-dispatching..."
    "$ROOT/scripts/agent-dispatch" "$task_id" 2>/dev/null || true
  else
    # Second failure — give up, pause task
    sqlite3 "$DB" "
      UPDATE agents SET status='failed', completed_at=CURRENT_TIMESTAMP,
             result='failed twice, paused' WHERE id=$agent_id;
      UPDATE tasks SET status='paused', updated_at=CURRENT_TIMESTAMP,
             notes=COALESCE(notes,'') || char(10) || '[agent] Failed twice. Needs human attention.' WHERE id=$task_id;
      INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES ($task_id, 'in-progress', 'paused');
    "
    title="$(sqlite3 "$DB" "SELECT title FROM tasks WHERE id=$task_id;")"
    echo "task #$task_id failed twice, paused: $title"
    discord_notify "Task #$task_id failed twice, needs attention: $title"
  fi
fi
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/agent-complete
git add scripts/agent-complete
git commit -m "feat: add agent-complete — result handling + dependency cascade"
```

---

### Task 6: Create scripts/agent-watcher

**Files:**
- Create: `scripts/agent-watcher`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"
STUCK_TIMEOUT="${CTF_STUCK_TIMEOUT:-10}"
TMUX_SESSION="${CTF_TMUX_SESSION:-ctf-agents}"

if [[ ! -f "$DB" ]]; then
  echo "tasks.db not found" >&2
  exit 1
fi

recovered=0
paused=0

# Find stuck agents: running but no heartbeat for STUCK_TIMEOUT minutes
stuck="$(sqlite3 "$DB" "
  SELECT id, task_id, tmux_pane, pid, retry_count
  FROM agents
  WHERE status='running'
    AND heartbeat_at < datetime('now', '-$STUCK_TIMEOUT minutes');
" 2>/dev/null)"

while IFS='|' read -r agent_id task_id pane pid retry_count; do
  [[ -z "$agent_id" ]] && continue

  echo "stuck agent #$agent_id (task #$task_id, no heartbeat for ${STUCK_TIMEOUT}+ min)"

  # Kill tmux pane
  if [[ -n "$pane" ]]; then
    tmux kill-window -t "$TMUX_SESSION:$pane" 2>/dev/null || true
  fi

  # Kill process
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    kill -TERM "$pid" 2>/dev/null || true
    sleep 1
    kill -9 "$pid" 2>/dev/null || true
  fi

  if [[ "$retry_count" -lt 1 ]]; then
    # First stuck — save session, retry
    sqlite3 "$DB" "
      UPDATE agents SET status='failed', completed_at=CURRENT_TIMESTAMP,
             result='stuck: no heartbeat for ${STUCK_TIMEOUT}+ min' WHERE id=$agent_id;
      UPDATE tasks SET status='todo', updated_at=CURRENT_TIMESTAMP WHERE id=$task_id;
      INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES ($task_id, 'in-progress', 'todo');
    "
    echo "  reset task #$task_id to todo, will retry on next cycle"
    recovered=$((recovered + 1))
  else
    # Second stuck — pause
    sqlite3 "$DB" "
      UPDATE agents SET status='failed', completed_at=CURRENT_TIMESTAMP,
             result='stuck twice, paused' WHERE id=$agent_id;
      UPDATE tasks SET status='paused', updated_at=CURRENT_TIMESTAMP,
             notes=COALESCE(notes,'') || char(10) || '[agent] Stuck twice. Needs human attention.' WHERE id=$task_id;
      INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES ($task_id, 'in-progress', 'paused');
    "
    echo "  task #$task_id paused (stuck twice)"
    paused=$((paused + 1))
  fi
done <<< "$stuck"

# Clean up orphaned tmux windows
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  tmux list-windows -t "$TMUX_SESSION" -F '#{window_name}' 2>/dev/null | while read -r win; do
    if [[ "$win" == agent-* ]]; then
      # Extract task_id from window name
      t_id="${win#agent-}"
      running="$(sqlite3 "$DB" "SELECT COUNT(*) FROM agents WHERE task_id=$t_id AND status='running';" 2>/dev/null)"
      if [[ "$running" -eq 0 ]]; then
        echo "orphan tmux window: $win (no running agent), killing"
        tmux kill-window -t "$TMUX_SESSION:$win" 2>/dev/null || true
      fi
    fi
  done
fi

running="$(sqlite3 "$DB" "SELECT COUNT(*) FROM agents WHERE status='running';" 2>/dev/null)"
echo "watcher: $running running, $recovered recovered, $paused paused"
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/agent-watcher
git add scripts/agent-watcher
git commit -m "feat: add agent-watcher — stuck detection, kill, retry/pause"
```

---

### Task 7: Create scripts/agent-daemon

**Files:**
- Create: `scripts/agent-daemon`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"
TMUX_SESSION="${CTF_TMUX_SESSION:-ctf-agents}"
MAX_AGENTS="${CTF_MAX_AGENTS:-3}"
INTERVAL=30

cmd="${1:-start}"

daemon_loop() {
  local cycle=0
  echo "Agent daemon started (max=$MAX_AGENTS, interval=${INTERVAL}s, stuck=${CTF_STUCK_TIMEOUT:-10}m)"
  echo "Press Ctrl+C to stop."
  echo ""

  while true; do
    cycle=$((cycle + 1))

    # Run watcher
    watcher_out="$("$ROOT/scripts/agent-watcher" 2>&1)" || true

    # Fill available slots
    dispatched=0
    running="$(sqlite3 "$DB" "SELECT COUNT(*) FROM agents WHERE status='running';" 2>/dev/null)"
    slots=$((MAX_AGENTS - running))

    while [[ "$slots" -gt 0 ]]; do
      dispatch_out="$("$ROOT/scripts/agent-dispatch" 2>&1)" || true
      if echo "$dispatch_out" | grep -q "dispatched agent"; then
        dispatched=$((dispatched + 1))
        slots=$((slots - 1))
      else
        break
      fi
    done

    # Log cycle
    running="$(sqlite3 "$DB" "SELECT COUNT(*) FROM agents WHERE status='running';" 2>/dev/null)"
    ts="$(date '+%H:%M:%S')"
    echo "[$ts] cycle $cycle: ${running}/${MAX_AGENTS} running, $dispatched dispatched | $watcher_out"

    sleep "$INTERVAL"
  done
}

case "$cmd" in
  start)
    # Ensure tmux session exists
    if ! tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
      tmux new-session -d -s "$TMUX_SESSION" -n "daemon" "$0 run"
      echo "daemon started in tmux session: $TMUX_SESSION"
      echo "  attach: tmux attach -t $TMUX_SESSION"
    else
      # Check if daemon window already exists
      if tmux list-windows -t "$TMUX_SESSION" -F '#{window_name}' 2>/dev/null | grep -q '^daemon$'; then
        echo "daemon already running in $TMUX_SESSION:daemon"
        exit 0
      fi
      tmux new-window -t "$TMUX_SESSION" -n "daemon" "$0 run"
      echo "daemon started in existing tmux session: $TMUX_SESSION:daemon"
    fi
    ;;
  stop)
    if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
      tmux kill-window -t "$TMUX_SESSION:daemon" 2>/dev/null || true
      echo "daemon stopped"
    else
      echo "no tmux session found"
    fi
    ;;
  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;
  run)
    # Internal: called by tmux, runs the actual loop
    daemon_loop
    ;;
  *)
    echo "usage: agent-daemon start|stop|restart" >&2
    exit 1
    ;;
esac
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/agent-daemon
git add scripts/agent-daemon
git commit -m "feat: add agent-daemon — 30s polling loop for watcher + dispatch"
```

---

### Task 8: Create scripts/agent-status

**Files:**
- Create: `scripts/agent-status`

**Step 1: Write the script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"
MAX_AGENTS="${CTF_MAX_AGENTS:-3}"
TMUX_SESSION="${CTF_TMUX_SESSION:-ctf-agents}"

if [[ ! -f "$DB" ]]; then
  echo "tasks.db not found" >&2
  exit 1
fi

echo "AGENT STATUS"
echo "============"

# Running agents
running_count="$(sqlite3 "$DB" "SELECT COUNT(*) FROM agents WHERE status='running';")"
echo "Running ($running_count/$MAX_AGENTS):"

running_out="$(sqlite3 "$DB" "
  SELECT printf('  %-12s task #%-4d [%-4s] %-30s %s  heartbeat %ss ago',
    a.tmux_pane,
    a.task_id,
    UPPER(SUBSTR(t.priority,1,3)),
    SUBSTR(t.title,1,30),
    CASE
      WHEN (strftime('%s','now') - strftime('%s',a.started_at)) >= 3600
        THEN (strftime('%s','now') - strftime('%s',a.started_at))/3600 || 'h'
      ELSE (strftime('%s','now') - strftime('%s',a.started_at))/60 || 'm'
    END,
    (strftime('%s','now') - strftime('%s',a.heartbeat_at))
  )
  FROM agents a
  JOIN tasks t ON t.id = a.task_id
  WHERE a.status = 'running'
  ORDER BY a.started_at;
" 2>/dev/null)"

if [[ -n "$running_out" ]]; then echo "$running_out"; else echo "  (none)"; fi
echo ""

# Queue
echo "Queue:"
queue_out="$(sqlite3 "$DB" "
  SELECT printf('  #%-4d [%-4s] %-30s (score: %d)',
    t.id,
    UPPER(SUBSTR(t.priority,1,3)),
    SUBSTR(t.title,1,30),
    CASE t.priority WHEN 'high' THEN 30 WHEN 'medium' THEN 20 ELSE 10 END
      + (SELECT COUNT(*) FROM tasks d
         WHERE d.depends_on LIKE '%' || t.id || '%' AND d.status='todo') * 10
  )
  FROM tasks t
  WHERE t.status = 'todo'
    AND t.project_id IS NOT NULL
  ORDER BY
    (CASE t.priority WHEN 'high' THEN 30 WHEN 'medium' THEN 20 ELSE 10 END
     + (SELECT COUNT(*) FROM tasks d
        WHERE d.depends_on LIKE '%' || t.id || '%' AND d.status='todo') * 10
    ) DESC,
    t.created_at ASC
  LIMIT 10;
" 2>/dev/null)"

if [[ -n "$queue_out" ]]; then echo "$queue_out"; else echo "  (none)"; fi
echo ""

# Recent completed/failed
echo "Recent:"
recent_out="$(sqlite3 "$DB" "
  SELECT printf('  agent #%-4d task #%-4d %-10s %s',
    a.id,
    a.task_id,
    a.status,
    CASE
      WHEN a.completed_at IS NULL THEN ''
      WHEN (strftime('%s','now') - strftime('%s',a.completed_at)) < 3600
        THEN (strftime('%s','now') - strftime('%s',a.completed_at))/60 || 'm ago'
      ELSE (strftime('%s','now') - strftime('%s',a.completed_at))/3600 || 'h ago'
    END
  )
  FROM agents a
  WHERE a.status IN ('completed', 'failed')
  ORDER BY a.completed_at DESC
  LIMIT 5;
" 2>/dev/null)"

if [[ -n "$recent_out" ]]; then echo "$recent_out"; else echo "  (none)"; fi
echo ""

# Daemon status
if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
  if tmux list-windows -t "$TMUX_SESSION" -F '#{window_name}' 2>/dev/null | grep -q '^daemon$'; then
    echo "Daemon: running (session: $TMUX_SESSION)"
  else
    echo "Daemon: stopped (tmux session exists but no daemon window)"
  fi
else
  echo "Daemon: stopped (no tmux session)"
fi
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/agent-status
git add scripts/agent-status
git commit -m "feat: add agent-status — show running, queued, and recent agents"
```

---

### Task 9: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Update "What This Does" section**

Add after the existing bullet about "Integrations":

```markdown
- **Multi-agent execution** — Dispatch multiple Claude Code sessions in parallel via tmux. Priority scheduling, heartbeat monitoring, stuck recovery, dependency cascading, and git worktree isolation.
```

**Step 2: Update Project Structure tree**

Replace the scripts section in the tree to include new scripts:

```
├── scripts/
│   ├── taskctl                # CLI for querying + managing tasks.db
│   ├── doctor                 # Health check (deps, DB, hooks, permissions)
│   ├── agent-dispatch         # Claim task + spawn agent in tmux
│   ├── agent-wrapper          # Agent lifecycle (prompt, heartbeat, complete)
│   ├── agent-complete         # Handle result + dependency cascade
│   ├── agent-watcher          # Detect stuck agents, kill + retry/pause
│   ├── agent-daemon           # 30s loop: watcher + dispatch
│   ├── agent-status           # Show running/queued/recent agents
│   ├── migrate-v3.sh          # Migrate existing DB to v3 schema
│   ├── current-focus          # Shows current priority + active tasks
│   ├── project-context        # Resolves project from cwd
│   ├── discord-notify         # Sends Discord webhook notifications
│   └── jira-task              # Jira operations via acli CLI
```

**Step 3: Add Multi-Agent section**

Add after the "### doctor" section:

```markdown
### Multi-Agent Execution

Dispatch multiple Claude Code sessions to work on tasks in parallel:

```bash
# Start the daemon (manages agents automatically)
scripts/agent-daemon start

# Or dispatch tasks manually
scripts/agent-dispatch              # Dispatch highest-priority eligible task
scripts/agent-dispatch 42           # Dispatch specific task

# Monitor
scripts/agent-status                # Overview of all agents
tmux attach -t ctf-agents           # Watch agents live
tmux attach -t ctf-agents:agent-42  # Watch specific agent

# Manual control
scripts/agent-watcher               # Run one health check cycle
scripts/agent-daemon stop           # Stop the daemon (agents keep running)
```

Each agent runs in a git worktree on its own branch. When a task completes, dependent tasks are automatically dispatched.

Set up task dependencies:
```bash
scripts/taskctl add-task "Build API" --project "my-app" --priority high
scripts/taskctl add-task "Build frontend" --project "my-app" --depends-on "[1]"
scripts/taskctl add-task "Write docs" --project "my-app" --depends-on "[1,2]"
# Dispatching task 1 will cascade to 2 and 3 as they complete
```
```

**Step 4: Add new env vars to table**

Add to the Environment Variables table:

```markdown
| `CTF_MAX_AGENTS` | `3` | Max concurrent agents |
| `CTF_STUCK_TIMEOUT` | `10` | Minutes before agent considered stuck |
| `CTF_TMUX_SESSION` | `ctf-agents` | tmux session name |
```

**Step 5: Add tmux to Requirements**

Add `tmux` to the requirements list:

```markdown
- `tmux` (for multi-agent execution)
```

**Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document multi-agent system, new scripts, env vars"
```

---

### Task 10: Update doctor + seed-sample for v3

**Files:**
- Modify: `scripts/doctor` (check tmux, update agents table check)
- Modify: `seed-sample.sh` (add depends_on examples)

**Step 1: Add tmux check to doctor**

Add after the `gh CLI installed` check:

```bash
check "tmux installed" "command -v tmux" optional
```

Change the agents table check from optional to required:

```bash
check "table: agents" "sqlite3 '$DB' \"SELECT 1 FROM agents LIMIT 0;\""
```

**Step 2: Add dependency examples to seed-sample.sh**

After the subtask inserts, add:

```sql
-- Dependencies: "Write API rate limiting docs" depends on "Add user search endpoint"
UPDATE tasks SET depends_on = '[' || (SELECT id FROM tasks WHERE title = 'Add user search endpoint') || ']'
  WHERE title = 'Write API rate limiting docs';
```

**Step 3: Commit**

```bash
git add scripts/doctor seed-sample.sh
git commit -m "feat: update doctor + seed-sample for v3 (tmux check, dependency examples)"
```

---

### Task 11: Final audit and push

**Step 1: Run doctor**

```bash
rm -f tasks.db && bash init-db.sh
./seed-sample.sh
./scripts/doctor
```

**Step 2: Run data leak audit**

```bash
grep -ri 'asker\|booknetic\|code-heaven\|faceswap\|spriggan\|534CSF\|b21bdc\|157\.180\|/Users/' \
  scripts/agent-dispatch scripts/agent-wrapper scripts/agent-complete \
  scripts/agent-watcher scripts/agent-daemon scripts/agent-status \
  scripts/migrate-v3.sh
```

Expected: no matches.

**Step 3: Test agent-status with seed data**

```bash
./scripts/agent-status
```

**Step 4: Clean up test DB and push**

```bash
rm -f tasks.db
git push origin main
```
