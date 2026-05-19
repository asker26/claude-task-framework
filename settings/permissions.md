# Permissions Configuration

Claude Code uses a permission system to control which tools can run without manual approval. Without permissions configured, every web search, git command, and database query requires you to click "Allow" — which gets painful fast during research sessions (50+ URLs) or multi-step workflows.

## How Permissions Work

Permissions are defined in `~/.claude/settings.json` under `permissions.allow`. Each rule is a string that matches a tool name and optionally a command prefix.

**Syntax:**
- `"ToolName"` — allows ALL uses of that tool (e.g., `"WebSearch"` allows all web searches)
- `"Bash(command:*)"` — allows bash commands starting with `command` (prefix matching)
- `"Bash(exact command here)"` — allows only that exact command

**Settings file location:** `~/.claude/settings.json` (global, applies to all projects)

## Recommended Setup

### Web Research (no prompts)

```json
"WebFetch",
"WebSearch"
```

**Why:** Research tasks often involve fetching 20-50+ URLs. Approving each one manually breaks flow and adds no safety value — these are read-only operations.

### Directory Listing

```json
"Bash(ls:*)"
```

**Why:** `ls` is read-only — it just lists directory contents. Claude uses it frequently to understand project structure before making changes.

### Database Queries

```json
"Bash(sqlite3:*)"
```

**Why:** SQLite is used for task management (`tasks.db`). Every scope check, priority query, and task update needs sqlite3. These are local database operations with no external risk.

### Git — Read-Only

```json
"Bash(git log:*)",
"Bash(git diff:*)",
"Bash(git show:*)",
"Bash(git status:*)",
"Bash(git blame:*)",
"Bash(git rev-parse:*)",
"Bash(git ls-files:*)",
"Bash(git shortlog:*)",
"Bash(git stash list:*)"
```

**Why:** These are all read-only git commands — they inspect the repo but never modify it. Auto-allowing them speeds up every workflow that needs to check state.

**What's NOT allowed (still prompts):**
- `git commit` — creates permanent history
- `git push` — sends to remote
- `git checkout` / `git switch` — changes working tree
- `git reset` — destructive
- `git branch -D` — deletes branches

We specifically avoided `Bash(git branch:*)` because prefix matching would also allow `git branch -D` (delete).

### GitHub CLI — Read-Only

```json
"Bash(gh pr view:*)",
"Bash(gh pr list:*)",
"Bash(gh pr diff:*)",
"Bash(gh pr checks:*)",
"Bash(gh issue view:*)",
"Bash(gh issue list:*)",
"Bash(gh repo view:*)",
"Bash(gh run view:*)",
"Bash(gh run list:*)"
```

**Why:** Same principle as git — reading PRs, issues, and CI status is safe. Creating/closing/commenting on PRs still requires approval.

**What's NOT allowed:**
- `gh pr create` — creates a PR visible to the team
- `gh issue create` — creates public issues
- `gh pr merge` — merges code
- `gh api` — could make POST/DELETE requests

### What to Keep Behind Prompts

| Command | Risk | Why it stays locked |
|---------|------|-------------------|
| `rm` | Deletes files | Irreversible data loss |
| `ssh` | Remote access | Production server access |
| `sudo` | Elevated privileges | System-level changes |
| `chmod` | Permission changes | Security implications |
| `git push --force` | Overwrites remote | Destroys team's work |
| `docker` | Container ops | Can affect running services |
| `npm install` | Package install | Supply chain risk |

## How to Set Up

1. Open (or create) `~/.claude/settings.json`
2. Add the `permissions` block:

```json
{
  "permissions": {
    "allow": [
      "WebFetch",
      "WebSearch",
      "Bash(sqlite3:*)",
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
  }
}
```

3. Restart Claude Code for changes to take effect.

## Adding More Permissions

If you find yourself constantly approving the same command, add it to the allow list. The rule of thumb:

- **Read-only operations** -> safe to auto-allow
- **Local-only operations** (no network) -> usually safe
- **Write operations** (commits, pushes, file deletes) -> keep behind prompts
- **Network operations** (SSH, deploy, API mutations) -> keep behind prompts

## Project-Level Permissions

You can also set permissions per-project in `.claude/settings.local.json` (gitignored) or `.claude/settings.json` (committed, shared with team). Project settings merge with global settings — they add to the allow list, they don't replace it.
