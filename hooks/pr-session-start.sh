#!/usr/bin/env bash
# SessionStart hook: register this Claude session (id, cwd, repo) in tasks.db for the PR cockpit (prctl sessions/claim).
# Fail-safe: never blocks a session — always exits 0, prints nothing.
set +e
trap 'exit 0' ERR
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/pr-lib.sh" 2>/dev/null || exit 0
[[ -f "$DB" ]] || exit 0
input="$(cat 2>/dev/null)"
sid="$(printf '%s' "$input" | jq -r '.session_id // empty' 2>/dev/null)"
[[ -n "$sid" ]] || exit 0
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)"
repo=""
if [[ -n "$cwd" && -d "$cwd" ]]; then
  url="$(git -C "$cwd" remote get-url origin 2>/dev/null || true)"
  [[ -n "$url" ]] && repo="$(repo_from_url "$url" 2>/dev/null || true)"
fi
sql "INSERT INTO sessions (id, cwd, repo, deck_tab_id, started_at, last_seen_at, ended_at)
     VALUES ($(sql_str "$sid"), $(sql_str "$cwd"), $(sql_str "$repo"), $(sql_str "${FLEET_TAB_ID:-}"), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
     ON CONFLICT(id) DO UPDATE SET cwd = COALESCE(excluded.cwd, sessions.cwd), repo = COALESCE(excluded.repo, sessions.repo),
       deck_tab_id = COALESCE(excluded.deck_tab_id, sessions.deck_tab_id), last_seen_at = CURRENT_TIMESTAMP, ended_at = NULL;" >/dev/null 2>&1
exit 0
