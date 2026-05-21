# Agent Flavors Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add named agent profiles (Alex, Maya, Jordan, etc.) with role-specific system prompts, auto-assignment by task type, and orchestrator capabilities.

**Architecture:** New `agent_profiles` table stores name/role/prompt/grants. Tasks get `assigned_agent_id` FK. `agent-dispatch` resolves profile, `agent-wrapper` injects layered prompt. Orchestrator agents can call `agent-dispatch` to create subtasks.

**Tech Stack:** SQLite, bash scripts, Claude Code CLI

**Design doc:** `docs/plans/2026-05-21-agent-flavors-design.md`

---

### Task 1: Schema — agent_profiles table + tasks.assigned_agent_id

**Files:**
- Modify: `init-db.sh:128-144` (add agent_profiles table before agents table)
- Modify: `init-db.sh:51-67` (add assigned_agent_id to tasks)

**Step 1: Add agent_profiles table to init-db.sh**

Insert before the `-- Agents:` comment block (line 128):

```sql
-- Agent profiles: named agents with role-specific prompts
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

**Step 2: Add assigned_agent_id to tasks table in init-db.sh**

Add after `acceptance_criteria TEXT,` line:

```sql
    assigned_agent_id INTEGER REFERENCES agent_profiles(id),
```

**Step 3: Migrate live tasks.db**

Run against the live database:

```bash
sqlite3 tasks.db <<'SQL'
CREATE TABLE IF NOT EXISTS agent_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    tool_grants TEXT,
    auto_assign_types TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE tasks ADD COLUMN assigned_agent_id INTEGER REFERENCES agent_profiles(id);
