#!/usr/bin/env bash
# UserPromptSubmit hook: liveness heartbeat for the PR cockpit sessions table. Fail-safe: always exits 0, prints nothing.
set +e
trap 'exit 0' ERR
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/pr-lib.sh" 2>/dev/null || exit 0
[[ -f "$DB" ]] || exit 0
sid="$(cat 2>/dev/null | jq -r '.session_id // empty' 2>/dev/null)"
[[ -n "$sid" ]] || exit 0
sql "INSERT INTO sessions (id, last_seen_at) VALUES ($(sql_str "$sid"), CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP, ended_at = NULL;" >/dev/null 2>&1
exit 0
