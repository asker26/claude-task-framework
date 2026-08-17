#!/usr/bin/env bash
# SessionEnd hook: close the session and release its PR claims. Fail-safe: always exits 0, prints nothing.
set +e
trap 'exit 0' ERR
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/pr-lib.sh" 2>/dev/null || exit 0
[[ -f "$DB" ]] || exit 0
sid="$(cat 2>/dev/null | jq -r '.session_id // empty' 2>/dev/null)"
[[ -n "$sid" ]] || exit 0
sql "UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = $(sql_str "$sid");
     UPDATE pr_claims SET released_at = CURRENT_TIMESTAMP WHERE session_id = $(sql_str "$sid") AND released_at IS NULL;" >/dev/null 2>&1
exit 0
