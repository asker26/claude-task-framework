#!/usr/bin/env bash
# v5 migration: PR cockpit — prs, pr_reviews, sessions, pr_claims, pr_settings + view pr_board.
# Idempotent — safe to run repeatedly. The view is always recreated so status-rule changes ship here.
# New DBs get the same DDL from init-db.sh.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"

if [[ ! -f "$DB" ]]; then
  echo "tasks.db not found at: $DB. Run init-db.sh first." >&2
  exit 1
fi

if [[ -n "$(sqlite3 "$DB" "SELECT 1 FROM pragma_table_info('pr_reviews') WHERE name IS NOT NULL LIMIT 1;" 2>/dev/null)" ]] \
   && [[ -z "$(sqlite3 "$DB" "SELECT 1 FROM pragma_table_info('pr_reviews') WHERE name='notes';")" ]]; then
  sqlite3 "$DB" "ALTER TABLE pr_reviews ADD COLUMN notes TEXT;"
fi

sqlite3 "$DB" <<'SQL'
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
    gh_review_id INTEGER,
    notes TEXT
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

CREATE TABLE IF NOT EXISTS pr_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pr_id INTEGER NOT NULL REFERENCES prs(id),
    jira_key TEXT NOT NULL,
    title TEXT, url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pr_finding_discards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL REFERENCES pr_reviews(id),
    fkey TEXT NOT NULL,
    excerpt TEXT,
    view TEXT NOT NULL DEFAULT 'original',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, fkey, view)
);

CREATE TABLE IF NOT EXISTS pr_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO pr_settings (key, value) VALUES ('max_diff', '3000'), ('stale_author_days', '3'), ('stale_days', '7'), ('model', 'claude-sonnet-5'), ('max_reviews', '1'), ('session_model', 'claude-sonnet-5'), ('auto_optimize', '1');

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

echo "v5 migration applied to $DB (prs, pr_reviews, sessions, pr_claims, pr_settings, view pr_board)"
