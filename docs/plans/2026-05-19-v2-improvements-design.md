# v2 Improvements — Design

**Date:** 2026-05-19
**Goal:** Take the framework from 7/10 to 9/10 by fixing onboarding and adding power tools.

## Problem

New users clone the repo, run `init-db.sh`, and hit a wall:
- Empty database with no guidance on what to insert
- No way to add projects/tasks without raw SQL
- Hooks require manual JSON editing into `.claude/settings.json`
- No way to verify the setup is working
- Daily use requires remembering SQL or reading script source

## Changes

### 1. Interactive Setup Wizard (`setup.sh`)

Runs after `init-db.sh`. Walks the user through:
1. Create first organization (name, optional Jira instance, optional Discord webhook)
2. Create first project (name, local_path, optional github_repo, assign to org)
3. Create first task (title, type, priority, assign to project)
4. Install hooks — detect `.claude/settings.json` location, merge hook config (or create from template)
5. Copy core skills to `~/.claude/skills/` (ask which: all, core only, none)
6. Print summary + next steps

Interactive prompts with sane defaults. Non-destructive — won't overwrite existing config.

### 2. taskctl CRUD Commands

New commands added to `scripts/taskctl`:

```
taskctl add-org <name> [--jira-instance <url>] [--jira-key <key>] [--discord-webhook <url>]
taskctl add-project <name> [--path <local_path>] [--repo <github_url>] [--org <org_name>] [--description <text>]
taskctl add-task <title> [--project <name>] [--type <type>] [--priority <priority>] [--parent <task_id>] [--due <date>] [--notes <text>]
taskctl add-member <name> [--org <org_name>] [--github <username>] [--discord <id>] [--jira <user_id>]
taskctl dashboard
taskctl log <task_id> <status> [--notes <text>]
```

`dashboard` output:
```
FOCUS DASHBOARD
===============
Org: MyCompany | Project: my-app (from cwd)

Active (3):
  #42  [HIGH] Fix auth regression          in-progress  my-app
  #38  [MED]  Add search feature           in-progress  my-app
  #41  [MED]  Update dependencies           testing      other-app

Next up (3):
  #45  [HIGH] Implement webhooks            todo         my-app
  #43  [MED]  Write API docs                todo         my-app
  #44  [LOW]  Refactor logger               todo         my-app

Recent changes:
  #40  done <- in-progress  2h ago
  #42  in-progress <- todo  5h ago
```

`log` records a status change and updates the task:
```
taskctl log 42 done --notes "Fixed in PR #123"
# Updates tasks.status, inserts into task_status_changes
```

### 3. Sample Seed Data (`seed-sample.sh`)

Optional script that populates the database with realistic example data:
- 2 orgs: "Personal" (no integrations), "Acme Corp" (Jira + Discord configured with placeholder URLs)
- 4 projects: 2 per org, with local_path set to `~/projects/<name>`
- 10 tasks: mix of types, statuses, priorities, including 2 subtasks
- 2 team members: in Acme Corp org

Purpose: lets users see how the system looks populated, understand the data model, and test scripts before adding real data. Can be wiped with `rm tasks.db && ./init-db.sh`.

### 4. Hook Config Template (`hooks.json.example`)

A ready-to-use JSON snippet that users copy into their `.claude/settings.json`. Contains all three hooks with a `__FRAMEWORK_PATH__` placeholder.

The setup wizard replaces the placeholder with the actual path automatically. Manual users can do find-and-replace.

### 5. Health Check (`scripts/doctor`)

Checks and reports:
- tasks.db exists and has the expected tables
- All scripts are executable
- `jq` is installed
- `sqlite3` is installed
- `gh` CLI is installed (optional, warns if missing)
- Hooks are configured in `.claude/settings.json` (checks if hook commands point to existing files)
- Python 3 is installed (needed by discord-notify)

Output: green checkmarks for pass, red X for fail, yellow warning for optional missing.

### 6. Schema Addition: `agents` Table

Future-proofing for multi-agent work. Added to `init-db.sh`:

```sql
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

### 7. Agent Dispatch Stub (`scripts/agent-dispatch`)

Placeholder script:
```bash
#!/usr/bin/env bash
echo "agent-dispatch: not yet implemented"
echo "This will be the entry point for multi-agent task execution."
echo "Usage: agent-dispatch <task-id> [--agent-type <type>]"
exit 1
```

Exists so the architecture has a clear entry point when multi-agent is built.

## File Changes Summary

| Action | File |
|--------|------|
| New | `setup.sh` |
| New | `seed-sample.sh` |
| New | `hooks.json.example` |
| New | `scripts/doctor` |
| New | `scripts/agent-dispatch` |
| Modified | `scripts/taskctl` (add CRUD + dashboard + log) |
| Modified | `init-db.sh` (add agents table) |
| Modified | `README.md` (document new commands + setup flow) |
| Modified | `settings/setup-guide.md` (reference setup.sh) |

## Non-Goals

- Web UI / TUI — shell output is sufficient
- Plugin marketplace — premature
- Auto-update — `git pull` works
- Multi-agent execution logic — only the schema + stub, implementation is a separate design