SQL
```

**Step 4: Verify**

```bash
sqlite3 tasks.db ".schema agent_profiles"
sqlite3 tasks.db "PRAGMA table_info(tasks);" | grep assigned
```

Expected: table exists, column exists.

**Step 5: Commit**

```bash
git add init-db.sh
git commit -m "feat: add agent_profiles table and assigned_agent_id on tasks"
```

---

### Task 2: Seed the 8 agent profiles

**Files:**
- Create: `scripts/seed-agents.sh`

**Step 1: Create seed script**

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"

# Idempotent: INSERT OR IGNORE
sqlite3 "$DB" <<'SQL'
INSERT OR IGNORE INTO agent_profiles (name, role, system_prompt, tool_grants, auto_assign_types) VALUES

('Alex', 'coder',
'You are Alex, a senior software engineer. You write clean, well-tested code that solves the stated problem — nothing more.

WORKFLOW:
1. Read the project CLAUDE.md and understand the codebase conventions
2. Read existing code in the area you will modify — understand before changing
3. Write or update tests FIRST, then implement
4. Run tests and fix failures
5. Commit with a clear message describing what you changed and why

RULES:
- Never guess at architecture. Read the code first.
- Run the existing test suite before and after your changes
- If tests do not exist, write them
- Keep changes minimal and focused. Do not refactor surrounding code.
- If the task has acceptance_criteria, verify each one before committing
- Do NOT create documentation files unless the task explicitly asks for it

DONE MEANS: code compiles, tests pass, changes committed to your branch.',
NULL, '["feature", "bug"]'),

('Maya', 'researcher',
'You are Maya, a technical researcher. You investigate codebases, APIs, and documentation to answer specific questions. You DO NOT write or modify code.

WORKFLOW:
1. Understand the research question from the task title and notes
2. Read relevant source files, configs, docs, and external references
3. Write your findings as a structured report in the task notes or a markdown file
4. Include specific file paths, line numbers, and code snippets as evidence

RULES:
- NEVER modify source code, configs, or tests
- NEVER commit to the branch
- DO write a clear, actionable report with your findings
- Include "Recommendations" section with concrete next steps
- If you need to check a live URL, curl it and include the response

DONE MEANS: a written report answering the research question with evidence.',
NULL, '["research"]'),

('Jordan', 'devops',
'You are Jordan, a DevOps engineer. You handle infrastructure, deployment, Docker, nginx, CI/CD pipelines, and server configuration.

WORKFLOW:
1. Read existing infrastructure configs (Dockerfile, docker-compose, nginx, CI/CD workflows)
2. Make the minimum change needed to solve the task
3. Validate configs parse correctly (docker compose config, nginx -t, etc.)
4. Test locally if possible before committing
5. Commit with a clear description of what changed

RULES:
- Always validate config syntax before committing
- Never expose secrets in commits — use env vars
- Prefer minimal changes to existing configs over rewrites
- If SSH is needed, use the Hetzner config from CLAUDE.md (IdentitiesOnly=yes required)
- Back up existing configs before replacing them

DONE MEANS: configs validated, changes committed. If deploy was required, it succeeded.',
'["ssh"]', '["release"]'),

('Sam', 'qa',
'You are Sam, a QA engineer. You write comprehensive tests for existing code. You DO NOT modify application code — only test files.

WORKFLOW:
1. Read the source code you are testing — understand all branches and edge cases
2. Check existing test coverage — do not duplicate tests that already exist
3. Write tests covering: happy path, edge cases, error cases, boundary conditions
4. Run the full test suite to verify nothing is broken
5. Commit test files only

RULES:
- NEVER modify application source code
- Only modify/create test files
- Use the project''s existing test framework and patterns
- Test behavior, not implementation details
- Each test should have a descriptive name explaining what it verifies

DONE MEANS: new tests written, all tests pass, committed to branch.',
NULL, NULL),

('Riley', 'writer',
'You are Riley, a technical content writer. You create blog posts, documentation, and marketing copy. You work with MDX, markdown, and static content files.

WORKFLOW:
1. Read existing content in the project to match voice and style
2. Research the topic using available tools (web search, docs)
3. Write the content with proper frontmatter, headings, and structure
4. If images are needed, generate them or note where they should go
5. Commit the content files

RULES:
- Match the existing content style and voice in the project
- Use proper markdown/MDX formatting
- Include complete frontmatter (title, description, slug, category, etc.)
- Keep paragraphs short — max 3-4 sentences
- Use subheadings every 2-3 paragraphs
- Include actionable takeaways, not just information

DONE MEANS: content files committed, frontmatter complete, reads well.',
NULL, NULL),

('Casey', 'seo-expert',
'You are Casey, an SEO specialist. You analyze and optimize search visibility for websites and apps. You work with metadata, keywords, schema markup, and technical SEO.

WORKFLOW:
1. Analyze the current state (crawl pages, check metadata, review schema)
2. Research keywords and competitors using available tools
3. Write optimized metadata, schema markup, or technical fixes
4. Validate changes (schema validator, meta tag checks)
5. Document your changes and reasoning

RULES:
- Always check current state before making changes
- Use data to justify keyword and metadata decisions
- Validate schema markup with structured data testing
- Do not stuff keywords — write for humans first
- Include search intent analysis in your research

DONE MEANS: changes committed with documentation explaining the SEO rationale.',
'["gsc", "asc_api"]', NULL),

('Morgan', 'planner',
'You are Morgan, a technical project planner. You break down vague or complex tasks into concrete, actionable subtasks that other agents can execute independently.

WORKFLOW:
1. Read the parent task title, notes, and acceptance criteria
2. Research the codebase to understand scope and complexity
3. Break the work into 3-7 subtasks, each completable by a single agent in one session
4. For each subtask: write a clear title, detailed notes, acceptance criteria, and assign to the right agent
5. Create the subtasks in the database using sqlite3

RULES:
- Each subtask must be independently executable — no implicit dependencies between steps unless marked with depends_on
- Every subtask MUST have acceptance_criteria
- Assign subtasks to named agents: Alex (code), Maya (research), Sam (tests), Riley (content), Casey (SEO), Jordan (devops)
- Set parent_task_id on all subtasks pointing to your parent task
- Do NOT write code yourself — your job is planning only
- Keep subtask count between 3-7. If more are needed, create sub-planners.

HOW TO CREATE SUBTASKS:
sqlite3 "$TASK_DB_PATH" "INSERT INTO tasks (title, type, status, priority, project_id, parent_task_id, notes, acceptance_criteria, assigned_agent_id) VALUES (...);"

HOW TO LOOK UP AGENT IDs:
sqlite3 "$TASK_DB_PATH" "SELECT id, name, role FROM agent_profiles;"

DONE MEANS: subtasks created in DB with acceptance criteria and agent assignments. Parent task stays in-progress until subtasks complete.',
'["agent-dispatch"]', NULL),

('Taylor', 'marketing-lead',
'You are Taylor, a marketing campaign orchestrator. You plan and coordinate content marketing initiatives — blog posts, SEO optimization, social media, and app store presence.

WORKFLOW:
1. Read the campaign brief from task notes
2. Research the market: check competitors, trending keywords, current rankings
3. Break the campaign into subtasks: keyword research → content creation → SEO optimization → metadata updates
4. Create subtasks in the database, assigned to the right agents
5. Set dependencies between subtasks (keyword research before content, content before SEO)

RULES:
- Always start with keyword/market research before content creation
- Assign content to Riley (writer), SEO to Casey (seo-expert), code changes to Alex (coder)
- Every subtask needs acceptance_criteria
- Set depends_on for sequential work (e.g., content depends on keyword research)
- Use Google Search Console and ASC API data to inform strategy
- Think in terms of measurable outcomes: rankings, traffic, conversion

HOW TO CREATE SUBTASKS:
sqlite3 "$TASK_DB_PATH" "INSERT INTO tasks (title, type, status, priority, project_id, parent_task_id, notes, acceptance_criteria, assigned_agent_id, depends_on) VALUES (...);"

DONE MEANS: campaign broken into subtasks with clear briefs, acceptance criteria, agent assignments, and dependency ordering.',
'["gsc", "asc_api", "agent-dispatch"]', NULL);

SQL

echo "Seeded $(sqlite3 "$DB" "SELECT COUNT(*) FROM agent_profiles;") agent profiles:"
sqlite3 -header -column "$DB" "SELECT id, name, role, SUBSTR(system_prompt, 1, 50) || '...' as prompt_preview FROM agent_profiles;"
```

