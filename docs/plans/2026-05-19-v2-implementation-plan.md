# v2 Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix onboarding friction and add daily-use power tools to take the framework from 7/10 to 9/10.

**Architecture:** All additions are shell scripts extending the existing `taskctl` pattern. No new languages or dependencies. The `agents` table is schema-only (no implementation). The setup wizard orchestrates existing scripts + new CRUD commands.

**Tech Stack:** Bash, SQLite3, jq

---

### Task 1: Add agents table to init-db.sh

**Files:**
- Modify: `init-db.sh:124` (before the closing `SQL` heredoc)

**Step 1: Add the agents table SQL**

Insert before the `SQL` closing marker (line 125) in `init-db.sh`:

```sql
-- Agents: track autonomous agent runs against tasks (future multi-agent support)
CREATE TABLE agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id),
    agent_type TEXT NOT NULL DEFAULT 'claude-code',
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    result TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Step 2: Verify by running init-db.sh on a fresh DB**

```bash
cd ~/WebstormProjects/claude-task-framework
rm -f /tmp/test-ctf.db
TASK_DB_PATH=/tmp/test-ctf.db bash init-db.sh 2>&1 || DB="$PWD/tasks.db"
sqlite3 /tmp/test-ctf.db ".schema agents"
```

Expected: the `CREATE TABLE agents` statement prints.

**Step 3: Clean up test DB and commit**

```bash
rm -f /tmp/test-ctf.db
git add init-db.sh
git commit -m "feat: add agents table to schema (multi-agent future-proofing)"
```

---

### Task 2: Add CRUD commands to taskctl

**Files:**
- Modify: `scripts/taskctl` (add 6 new case branches + update usage text)

**Step 1: Add `sql_write` helper**

Insert after the `sql_escape` function (after line 27):

```bash
sql_write() {
  sqlite3 "$DB" "$1"
}

resolve_org_id() {
  local org_name="$1"
  local org_escaped
  org_escaped="$(sql_escape "$org_name")"
  sql_scalar "SELECT id FROM organizations WHERE name = '${org_escaped}' LIMIT 1;"
}

resolve_project_id() {
  local proj_name="$1"
  local proj_escaped
  proj_escaped="$(sql_escape "$proj_name")"
  sql_scalar "SELECT id FROM projects WHERE name = '${proj_escaped}' LIMIT 1;"
}
```

**Step 2: Add `add-org` command**

Insert before the `*)` default case:

```bash
  add-org)
    org_name="${1:-}"
    if [[ -z "$org_name" ]]; then
      echo "usage: taskctl add-org <name> [--jira-instance <url>] [--jira-key <key>] [--discord-webhook <url>]" >&2
      exit 1
    fi
    shift
    jira_instance="" jira_key="" discord_webhook=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --jira-instance) jira_instance="${2:-}"; shift 2 ;;
        --jira-key) jira_key="${2:-}"; shift 2 ;;
        --discord-webhook) discord_webhook="${2:-}"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 1 ;;
      esac
    done
    sql_write "
      INSERT INTO organizations (name, jira_instance, jira_project_key, discord_webhook_url)
      VALUES ('$(sql_escape "$org_name")', '$(sql_escape "$jira_instance")', '$(sql_escape "$jira_key")', '$(sql_escape "$discord_webhook")');
    "
    echo "created org: $org_name (id $(sql_scalar "SELECT last_insert_rowid();"))"
    ;;
```

**Step 3: Add `add-project` command**

```bash
  add-project)
    proj_name="${1:-}"
    if [[ -z "$proj_name" ]]; then
      echo "usage: taskctl add-project <name> [--path <local_path>] [--repo <github_url>] [--org <org_name>] [--description <text>]" >&2
      exit 1
    fi
    shift
    local_path="" github_repo="" org_name="" description=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --path) local_path="${2:-}"; shift 2 ;;
        --repo) github_repo="${2:-}"; shift 2 ;;
        --org) org_name="${2:-}"; shift 2 ;;
        --description) description="${2:-}"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 1 ;;
      esac
    done
    org_id=""
    if [[ -n "$org_name" ]]; then
      org_id="$(resolve_org_id "$org_name")"
      if [[ -z "$org_id" ]]; then
        echo "org not found: $org_name" >&2
        exit 1
      fi
    fi
    sql_write "
      INSERT INTO projects (name, local_path, github_repo, description, organization_id)
      VALUES ('$(sql_escape "$proj_name")', '$(sql_escape "$local_path")', '$(sql_escape "$github_repo")', '$(sql_escape "$description")', $(if [[ -n "$org_id" ]]; then echo "$org_id"; else echo "NULL"; fi));
    "
    echo "created project: $proj_name (id $(sql_scalar "SELECT last_insert_rowid();"))"
    ;;
