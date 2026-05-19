# Task Management System — Design

## Storage

Single SQLite database at `tasks.db` in the project root.

## Schema

### organizations

| Column              | Type      | Notes                      |
|---------------------|-----------|----------------------------|
| id                  | INTEGER PK| auto-increment             |
| name                | TEXT      | unique, not null           |
| jira_instance       | TEXT      | URL, optional              |
| jira_project_key    | TEXT      | e.g. "MYPROJECT"           |
| discord_webhook_url | TEXT      | optional                   |
| created_at          | TIMESTAMP | default now                |
| updated_at          | TIMESTAMP | default now                |

### projects

| Column          | Type      | Notes                      |
|-----------------|-----------|----------------------------|
| id              | INTEGER PK| auto-increment             |
| name            | TEXT      | unique, not null           |
| github_repo     | TEXT      | URL, optional              |
| local_path      | TEXT      | absolute path, optional    |
| description     | TEXT      | context/notes              |
| context         | TEXT      | additional context         |
| organization_id | INTEGER   | FK -> organizations.id     |
| created_at      | TIMESTAMP | default now                |
| updated_at      | TIMESTAMP | default now                |

### tasks

| Column         | Type      | Notes                                          |
|----------------|-----------|-------------------------------------------------|
| id             | INTEGER PK| auto-increment                                 |
| title          | TEXT      | not null                                        |
| type           | TEXT      | feature, research, video, release, bug, other   |
| status         | TEXT      | todo, in-progress, testing, done, paused (default: todo) |
| priority       | TEXT      | high, medium, low (default: medium)             |
| project_id     | INTEGER   | FK -> projects.id, nullable                    |
| parent_task_id | INTEGER   | FK -> tasks.id, nullable (subtasks)            |
| notes          | TEXT      | free-form                                       |
| due_date       | DATE      | optional                                        |
| created_at     | TIMESTAMP | default now                                     |
| updated_at     | TIMESTAMP | default now                                     |

### team_members

| Column          | Type      | Notes                      |
|-----------------|-----------|----------------------------|
| id              | INTEGER PK| auto-increment             |
| name            | TEXT      | not null                   |
| github_username | TEXT      | optional                   |
| discord_id      | TEXT      | optional                   |
| jira_user_id    | TEXT      | optional                   |
| organization_id | INTEGER   | FK -> organizations.id     |
| created_at      | TIMESTAMP | default now                |
| updated_at      | TIMESTAMP | default now                |

### task_status_changes

| Column      | Type      | Notes                      |
|-------------|-----------|----------------------------|
| id          | INTEGER PK| auto-increment             |
| task_id     | INTEGER   | FK -> tasks.id             |
| from_status | TEXT      | nullable (first entry)     |
| to_status   | TEXT      | not null                   |
| changed_at  | TIMESTAMP | default now                |

### project_memories

| Column     | Type      | Notes                                                    |
|------------|-----------|----------------------------------------------------------|
| id         | INTEGER PK| auto-increment                                           |
| project_id | INTEGER  | FK -> projects.id                                        |
| title      | TEXT      | not null                                                 |
| type       | TEXT      | context, architecture, gotcha, reference, baseline, failure-mode |
| content    | TEXT      | not null                                                 |
| created_at | TIMESTAMP | default now                                              |
| updated_at | TIMESTAMP | default now                                              |

### memory

| Column     | Type      | Notes                      |
|------------|-----------|----------------------------|
| id         | INTEGER PK| auto-increment             |
| title      | TEXT      | not null                   |
| summary    | TEXT      | optional                   |
| content    | TEXT      | not null                   |
| tags       | TEXT      | comma-separated            |
| started_at | TEXT      | optional                   |
| ended_at   | TEXT      | optional                   |
| created_at | TIMESTAMP | default now                |

## Interaction

All through Claude Code conversations. No standalone CLI — the `scripts/taskctl` script is the programmatic interface.

## Conventions

- Subtasks are regular tasks with `parent_task_id` set.
- A project with no tasks is fine (it's a registry).
- `updated_at` auto-updates on any change via triggers.
- Organizations group projects and store team-level integrations (Jira, Discord).
- Team members map identities across GitHub, Discord, and Jira.
