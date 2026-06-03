#!/bin/bash
# Initialize an empty tasks.db with the full schema.
# Run this once after cloning the repo.
set -e

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$REPO/tasks.db"

if [[ -f "$DB" ]]; then
  echo "tasks.db already exists at: $DB"
  echo "Delete it first if you want to start fresh."
  exit 1
fi

sqlite3 "$DB" <<'SQL'
-- Organizations: group projects under a team/company
CREATE TABLE organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    jira_instance TEXT,
    jira_project_key TEXT,
    discord_webhook_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_organizations_timestamp AFTER UPDATE ON organizations
BEGIN
    UPDATE organizations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Projects: registered codebases
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    github_repo TEXT,
    local_path TEXT,
    description TEXT,
    context TEXT,
    organization_id INTEGER REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_projects_timestamp AFTER UPDATE ON projects
BEGIN
    UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Sprints: time-boxed buckets of tasks (optionally scoped to a project)
CREATE TABLE sprints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    project_id INTEGER REFERENCES projects(id),
    goal TEXT,
    status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'completed', 'cancelled')),
    start_date TEXT,
    end_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_sprints_project_status ON sprints(project_id, status);

CREATE TRIGGER update_sprints_timestamp AFTER UPDATE ON sprints
BEGIN
    UPDATE sprints SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Tasks: the core work items
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'feature' CHECK(type IN ('feature', 'bug', 'research', 'video', 'release', 'other')),
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in-progress', 'in-review', 'approved', 'testing', 'done', 'paused')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
    project_id INTEGER,
    parent_task_id INTEGER,
    notes TEXT,
    due_date TEXT,
    depends_on TEXT,
    acceptance_criteria TEXT,
    assigned_agent_id INTEGER REFERENCES agent_profiles(id),
    sprint_id INTEGER REFERENCES sprints(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
    FOREIGN KEY (sprint_id) REFERENCES sprints(id)
);

CREATE INDEX idx_tasks_sprint_id ON tasks(sprint_id);

-- Team members: map GitHub/Discord/Jira identities
CREATE TABLE team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    github_username TEXT,
    discord_id TEXT,
    jira_user_id TEXT,
    organization_id INTEGER NOT NULL REFERENCES organizations(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_team_members_timestamp AFTER UPDATE ON team_members
BEGIN
    UPDATE team_members SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Task status change log
CREATE TABLE task_status_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project memories: persistent context per project (architecture notes, gotchas, etc.)
CREATE TABLE project_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'context' CHECK(type IN ('context', 'architecture', 'gotcha', 'reference', 'baseline', 'failure-mode')),
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX idx_project_memories_project_id ON project_memories(project_id);
CREATE INDEX idx_project_memories_type ON project_memories(type);

CREATE TRIGGER update_project_memories_timestamp
AFTER UPDATE ON project_memories
BEGIN
    UPDATE project_memories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- General memory store (session summaries, learnings, etc.)
CREATE TABLE memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    tags TEXT,
    started_at TEXT,
    ended_at TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Agents: track autonomous agent runs against tasks
CREATE TABLE agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id),
    profile_id INTEGER REFERENCES agent_profiles(id),
    worker_name TEXT NOT NULL DEFAULT 'agent',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
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
SQL

echo "Created tasks.db at: $DB"
echo ""
echo "Quick start:"
echo "  ./scripts/taskctl add-org \"My Team\""
echo "  ./scripts/taskctl add-project \"my-app\" --org \"My Team\" --path ~/projects/my-app"
echo "  ./scripts/taskctl add-task \"First feature\" --project \"my-app\" --priority high"
echo "  ./scripts/taskctl dashboard"