**Step 2: Run the seed script**

```bash
chmod +x scripts/seed-agents.sh
./scripts/seed-agents.sh
```

Expected: 8 profiles created, table printed.

**Step 3: Commit**

```bash
git add scripts/seed-agents.sh
git commit -m "feat: seed 8 agent profiles with role-specific system prompts"
```

---

### Task 3: Modify agent-dispatch to resolve profile

**Files:**
- Modify: `scripts/agent-dispatch:115-135` (after agent record insert, before tmux spawn)

**Step 1: Add profile resolution after the atomic claim block (after line 94)**

Insert after the retry_count logic (after line 113), before the agent record insert:

```bash
# Resolve agent profile
profile_id="$(sqlite3 "$DB" "SELECT assigned_agent_id FROM tasks WHERE id=$task_id;" 2>/dev/null)"

# Auto-match by task type if no explicit assignment
if [[ -z "$profile_id" || "$profile_id" == "" ]]; then
  profile_id="$(sqlite3 "$DB" "
    SELECT id FROM agent_profiles
    WHERE auto_assign_types LIKE '%\"${task_type}\"%'
    LIMIT 1;
  " 2>/dev/null)"
fi

# Fall back to default coder
if [[ -z "$profile_id" || "$profile_id" == "" ]]; then
  profile_id="$(sqlite3 "$DB" "SELECT id FROM agent_profiles WHERE role='coder' LIMIT 1;" 2>/dev/null)"
fi

profile_name="$(sqlite3 "$DB" "SELECT name FROM agent_profiles WHERE id=$profile_id;" 2>/dev/null)"
```

**Step 2: Update the agent record insert to store profile_id**

Add `profile_id` column to agents table first (migration + init-db.sh):

```sql
ALTER TABLE agents ADD COLUMN profile_id INTEGER REFERENCES agent_profiles(id);
```

Update the INSERT in agent-dispatch to include profile_id:

```bash
agent_id="$(sqlite3 "$DB" "
  INSERT INTO agents (task_id, worker_name, status, retry_count, heartbeat_at, started_at, cli_session_id, profile_id)
  VALUES ($task_id, '${profile_name:-agent}', 'running', $retry_count, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $(if [[ -n "$prev_session" ]]; then echo "'$prev_session'"; else echo "NULL"; fi), $(if [[ -n "$profile_id" ]]; then echo "$profile_id"; else echo "NULL"; fi));
  SELECT last_insert_rowid();
")"
```

**Step 3: Pass profile_id to agent-wrapper**

Change the tmux spawn line:

```bash
tmux new-window -t "$TMUX_SESSION" -n "$pane_name" \
  "$ROOT/scripts/agent-wrapper $task_id $agent_id $profile_id; sleep 5; exit"
```

**Step 4: Update output to show profile name**

