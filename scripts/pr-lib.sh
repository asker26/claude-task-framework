#!/usr/bin/env bash
# Shared helpers for the PR cockpit scripts (prctl, pr-sync, pr-worker, pr-review-run, hooks). Source it; do not execute.

PR_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${ROOT:-$(cd "$PR_LIB_DIR/.." && pwd)}"
DB="${TASK_DB_PATH:-$ROOT/tasks.db}"
PR_ORG="${CTF_PR_ORG:-FS-Code}"
REVIEWS_DIR="${CTF_PR_REVIEWS_DIR:-$ROOT/.reviews}"
TMUX_SESSION="${CTF_TMUX_SESSION:-ctf-agents}"
WORKER_WINDOW="pr-worker"

sql()       { sqlite3 -cmd '.timeout 5000' "$DB" "$1"; }
sql_ro()    { sqlite3 -cmd '.timeout 5000' -readonly "$DB" "$1"; }
sql_esc()   { printf '%s' "$1" | sed "s/'/''/g"; }
sql_table() { sqlite3 -cmd '.timeout 5000' -readonly -header -column "$DB" "$1"; }
sql_str()   { if [[ -n "${1:-}" ]]; then printf "'%s'" "$(sql_esc "$1")"; else printf 'NULL'; fi; }

require_db() {
  [[ -f "$DB" ]] || { echo "tasks.db not found at: $DB" >&2; exit 1; }
  sql_ro "SELECT 1 FROM prs LIMIT 0;" >/dev/null 2>&1 \
    || { echo "PR tables missing — run scripts/migrate-v5-prs.sh" >&2; exit 1; }
}

setting_get() { sql_ro "SELECT value FROM pr_settings WHERE key = $(sql_str "$1");"; }
setting_set() {
  sql "INSERT INTO pr_settings (key, value, updated_at) VALUES ($(sql_str "$1"), $(sql_str "$2"), CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP;"
}
setting_del() { sql "DELETE FROM pr_settings WHERE key = $(sql_str "$1");"; }

