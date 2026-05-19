# v3 Multi-Agent Worker System — Design

**Date:** 2026-05-19
**Goal:** Add multi-agent task execution to the framework — dispatch multiple Claude Code CLI sessions that work on tasks in parallel, with heartbeat monitoring, stuck recovery, dependency cascading, and priority-based scheduling.

**Approach:** Clean room implementation. Behavioral patterns derived from an architectural specification. All code is original bash + SQLite.

## Architecture

```
agent-daemon (30s loop)
  ├── agent-dispatch    → claim todo tasks, spawn tmux panes
  ├── agent-watcher     → check heartbeats, kill stuck agents, retry/pause
  └── agent-complete    → called by agent on exit, trigger dependency cascade

tmux session: "ctf-agents"
  ├── pane "daemon"     → agent-daemon loop
  ├── pane "agent-42"   → claude working on task #42 (in git worktree)
  ├── pane "agent-38"   → claude working on task #38 (in git worktree)
  └── ...
```

Each agent runs in a named tmux window inside a shared session (`ctf-agents`). The daemon occupies one window and manages the others. Agent windows auto-close on completion after `agent-complete` records the result.

Manual override always works:
- `agent-dispatch 42` — force-dispatch a specific task
- `agent-dispatch` (no args) — dispatch next eligible task by priority
- `agent-watcher` — run one check cycle manually
- `agent-status` — show all running agents and queued tasks

The daemon is optional convenience — everything works without it via manual calls or cron.

## Schema Changes

The existing `agents` table (stub from v2) gets replaced, and `tasks` gets a `depends_on` column:

```sql
DROP TABLE IF EXISTS agents;
CREATE TABLE agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    worker_name TEXT NOT NULL DEFAULT 'agent',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','running','completed','failed','cancelled')),
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

ALTER TABLE tasks ADD COLUMN depends_on TEXT;
-- JSON array of task IDs, e.g. "[3, 7]"
-- Null or empty = no dependencies
```

Key fields:
- `cli_session_id` — for `claude --resume` on retry
- `tmux_pane` — window name for kill/attach
- `pid` — Claude CLI process ID for heartbeat checks
- `retry_count` — 0 = first attempt, 1 = retry, >=2 = give up (task paused)
- `heartbeat_at` — updated on each line of Claude output
- `depends_on` — JSON array on tasks table

## Dispatch Flow

`agent-dispatch [task_id]`:

1. If `task_id` given: dispatch that specific task. If no arg: pick best eligible task by priority score.
2. Check concurrency: `SELECT COUNT(*) FROM agents WHERE status='running'`. If >= max (env `CTF_MAX_AGENTS`, default 3): exit.
3. Check dependencies: parse `depends_on` JSON, verify all referenced tasks have `status='done'`. If not satisfied: skip.
4. Atomic claim: `UPDATE tasks SET status='in-progress' WHERE id=X AND status='todo'`. If 0 rows affected: someone else claimed it, skip.
5. Insert `agents` row (status='running', heartbeat_at=now).
6. Resolve project: `tasks.project_id` -> `projects.local_path`.
7. Create git worktree: `.workspaces/agent-{task_id}` on branch `task-{task_id}`.
8. Spawn tmux window: `tmux new-window -t ctf-agents -n "agent-{task_id}" "agent-wrapper {task_id} {agent_id}"`.

### Priority Scoring

When no task_id given, pick the highest-scoring eligible task:

```sql
SELECT t.id,
  CASE t.priority WHEN 'high' THEN 30 WHEN 'medium' THEN 20 ELSE 10 END
  + (SELECT COUNT(*) FROM tasks d
     WHERE d.depends_on LIKE '%' || t.id || '%' AND d.status='todo') * 10
  AS score
FROM tasks t
WHERE t.status = 'todo' AND t.project_id IS NOT NULL
ORDER BY score DESC, t.created_at ASC
LIMIT 1;
```

High-priority tasks that unblock other tasks get dispatched first.

## Agent Wrapper + Heartbeat

The tmux window runs `agent-wrapper`, not `claude` directly:

1. `cd` into worktree path.
2. Build system prompt: task title, notes, project name, priority, instruction to work autonomously and commit when done.
3. Check for `cli_session_id` from a previous attempt — if present, use `claude --resume`.
4. Launch: `claude --dangerously-skip-permissions -p "{prompt}"`.
5. Pipe stdout through heartbeat updater: on each line, `UPDATE agents SET heartbeat_at=CURRENT_TIMESTAMP`.
6. On exit: capture exit code, store `cli_session_id` if available, call `agent-complete <agent_id> <exit_code>`.
7. Pane stays open 5s for inspection, then closes.

