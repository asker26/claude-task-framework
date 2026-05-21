# Agent Flavors Design

Named agents as virtual team members with role-specific system prompts, auto-assignment, and orchestrator capabilities.

## Problem

All work agents get the same generic 3-line prompt regardless of task type. This leads to:
- Sloppy work (agents don't know what "done" looks like for their role)
- No stack awareness (agents guess at architecture instead of following conventions)
- No separation of concerns (a bug fix agent shouldn't think like a content writer)

## Architecture

### Schema: `agent_profiles` table

```sql
CREATE TABLE agent_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    tool_grants TEXT,
    auto_assign_types TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- `name` — human-readable identifier ("Alex", "Maya"). Used in conversation: "assign this to Alex."
- `role` — category: coder, researcher, reviewer, devops, qa, writer, seo-expert, planner, marketing-lead.
- `system_prompt` — full identity + behavioral instructions for the agent. Injected as the first block of the Claude prompt.
- `tool_grants` — JSON array of extra capabilities the agent gets: `["ssh", "gsc", "asc_api", "agent-dispatch"]`. Controls what the agent is allowed to do beyond default.
- `auto_assign_types` — JSON array of task types that auto-match: `["bug", "feature"]`. Used by agent-dispatch when no explicit assignment exists.

### Task assignment: `assigned_agent_id` on tasks

```sql
ALTER TABLE tasks ADD COLUMN assigned_agent_id INTEGER REFERENCES agent_profiles(id);
```

Nullable. When set, agent-dispatch uses that profile. When null, falls back to auto-match by task type, then default coder.

### Prompt layering

Three layers, concatenated by agent-wrapper:

```
[IDENTITY — agent_profiles.system_prompt]
You are Alex, a senior software engineer. You write clean, tested code...

[TASK — built from tasks table]
Task #946: Fix blog images on code-heaven.com
Type: bug. Priority: high.
Acceptance criteria: curl blog URLs, find <img> tags...

[PROJECT — auto-loaded]
CLAUDE.md from the worktree is picked up by Claude Code automatically.
```

## Roster

| Name | Role | Auto-assigns to | Tool grants | Description |
|---|---|---|---|---|
| Alex | coder | feature, bug | — | Senior dev. Writes code, runs tests, commits. |
| Maya | researcher | research | — | Investigates codebases, APIs, docs. Read-only, writes reports. No code changes. |
| Jordan | devops | release | ssh | Infrastructure, Docker, nginx, CI/CD, deploys. |
| Sam | qa | — | — | Writes and runs tests. Assigned by planner or manually. |
| Riley | writer | — | — | Blog posts, docs, marketing copy. Content-focused. |
| Casey | seo-expert | — | gsc, asc_api | Keyword research, metadata, technical SEO, schema markup. |
| Morgan | planner | — | agent-dispatch | Breaks vague tasks into subtasks with acceptance criteria. Assigns to other agents. |
| Taylor | marketing-lead | — | gsc, asc_api, agent-dispatch | Orchestrates content campaigns. Creates subtasks for writer, seo-expert, coder. |
| (unnamed) | reviewer | — | — | System role. Auto-spawned on in-review. Verifies acceptance criteria. |

## Assignment flow

1. **Manual**: User says "assign this to Alex" → sets `assigned_agent_id`.
2. **Auto-match**: agent-dispatch checks `auto_assign_types`. Task type `bug` matches Alex (coder).
3. **Default**: No match → falls back to coder profile.
4. **Orchestrator**: Planner/marketing-lead creates subtasks with `assigned_agent_id` set on each.
5. **Reviewer**: Unchanged — agent-complete spawns reviewer automatically on in-review.

## Script changes

### agent-dispatch
- After claiming a task, read `assigned_agent_id` (or auto-match).
- Pass `profile_id` to agent-wrapper.

### agent-wrapper
- Accept optional `profile_id` argument.
- Query `agent_profiles` for system_prompt and tool_grants.
- Build layered prompt: identity + task + project.
- For tool_grants: translate to env vars or CLI flags the agent session can use.

### agent-review
- No change. Reviewer stays a system role with its own prompt (already specialized).

### taskctl
- `taskctl assign <task_id> <agent_name>` — sets assigned_agent_id.
- `taskctl agents` — lists all agent profiles.

## Tool grants implementation

Tool grants are capabilities beyond the default Claude Code session:

| Grant | What it enables |
|---|---|
| `ssh` | Agent can SSH to configured servers (uses Hetzner config from CLAUDE.md) |
| `gsc` | Google Search Console API access (env vars injected) |
| `asc_api` | App Store Connect API access (key/issuer injected as env vars) |
| `agent-dispatch` | Orchestrator can call agent-dispatch to create and dispatch subtasks |

Grants are passed as env vars into the Claude session. The system prompt tells the agent what tools are available.

## System prompt guidelines

Each profile's system_prompt should:
1. Define identity and expertise area
2. State what the agent DOES and DOES NOT do
3. Define what "done" looks like for this role
4. Include role-specific verification steps (e.g., coder runs tests, writer checks readability)
5. Be opinionated — recommend approaches, don't ask open-ended questions
6. Be concise — under 500 words. Project context comes from CLAUDE.md, not the system prompt.

## Stack inference

No explicit stack assignment. The agent inherits stack knowledge from:
1. The project's CLAUDE.md (loaded automatically by Claude Code when cd'd into worktree)
2. The codebase itself (package.json, *.csproj, composer.json — the agent reads these)
3. The task notes (which can mention specific tech if relevant)

This means Alex (coder) works on Next.js when dispatched to a Next.js project, and on .NET when dispatched to a .NET project. The role prompt stays the same; the project context changes.