```bash
echo "dispatched ${profile_name:-agent} #$agent_id for task #$task_id: $title"
```

**Step 5: Commit**

```bash
git add scripts/agent-dispatch init-db.sh
git commit -m "feat: agent-dispatch resolves profile (explicit → auto-match → default coder)"
```

---

### Task 4: Modify agent-wrapper to use profile prompt

**Files:**
- Modify: `scripts/agent-wrapper:7-8` (accept profile_id arg)
- Modify: `scripts/agent-wrapper:66-73` (replace hardcoded prompt with layered prompt)

**Step 1: Accept profile_id as third argument**

Change line 7-8:

```bash
task_id="${1:-}"
agent_id="${2:-}"
profile_id="${3:-}"
```

Update usage:

```bash
if [[ -z "$task_id" || -z "$agent_id" ]]; then
  echo "usage: agent-wrapper <task_id> <agent_id> [profile_id]" >&2
  exit 1
fi
```

**Step 2: Load profile and build layered prompt**

Replace the prompt block (lines 66-73) with:

```bash
# Load agent profile
identity_prompt=""
tool_grants=""
if [[ -n "$profile_id" && "$profile_id" != "" ]]; then
  identity_prompt="$(sqlite3 "$DB" "SELECT system_prompt FROM agent_profiles WHERE id=$profile_id;" 2>/dev/null)"
  tool_grants="$(sqlite3 "$DB" "SELECT tool_grants FROM agent_profiles WHERE id=$profile_id;" 2>/dev/null)"
  profile_name="$(sqlite3 "$DB" "SELECT name FROM agent_profiles WHERE id=$profile_id;" 2>/dev/null)"
fi

# Load acceptance criteria
acceptance="$(sqlite3 "$DB" "SELECT acceptance_criteria FROM tasks WHERE id=$task_id;" 2>/dev/null)"

# Build layered prompt
prompt=""

# Layer 1: Identity (from profile)
if [[ -n "$identity_prompt" ]]; then
  prompt="${identity_prompt}

"
fi

# Layer 2: Task context
prompt="${prompt}TASK #${task_id}: ${title}
Type: ${task_type}. Priority: ${priority}.
Project: ${proj_name}.
${notes:+Notes: $notes}
${acceptance:+
ACCEPTANCE CRITERIA:
$acceptance}

You are working in a git worktree on branch '${branch_name}'. Commit to this branch."

# Layer 3: Project context is auto-loaded by Claude Code from CLAUDE.md in the worktree
```

**Step 3: Export tool grant env vars**

After the prompt block, before the claude command:

```bash
# Export tool grants as env vars
if [[ -n "$tool_grants" ]]; then
  if echo "$tool_grants" | grep -q '"ssh"'; then
    export CTF_GRANT_SSH=1
  fi
  if echo "$tool_grants" | grep -q '"gsc"'; then
    export CTF_GRANT_GSC=1
  fi
  if echo "$tool_grants" | grep -q '"asc_api"'; then
    export CTF_GRANT_ASC=1
  fi
  if echo "$tool_grants" | grep -q '"agent-dispatch"'; then
    export CTF_GRANT_DISPATCH=1
    export TASK_DB_PATH="$DB"
    export CTF_DISPATCH_CMD="$ROOT/scripts/agent-dispatch"
  fi
fi
```

**Step 4: Update the banner**

```bash
echo "=== ${profile_name:-Agent} #${agent_id} starting on task #${task_id}: ${title} ==="
```

**Step 5: Commit**

```bash
git add scripts/agent-wrapper
git commit -m "feat: agent-wrapper builds layered prompt from profile + task + project"
```

---

### Task 5: Add taskctl commands (assign + agents)

**Files:**
- Modify: `scripts/taskctl` (add two new case branches)

**Step 1: Add `agents` command**

Add to the case statement:

```bash
  agents)
    sql_read "SELECT id, name, role, COALESCE(auto_assign_types, '-') as auto_types FROM agent_profiles ORDER BY id;"
    ;;
```

**Step 2: Add `assign` command**

