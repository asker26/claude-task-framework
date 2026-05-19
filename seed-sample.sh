#!/bin/bash
# Populate tasks.db with sample data to demonstrate the framework.
# Run after init-db.sh. Safe to re-run (uses INSERT OR IGNORE where possible).
set -e

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="${TASK_DB_PATH:-$REPO/tasks.db}"

if [[ ! -f "$DB" ]]; then
  echo "tasks.db not found. Run init-db.sh first." >&2
  exit 1
fi

echo "Seeding sample data into: $DB"

sqlite3 "$DB" <<'SQL'
-- Organizations
INSERT OR IGNORE INTO organizations (name) VALUES ('Personal');
INSERT OR IGNORE INTO organizations (name, jira_instance, jira_project_key, discord_webhook_url)
  VALUES ('Acme Corp', 'https://acme.atlassian.net', 'ACME', 'https://discord.com/api/webhooks/EXAMPLE/TOKEN');

-- Projects
INSERT OR IGNORE INTO projects (name, local_path, description, organization_id)
  VALUES ('portfolio-site', '~/projects/portfolio-site', 'Personal portfolio website', (SELECT id FROM organizations WHERE name = 'Personal'));
INSERT OR IGNORE INTO projects (name, local_path, description, organization_id)
  VALUES ('side-project', '~/projects/side-project', 'Weekend experiment app', (SELECT id FROM organizations WHERE name = 'Personal'));
INSERT OR IGNORE INTO projects (name, local_path, github_repo, description, organization_id)
  VALUES ('acme-api', '~/projects/acme-api', 'https://github.com/acme/api', 'Main backend API', (SELECT id FROM organizations WHERE name = 'Acme Corp'));
INSERT OR IGNORE INTO projects (name, local_path, github_repo, description, organization_id)
  VALUES ('acme-dashboard', '~/projects/acme-dashboard', 'https://github.com/acme/dashboard', 'Admin dashboard (React)', (SELECT id FROM organizations WHERE name = 'Acme Corp'));

-- Tasks
INSERT INTO tasks (title, type, status, priority, project_id, notes)
  VALUES ('Fix auth token expiry bug', 'bug', 'in-progress', 'high', (SELECT id FROM projects WHERE name = 'acme-api'), 'Tokens expire after 1h instead of 24h');
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Add user search endpoint', 'feature', 'todo', 'high', (SELECT id FROM projects WHERE name = 'acme-api'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Write API rate limiting docs', 'other', 'todo', 'medium', (SELECT id FROM projects WHERE name = 'acme-api'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Migrate to React 19', 'feature', 'in-progress', 'medium', (SELECT id FROM projects WHERE name = 'acme-dashboard'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Fix chart rendering on mobile', 'bug', 'testing', 'medium', (SELECT id FROM projects WHERE name = 'acme-dashboard'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Redesign hero section', 'feature', 'todo', 'medium', (SELECT id FROM projects WHERE name = 'portfolio-site'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Add blog with MDX', 'feature', 'todo', 'low', (SELECT id FROM projects WHERE name = 'portfolio-site'));
INSERT INTO tasks (title, type, status, priority, project_id)
  VALUES ('Research AI features', 'research', 'paused', 'low', (SELECT id FROM projects WHERE name = 'side-project'));

-- Subtasks (children of "Add user search endpoint")
INSERT INTO tasks (title, type, status, priority, project_id, parent_task_id)
  VALUES ('Design search query schema', 'feature', 'todo', 'high', (SELECT id FROM projects WHERE name = 'acme-api'), (SELECT id FROM tasks WHERE title = 'Add user search endpoint'));
INSERT INTO tasks (title, type, status, priority, project_id, parent_task_id)
  VALUES ('Implement Elasticsearch integration', 'feature', 'todo', 'high', (SELECT id FROM projects WHERE name = 'acme-api'), (SELECT id FROM tasks WHERE title = 'Add user search endpoint'));

-- Dependencies: "Write API rate limiting docs" depends on "Add user search endpoint"
UPDATE tasks SET depends_on = '[' || (SELECT id FROM tasks WHERE title = 'Add user search endpoint') || ']'
  WHERE title = 'Write API rate limiting docs';

-- Team members
INSERT OR IGNORE INTO team_members (name, organization_id, github_username, discord_id)
  VALUES ('Alice', (SELECT id FROM organizations WHERE name = 'Acme Corp'), 'alice-dev', '123456789');
INSERT OR IGNORE INTO team_members (name, organization_id, github_username, discord_id, jira_user_id)
  VALUES ('Bob', (SELECT id FROM organizations WHERE name = 'Acme Corp'), 'bob-eng', '987654321', 'bob.smith');

-- Sample status changes
INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES (1, 'todo', 'in-progress');
INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES (4, 'todo', 'in-progress');
INSERT INTO task_status_changes (task_id, from_status, to_status) VALUES (5, 'in-progress', 'testing');
SQL

echo ""
echo "Sample data loaded:"
sqlite3 -header -column "$DB" "SELECT COUNT(*) as orgs FROM organizations;"
sqlite3 -header -column "$DB" "SELECT COUNT(*) as projects FROM projects;"
sqlite3 -header -column "$DB" "SELECT COUNT(*) as tasks FROM tasks;"
sqlite3 -header -column "$DB" "SELECT COUNT(*) as members FROM team_members;"
echo ""
echo "Try: ./scripts/taskctl dashboard"
echo "To reset: rm tasks.db && ./init-db.sh && ./seed-sample.sh"
