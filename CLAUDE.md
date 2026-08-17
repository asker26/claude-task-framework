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
- Active-sprint bonus: +25 if the task is in a sprint whose status is `active`
- Tiebreaker: oldest `created_at` first
- Tasks with unmet `depends_on` are skipped
- Set `CTF_SPRINT=<id|name>` to restrict auto-pick to a single sprint's tasks

### Concurrency and environment
| Setting | Env var | Default |
|---|---|---|
| Max concurrent agents | `CTF_MAX_AGENTS` | 3 |
| Tmux session name | `CTF_TMUX_SESSION` | `ctf-agents` |
| Restrict auto-pick to one sprint | `CTF_SPRINT` | (unset) |
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

# Sprints
scripts/taskctl add-sprint "Sprint 1" --project myapp --goal "ship MVP" --end 2026-06-20
scripts/taskctl add-task "Title" --project myapp --sprint "Sprint 1"   # or --sprint <id>
scripts/taskctl sprint-add "Sprint 1" 42 43    # move existing tasks into a sprint
scripts/taskctl sprint-activate "Sprint 1"     # one active sprint per project (demotes siblings)
scripts/taskctl sprints [project]              # list sprints + done/total progress
scripts/taskctl sprint "Sprint 1"              # sprint detail + its tasks
scripts/taskctl sprint-status 1 completed      # set status (planned|active|completed|cancelled)
scripts/taskctl sprint-remove 42               # clear a task's sprint
scripts/taskctl backlog [project]              # non-done tasks not in any sprint

# Views
scripts/taskctl dashboard              # full focus dashboard (incl. active sprint section)
scripts/taskctl active                 # in-progress/testing tasks
scripts/taskctl focus                  # top priority tasks

# Agents
scripts/taskctl agents                 # list profiles
scripts/taskctl assign 42 Maya         # assign task to agent
```

## PR Cockpit (prctl)

One board for every open PR across the FS-Code org with *my* review state (from GitHub), locally staged
`/reviewer-ultra` reports, and which Claude session is on which PR. Use it instead of re-deriving PR state with `gh`.

```bash
scripts/prctl board                 # NEEDS YOU · WAITING ON AUTHOR · APPROVED · MINE  (--repo X, --all, --fresh, --json)
scripts/prctl show bookneticsaas#3128
scripts/prctl review bookneticsaas#3128 [--now]   # queue for the worker / run here
scripts/prctl staged | read <ref> | edit <ref>
scripts/prctl post <ref> [--verdict A|RC|C] [--full] [--yes]   # gh pr review, human-approved, under your account
scripts/prctl skip <ref> [--days N] | unskip <ref>
scripts/prctl claim <ref> | release | whoami | label "payments" | sessions
scripts/prctl worker start [--sync-only|--queue-only] | stop | status   # tmux ctf-agents:pr-worker, one review at a time
scripts/prctl config set model claude-sonnet-5                  # or claude-opus-4-8 (worker model; subagents inherit); also max_diff, stale_*, ignore_repos, ignore_authors
```

Statuses (view `pr_board`, first match wins): `running` → `staged` → `review-failed` → `skipped` → `re-review` (author pushed since my review) → `needs-review` → `author-replied` → `waiting-author` → `approved` (`ready ✓` when mergeable + green) → `commented`; drafts and my own PRs are separate. Flags: `STALE` (waiting-author > 3d or idle > 7d), `conflicts`, `ci-red`, `too-big` (> `max_diff` lines — manual review only), `s:<session>` claims.

Worker: `pr-sync` every 5 min (GraphQL, one query per repo that has open PRs), reaps reviews silent for 30 min, picks explicit queue → `re-review` → `needs-review`, runs `pr-review-run` (headless `claude -p` running `/reviewer-ultra`, report written to `.reviews/`), never posts. On a session-cap hit it cools down until the reset time. Env: `CTF_PR_CLAUDE_MODEL` (overrides `config model`), `CTF_PR_ORG`, `CTF_PR_IGNORE_REPOS`, `CTF_PR_IGNORE_AUTHORS`, `CTF_GH_ME`, `CTF_PR_POLL`, `CTF_PR_SYNC_INTERVAL`, `CTF_PR_MAX_REVIEWS`, `CTF_PR_STUCK_TIMEOUT`, `CTF_PR_NOTIFY`, `CTF_PR_REVIEWS_DIR`.

Session hooks (`hooks/pr-session-*.sh`, installed by `scripts/install-pr-hooks.sh`) register every Claude session; `prctl claim` links the current one (`$CLAUDE_CODE_SESSION_ID`) to a PR. Schema: `scripts/migrate-v5-prs.sh` (existing DBs) / `init-db.sh` (new). Tests: `scripts/test-prctl` (offline, fake `gh`/`claude`). **Usage playbook: `docs/playbooks/pr-cockpit.md`** (daily loop, where reports live, sessions, troubleshooting). Design: `docs/plans/2026-08-17-pr-cockpit-design.md`.

## Task Schema
```sql
tasks: id, title, type, status, priority, project_id, parent_task_id,
       notes, due_date, depends_on, acceptance_criteria, assigned_agent_id,
       sprint_id, created_at, updated_at