```

**Step 4: Add `add-task` command**

```bash
  add-task)
    task_title="${1:-}"
    if [[ -z "$task_title" ]]; then
      echo "usage: taskctl add-task <title> [--project <name>] [--type <type>] [--priority <pri>] [--parent <id>] [--due <date>] [--notes <text>]" >&2
      exit 1
    fi
    shift
    proj_name="" task_type="feature" task_priority="medium" parent_id="" due_date="" notes=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --project) proj_name="${2:-}"; shift 2 ;;
        --type) task_type="${2:-}"; shift 2 ;;
        --priority) task_priority="${2:-}"; shift 2 ;;
        --parent) parent_id="${2:-}"; shift 2 ;;
        --due) due_date="${2:-}"; shift 2 ;;
        --notes) notes="${2:-}"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 1 ;;
      esac
    done
    proj_id=""
    if [[ -n "$proj_name" ]]; then
      proj_id="$(resolve_project_id "$proj_name")"
      if [[ -z "$proj_id" ]]; then
        echo "project not found: $proj_name" >&2
        exit 1
      fi
    fi
    sql_write "
      INSERT INTO tasks (title, type, priority, project_id, parent_task_id, due_date, notes)
      VALUES ('$(sql_escape "$task_title")', '$(sql_escape "$task_type")', '$(sql_escape "$task_priority")', $(if [[ -n "$proj_id" ]]; then echo "$proj_id"; else echo "NULL"; fi), $(if [[ -n "$parent_id" ]]; then echo "$parent_id"; else echo "NULL"; fi), $(if [[ -n "$due_date" ]]; then echo "'$(sql_escape "$due_date")'"; else echo "NULL"; fi), $(if [[ -n "$notes" ]]; then echo "'$(sql_escape "$notes")'"; else echo "NULL"; fi));
    "
    echo "created task: $task_title (id $(sql_scalar "SELECT last_insert_rowid();"))"
    ;;
```

**Step 5: Add `add-member` command**

```bash
  add-member)
    member_name="${1:-}"
    if [[ -z "$member_name" ]]; then
      echo "usage: taskctl add-member <name> --org <org_name> [--github <user>] [--discord <id>] [--jira <id>]" >&2
      exit 1
    fi
    shift
    org_name="" github="" discord="" jira=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --org) org_name="${2:-}"; shift 2 ;;
        --github) github="${2:-}"; shift 2 ;;
        --discord) discord="${2:-}"; shift 2 ;;
        --jira) jira="${2:-}"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 1 ;;
      esac
    done
    if [[ -z "$org_name" ]]; then
      echo "--org is required" >&2
      exit 1
    fi
    org_id="$(resolve_org_id "$org_name")"
    if [[ -z "$org_id" ]]; then
      echo "org not found: $org_name" >&2
      exit 1
    fi
    sql_write "
      INSERT INTO team_members (name, organization_id, github_username, discord_id, jira_user_id)
      VALUES ('$(sql_escape "$member_name")', $org_id, '$(sql_escape "$github")', '$(sql_escape "$discord")', '$(sql_escape "$jira")');
    "
    echo "created member: $member_name (id $(sql_scalar "SELECT last_insert_rowid();"))"
    ;;
