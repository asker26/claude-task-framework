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

-- PR cockpit (v5): open PRs across the org, local review runs, sessions and claims
CREATE TABLE IF NOT EXISTS prs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT, author TEXT, url TEXT,
    base_ref TEXT, head_ref TEXT, head_sha TEXT,
    is_draft INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'open',
    mergeable TEXT, checks TEXT, review_decision TEXT,
    additions INTEGER, deletions INTEGER, changed_files INTEGER,
    gh_created_at DATETIME, gh_updated_at DATETIME,
    last_commit_at DATETIME, last_comment_at DATETIME,
    my_review_state TEXT, my_review_sha TEXT, my_review_at DATETIME,
    skip_until DATETIME, skip_reason TEXT,
    synced_at DATETIME,
    UNIQUE(repo, number)
);
CREATE INDEX IF NOT EXISTS idx_prs_state ON prs(state);

CREATE TABLE IF NOT EXISTS pr_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL REFERENCES prs(id),
    head_sha TEXT NOT NULL,
    status TEXT NOT NULL,
    verdict TEXT,
    report_path TEXT, log_path TEXT,
    cli_session_id TEXT,
    tmux_window TEXT, pid INTEGER, heartbeat_at DATETIME,
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME, finished_at DATETIME, posted_at DATETIME,
    gh_review_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_pr_reviews_pr_status ON pr_reviews(pr_id, status);

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    cwd TEXT, repo TEXT, label TEXT,
    kind TEXT NOT NULL DEFAULT 'interactive',
    deck_tab_id TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_sessions_live ON sessions(ended_at, last_seen_at);

CREATE TABLE IF NOT EXISTS pr_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL REFERENCES prs(id),
    session_id TEXT NOT NULL REFERENCES sessions(id),
    note TEXT,
    claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    released_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_pr_claims_open ON pr_claims(pr_id, released_at);

CREATE TABLE IF NOT EXISTS pr_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('max_diff', '3000'), ('stale_author_days', '3'), ('stale_days', '7'), ('model', 'claude-sonnet-5'), ('max_reviews', '1');

DROP VIEW IF EXISTS pr_board;
CREATE VIEW pr_board AS
WITH cfg AS (
    SELECT CAST(COALESCE((SELECT value FROM pr_settings WHERE key = 'max_diff'), '3000') AS INTEGER) AS max_diff,
           CAST(COALESCE((SELECT value FROM pr_settings WHERE key = 'stale_author_days'), '3') AS REAL) AS stale_author_days,
           CAST(COALESCE((SELECT value FROM pr_settings WHERE key = 'stale_days'), '7') AS REAL) AS stale_days,
           (SELECT value FROM pr_settings WHERE key = 'gh_login') AS me
),
active AS (
    SELECT r.* FROM pr_reviews r
    WHERE r.id = (SELECT r2.id FROM pr_reviews r2
                  WHERE r2.pr_id = r.pr_id AND r2.status IN ('queued', 'running', 'staged', 'failed')
                  ORDER BY r2.id DESC LIMIT 1)
),
claim_list AS (
    SELECT c.pr_id, group_concat(COALESCE(s.label, substr(s.id, 1, 4)), ',') AS claims
    FROM pr_claims c JOIN sessions s ON s.id = c.session_id
    WHERE c.released_at IS NULL AND s.kind <> 'worker'
    GROUP BY c.pr_id
),
base AS (
    SELECT p.*,
           (p.author = cfg.me) AS is_mine,
           a.id AS active_review_id, a.status AS active_review_status, a.verdict AS active_review_verdict,
           (a.status = 'staged' AND a.head_sha <> p.head_sha) AS active_review_behind,
           cl.claims,
           (COALESCE(p.additions, 0) + COALESCE(p.deletions, 0) > cfg.max_diff) AS too_big,
           CAST(julianday('now') - julianday(p.gh_created_at) AS INTEGER) AS age_days,
           CAST(julianday('now') - julianday(p.my_review_at) AS INTEGER) AS waiting_days,
           julianday('now') - julianday(p.my_review_at) AS waiting_days_real,
           julianday('now') - julianday(MAX(COALESCE(p.last_commit_at, ''), COALESCE(p.last_comment_at, ''), COALESCE(p.gh_updated_at, ''))) AS idle_days,
           cfg.stale_author_days, cfg.stale_days,
           CASE
             WHEN p.author = cfg.me THEN 'mine'
             WHEN p.is_draft = 1 THEN 'draft'
             WHEN a.status IN ('queued', 'running') THEN 'running'
             WHEN a.status = 'staged' THEN 'staged'
             WHEN a.status = 'failed' AND a.attempts >= 2 THEN 'review-failed'
             WHEN p.skip_until IS NOT NULL AND p.skip_until > datetime('now') THEN 'skipped'
             WHEN p.my_review_sha IS NOT NULL AND p.my_review_sha <> p.head_sha THEN 're-review'
             WHEN p.my_review_sha IS NULL THEN 'needs-review'
             WHEN p.last_comment_at IS NOT NULL AND p.last_comment_at > p.my_review_at THEN 'author-replied'
             WHEN p.my_review_state = 'CHANGES_REQUESTED' THEN 'waiting-author'
             WHEN p.my_review_state = 'APPROVED' THEN 'approved'
             ELSE 'commented'
           END AS status
    FROM prs p
    CROSS JOIN cfg
    LEFT JOIN active a ON a.pr_id = p.id
    LEFT JOIN claim_list cl ON cl.pr_id = p.id
    WHERE p.state = 'open'
)
SELECT b.*,
       CASE WHEN b.status = 'approved' AND b.mergeable = 'MERGEABLE' AND b.checks = 'SUCCESS' THEN 1
            WHEN b.status = 'mine' AND b.review_decision = 'APPROVED' AND b.mergeable = 'MERGEABLE' AND b.checks = 'SUCCESS' THEN 1
            ELSE 0 END AS ready,
       CASE WHEN b.status = 'waiting-author' AND b.waiting_days_real > b.stale_author_days THEN 1
            WHEN b.idle_days > b.stale_days THEN 1
            ELSE 0 END AS stale,
       (b.mergeable = 'CONFLICTING') AS conflicts,
       (b.checks = 'FAILURE') AS ci_red
FROM base b;
SQL

echo "Created tasks.db at: $DB"
echo ""
echo "Quick start:"
echo "  ./scripts/taskctl add-org \"My Team\""
echo "  ./scripts/taskctl add-project \"my-app\" --org \"My Team\" --path ~/projects/my-app"
echo "  ./scripts/taskctl add-task \"First feature\" --project \"my-app\" --priority high"
echo "  ./scripts/taskctl dashboard"