## Watcher + Stuck Recovery

`agent-watcher` runs one check cycle (daemon calls it every 30s):

1. Find stuck agents: `status='running' AND heartbeat_at < datetime('now', '-N minutes')` where N = env `CTF_STUCK_TIMEOUT` (default 10).
2. For each stuck agent:
   - Kill tmux window and pid.
   - If `retry_count == 0`: mark agent failed, save `cli_session_id`, reset task to `todo`, re-dispatch (will use `--resume`).
   - If `retry_count >= 1`: mark agent failed, mark task `paused`, append note "Agent stuck twice, needs human attention", notify Discord.
3. Find orphaned tmux windows (no matching running agent row) and kill them.
4. Print summary.

## Dependency Cascade + Completion

`agent-complete <agent_id> <exit_code>`:

**On success (exit 0):**
1. Update agent: `status='completed'`, `completed_at=now`.
2. Update task: `status='done'`.
3. Dependency cascade: find all `todo` tasks whose `depends_on` includes this task. For each, check if ALL deps are now `done`. If yes: `agent-dispatch <task_id>`.
4. Subtask cascade: if task has `parent_task_id`, check if ALL sibling subtasks are `done`. If yes and parent is `todo`: `agent-dispatch <parent_id>`.
5. Notify Discord if webhook configured.
6. Clean up worktree after PR/merge.

**On failure (exit != 0):**
1. Update agent: `status='failed'`.
2. If `retry_count == 0`: reset task to `todo`, increment `retry_count`, re-dispatch.
3. If `retry_count >= 1`: mark task `paused`, notify Discord.

## Daemon

`agent-daemon start|stop|restart`:

- Starts a tmux session `ctf-agents` with a `daemon` window.
- Loops every 30s: run `agent-watcher`, then `agent-dispatch` (fills available slots).
- Logs each cycle to stdout.
- `stop` kills the daemon window; running agents keep going.

## Status Command

`agent-status` output:

```
AGENT STATUS
============
Running (2/3):
  agent-42  task #42  [HIGH] Fix auth regression    12m  heartbeat 8s ago
  agent-38  task #38  [MED]  Add search feature      4m  heartbeat 2s ago

Queue (3 eligible):
  #45  [HIGH] Implement webhooks         (unblocked, score: 50)
  #43  [MED]  Write API docs             (unblocked, score: 20)
  #44  [LOW]  Refactor logger            (blocked by #45)

Recent (last 5):
  agent-41  task #41  completed  7m ago
  agent-40  task #40  failed     22m ago  (retry 1, re-dispatched)

Daemon: running (pid 12345, cycle 47)
```

## Isolation

**Default: git worktrees.** Each agent gets `.workspaces/agent-{task_id}` on branch `task-{task_id}`. Agents cannot interfere with each other or the main working copy.

**Future: Docker containers (Phase 2).** Optional `CTF_ISOLATION=docker` mode where each agent runs inside a container instead of a local worktree. Not designed here — noted as a future task for users who want stronger sandboxing.

## Configuration

All via environment variables with sane defaults:

| Variable | Default | Purpose |
|----------|---------|---------|
| `CTF_MAX_AGENTS` | `3` | Max concurrent agents |
| `CTF_STUCK_TIMEOUT` | `10` | Minutes before agent considered stuck |
| `CTF_TMUX_SESSION` | `ctf-agents` | tmux session name |
| `CTF_ISOLATION` | `worktree` | Isolation mode (worktree only for now) |

## File Changes Summary

| Action | File |
|--------|------|
| New | `scripts/agent-dispatch` (replace stub) |
| New | `scripts/agent-wrapper` |
| New | `scripts/agent-watcher` |
| New | `scripts/agent-complete` |
| New | `scripts/agent-daemon` |
| New | `scripts/agent-status` |
| Modified | `init-db.sh` (replace agents table, add depends_on) |
| Modified | `scripts/taskctl` (add depends_on support to add-task, dashboard) |
| Modified | `README.md` (document multi-agent system) |

## Non-Goals

- Docker container isolation — future Phase 2, not designed here
- Web UI for agent monitoring — `agent-status` + tmux attach is sufficient
- Multi-machine distribution — single machine only
- Agent-to-agent communication — agents work independently on separate tasks
- API mode execution — CLI only (Claude Code)
