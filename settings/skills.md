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

This repo ships with these skills:

| Skill | Purpose |
|-------|---------|
| **refactor** | Assess, plan, batch execute with tests, commit, push, PR |
| **opib** | Open anything in the browser — URLs, PR numbers, file paths |
| **list-prs** | List open PRs for the current repo in a formatted table |
| **summ** | Summarize the current session — focus, progress, next steps |
| **team-lead** | Scope gate and project switching |
| **docs-lookup** | Research latest docs before writing code |
| **isolate-workspace** | Work in isolated repo clones |

> The **feature** and **bugfix** mega-skills were removed in favor of the external **superpowers** workflow chain (see [Core Workflow (superpowers)](#core-workflow-superpowers) below). Their originals are kept under `skills-backup/`.

## Recommended Additional Skills

Install these globally at `~/.claude/skills/{name}/SKILL.md` based on your needs:

### Core Workflow (superpowers)

The dev workflow uses the **superpowers** skill set by [@obra](https://github.com/obra) — external skills installed globally in `~/.claude/skills/` (not part of this repo). They replace the removed `feature`/`bugfix` mega-skills with a gated brainstorm → plan → execute → review flow.

| Skill | Purpose | GitHub source |
|-------|---------|---------------|
| **brainstorming** | Explore intent + requirements, present a design, get approval before any code | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/brainstorming) |
| **writing-plans** | Turn an approved spec into a step-by-step implementation plan | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/writing-plans) |
| **executing-plans** | Execute a written plan with review checkpoints | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/executing-plans) |
| **test-driven-development** | Write tests before implementation code | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/test-driven-development) |
| **systematic-debugging** | Root-cause-first debugging for any bug/test failure | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) |
| **verification-before-completion** | Run verification + confirm output before claiming done | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/verification-before-completion) |
| **requesting-code-review** | Verify work meets requirements before merge | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/requesting-code-review) |
| **receiving-code-review** | Handle review feedback with technical rigor | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/receiving-code-review) |
| **finishing-a-development-branch** | Decide merge / PR / cleanup when work is complete | [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills/finishing-a-development-branch) |
| **writing-clearly-and-concisely** | Strunk's rules for any human-facing prose | [obra/the-elements-of-style](https://github.com/obra/the-elements-of-style/tree/main/skills/writing-clearly-and-concisely) |

Install all of them with the snippet in [README → Superpowers workflow skills](../README.md#superpowers-workflow-skills).

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
