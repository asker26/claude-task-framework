#!/usr/bin/env bash
# Stop Hook
# Prevents Claude from exiting mid-chain when autonomous execution is active.

set -euo pipefail

CHAIN_STATE_FILE="$HOME/.claude/teamlead-chain.state"

# No active chain — allow exit immediately
if [[ ! -f "$CHAIN_STATE_FILE" ]]; then
  exit 0
fi

# Read hook input
HOOK_INPUT=$(cat)
HOOK_SESSION=$(echo "$HOOK_INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")
TRANSCRIPT_PATH=$(echo "$HOOK_INPUT" | jq -r '.transcript_path // ""' 2>/dev/null || echo "")

# Parse state file
STATE_SESSION=$(grep '^session_id:' "$CHAIN_STATE_FILE" | sed 's/session_id: *//' || echo "")
MAX_BLOCKS=$(grep '^max_blocks:' "$CHAIN_STATE_FILE" | sed 's/max_blocks: *//' || echo "2")
BLOCKS_USED=$(grep '^blocks_used:' "$CHAIN_STATE_FILE" | sed 's/blocks_used: *//' || echo "0")
CREATED_AT=$(grep '^created_at:' "$CHAIN_STATE_FILE" | sed 's/created_at: *//' || echo "0")
CHAIN_TYPE=$(grep '^chain_type:' "$CHAIN_STATE_FILE" | sed 's/chain_type: *//' || echo "unknown")

# Session isolation: only block the session that started the chain
if [[ -n "$STATE_SESSION" ]] && [[ "$STATE_SESSION" != "$HOOK_SESSION" ]]; then
  exit 0
fi

# Safety: validate numeric fields
if [[ ! "$MAX_BLOCKS" =~ ^[0-9]+$ ]] || [[ ! "$BLOCKS_USED" =~ ^[0-9]+$ ]] || [[ ! "$CREATED_AT" =~ ^[0-9]+$ ]]; then
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# Safety: max blocks reached — allow exit
if [[ "$BLOCKS_USED" -ge "$MAX_BLOCKS" ]]; then
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# Safety: time-based expiry (5 minutes = 300 seconds)
NOW=$(date +%s)
ELAPSED=$((NOW - CREATED_AT))
if [[ "$ELAPSED" -gt 300 ]]; then
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# Check transcript for completion markers or async wait state
CHAIN_COMPLETE=false
ASYNC_WAITING=false
if [[ -n "$TRANSCRIPT_PATH" ]] && [[ -f "$TRANSCRIPT_PATH" ]]; then
  # Get last few assistant text blocks
  set +e
  LAST_OUTPUT=$(grep '"role":"assistant"' "$TRANSCRIPT_PATH" | tail -n 50 | jq -rs '
    map(.message.content[]? | select(.type == "text") | .text) | last // ""
  ' 2>/dev/null || echo "")
  set -e

  LAST_LOWER=$(echo "$LAST_OUTPUT" | tr '[:upper:]' '[:lower:]')

  # Completion markers: PR created, pushed, report line, or explicit completion
  if echo "$LAST_LOWER" | grep -qE '(pr #[0-9]|pr created|pushed to|report:|done\. \[|all steps complete|chain complete)'; then
    CHAIN_COMPLETE=true
  fi

  # Also complete if Claude mentioned it couldn't proceed (blocked, no tests, etc.)
  if echo "$LAST_LOWER" | grep -qE '(cannot proceed|blocked by|no test suite|skipping remaining)'; then
    CHAIN_COMPLETE=true
  fi

  # Q&A completion: no code changes were made, nothing to commit
  if echo "$LAST_LOWER" | grep -qE '(no code changes|nothing to commit|no changes made|q&a|local.only.*changes|gitignored)'; then
    CHAIN_COMPLETE=true
  fi

  # Misclassification: Claude recognizes the hook misfired
  if echo "$LAST_LOWER" | grep -qE '(misclassif|not a (bugfix|feature|refactor)|no (bugfix|feature|refactor) here|hook.*(wrong|misfire)|there.s no (bugfix|feature|refactor)|hook misclassified)'; then
    CHAIN_COMPLETE=true
  fi

  # Async wait: Claude is idle because background agents haven't returned yet
  if echo "$LAST_LOWER" | grep -qE '(waiting (on|for).*agent|agent.*(still )?(running|active|working)|[0-9]+ agent|background.*(running|agent)|pending.*report|research in progress|launched.*agent|monitoring.*agent|report.*(when|as).*(finish|complete)|nothing to (commit|push).*wait)'; then
    ASYNC_WAITING=true
  fi
fi

# Chain is complete — clean up and allow exit
if [[ "$CHAIN_COMPLETE" == true ]]; then
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# Async wait — don't count as a premature stop, don't burn a block
if [[ "$ASYNC_WAITING" == true ]]; then
  exit 0
fi

# Chain not complete — block exit and tell Claude to continue
NEW_BLOCKS=$((BLOCKS_USED + 1))
TEMP_FILE="${CHAIN_STATE_FILE}.tmp.$$"
sed "s/^blocks_used: .*/blocks_used: $NEW_BLOCKS/" "$CHAIN_STATE_FILE" > "$TEMP_FILE"
mv "$TEMP_FILE" "$CHAIN_STATE_FILE"

REMAINING_BLOCKS=$((MAX_BLOCKS - NEW_BLOCKS))

jq -n \
  --arg reason "You stopped before completing the $CHAIN_TYPE chain. Continue with the remaining steps. Do NOT stop until you reach the REPORT step. ($REMAINING_BLOCKS block(s) remaining before forced exit)" \
  --arg msg "Chain active ($CHAIN_TYPE) — continuing execution ($NEW_BLOCKS/$MAX_BLOCKS blocks used)" \
  '{
    "decision": "block",
    "reason": $reason,
    "systemMessage": $msg
  }'

exit 0