gh_me() {
  local me="${CTF_GH_ME:-}"
  [[ -n "$me" ]] || me="$(setting_get gh_login)"
  if [[ -z "$me" ]]; then
    me="$(gh api user --jq .login 2>/dev/null)" || return 1
  fi
  [[ "$(setting_get gh_login)" == "$me" ]] || setting_set gh_login "$me"
  printf '%s' "$me"
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

repo_from_url() {
  local slug
  slug="$(printf '%s' "$1" | sed -E 's#^(https://github\.com/|git@github\.com:|ssh://git@github\.com/)##; s#\.git$##; s#/$##')"
  [[ "$(lower "${slug%%/*}")" == "$(lower "$PR_ORG")" && "$slug" == */* ]] || return 1
  printf '%s/%s' "$PR_ORG" "${slug#*/}"
}
repo_from_cwd() {
  local url
  url="$(git remote get-url origin 2>/dev/null)" || return 1
  repo_from_url "$url"
}

# "repo#N" | "Org/repo#N" | "N" (cwd inside that repo) → "Org/repo<TAB>N"
pr_ref_parse() {
  local ref="$1" repo num
  if [[ "$ref" =~ ^(([A-Za-z0-9_.-]+)/)?([A-Za-z0-9_.-]+)#([0-9]+)$ ]]; then
    num="${BASH_REMATCH[4]}"
    if [[ -n "${BASH_REMATCH[2]}" ]]; then repo="${BASH_REMATCH[2]}/${BASH_REMATCH[3]}"; else repo="$PR_ORG/${BASH_REMATCH[3]}"; fi
  elif [[ "$ref" =~ ^#?([0-9]+)$ ]]; then
    num="${BASH_REMATCH[1]}"
    repo="$(repo_from_cwd)" || { echo "bare PR number needs a cwd inside a $PR_ORG repo — use repo#$num" >&2; return 1; }
  else
    echo "bad PR ref '$ref' — use repo#N or Org/repo#N" >&2; return 1
  fi
  printf '%s\t%s' "$repo" "$num"
}
pr_id_for()    { sql_ro "SELECT id FROM prs WHERE repo = $(sql_str "$1") COLLATE NOCASE AND number = $2;"; }
pr_ref_short() { printf '%s#%s' "${1#*/}" "$2"; }
pr_ref_of_id() { sql_ro "SELECT substr(repo, instr(repo, '/') + 1) || '#' || number FROM prs WHERE id = $1;"; }
pr_id_or_die() {
  local parsed repo num id
  parsed="$(pr_ref_parse "$1")" || exit 1
  IFS=$'\t' read -r repo num <<< "$parsed"
  id="$(pr_id_for "$repo" "$num")"
  [[ -n "$id" ]] || { echo "unknown PR $(pr_ref_short "$repo" "$num") — run prctl sync" >&2; exit 1; }
  printf '%s' "$id"
}

# report file → BLOCK | REQUEST_CHANGES | APPROVE_WITH_COMMENTS, or empty when absent/ambiguous
report_verdict() {
  local line n
  line="$(grep -m1 '\*\*Verdict:\*\*' "$1" 2>/dev/null || true)"
  [[ -n "$line" ]] || return 0
  n="$(printf '%s' "$line" | grep -oE 'BLOCK|REQUEST_CHANGES|APPROVE_WITH_COMMENTS' | wc -l | tr -d ' ')"
  [[ "$n" == 1 ]] || return 0
  printf '%s' "$line" | grep -oE 'BLOCK|REQUEST_CHANGES|APPROVE_WITH_COMMENTS'
}

# stream text containing "resets 5:30pm" (in $CTF_PR_RESET_TZ, default Asia/Baku) → UTC 'YYYY-MM-DD HH:MM:SS'; else now+60m
cooldown_until_from_text() {
  local hhmm ampm epoch today tz="${CTF_PR_RESET_TZ:-Asia/Baku}"
  if [[ "$1" =~ resets[[:space:]]+([0-9]{1,2}(:[0-9]{2})?)[[:space:]]*(am|pm|AM|PM) ]]; then
    hhmm="${BASH_REMATCH[1]}"; ampm="$(printf '%s' "${BASH_REMATCH[3]}" | tr '[:lower:]' '[:upper:]')"
    [[ "$hhmm" == *:* ]] || hhmm="$hhmm:00"
    today="$(TZ="$tz" date '+%Y-%m-%d')"
    epoch="$(TZ="$tz" date -j -f '%Y-%m-%d %I:%M%p' "$today $hhmm$ampm" '+%s' 2>/dev/null || true)"
    if [[ -n "$epoch" ]]; then
      (( epoch <= $(date '+%s') )) && epoch=$((epoch + 86400))
      date -u -r "$epoch" '+%Y-%m-%d %H:%M:%S'; return 0
    fi
  fi
  date -u -v+60M '+%Y-%m-%d %H:%M:%S'
}
utc_to_local_hm() { local e; e="$(TZ=UTC date -j -f '%Y-%m-%d %H:%M:%S' "$1" '+%s' 2>/dev/null)" && date -r "$e" '+%H:%M' || printf '%s' "${1:11:5}"; }

worker_running() { tmux list-windows -t "$TMUX_SESSION" -F '#{window_name}' 2>/dev/null | grep -qx "$WORKER_WINDOW"; }
worker_state_text() {
  worker_running || { printf 'stopped'; return 0; }
  local until run
  until="$(setting_get worker_cooldown_until)"
  if [[ -n "$until" && "$(sql_ro "SELECT datetime('now') < '$until';")" == 1 ]]; then
    printf 'cooldown until %s (session cap)' "$(utc_to_local_hm "$until")"; return 0
  fi
  run="$(sql_ro "SELECT substr(p.repo, instr(p.repo,'/')+1) || '#' || p.number || ' (' || CAST((julianday('now') - julianday(r.started_at)) * 1440 AS INTEGER) || 'm)'
                 FROM pr_reviews r JOIN prs p ON p.id = r.pr_id WHERE r.status = 'running' ORDER BY r.started_at LIMIT 1;")"
  if [[ -n "$run" ]]; then printf 'reviewing %s' "$run"
  elif [[ "$(setting_get worker_mode)" == sync-only ]]; then printf 'idle (sync-only)'
  else printf 'idle'; fi
}

notify_local() {
  [[ "${CTF_PR_NOTIFY:-1}" == 0 ]] && return 0
  command -v osascript >/dev/null 2>&1 || return 0
  local t m
  t="$(printf '%s' "$1" | sed 's/"/\\"/g')"; m="$(printf '%s' "$2" | sed 's/"/\\"/g')"
  osascript -e "display notification \"$m\" with title \"$t\"" >/dev/null 2>&1 || true
}