```

**Step 6: Add `log` command**

```bash
  log)
    id="${1:-}"
    new_status="${2:-}"
    if [[ -z "$id" || -z "$new_status" ]]; then
      echo "usage: taskctl log <task_id> <status> [--notes <text>]" >&2
      exit 1
    fi
    if [[ ! "$id" =~ ^[0-9]+$ ]]; then
      echo "task id must be numeric" >&2
      exit 1
    fi
    shift 2
    notes=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --notes) notes="${2:-}"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 1 ;;
      esac
    done
    old_status="$(sql_scalar "SELECT status FROM tasks WHERE id = $id;")"
    if [[ -z "$old_status" ]]; then
      echo "task $id not found" >&2
      exit 1
    fi
    new_escaped="$(sql_escape "$new_status")"
    sql_write "
      UPDATE tasks SET status = '${new_escaped}', updated_at = CURRENT_TIMESTAMP WHERE id = ${id};
      INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES (${id}, '$(sql_escape "$old_status")', '${new_escaped}');
    "
    if [[ -n "$notes" ]]; then
      sql_write "UPDATE tasks SET notes = '$(sql_escape "$notes")' WHERE id = ${id};"
    fi
    echo "$old_status -> $new_status (task #$id)"
    ;;
```

**Step 7: Add `dashboard` command**

```bash
  dashboard)
    cwd_input="${1:-$PWD}"
    echo "FOCUS DASHBOARD"
    echo "==============="
    # Try to detect project from cwd
    cwd_escaped="$(sql_escape "$cwd_input")"
    proj_row="$(sql_scalar "
      SELECT p.name || '|' || COALESCE(o.name, '-')
      FROM projects p
      LEFT JOIN organizations o ON o.id = p.organization_id
      WHERE '${cwd_escaped}' LIKE p.local_path || '%'
      ORDER BY length(p.local_path) DESC
      LIMIT 1;
    " 2>/dev/null || echo "")"
    if [[ -n "$proj_row" ]]; then
      IFS='|' read -r d_proj d_org <<< "$proj_row"
      echo "Org: $d_org | Project: $d_proj (from cwd)"
    fi
    echo ""
    echo "Active:"
    sql_read "
      SELECT printf('  #%-4d [%-4s] %-35s %-12s %s', t.id,
             UPPER(SUBSTR(t.priority,1,3)), t.title, t.status, COALESCE(p.name,'-'))
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.status IN ('in-progress','testing')
      ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               t.updated_at DESC
      LIMIT 10;
    " 2>/dev/null || echo "  (none)"
    echo ""
    echo "Next up:"
    sql_read "
      SELECT printf('  #%-4d [%-4s] %-35s %-12s %s', t.id,
             UPPER(SUBSTR(t.priority,1,3)), t.title, t.status, COALESCE(p.name,'-'))
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.status = 'todo'
      ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
               t.updated_at DESC
      LIMIT 5;
    " 2>/dev/null || echo "  (none)"
    echo ""
    echo "Recent changes:"
    sql_read "
      SELECT printf('  #%-4d %-12s <- %-12s %s', sc.task_id, sc.to_status, COALESCE(sc.from_status,'new'),
             CASE
               WHEN (strftime('%s','now') - strftime('%s',sc.changed_at)) < 3600
                 THEN (strftime('%s','now') - strftime('%s',sc.changed_at))/60 || 'm ago'
               WHEN (strftime('%s','now') - strftime('%s',sc.changed_at)) < 86400
                 THEN (strftime('%s','now') - strftime('%s',sc.changed_at))/3600 || 'h ago'
               ELSE (strftime('%s','now') - strftime('%s',sc.changed_at))/86400 || 'd ago'
             END)
      FROM task_status_changes sc
      ORDER BY sc.changed_at DESC
      LIMIT 5;
    " 2>/dev/null || echo "  (none)"
    ;;
```

**Step 8: Update usage text**

Replace the existing usage `cat` block with:

```
usage: taskctl <command>

commands:
  projects                           List all projects
  active                             Show in-progress/testing tasks
  active-high-json                   High-priority active tasks as JSON
  focus                              Top priority tasks
  dashboard [cwd]                    Full focus dashboard
  project <name>                     Project details as JSON
  project-from-cwd [cwd]            Detect project from directory
  team-member <github-username>      Team member details as JSON
  tasks <project> [--open]           Tasks for a project
  tasks-open <project>               Non-done tasks for a project
  add-org <name> [opts]              Create organization
  add-project <name> [opts]          Create project
  add-task <title> [opts]            Create task
  add-member <name> [opts]           Create team member
  set-status <id> <status>           Update task status
  log <id> <status> [--notes ...]    Status change with audit log
