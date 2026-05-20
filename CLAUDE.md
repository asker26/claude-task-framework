# Claude Task Framework

Multi-agent task management and autonomous execution framework for Claude Code.

## Architecture

- **DB**: `tasks.db` (SQLite) — tables: organizations, projects, tasks, agents, team_members, task_status_changes, project_memories, memory
- **Scripts**: `scripts/` — agent system, taskctl CLI, integrations (Discord, Jira, GSC)
- **Hooks**: `hooks/` — session-start (focus injection), intent-classifier (workflow chaining), stop-guard (anti-premature-exit)
- **Skills**: `skills/` — mega-skills (/feature, /bugfix, /refactor), utilities (/opib, /list-prs, /summ)
- **Templates**: `templates/` — Discord embed templates (pr_review, jira_status, seo_monitor)
- **Workflows**: `scripts/workflows/` — blog-image-gen, gsc-audit

## Agent System

### Lifecycle
```
todo → in-progress (agent-dispatch) → in-review (agent-complete) → done (agent-review PASS)
                                                                  → todo (agent-review FAIL, with feedback in notes)
                                    → paused (failed twice, needs human)
```

### Scripts
| Script | Purpose |
|---|---|
| `agent-dispatch` | Claims a task, creates worktree + agent record, spawns `agent-wrapper` in tmux |
| `agent-wrapper` | Runs Claude Code session with task prompt, pipes output with heartbeat |
| `agent-complete` | On success → sets `in-review`, spawns `agent-review`. On failure → retries or pauses |
| `agent-review` | Spawns reviewer Claude session. Checks acceptance criteria, writes verdict file. PASS → done + cascades. FAIL → back to todo with feedback |
| `agent-daemon` | Loop: runs watcher, fills agent slots from queue. Runs in tmux |
| `agent-watcher` | Detects stuck agents (no heartbeat), orphaned in-review tasks, cleans tmux windows |
| `agent-status` | Dashboard: running agents, queue, in-review, recent completions, daemon status |

### Key details
- Agents run in git worktrees at `.workspaces/agent-{task_id}/` on branch `task-{task_id}`
- Max concurrency: `CTF_MAX_AGENTS` (default 3)
- Tmux session: `CTF_TMUX_SESSION` (default `ctf-agents`)
- Stuck timeout: `CTF_STUCK_TIMEOUT` (default 10 min)
- Review verdict written to `/tmp/ctf-review-{task_id}` (line 1: PASS/FAIL, line 2+: details)

## Task Schema
```sql
tasks: id, title, type, status, priority, project_id, parent_task_id,
       notes, due_date, depends_on, acceptance_criteria, created_at, updated_at
```
- **status**: todo, in-progress, in-review, testing, done, paused
- **type**: feature, bug, research, video, release, other
- **priority**: high, medium, low
- **acceptance_criteria**: concrete, testable criteria the review agent checks
- **depends_on**: JSON array of task IDs that must be done first
- **parent_task_id**: for subtask hierarchies (user stories)

## Conventions

- tasks.db is gitignored (user data). Schema lives in `init-db.sh`.
- `.workspaces/` is gitignored (agent worktrees).
- All scripts use `$ROOT` relative to script location, `$DB` from `TASK_DB_PATH` or `$ROOT/tasks.db`.
- Agent records track: worker_name ('agent' or 'reviewer'), tmux_pane, pid, heartbeat, retry_count.
- Cascades: when a task completes, dependent tasks and parent tasks auto-dispatch if unblocked.
- Discord notifications fire on completion/failure if the org has a webhook configured.

## Development rules

- Keep scripts as bash — no Node/Python dependencies for core agent system.
- Every schema change must update BOTH `init-db.sh` (new users) and include a migration path (existing users).
- Agent prompts should include acceptance criteria and be skeptical — "verify actual behavior, not just that files exist."
- Test agent changes by dispatching against a real task: `scripts/agent-dispatch <task_id>`
