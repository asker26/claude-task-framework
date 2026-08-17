#!/usr/bin/env bash
# Append the PR cockpit session hooks to ~/.claude/settings.json (idempotent; other hooks and keys untouched; backup first).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETTINGS="${CLAUDE_SETTINGS:-$HOME/.claude/settings.json}"
mkdir -p "$(dirname "$SETTINGS")"
[[ -f "$SETTINGS" ]] || echo '{}' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.bak-$(date +%Y%m%d%H%M%S)"
tmp="$(mktemp)"
jq --arg root "$ROOT" '
  def ensure($event; $cmd):
    .hooks //= {} | .hooks[$event] //= []
    | if ([.hooks[$event][]?.hooks[]?.command] | index($cmd)) then . else .hooks[$event] += [{"hooks":[{"type":"command","command":$cmd}]}] end;
  ensure("SessionStart"; $root + "/hooks/pr-session-start.sh")
  | ensure("UserPromptSubmit"; $root + "/hooks/pr-session-seen.sh")
  | ensure("SessionEnd"; $root + "/hooks/pr-session-end.sh")
' "$SETTINGS" > "$tmp" && mv "$tmp" "$SETTINGS"
echo "PR cockpit hooks installed in $SETTINGS (SessionStart, UserPromptSubmit, SessionEnd)"