```

**Step 9: Test CRUD commands**

```bash
cd ~/WebstormProjects/claude-task-framework
rm -f /tmp/test-ctf.db && sqlite3 /tmp/test-ctf.db < <(sed -n '/^sqlite3/,/^SQL$/p' init-db.sh | tail -n +2 | head -n -1)
# Simpler: just run init-db against tmp
TASK_DB_PATH=/tmp/test-ctf.db ./scripts/taskctl add-org "TestOrg"
TASK_DB_PATH=/tmp/test-ctf.db ./scripts/taskctl add-project "test-app" --org "TestOrg" --path "$HOME/test"
TASK_DB_PATH=/tmp/test-ctf.db ./scripts/taskctl add-task "Fix login bug" --project "test-app" --type bug --priority high
TASK_DB_PATH=/tmp/test-ctf.db ./scripts/taskctl log 1 in-progress
TASK_DB_PATH=/tmp/test-ctf.db ./scripts/taskctl dashboard
rm -f /tmp/test-ctf.db
```

**Step 10: Commit**

```bash
git add scripts/taskctl
git commit -m "feat: add CRUD commands, dashboard, and log to taskctl"
```

---

### Task 3: Create scripts/doctor

**Files:**
- Create: `scripts/doctor`

**Step 1: Write the health check script**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"
PASS="\033[32m[ok]\033[0m"
FAIL="\033[31m[FAIL]\033[0m"
WARN="\033[33m[warn]\033[0m"
errors=0

check() {
  if eval "$2" >/dev/null 2>&1; then
    printf "$PASS %s\n" "$1"
  elif [[ "${3:-}" == "optional" ]]; then
    printf "$WARN %s (optional)\n" "$1"
  else
    printf "$FAIL %s\n" "$1"
    errors=$((errors + 1))
  fi
}

echo "Claude Task Framework — Health Check"
echo "====================================="
echo ""

check "sqlite3 installed" "command -v sqlite3"
check "jq installed" "command -v jq"
check "git installed" "command -v git"
check "python3 installed" "command -v python3"
check "gh CLI installed" "command -v gh" optional
check "tasks.db exists" "test -f '$DB'"

if [[ -f "$DB" ]]; then
  for table in organizations projects tasks team_members task_status_changes project_memories memory; do
    check "table: $table" "sqlite3 '$DB' \"SELECT 1 FROM $table LIMIT 0;\""
  done
  # agents table is optional (only in v2+ schemas)
  check "table: agents" "sqlite3 '$DB' \"SELECT 1 FROM agents LIMIT 0;\"" optional
fi

for script in taskctl current-focus project-context discord-notify jira-task; do
  check "scripts/$script executable" "test -x '$ROOT/scripts/$script'"
done

for hook in session-start.sh intent-classifier.sh stop-guard.sh; do
  check "hooks/$hook executable" "test -x '$ROOT/hooks/$hook'"
done

# Check if hooks are configured in Claude settings
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
if [[ -f "$CLAUDE_SETTINGS" ]]; then
  if grep -q "session-start" "$CLAUDE_SETTINGS" 2>/dev/null; then
    printf "$PASS hooks configured in ~/.claude/settings.json\n"
  else
    printf "$WARN hooks not found in ~/.claude/settings.json (run setup.sh to install)\n"
  fi
else
  printf "$WARN ~/.claude/settings.json not found\n"
fi

echo ""
if [[ "$errors" -gt 0 ]]; then
  echo "$errors issue(s) found. Fix the [FAIL] items above."
  exit 1
else
  echo "All checks passed."
fi
```

**Step 2: Make executable and test**

```bash
chmod +x scripts/doctor
./scripts/doctor
```

**Step 3: Commit**

```bash
git add scripts/doctor
git commit -m "feat: add scripts/doctor health check"
```

---

### Task 4: Create scripts/agent-dispatch stub

**Files:**
- Create: `scripts/agent-dispatch`

**Step 1: Write the stub**

