# Claude Task Framework

Multi-agent task management and autonomous execution framework for Claude Code.

**Default behavior: delegate work to agents, don't do it directly.** When a task exists in the DB, dispatch it to an agent rather than doing the work yourself. You are the orchestrator — agents are the workers.

## Quick Start: Running Agents

### Start the daemon (recommended)
The daemon continuously polls for `todo` tasks, dispatches agents to fill available slots, and monitors for stuck/orphaned agents. This is the hands-off way to process a task queue.

```bash
scripts/agent-daemon start     # launches in tmux, polls every 30s
scripts/agent-daemon stop      # kills the daemon window
scripts/agent-daemon restart   # stop + start
```

### Dispatch a single task
```bash
scripts/agent-dispatch 42      # dispatch specific task #42
scripts/agent-dispatch          # auto-pick highest priority eligible task
```

### Monitor
```bash
scripts/agent-status            # dashboard: running agents, queue, reviews, daemon status
tmux attach -t ctf-agents       # watch agents work live
tmux attach -t ctf-agents:agent-42   # watch a specific agent
```

### Typical workflow
```bash
# 1. Create tasks
scripts/taskctl add-task "Add dark mode toggle" --project myapp --type feature --priority high \
  --notes "Add a toggle in settings that switches the theme" \
  --acceptance-criteria "Toggle exists in settings, theme switches on click, preference persists in localStorage"

# 2. Optionally assign a specific agent
scripts/taskctl assign 42 Alex        # assign to Alex (coder)

# 3. Dispatch
scripts/agent-dispatch 42             # or just start the daemon and let it pick

# 4. Watch
scripts/agent-status
```

## How the Agent System Works

### Lifecycle
```
todo --> in-progress (agent-dispatch) --> in-review (agent-complete)
                                              |
                                        agent-review
                                         /        \
                                     PASS           FAIL
                                      |               |
                                    done         back to todo
                                  (cascades)    (feedback in notes)

                              failed twice --> paused (needs human)
```

### What happens when you dispatch a task

1. **`agent-dispatch`** claims the task (atomically sets status to `in-progress`), resolves the agent profile (explicit assignment > auto-match by task type > default coder), creates a git worktree at `.workspaces/agent-{task_id}/` on branch `task-{task_id}`, inserts an agent record in the DB, and spawns `agent-wrapper` in a new tmux window.

2. **`agent-wrapper`** builds a layered prompt (identity from profile + task context + project CLAUDE.md), starts a `claude --dangerously-skip-permissions` session in the worktree, and pipes output with a heartbeat (updates `heartbeat_at` on every output line so the watcher can detect stuck agents).

3. **`agent-complete`** runs when the Claude session exits:
   - **Exit 0 (success)**: sets task to `in-review`, spawns `agent-review` in a new tmux window.
   - **Exit non-zero, first attempt**: sets task back to `todo` for retry on next daemon cycle.
   - **Exit non-zero, second attempt**: sets task to `paused` with a note that it needs human attention.

4. **`agent-review`** spawns a separate Claude session (the "reviewer") that reads the git diff, checks acceptance criteria, and writes a verdict to `/tmp/ctf-review-{task_id}`:
   - **PASS**: task marked `done`. Triggers dependency cascade (unblocked tasks auto-dispatch) and subtask cascade (if all siblings done, parent dispatches).
   - **FAIL**: task kicked back to `todo` with review feedback appended to notes. Agent will re-attempt with that feedback.

5. **`agent-watcher`** (called by daemon each cycle) detects stuck agents (no heartbeat for 10+ min), kills their tmux windows/processes, and either retries or pauses. Also re-dispatches orphaned `in-review` tasks with no running reviewer.

6. **`agent-daemon`** ties it all together: runs watcher, then fills available agent slots from the queue, every 30 seconds.

### Priority queue
When auto-picking tasks, `agent-dispatch` scores them by:
- Priority weight: high=30, medium=20, low=10
- Dependency bonus: +10 per `todo` task that depends on this one (unblocks more work)
- Tiebreaker: oldest `created_at` first
- Tasks with unmet `depends_on` are skipped

