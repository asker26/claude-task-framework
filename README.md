# Claude Task Framework

A task management and autonomous execution framework for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Gives Claude persistent project context, focus management, and end-to-end autonomous workflows (feature -> test -> commit -> push -> PR) via hooks and skills.

## What This Does

- **Task tracking** — SQLite database for projects, tasks, organizations, and team members. Claude queries it to understand what you're working on and stay on-scope.
- **Focus guard** — Session-start hook injects your current priority and active tasks. If you drift off-topic, Claude flags it.
- **Integrations** — Scripts for Discord notifications (via webhooks) and Jira operations (via `acli` CLI).
- **Multi-agent execution** — Dispatch multiple Claude Code sessions in parallel via tmux. Priority scheduling, heartbeat monitoring, stuck recovery, dependency cascading, and git worktree isolation.

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

Copy the example CLAUDE.md to your home directory and customize it:
```bash
cp CLAUDE.md.example ~/CLAUDE.md
```

## Setting Up Hooks

The setup wizard installs hooks automatically. To install manually, copy the template and replace the placeholder path:

```bash
# Copy and customize the hook template
cat hooks.json.example | sed "s|__FRAMEWORK_PATH__|$(pwd)|g" > /tmp/hooks.json

# If you already have ~/.claude/settings.json, merge the hooks key:
jq --argjson hooks "$(jq '.hooks' /tmp/hooks.json)" '. + {hooks: $hooks}' \
  ~/.claude/settings.json > ~/.claude/settings.json.tmp && mv ~/.claude/settings.json.tmp ~/.claude/settings.json

# Or if starting fresh:
cat hooks.json.example | sed "s|__FRAMEWORK_PATH__|$(pwd)|g" > ~/.claude/settings.json
```

## Setting Up Skills

Copy the included skills to your global Claude skills directory:

```bash
cp -r skills/* ~/.claude/skills/
```

This gives you `/refactor`, `/opib`, `/list-prs`, `/summ`, `/team-lead`, `/docs-lookup`, `/isolate`, and `/ctf-clean` (agent-workspace janitor) as slash commands in Claude Code.

The interactive development workflow uses the external **superpowers** skills (see below) instead of the old `/feature` and `/bugfix` mega-skills.

## Superpowers workflow skills