```bash
#!/usr/bin/env bash
set -euo pipefail
echo "agent-dispatch: not yet implemented"
echo "This will be the entry point for multi-agent task execution."
echo ""
echo "Usage: agent-dispatch <task-id> [--agent-type <type>]"
echo ""
echo "Planned agent types: claude-code, codex, custom"
echo "See docs/plans/ for the multi-agent design when available."
exit 1
```

**Step 2: Make executable and commit**

```bash
chmod +x scripts/agent-dispatch
git add scripts/agent-dispatch
git commit -m "feat: add agent-dispatch stub for future multi-agent support"
```

---

### Task 5: Create hooks.json.example

**Files:**
- Create: `hooks.json.example`

**Step 1: Write the template**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "__FRAMEWORK_PATH__/hooks/session-start.sh"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "__FRAMEWORK_PATH__/hooks/intent-classifier.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "__FRAMEWORK_PATH__/hooks/stop-guard.sh"
          }
        ]
      }
    ]
  }
}
```

**Step 2: Commit**

```bash
git add hooks.json.example
git commit -m "feat: add hooks.json.example template for easy hook installation"
```

---

### Task 6: Create seed-sample.sh

**Files:**
- Create: `seed-sample.sh`

**Step 1: Write the seed script**

```bash
#!/bin/bash
# Populate tasks.db with sample data to demonstrate the framework.
# Run after init-db.sh. Safe to re-run (uses INSERT OR IGNORE).
set -e

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="${TASK_DB_PATH:-$REPO/tasks.db}"

if [[ ! -f "$DB" ]]; then
  echo "tasks.db not found. Run init-db.sh first." >&2
  exit 1
fi

echo "Seeding sample data into: $DB"

sqlite3 "$DB" <<'SQL'
-- Organizations
INSERT OR IGNORE INTO organizations (name) VALUES ('Personal');
INSERT OR IGNORE INTO organizations (name, jira_instance, jira_project_key, discord_webhook_url)
  VALUES ('Acme Corp', 'https://acme.atlassian.net', 'ACME', 'https://discord.com/api/webhooks/EXAMPLE/TOKEN');

-- Projects
INSERT OR IGNORE INTO projects (name, local_path, description, organization_id)
  VALUES ('portfolio-site', '~/projects/portfolio-site', 'Personal portfolio website', (SELECT id FROM organizations WHERE name = 'Personal'));
INSERT OR IGNORE INTO projects (name, local_path, description, organization_id)
  VALUES ('side-project', '~/projects/side-project', 'Weekend experiment app', (SELECT id FROM organizations WHERE name = 'Personal'));
INSERT OR IGNORE INTO projects (name, local_path, github_repo, description, organization_id)
  VALUES ('acme-api', '~/projects/acme-api', 'https://github.com/acme/api', 'Main backend API', (SELECT id FROM organizations WHERE name = 'Acme Corp'));
INSERT OR IGNORE INTO projects (name, local_path, github_repo, description, organization_id)
  VALUES ('acme-dashboard', '~/projects/acme-dashboard', 'https://github.com/acme/dashboard', 'Admin dashboard (React)', (SELECT id FROM organizations WHERE name = 'Acme Corp'));