### Concurrency and environment
| Setting | Env var | Default |
|---|---|---|
| Max concurrent agents | `CTF_MAX_AGENTS` | 3 |
| Tmux session name | `CTF_TMUX_SESSION` | `ctf-agents` |
| Stuck timeout (minutes) | `CTF_STUCK_TIMEOUT` | 10 |
| Database path | `TASK_DB_PATH` | `$ROOT/tasks.db` |

### Retry logic
- First failure: task returns to `todo`, retry count incremented, daemon picks it up next cycle.
- Second failure: task set to `paused`, notes appended with "[agent] Failed twice. Needs human attention."
- Review failure: task returns to `todo` with reviewer feedback in notes. The next agent attempt sees this feedback.
- Resume sessions: if a failed agent had a `cli_session_id`, the retry uses `--resume` to continue from where it left off.

## Agent Profiles

Named agents with specialized system prompts and capabilities. Seeded by `scripts/seed-agents.sh`.

| Name | Role | Auto-assigns to | Tool grants |
|---|---|---|---|
| Alex | coder | `feature`, `bug` | - |
| Maya | researcher | `research` | - |
| Jordan | devops | `release` | `ssh` |
| Sam | qa | - | - |
| Riley | writer | - | - |
| Casey | seo-expert | - | `gsc`, `asc_api` |
| Morgan | planner | - | `agent-dispatch` |
| Taylor | marketing-lead | - | `gsc`, `asc_api`, `agent-dispatch` |

```sql
agent_profiles: id, name, role, system_prompt, tool_grants, auto_assign_types, created_at
```

**Prompt layering**: identity (from profile `system_prompt`) + task context (title, type, priority, notes, acceptance criteria) + project CLAUDE.md (auto-loaded by Claude from worktree).

**Tool grants**: JSON array exported as env vars (`CTF_GRANT_SSH`, `CTF_GRANT_GSC`, etc.). Morgan and Taylor can sub-dispatch tasks via `CTF_GRANT_DISPATCH`.

**Assignment priority**: explicit `assigned_agent_id` on task > auto-match by `auto_assign_types` > fallback to `coder` role.

```bash
scripts/taskctl agents                  # list all profiles
scripts/taskctl assign 42 Alex          # manually assign
scripts/seed-agents.sh                  # re-seed profiles (INSERT OR IGNORE)
```

## Task Management (taskctl)

```bash
# Tasks
scripts/taskctl add-task "Title" --project myapp --type feature --priority high \
  --notes "Details" --depends-on "[1,2]" --parent 10
scripts/taskctl tasks myapp             # all tasks for project
scripts/taskctl tasks-open myapp        # non-done only
scripts/taskctl set-status 42 done
scripts/taskctl log 42 in-progress --notes "started work"

# Projects & orgs
scripts/taskctl projects
scripts/taskctl add-project myapp --path ~/Projects/myapp --org myorg --repo https://github.com/user/myapp
scripts/taskctl add-org myorg --jira-instance https://x.atlassian.net --jira-key PROJ --discord-webhook https://...

# Views
scripts/taskctl dashboard              # full focus dashboard
scripts/taskctl active                 # in-progress/testing tasks
scripts/taskctl focus                  # top priority tasks

# Agents
scripts/taskctl agents                 # list profiles
scripts/taskctl assign 42 Maya         # assign task to agent
```

## Task Schema
```sql
tasks: id, title, type, status, priority, project_id, parent_task_id,
       notes, due_date, depends_on, acceptance_criteria, assigned_agent_id,
       created_at, updated_at
```
- **status**: `todo`, `in-progress`, `in-review`, `testing`, `done`, `paused`
- **type**: `feature`, `bug`, `research`, `video`, `release`, `other`
- **priority**: `high`, `medium`, `low`
- **acceptance_criteria**: concrete, testable criteria the review agent checks — always set these
- **depends_on**: JSON array of task IDs (e.g., `[1,2]`) that must be `done` before dispatch
- **parent_task_id**: subtask hierarchy. When all subtasks are `done`, parent auto-dispatches.

## Architecture

