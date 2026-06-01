---
name: ctf-clean
description: "Safely GC stale agent cruft (worktrees, registrations, tmux windows, agent rows). Offers to PR un-merged work first; reports isolation clones. Usage: /ctf-clean [--dry-run]"
metadata:
  version: 1.0.0
---

# ctf-clean — agent workspace janitor

Reclaim stale agent cruft from the task framework. Auto-removes only worktrees
whose task is `done`/merged with no real uncommitted work; offers to PR un-merged
work before removing it; reports (never deletes) `/isolate` clones.

**Safety invariant:** only cruft tied to a `done` task is ever touched. Anything
tied to `todo`/`in-progress`/`in-review` is left alone — that's `agent-watcher`'s
job, not this skill's.

## Steps

1. Run the sweeper. If the user passed `--dry-run`, pass it through, print the
   output, and STOP — touch nothing else.
   ```bash
   scripts/agent-clean ${ARGUMENTS}
   ```
2. Show the summary block (worktrees removed + GB reclaimed, registrations
   pruned, tmux windows killed, agent rows reset).
3. Parse the `ATTENTION` lines (tab-separated: `ATTENTION  <task_id>  <branch>
   <status>  <why>`). These are un-merged / active worktrees that were NOT
   removed. For each whose `why` contains "un-merged" (skip ones marked "active
   task"), offer three choices:
   - **(a) PR + remove** — open a PR from the branch, then remove the worktree:
     ```bash
     git -C <project.local_path> push -u origin task-<id>
     gh pr create --repo <org/repo> --head task-<id> --title "<task title>" --body "<bullet summary>"
     git -C <project.local_path> worktree remove --force <framework_root>/.workspaces/agent-<id>
     ```
     Resolve `<project.local_path>` and `<org/repo>` from `tasks`/`projects`;
     `<framework_root>` is the claude-task-framework repo root (where
     `scripts/agent-clean` lives) — the worktree's absolute path, since it's
     registered to the project repo but lives under the framework's `.workspaces/`.
     Title + bullets follow the repo's PR conventions; if the project's org has
     Jira/Discord configured, update them per the Autonomy rules.
   - **(b) keep** — leave it untouched.
   - **(c) force-delete** — `git -C <project.local_path> worktree remove --force
     <framework_root>/.workspaces/agent-<id>` without a PR.
   Worktrees marked "active task" are reported only — never offer to remove them.
4. Print the `ISOLATION` lines verbatim (tab-separated: `ISOLATION  <path>
   <size>  <git summary>`). These are user isolation clones — report only, never
   act on them.

## Boundaries

- Never deletes or modifies isolation clones.
- Never deletes `agents` rows (the sweeper only resets orphaned `running` rows to
  `cancelled`).
- Never touches anything tied to a non-terminal task.