-- Tasks
INSERT INTO tasks (title, type, status, priority, project_id, notes)
  VALUES ('Fix auth token expiry bug', 'bug', 'in-progress', 'high', (SELECT id FROM projects WHERE name = 'acme-api'), 'Tokens expire after 1h instead of 24h');
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Add user search endpoint', 'feature', 'todo', 'high', (SELECT id FROM projects WHERE name = 'acme-api'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Write API rate limiting docs', 'other', 'todo', 'medium', (SELECT id FROM projects WHERE name = 'acme-api'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Migrate to React 19', 'feature', 'in-progress', 'medium', (SELECT id FROM projects WHERE name = 'acme-dashboard'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Fix chart rendering on mobile', 'bug', 'testing', 'medium', (SELECT id FROM projects WHERE name = 'acme-dashboard'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Redesign hero section', 'feature', 'todo', 'medium', (SELECT id FROM projects WHERE name = 'portfolio-site'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Add blog with MDX', 'feature', 'todo', 'low', (SELECT id FROM projects WHERE name = 'portfolio-site'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Research AI features', 'research', 'paused', 'low', (SELECT id FROM projects WHERE name = 'side-project'));

-- Subtasks (children of "Add user search endpoint")
INSERT INTO tasks (title, type, status, priority, project_id, parent_task_id)
  VALUES ('Design search query schema', 'feature', 'todo', 'high', (SELECT id FROM projects WHERE name = 'acme-api'), (SELECT id FROM tasks WHERE title = 'Add user search endpoint'));
INSERT INTO tasks (title, type, status, priority, project_id, parent_task_id)
  VALUES ('Implement Elasticsearch integration', 'feature', 'todo', 'high', (SELECT id FROM projects WHERE name = 'acme-api'), (SELECT id FROM tasks WHERE title = 'Add user search endpoint'));

-- Team members
INSERT OR IGNORE INTO team_members (name, organization_id, github_username, discord_id)
  VALUES ('Alice', (SELECT id FROM organizations WHERE name = 'Acme Corp'), 'alice-dev', '123456789');
INSERT OR IGNORE INTO team_members (name, organization_id, github_username, discord_id, jira_user_id)
  VALUES ('Bob', (SELECT id FROM organizations WHERE name = 'Acme Corp'), 'bob-eng', '987654321', 'bob.smith');

-- Sample status changes
INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES (1, 'todo', 'in-progress');
INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES (4, 'todo', 'in-progress');
INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES (5, 'in-progress', 'testing');
SQL

echo ""
echo "Sample data loaded:"
sqlite3 -header -column "$DB" "SELECT COUNT(*) as orgs FROM organizations;"
sqlite3 -header -column "$DB" "SELECT COUNT(*) as projects FROM projects;"
sqlite3 -header -column "$DB" "SELECT COUNT(*) as tasks FROM tasks;"
sqlite3 -header -column "$DB" "SELECT COUNT(*) as members FROM team_members;"
echo ""
echo "Try: ./scripts/taskctl dashboard"
echo "To reset: rm tasks.db && ./init-db.sh && ./seed-sample.sh"
```

**Step 2: Make executable and test**

```bash
chmod +x seed-sample.sh
rm -f /tmp/test-ctf.db
TASK_DB_PATH=/tmp/test-ctf.db bash init-db.sh
TASK_DB_PATH=/tmp/test-ctf.db ./seed-sample.sh
TASK_DB_PATH=/tmp/test-ctf.db ./scripts/taskctl dashboard
rm -f /tmp/test-ctf.db
```

**Step 3: Commit**

```bash
git add seed-sample.sh
git commit -m "feat: add seed-sample.sh with example orgs, projects, and tasks"
```

---

### Task 7: Create setup.sh

**Files:**
- Create: `setup.sh`

**Step 1: Write the interactive setup wizard**

The wizard should:
1. Check if `tasks.db` exists, run `init-db.sh` if not
2. Prompt for first org name (default: "Personal", optional Jira/Discord)
3. Prompt for first project (name, local_path defaulting to `$PWD`, optional github_repo)
4. Prompt for first task (title, type, priority)
5. Ask about hook installation — read `hooks.json.example`, replace `__FRAMEWORK_PATH__` with `$ROOT`, merge into `~/.claude/settings.json` (or create it)
6. Ask which skills to copy to `~/.claude/skills/` (all / core only / none)
7. Print summary

Key implementation details:
- Use `read -rp "Prompt [default]: " var` pattern for all prompts
- Use `${var:-default}` for defaults
- For hook merging: if `~/.claude/settings.json` exists and has `hooks`, warn and ask to overwrite. If it exists without `hooks`, use `jq` to merge. If it doesn't exist, create from template.
- For skill copying: core = feature, bugfix, refactor, opib, list-prs, summ, team-lead, docs-lookup, isolate-workspace. All = core + aso/* + appstoreconnect.
- Use the new `taskctl` CRUD commands internally (not raw SQL).

```bash
#!/bin/bash
# Interactive setup wizard for Claude Task Framework.
# Run this after cloning to get started quickly.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$ROOT/tasks.db"
TASKCTL="$ROOT/scripts/taskctl"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

echo "Claude Task Framework — Setup"
echo "=============================="
echo ""

# --- Step 1: Database ---
if [[ ! -f "$DB" ]]; then
  echo "Initializing database..."
  bash "$ROOT/init-db.sh"
  echo ""
fi

# --- Step 2: First Organization ---
read -rp "Organization name [Personal]: " org_name
org_name="${org_name:-Personal}"

read -rp "Jira instance URL (blank to skip): " jira_instance
read -rp "Discord webhook URL (blank to skip): " discord_webhook

org_args=("$org_name")
[[ -n "$jira_instance" ]] && org_args+=(--jira-instance "$jira_instance")
[[ -n "$discord_webhook" ]] && org_args+=(--discord-webhook "$discord_webhook")
"$TASKCTL" add-org "${org_args[@]}"
echo ""

# --- Step 3: First Project ---
default_path="$PWD"
read -rp "Project name [my-app]: " proj_name
proj_name="${proj_name:-my-app}"

read -rp "Local path [$default_path]: " proj_path
proj_path="${proj_path:-$default_path}"

read -rp "GitHub repo URL (blank to skip): " proj_repo

proj_args=("$proj_name" --org "$org_name" --path "$proj_path")
[[ -n "$proj_repo" ]] && proj_args+=(--repo "$proj_repo")
"$TASKCTL" add-project "${proj_args[@]}"
echo ""

# --- Step 4: First Task ---
read -rp "First task title [Set up project]: " task_title
task_title="${task_title:-Set up project}"

read -rp "Type (feature/bug/research/other) [feature]: " task_type
task_type="${task_type:-feature}"

read -rp "Priority (high/medium/low) [medium]: " task_priority
task_priority="${task_priority:-medium}"

"$TASKCTL" add-task "$task_title" --project "$proj_name" --type "$task_type" --priority "$task_priority"
echo ""

# --- Step 5: Install Hooks ---
echo "Hook Installation"
echo "-----------------"
read -rp "Install Claude Code hooks? (y/n) [y]: " install_hooks
install_hooks="${install_hooks:-y}"

if [[ "$install_hooks" == "y" ]]; then
  HOOK_CONFIG=$(cat "$ROOT/hooks.json.example" | sed "s|__FRAMEWORK_PATH__|$ROOT|g")

  mkdir -p "$HOME/.claude"

  if [[ -f "$CLAUDE_SETTINGS" ]]; then
    if jq -e '.hooks' "$CLAUDE_SETTINGS" >/dev/null 2>&1; then
      read -rp "Existing hooks found in settings. Overwrite? (y/n) [n]: " overwrite
      if [[ "${overwrite:-n}" == "y" ]]; then
        jq --argjson hooks "$(echo "$HOOK_CONFIG" | jq '.hooks')" '.hooks = $hooks' "$CLAUDE_SETTINGS" > "${CLAUDE_SETTINGS}.tmp"
        mv "${CLAUDE_SETTINGS}.tmp" "$CLAUDE_SETTINGS"
        echo "Hooks updated."
      else
        echo "Skipped hook installation."
      fi
    else
      jq --argjson hooks "$(echo "$HOOK_CONFIG" | jq '.hooks')" '. + {hooks: $hooks}' "$CLAUDE_SETTINGS" > "${CLAUDE_SETTINGS}.tmp"
      mv "${CLAUDE_SETTINGS}.tmp" "$CLAUDE_SETTINGS"
      echo "Hooks added to existing settings."
    fi
  else
    echo "$HOOK_CONFIG" | jq '.' > "$CLAUDE_SETTINGS"
    echo "Created $CLAUDE_SETTINGS with hooks."
  fi
  echo ""
fi

# --- Step 6: Install Skills ---
echo "Skill Installation"
echo "------------------"
echo "  1) Core (9 skills: feature, bugfix, refactor, opib, list-prs, summ, team-lead, docs-lookup, isolate-workspace)"
echo "  2) All (core + 17 ASO skills + appstoreconnect)"
echo "  3) None"
read -rp "Which skills to install? [1]: " skill_choice
skill_choice="${skill_choice:-1}"

if [[ "$skill_choice" == "1" || "$skill_choice" == "2" ]]; then
  mkdir -p "$HOME/.claude/skills"
  for skill in feature bugfix refactor opib list-prs summ team-lead docs-lookup isolate-workspace; do
    cp -r "$ROOT/skills/$skill" "$HOME/.claude/skills/"
  done
  echo "Installed 9 core skills."

  if [[ "$skill_choice" == "2" ]]; then
    cp -r "$ROOT/skills/appstoreconnect" "$HOME/.claude/skills/"
    for skill_dir in "$ROOT/skills/aso"/*/; do
      skill_name="$(basename "$skill_dir")"
      cp -r "$skill_dir" "$HOME/.claude/skills/$skill_name"
    done
    echo "Installed 18 additional skills (ASO + App Store Connect)."
  fi
  echo ""
fi

# --- Summary ---
echo "Setup Complete"
echo "=============="
echo "  Database: $DB"
echo "  Org: $org_name"
echo "  Project: $proj_name ($proj_path)"
echo "  Task: $task_title"
[[ "$install_hooks" == "y" ]] && echo "  Hooks: installed"
[[ "$skill_choice" != "3" ]] && echo "  Skills: installed to ~/.claude/skills/"
echo ""
echo "Next steps:"
echo "  ./scripts/taskctl dashboard     # See your dashboard"
echo "  ./scripts/doctor                # Verify everything works"
echo "  claude                          # Start a Claude Code session"
```

**Step 2: Make executable and commit**

```bash
chmod +x setup.sh
git add setup.sh
git commit -m "feat: add interactive setup wizard"
```

---

### Task 8: Update README.md

**Files:**
- Modify: `README.md`

**Step 1: Update Quick Start section**

Replace the existing Quick Start with:

```markdown
## Quick Start

```bash
# Clone
git clone https://github.com/asker26/claude-task-framework.git
cd claude-task-framework

# Run the setup wizard (creates DB, first project, installs hooks + skills)
chmod +x setup.sh scripts/* hooks/* *.sh
./setup.sh
```

Or set up manually:

```bash
./init-db.sh                                          # Create empty database
./scripts/taskctl add-org "My Team"                   # Add an organization
./scripts/taskctl add-project "my-app" --org "My Team" --path ~/projects/my-app
./scripts/taskctl add-task "First feature" --project "my-app" --priority high
./scripts/taskctl dashboard                           # See your dashboard
./scripts/doctor                                      # Verify setup
```

Optional: load sample data to explore the framework:
```bash
./seed-sample.sh
./scripts/taskctl dashboard
```
```

**Step 2: Add `dashboard`, `log`, CRUD commands, `doctor` to the Scripts section**

Add to the `taskctl` docs:

```markdown
### CRUD

```bash
scripts/taskctl add-org "My Team" --discord-webhook "https://..."
scripts/taskctl add-project "my-app" --org "My Team" --path ~/projects/my-app
scripts/taskctl add-task "Build login" --project "my-app" --type feature --priority high
scripts/taskctl add-member "Alice" --org "My Team" --github alice-dev
scripts/taskctl log 1 in-progress --notes "Started working on it"
scripts/taskctl dashboard
```

### doctor

```bash
scripts/doctor    # Verify DB, deps, hooks, and script permissions
```
```

**Step 3: Add `seed-sample.sh` and `setup.sh` to Project Structure tree**

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README with setup wizard, CRUD commands, and doctor"
```

---

### Task 9: Update settings/setup-guide.md

**Files:**
- Modify: `settings/setup-guide.md`

**Step 1: Add reference to setup.sh at the top of Step 6**

Add before the manual steps:

```markdown
## Step 6: Task Management

**Fastest path:** Run the setup wizard — it handles everything below:
```bash
./setup.sh
```

**Manual setup:**
```

**Step 2: Commit**

```bash
git add settings/setup-guide.md
git commit -m "docs: reference setup.sh in setup guide"
```

---

### Task 10: Final audit and push

**Step 1: Run doctor to verify**

```bash
./scripts/doctor
```

**Step 2: Run full data leak audit on new/changed files**

```bash
cd ~/WebstormProjects/claude-task-framework
grep -ri 'asker\|booknetic\|code-heaven\|faceswap\|spriggan\|534CSF\|b21bdc\|157\.180\|/Users/' setup.sh seed-sample.sh hooks.json.example scripts/doctor scripts/agent-dispatch
```

Expected: no matches.

**Step 3: Push**

```bash
git push origin main
```
