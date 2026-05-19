# Skills Configuration

Skills are reusable prompt templates that teach Claude Code domain-specific knowledge and workflows. They live in `~/.claude/skills/` (global) or `.claude/skills/` (per-project).

## How Skills Work

Each skill is a markdown file with YAML frontmatter:

```markdown
---
name: skill-name
description: When to trigger this skill. Claude reads this to decide when to use it.
---

# Skill content — instructions, templates, examples
```

Claude auto-selects skills based on the `description` field matching the user's intent. You can also invoke them manually with `/skill-name`.

**Global skills location:** `~/.claude/skills/{skill-name}/SKILL.md`
**Project skills location:** `.claude/skills/{skill-name}.md`

## Included Skills

This repo ships with six skills:

| Skill | Purpose |
|-------|---------|
| **feature** | End-to-end feature: explore, plan, implement, test, commit, push, PR |
| **bugfix** | Diagnose, fix, test, commit, push — minimal changes only |
| **refactor** | Assess, plan, batch execute with tests, commit, push, PR |
| **opib** | Open anything in the browser — URLs, PR numbers, file paths |
| **list-prs** | List open PRs for the current repo in a formatted table |
| **summ** | Summarize the current session — focus, progress, next steps |

## Recommended Additional Skills

Install these globally at `~/.claude/skills/{name}/SKILL.md` based on your needs:

### Core Workflow

| Skill | Purpose |
|-------|---------|
| **brainstorming** | Explore intent and requirements before writing code |
| **writing-plans** | Create implementation plans from specs/requirements |
| **executing-plans** | Execute written plans with review checkpoints |
| **code-review-expert** | Senior engineer-level code review |
| **test-driven-development** | Write tests before implementation code |
| **docs-lookup** | Research latest documentation before writing code |
| **software-architecture** | Architecture guidance for any software project |

### Backend

| Skill | Purpose |
|-------|---------|
| **senior-backend** | Node.js, Go, Python, Postgres, GraphQL, REST |
| **dotnet-architecture** | .NET Web API project structure, EF Core patterns |
| **dotnet-best-practices** | .NET/C# code quality enforcement |
| **wordpress-pro** | WordPress themes, plugins, WooCommerce |
| **stripe-custom** | Stripe integrations and payment workflows |

### Frontend & Mobile

| Skill | Purpose |
|-------|---------|
| **ui-ux-pro-max** | UI/UX design intelligence across multiple frameworks |
| **react-native-architecture** | React Native with Expo, navigation, native modules |
| **react-native-design** | React Native styling and Reanimated animations |

## Installed Plugins

Plugins are community/official skill packs. Configured in `~/.claude/settings.json` under `enabledPlugins`:

```json
{
  "enabledPlugins": {
    "pr-review-toolkit@claude-plugins-official": true,
    "frontend-design@claude-plugins-official": true,
    "feature-dev@claude-plugins-official": true
  }
}
```

| Plugin | What It Adds |
|--------|-------------|
| **pr-review-toolkit** | PR review with specialized agents: code reviewer, comment analyzer, test analyzer, silent failure hunter |
| **frontend-design** | Creates distinctive, production-grade frontend interfaces |
| **feature-dev** | Guided feature development with codebase understanding and architecture focus |

## How to Set Up Skills

### Global Skills (for all projects)

1. Create the skill directory: `mkdir -p ~/.claude/skills/{skill-name}/`
2. Create `SKILL.md` with frontmatter and instructions
3. Claude will auto-detect it next session

### Project Skills (for one project)

1. Create `.claude/skills/` in the project root
2. Add `{skill-name}.md` files
3. These are committed to git and shared with the team

### Plugins

1. In `~/.claude/settings.json`, add to `enabledPlugins`:
   ```json
   "plugin-name@marketplace-id": true
   ```
2. Claude will install and load the plugin on next session

## Skill Chaining with Hooks

The intent-classifier hook automatically chains skills based on user intent:

| User Says | Chain Executed |
|-----------|---------------|
| "add a new feature" | explore -> plan -> implement -> test -> commit -> push -> PR |
| "fix this bug" | diagnose -> fix -> test -> commit -> push |
| "refactor this" | assess -> plan -> batch execute -> verify -> commit -> push -> PR |
| "deploy this" | execute -> verify -> report |
| "review this PR" | review -> report |

This chaining is driven by the hooks in `hooks/` and the skill definitions in `skills/`.