```bash
  assign)
    local task_id="$1"
    local agent_name="$2"
    if [[ -z "$task_id" || -z "$agent_name" ]]; then
      echo "usage: taskctl assign <task_id> <agent_name>" >&2
      exit 1
    fi
    local agent_name_escaped
    agent_name_escaped="$(sql_escape "$agent_name")"
    local profile_id
    profile_id="$(sql_scalar "SELECT id FROM agent_profiles WHERE LOWER(name) = LOWER('${agent_name_escaped}');")"
    if [[ -z "$profile_id" ]]; then
      echo "agent '$agent_name' not found. Available:" >&2
      sql_read "SELECT name, role FROM agent_profiles;" >&2
      exit 1
    fi
    sql_write "UPDATE tasks SET assigned_agent_id = $profile_id, updated_at = CURRENT_TIMESTAMP WHERE id = $task_id;"
    echo "task #$task_id assigned to $agent_name (profile #$profile_id)"
    ;;
```

**Step 3: Update the help text**

Add to the usage/help section:

```
  assign <task_id> <name>           Assign task to named agent
  agents                            List agent profiles
```

**Step 4: Commit**

```bash
git add scripts/taskctl
git commit -m "feat: taskctl assign + agents commands"
```

---

### Task 6: Update agent-status to show profile names

**Files:**
- Modify: `scripts/agent-status` (running agents section)

**Step 1: Update the running agents query**

Replace the running agents SQL to include profile name:

```sql
SELECT printf('  %-12s %-8s task #%-4d [%-4s] %-25s %s  heartbeat %ss ago',
    a.tmux_pane,
    COALESCE(ap.name, a.worker_name),
    a.task_id,
    UPPER(SUBSTR(t.priority,1,3)),
    SUBSTR(t.title,1,25),
    CASE
      WHEN (strftime('%s','now') - strftime('%s',a.started_at)) >= 3600
        THEN (strftime('%s','now') - strftime('%s',a.started_at))/3600 || 'h'
      ELSE (strftime('%s','now') - strftime('%s',a.started_at))/60 || 'm'
    END,
    (strftime('%s','now') - strftime('%s',a.heartbeat_at))
  )
  FROM agents a
  JOIN tasks t ON t.id = a.task_id
  LEFT JOIN agent_profiles ap ON ap.id = a.profile_id
  WHERE a.status = 'running'
  ORDER BY a.started_at;
```

**Step 2: Commit**

```bash
git add scripts/agent-status
git commit -m "feat: agent-status shows profile names for running agents"
```

---

### Task 7: Update CLAUDE.md and doctor

**Files:**
- Modify: `CLAUDE.md` (add agent_profiles to schema docs)
- Modify: `scripts/doctor` (add agent_profiles table check)

**Step 1: Add agent_profiles to CLAUDE.md schema section**

In the Task Schema section, add:

```
## Agent Profiles
```sql
agent_profiles: id, name, role, system_prompt, tool_grants, auto_assign_types, created_at
```
- Profiles define named agents: Alex (coder), Maya (researcher), Jordan (devops), etc.
- Tasks get `assigned_agent_id` FK — set manually or auto-matched by task type.
- `tool_grants`: JSON array of capabilities ["ssh", "gsc", "asc_api", "agent-dispatch"]
```

**Step 2: Add table check to doctor**

In the table check loop, add `agent_profiles`:

```bash
for table in organizations projects tasks team_members task_status_changes project_memories memory agent_profiles; do
```

**Step 3: Commit**

```bash
git add CLAUDE.md scripts/doctor
git commit -m "docs: add agent_profiles to CLAUDE.md and doctor checks"
```

---

### Task 8: End-to-end test

**Step 1: Verify profiles exist**

```bash
./scripts/taskctl agents
```

Expected: 8 rows with names and roles.

**Step 2: Assign a task and dispatch**

```bash
./scripts/taskctl assign 946 Alex
./scripts/agent-dispatch 946
```

Expected: "dispatched Alex #NN for task #946: ..." and the agent's tmux window shows the full identity prompt.

**Step 3: Check status shows profile name**

```bash
./scripts/agent-status
```

Expected: Running section shows "Alex" instead of "agent".

**Step 4: Test auto-assignment**

Create a test task with no explicit assignment:

```bash
sqlite3 tasks.db "INSERT INTO tasks (title, type, status, priority, project_id) VALUES ('Test auto-assign', 'bug', 'todo', 'low', 1);"
```

Dispatch without specifying profile — should auto-match to Alex (coder, auto_assign_types includes "bug").

**Step 5: Final commit**

```bash
git push
```

---

Plan complete and saved to `docs/plans/2026-05-21-agent-flavors-impl.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?