sprints: id, name, project_id, goal, status, start_date, end_date,
       created_at, updated_at
```
- **status**: `todo`, `in-progress`, `in-review`, `approved`, `testing`, `done`, `paused`
- **type**: `feature`, `bug`, `research`, `video`, `release`, `other`
- **priority**: `high`, `medium`, `low`
- **acceptance_criteria**: concrete, testable criteria the review agent checks — always set these
- **depends_on**: JSON array of task IDs (e.g., `[1,2]`) that must be `done` before dispatch
- **parent_task_id**: subtask hierarchy. When all subtasks are `done`, parent auto-dispatches.
- **sprint_id**: optional FK to `sprints`. Tasks in the `active` sprint get a +25 dispatch bonus. `sprints.status`: `planned`, `active`, `completed`, `cancelled` (one `active` per project — enforced by `sprint-activate`).

## Architecture

- **DB**: `tasks.db` (SQLite) — tables: organizations, projects, sprints, tasks, agents, agent_profiles, team_members, task_status_changes, project_memories, memory, prs, pr_reviews, sessions, pr_claims, pr_settings (+ view `pr_board`)
- **Scripts**: `scripts/` — agent system, taskctl CLI, integrations (Discord, Jira, GSC)
- **Hooks**: `hooks/` — session-start (focus injection), pr-session-start/seen/end (PR cockpit session registry)
- **Skills**: `skills/` — `/refactor` mega-skill, utilities (`/opib`, `/list-prs`, `/summ`, `/efnpm` — explain a topic for a non-technical PM), plus team-lead, docs-lookup, isolate-workspace, ctf-clean (`/ctf-clean` workspace janitor), appstoreconnect, the ASO suite, and the review pair: `/reviewer-ultra` (multi-agent PR review: regressions/bugs/smells + validators) and `/readable-ultra` (readability-only review distilled from Clean Code / The Art of Readable Code; composes with reviewer-ultra as a 4th finder). The interactive dev workflow (brainstorm → plan → execute → review) uses the external **superpowers** skills — see [Superpowers workflow skills](#superpowers-workflow-skills). The global `/tirf` skill (Type In a Readable Format — reshapes bloated AI output into a scannable, lossless view) also lives in `~/.claude/skills/`, not in this repo's `skills/`, and composes with `writing-clearly-and-concisely`.
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
| `taskctl` | CLI for task/project/org/sprint CRUD and views |
| `doctor` | Health check: verifies deps, DB tables, script permissions, hook config |
| `migrate-v4-sprints.sh` | Idempotent migration: adds the `sprints` table + `tasks.sprint_id` to an existing DB |
| `agent-clean` | Janitor: safely removes stale `done`-task worktrees, prunes orphaned registrations, kills dead tmux windows, resets orphaned agent rows (`--dry-run` to preview) |
| `seed-agents.sh` | Seeds the 8 agent profiles (INSERT OR IGNORE) |
| `prctl` | PR cockpit CLI: board, show, review queue, staged/read/edit/post, skip, claim/sessions, worker, config |
| `pr-sync` | GitHub → `prs` (GraphQL per repo with open PRs); marks merged/closed; discards their pending reviews |
| `pr-worker` | Daemon: sync → reap stuck → pick (queue → re-review → needs-review) → run one `pr-review-run` in tmux; session-cap cooldown |
| `pr-review-run` | One headless `claude -p` `/reviewer-ultra` session for one PR; heartbeat; stages the report as `.reviews/<repo>-<n>-<sha7>.md` |
| `migrate-v5-prs.sh` | Idempotent migration: PR cockpit tables + `pr_board` view (always recreated) |
| `install-pr-hooks.sh` | Appends the three PR session hooks to `~/.claude/settings.json` (idempotent, backup) |
| `test-prctl` | Offline integration test for the whole PR cockpit (fake `gh` + `claude` shims) |

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