The dev workflow (brainstorm → plan → execute → review) uses the **superpowers** skill set by [@obra](https://github.com/obra). These are external skills installed globally in `~/.claude/skills/` — they are **not** part of this repo and **not** symlinked from `skills/`. They replace the removed `/feature` and `/bugfix` mega-skills (whose originals are kept under `skills-backup/`).

| Skill | GitHub source |
|-------|---------------|
| `brainstorming` | [obra/superpowers · skills/brainstorming](https://github.com/obra/superpowers/tree/main/skills/brainstorming) |
| `writing-plans` | [obra/superpowers · skills/writing-plans](https://github.com/obra/superpowers/tree/main/skills/writing-plans) |
| `executing-plans` | [obra/superpowers · skills/executing-plans](https://github.com/obra/superpowers/tree/main/skills/executing-plans) |
| `test-driven-development` | [obra/superpowers · skills/test-driven-development](https://github.com/obra/superpowers/tree/main/skills/test-driven-development) |
| `systematic-debugging` | [obra/superpowers · skills/systematic-debugging](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) |
| `verification-before-completion` | [obra/superpowers · skills/verification-before-completion](https://github.com/obra/superpowers/tree/main/skills/verification-before-completion) |
| `requesting-code-review` | [obra/superpowers · skills/requesting-code-review](https://github.com/obra/superpowers/tree/main/skills/requesting-code-review) |
| `receiving-code-review` | [obra/superpowers · skills/receiving-code-review](https://github.com/obra/superpowers/tree/main/skills/receiving-code-review) |
| `finishing-a-development-branch` | [obra/superpowers · skills/finishing-a-development-branch](https://github.com/obra/superpowers/tree/main/skills/finishing-a-development-branch) |
| `writing-clearly-and-concisely` | [obra/the-elements-of-style · skills/writing-clearly-and-concisely](https://github.com/obra/the-elements-of-style/tree/main/skills/writing-clearly-and-concisely) |

Install / update:

```bash
tmp=$(mktemp -d)
git clone --depth 1 https://github.com/obra/superpowers.git "$tmp/sp"
for s in brainstorming writing-plans executing-plans test-driven-development \
         systematic-debugging verification-before-completion \
         requesting-code-review receiving-code-review finishing-a-development-branch; do
  cp -r "$tmp/sp/skills/$s" ~/.claude/skills/
done
git clone --depth 1 https://github.com/obra/the-elements-of-style.git "$tmp/eos"
cp -r "$tmp/eos/skills/writing-clearly-and-concisely" ~/.claude/skills/
rm -rf "$tmp"
```

## /tirf — readable formatter (global)

`/tirf` reshapes a bloated, hard-to-read blob of AI output into a tight,
scannable markdown view — **without losing any facts**. It is not a summarizer
(`/summ` condenses; `/tirf` reorganizes losslessly).

It is a **global** skill living in `~/.claude/skills/tirf/`, like the superpowers
skills above — not part of this repo's `skills/`. It composes with
`writing-clearly-and-concisely` for the word-level polish.

Usage: `/tirf <file | task-id | text>` (no argument → it asks what to format).

## Project Structure

```
claude-task-framework/
├── init-db.sh                 # Creates empty tasks.db with full schema
├── setup.sh                   # Interactive setup wizard
├── seed-sample.sh             # Optional sample data for exploration
├── backup-db.sh               # Daily SQL dump + git commit
├── hooks.json.example         # Hook config template for ~/.claude/settings.json
├── CLAUDE.md.example          # Template for your ~/CLAUDE.md
├── AGENTS.md                  # Instructions for AI agents working in this repo
├── hooks/
│   └── session-start.sh       # Injects focus context at session start
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
├── skills/
│   ├── refactor/SKILL.md      # Autonomous refactor
│   ├── opib/SKILL.md          # Open anything in browser (/opib)
│   ├── list-prs/SKILL.md      # List open PRs in a table (/list-prs)
│   ├── summ/SKILL.md          # Summarize current session (/summ)
│   ├── team-lead/SKILL.md     # Scope gate and project switching
│   ├── docs-lookup/SKILL.md   # Research docs before writing code
│   ├── isolate-workspace/SKILL.md # Work in isolated repo clones
│   ├── appstoreconnect/SKILL.md   # App Store Connect API operations
│   └── aso/                   # App Store Optimization suite (17 skills)
│       ├── app-marketing-context/  keyword-research/  metadata-optimization/
│       ├── aso-audit/  competitor-analysis/  screenshot-optimization/
│       ├── ab-test-store-listing/  localization/  app-launch/
│       ├── app-store-featured/  app-analytics/  retention-optimization/
│       ├── monetization-strategy/  review-management/
│       └── market-pulse/  market-movers/  ua-campaign/
├── templates/
│   ├── pr_review.json         # Discord embed for PR reviews
│   ├── jira_status.json       # Discord embed for Jira transitions
│   └── seo_monitor.json       # Discord embed for SEO reports
├── settings/
│   ├── setup-guide.md         # Full setup walkthrough
│   ├── permissions.md         # Permission configuration guide
│   ├── skills.md              # Skills documentation
│   └── mcp-servers.md         # MCP server configuration guide
└── docs/
    └── plans/
        └── task-management-design.md  # Database schema design doc
```

## Database Schema

The `tasks.db` database has these tables:

| Table | Purpose |
|-------|---------|
| `organizations` | Teams/companies with Jira and Discord integration config |
| `projects` | Registered codebases with local paths and org membership |
| `tasks` | Work items with type, status, priority, and subtask support |
| `team_members` | People with GitHub, Discord, and Jira identity mapping |
| `task_status_changes` | Audit log of status transitions |
| `project_memories` | Persistent context per project (architecture notes, gotchas) |
| `memory` | General-purpose memory store |
| `agents` | Track autonomous agent runs per task (future multi-agent) |

See `docs/plans/task-management-design.md` for the full schema reference.

## Scripts

### taskctl

The main CLI for interacting with `tasks.db`:

```bash
scripts/taskctl projects              # List all projects
scripts/taskctl active                # Show in-progress/testing tasks
scripts/taskctl focus                 # Top priority tasks
scripts/taskctl dashboard             # Full focus dashboard
scripts/taskctl tasks "my-app"        # Tasks for a project
scripts/taskctl tasks "my-app" --open # Only non-done tasks
scripts/taskctl set-status 42 done    # Update task status
scripts/taskctl project-from-cwd      # Detect project from current directory
```

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

### discord-notify

Send formatted Discord notifications:

```bash
scripts/discord-notify pr-review \
  --project "my-app" \
  --github "teammate" \
  --pr-number 123 \
  --pr-title "Add search feature" \
  --pr-url "https://github.com/org/repo/pull/123" \
  --repo "org/repo"

scripts/discord-notify custom \
  --project "my-app" \
  --message "Deployment complete" \
  --title "Deploy"
```

### jira-task

Wrapper around `acli` for Jira operations:

```bash
# Set your Jira instance
export JIRA_DEFAULT_PROJECT=MYPROJECT
export JIRA_BASE_URL=https://your-instance.atlassian.net/browse

scripts/jira-task view 123            # View issue
scripts/jira-task transition 123 DONE # Change status
scripts/jira-task comment 123 "Fixed in PR #456"
scripts/jira-task search "status = 'In Progress'"
```

## How the Hooks Work

### Session Start
When you open a Claude Code session, `session-start.sh` queries `tasks.db` for your high-priority in-progress tasks and injects them as context. Claude knows what you should be working on.

## Niche Skills

### App Store Optimization (ASO) Suite

The `skills/aso/` directory contains 17 specialized skills for iOS/Android app marketing. These are domain-specific — only install them if you're doing mobile app development and App Store optimization.

Copy the ones you need:
```bash
cp -r skills/aso/* ~/.claude/skills/
```

Skills cover the full ASO pipeline: market research, keyword discovery, metadata writing, screenshot design, A/B testing, competitor analysis, localization, launch planning, featuring strategy, analytics, retention, monetization, review management, and market intelligence.

### App Store Connect

The `skills/appstoreconnect/` skill provides a workflow for managing App Store metadata via the ASC API. Requires your own API key setup (see the skill file for instructions).

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TASK_DB_PATH` | `./tasks.db` | Override database location |
| `JIRA_DEFAULT_PROJECT` | `MYPROJECT` | Default Jira project key |
| `JIRA_BASE_URL` | `https://your-instance.atlassian.net/browse` | Jira browse URL |
| `ACLI_PATH` | auto-detect | Path to Jira `acli` CLI |
| `DISCORD_DEFAULT_USER` | git user name | Default reviewer/sender name |
| `CTF_MAX_AGENTS` | `3` | Max concurrent agents |
| `CTF_STUCK_TIMEOUT` | `10` | Minutes before agent considered stuck |
| `CTF_TMUX_SESSION` | `ctf-agents` | tmux session name |

## Requirements

- macOS or Linux
- SQLite3
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- `jq` (used by hooks)
- Git + GitHub CLI (`gh`) for PR creation
- `acli` (optional, for Jira integration)
- Python 3 (used by discord-notify for template rendering)
- tmux (for multi-agent execution)

## License

MIT
