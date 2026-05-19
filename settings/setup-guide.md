# Claude Code Setup Guide

Step-by-step guide to replicate this Claude Code configuration on a new machine.

## Prerequisites

- macOS or Linux
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- Node.js and npm (for MCP servers)
- Git and GitHub CLI (`gh`) installed
- SQLite3 (comes with macOS)

## Step 1: Global Settings

Create `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "WebFetch",
      "WebSearch",
      "Bash(sqlite3:*)",
      "Bash(ls:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git show:*)",
      "Bash(git status:*)",
      "Bash(git blame:*)",
      "Bash(git rev-parse:*)",
      "Bash(git ls-files:*)",
      "Bash(git shortlog:*)",
      "Bash(git stash list:*)",
      "Bash(gh pr view:*)",
      "Bash(gh pr list:*)",
      "Bash(gh pr diff:*)",
      "Bash(gh pr checks:*)",
      "Bash(gh issue view:*)",
      "Bash(gh issue list:*)",
      "Bash(gh repo view:*)",
      "Bash(gh run view:*)",
      "Bash(gh run list:*)"
    ]
  },
  "enabledPlugins": {
    "pr-review-toolkit@claude-plugins-official": true,
    "frontend-design@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true
  }
}
```

See [permissions.md](permissions.md) for what each rule does and why.

## Step 2: Install Skills

Skills go in `~/.claude/skills/{skill-name}/SKILL.md`. The full skill set is documented in [skills.md](skills.md).

**Essential skills to install first:**
1. **feature** — autonomous end-to-end feature implementation
2. **bugfix** — autonomous bug diagnosis and fix
3. **refactor** — autonomous refactor with safe batching

These are included in the `skills/` directory of this repo. Copy them to `~/.claude/skills/`.

## Step 3: Project CLAUDE.md

Create a `CLAUDE.md` in your home directory (or project root) that tells Claude about your environment, conventions, and tools. This is the most important file — it's loaded into every conversation.

Key sections to include:
- **Environment** — OS, languages, project locations
- **Conventions** — coding standards, documentation patterns
- **Tools** — CLIs, APIs, infrastructure details
- **Autonomy rules** — what Claude can do without asking vs. what requires approval

See `CLAUDE.md.example` in this repo as a starting template.

## Step 4: MCP Servers (Optional)

Add external tool integrations. See [mcp-servers.md](mcp-servers.md) for details.

Common MCP servers:
- **Shopify Dev** — Shopify app development docs
- **Context7** — library documentation lookup
- **Paddle** — billing/subscription management

## Step 5: Project-Level Config

For each project, you can add:

1. **`.claude/settings.local.json`** (gitignored) — project-specific permissions and MCP approvals
2. **`.claude/skills/`** — project-specific skills
3. **`.mcp.json`** — project-specific MCP servers
4. **`CLAUDE.md`** in the project root — project-specific instructions

## Step 6: Task Management

**Fastest path:** Run the setup wizard — it handles everything below:
```bash
./setup.sh
```

**Manual setup:**

1. Clone this repo
2. Run `./init-db.sh` to create an empty `tasks.db` with the full schema
3. Use `./scripts/taskctl add-org`, `add-project`, `add-task` to populate your data
4. Run `./scripts/doctor` to verify everything is configured correctly
5. Claude queries this database for scope checks, priority management, and task tracking
6. See `docs/plans/task-management-design.md` for the full design

## Configuration File Summary

| File | Scope | Gitignored? | Purpose |
|------|-------|-------------|---------|
| `~/.claude/settings.json` | Global | N/A | Permissions, plugins, global MCP |
| `~/.claude/skills/*/SKILL.md` | Global | N/A | Skills available everywhere |
| `~/CLAUDE.md` | Home dir | N/A | Environment and conventions |
| `.claude/settings.json` | Project | No (shared) | Team permissions and hooks |
| `.claude/settings.local.json` | Project | Yes | Personal overrides |
| `.claude/skills/*.md` | Project | No (shared) | Project-specific skills |
| `.mcp.json` | Project | Depends | MCP server configs |
| `CLAUDE.md` | Project | No (shared) | Project instructions |

## Customizing for Your Team

1. **Permissions** — start with the read-only set, add more as you identify friction points
2. **Skills** — only install what matches your stack
3. **CLAUDE.md** — adapt to your infrastructure. Replace placeholder references with your tools.
4. **MCP servers** — add servers for the APIs you actually use (Stripe, Paddle, Shopify, etc.)
5. **Hooks** — the autonomous orchestration hooks are optional but powerful for focus management and multi-project workflows