- **DB**: `tasks.db` (SQLite) — tables: organizations, projects, tasks, agents, agent_profiles, team_members, task_status_changes, project_memories, memory
- **Scripts**: `scripts/` — agent system, taskctl CLI, integrations (Discord, Jira, GSC)
- **Hooks**: `hooks/` — session-start (focus injection), stop-guard (anti-premature-exit)
- **Skills**: `skills/` — `/refactor` mega-skill, utilities (`/opib`, `/list-prs`, `/summ`), plus team-lead, docs-lookup, isolate-workspace, appstoreconnect, and the ASO suite. The interactive dev workflow (brainstorm → plan → execute → review) uses the external **superpowers** skills — see [Superpowers workflow skills](#superpowers-workflow-skills).
- **Templates**: `templates/` — Discord embed templates (pr_review, jira_status, seo_monitor)
- **Workflows**: `scripts/workflows/` — blog-image-gen, gsc-audit

### Key scripts
| Script | Purpose |
|---|---|
| `agent-daemon` | Continuous loop: runs watcher, fills agent slots from queue. The main entry point. |
| `agent-dispatch` | Claims a task, creates worktree + agent record, spawns `agent-wrapper` in tmux |
| `agent-wrapper` | Builds layered prompt, runs Claude Code session with heartbeat |
| `agent-complete` | Handles success (-> in-review + review) or failure (-> retry or pause) |
| `agent-review` | Spawns reviewer Claude session, checks acceptance criteria, writes PASS/FAIL verdict |
| `agent-watcher` | Detects stuck agents, kills orphans, re-dispatches orphaned reviews |
| `agent-status` | Dashboard: running agents, queue, in-review, recent completions, daemon status |
| `taskctl` | CLI for task/project/org CRUD and views |
| `doctor` | Health check: verifies deps, DB tables, script permissions, hook config |
| `seed-agents.sh` | Seeds the 8 agent profiles (INSERT OR IGNORE) |

## Conventions

- tasks.db is gitignored (user data). Schema lives in migration scripts.
- `.workspaces/` is gitignored (agent worktrees).
- `docs/plans/` is gitignored — design docs and implementation plans are local-only, never committed.
- All scripts use `$ROOT` relative to script location, `$DB` from `TASK_DB_PATH` or `$ROOT/tasks.db`.
- Agent records track: worker_name, profile_id, tmux_pane, pid, heartbeat_at, retry_count, cli_session_id.
- Cascades: when a task completes review, dependent tasks and parent tasks auto-dispatch if unblocked.
- Discord notifications fire on completion/failure if the org has a webhook configured.

## Superpowers workflow skills

The interactive dev workflow (brainstorm → plan → execute → review) uses the external **superpowers** skills by [@obra](https://github.com/obra), installed globally in `~/.claude/skills/`. They are NOT part of this repo and NOT symlinked from `skills/`. They replace the removed `/feature` and `/bugfix` mega-skills (originals kept under `skills-backup/`).

From [github.com/obra/superpowers](https://github.com/obra/superpowers): `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch`.
From [github.com/obra/the-elements-of-style](https://github.com/obra/the-elements-of-style): `writing-clearly-and-concisely`.

See [README → Superpowers workflow skills](README.md#superpowers-workflow-skills) for the install command and per-skill source links.

## Development Rules

- Keep scripts as bash — no Node/Python dependencies for core agent system.
- Every schema change must update BOTH migration scripts (new users) and include a migration path (existing users).
- Agent prompts should include acceptance criteria and be skeptical — "verify actual behavior, not just that files exist."
- Test agent changes by dispatching against a real task: `scripts/agent-dispatch <task_id>`
- **Prefer delegation**: if a task is in the DB with acceptance criteria, dispatch it to an agent. Only do work directly when it's faster than creating a task (trivial changes, urgent fixes, or interactive exploration).
- **Minimize debug round-trips**: when diagnosing, batch your probes. Gather multiple signals per cycle (logs + DB state + a reproducible script that traces each step) instead of testing one variable at a time. Prefer a single self-contained reproduction over repeated incremental requests.
