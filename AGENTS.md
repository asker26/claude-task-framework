# claude-task-framework — shared control center

This repo is a task management and automation framework for Claude Code.

## Purpose
- `tasks.db` is the source of truth for projects, tasks, organizations, and team context.
- `docs/`, `templates/`, `settings/`, and `scripts/` contain reusable operating knowledge and utilities.
- `hooks/` provides autonomous execution hooks for Claude Code.
- `skills/` contains reusable skill definitions.

## Non-destructive rule
Do not remove, rename, or break:
- `hooks/session-start.sh`
- `hooks/intent-classifier.sh`
- `hooks/stop-guard.sh`
- `tasks.db`

## Source-of-truth rules
- Tasks/projects/priority data: `tasks.db`
- Context extraction: `scripts/taskctl`, `scripts/current-focus`, `scripts/project-context`
- Notifications: `scripts/discord-notify`, `scripts/jira-task`

## Preferred workflow
When working in this repo:
1. Use `scripts/taskctl project-from-cwd` to resolve current project context.
2. Use `scripts/current-focus` to get active priority/task context.
3. Use `scripts/jira-task` for Jira access and `scripts/discord-notify` for Discord notifications.

## Efficiency guidance
- Prefer shared scripts over duplicating SQL in prompts.
- Prefer plain-text aligned tables over markdown tables in user-facing responses.
