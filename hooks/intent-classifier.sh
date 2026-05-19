#!/usr/bin/env bash
# UserPromptSubmit Hook
# Classifies user intent and injects autonomous chain directives.
# This is the key mechanism that makes Claude actually execute multi-step chains.

set -euo pipefail

# Read hook input from stdin
HOOK_INPUT=$(cat)

# Extract user prompt
PROMPT=$(echo "$HOOK_INPUT" | jq -r '.prompt // ""' 2>/dev/null || echo "")
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // ""' 2>/dev/null || echo "")

# Normalize for matching
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

CHAIN_STATE_DIR="$HOME/.claude"
CHAIN_STATE_FILE="$CHAIN_STATE_DIR/teamlead-chain.state"

# --- Escape hatches: if user wants to override, don't inject ---
if echo "$PROMPT_LOWER" | grep -qE '(just plan|don'\''t build|only design|stop after|don'\''t push|don'\''t commit|no pr|no push|don'\''t create)'; then
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# Skip very short prompts (likely follow-ups, confirmations, slash commands)
WORD_COUNT=$(echo "$PROMPT" | wc -w | tr -d ' ')
if [[ "$WORD_COUNT" -lt 3 ]]; then
  # Short follow-ups mean the chain was already interrupted — clean up stale state
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# Skip slash commands — skills handle themselves
if echo "$PROMPT" | grep -qE '^\s*/'; then
  exit 0
fi

# --- Research/question gate: detect investigative & conversational prompts BEFORE intent classification ---
# These words indicate the user wants info, not autonomous execution.
# Must come before feature/bugfix matching since prompts like "check if X is broken" contain both.
if echo "$PROMPT_LOWER" | grep -qE '(^|\s)(check if|research|investigate|look into|find out|read |what |how |why |where |when |which |can you |could you |can i |do you |did you |is it |is that |are you |tell me|show me|explain|analyze|analysis|compare|list |search |should i|should we|contemplat|thinking about|considering|wether|whether|opinion|recommend|thoughts on|pros and cons|does |would |regarding|about my|what if|evaluate|assessment|report on|summary of|overview|metrics|market |pricing |strategy )\b'; then
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# --- Conversational/follow-up gate: short prompts that aren't action requests ---
# Catches things like "okay open the zip", "yeah do that", "no the other one", "right but..."
if echo "$PROMPT_LOWER" | grep -qE '^(ok(ay)?|yeah|yes|no|right|sure|got it|thanks|hmm|hm|actually|also|oh|ah|wait|so |i meant|i mean|not |one more)'; then
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# --- Intent classification (first match wins) ---
INTENT="none"

if echo "$PROMPT_LOWER" | grep -qE '(^|\s)(add|create|build|implement|new feature|set up|wire up)\b'; then
  INTENT="feature"
elif echo "$PROMPT_LOWER" | grep -qE '(^|\s)(fix|bug|broken|error|not working|crash|issue|failing)\b'; then
  INTENT="bugfix"
elif echo "$PROMPT_LOWER" | grep -qE '(^|\s)(refactor|clean ?up|simplify|restructure|migrate|reorganize)\b'; then
  INTENT="refactor"
elif echo "$PROMPT_LOWER" | grep -qE '(^|\s)(deploy|docker|nginx|server|ci/?cd|pipeline)\b'; then
  INTENT="devops"
elif echo "$PROMPT_LOWER" | grep -qE '(^|\s)(review|check code|pull request|pr #|pr review)\b'; then
  INTENT="review"
elif echo "$PROMPT_LOWER" | grep -qE '(^|\s)(jira|ticket|discord|notify|update status)\b'; then
  INTENT="ops"
fi

# No intent detected — clean up stale chain state and let Claude handle normally
if [[ "$INTENT" == "none" ]]; then
  rm -f "$CHAIN_STATE_FILE"
  exit 0
fi

# --- Build chain directive per intent ---
case "$INTENT" in
  feature)
    DIRECTIVE="EXECUTION MODE: AUTONOMOUS FEATURE CHAIN
Execute ALL of the following steps WITHOUT stopping between them.
Do NOT ask 'shall I continue?', 'ready to proceed?', or 'want me to...?' — just do the next step.
Scale effort to task size (1 file = no plan needed, 3+ files = brief internal plan, 10+ = detailed plan).

1. EXPLORE: Read relevant files, find existing patterns to follow. (2 min max)
2. PLAN: If 3+ files need changes, briefly outline your approach. Keep it internal — do not ask for approval.
3. IMPLEMENT: Write all code changes. Follow existing codebase patterns exactly.
4. TEST: Run the project's test suite. If tests fail, fix them before proceeding.
5. COMMIT: Stage changed files, write a clear conventional commit message, commit.
6. PUSH: Push to current branch.
7. PR: If on a feature branch (not main), create a PR with short title and bullet summary.
8. REPORT: One line — what was built, branch/PR link.

If any step is blocked (no tests exist, already on main, etc.), skip it and continue to the next."
    ;;

  bugfix)
    DIRECTIVE="EXECUTION MODE: AUTONOMOUS BUGFIX
Execute ALL steps without stopping. Do NOT pause to ask for confirmation.

1. DIAGNOSE: Read the error context, trace the root cause.
2. FIX: Make the minimal correct change. Don't refactor surrounding code.
3. TEST: Run tests. Verify the fix. If no tests cover this, add one.
4. COMMIT + PUSH: Commit with a clear message, push.
5. REPORT: One line — what was broken, what fixed it."
    ;;

  refactor)
    DIRECTIVE="EXECUTION MODE: AUTONOMOUS REFACTOR
Execute ALL steps without stopping. Do NOT pause to ask for confirmation.

1. ASSESS: Read current code, identify what needs to change and why.
2. PLAN: Outline the refactor steps internally. Batch related changes.
3. EXECUTE: Make changes incrementally. Run tests after each batch.
4. VERIFY: Full test suite pass.
5. COMMIT + PUSH + PR: Commit with clear message, push, create PR if on feature branch.
6. REPORT: One line — what was refactored and why."
    ;;

  devops)
    DIRECTIVE="EXECUTION MODE: AUTONOMOUS DEVOPS
Execute the task fully. Verify each step works before moving to the next.
Do NOT pause to ask for confirmation unless the action is destructive (deploy to prod, delete resources).
Report what was done when complete."
    ;;

  review)
    DIRECTIVE="EXECUTION MODE: CODE REVIEW
Review the code thoroughly. Report findings organized by severity (critical -> minor).
Include specific file:line references. Suggest concrete fixes, not just observations.
Be opinionated — state what should change, not just what could change."
    ;;

  ops)
    DIRECTIVE="EXECUTION MODE: OPERATIONS
Execute the requested operation immediately. Use Jira CLI, Discord webhooks, or tasks.db as appropriate.
Report what was done when complete."
    ;;
esac

# --- Create chain state file for stop-guard (only for multi-step chains) ---
if [[ "$INTENT" == "feature" || "$INTENT" == "bugfix" || "$INTENT" == "refactor" ]]; then
  cat > "$CHAIN_STATE_FILE" << EOF
chain_type: $INTENT
session_id: $SESSION_ID
max_blocks: 2
blocks_used: 0
created_at: $(date +%s)
EOF
fi

# --- Output directive as additionalContext ---
jq -n --arg directive "$DIRECTIVE" '{
  "hookSpecificOutput": {
    "hookEventName": "UserPromptSubmit",
    "additionalContext": $directive
  }
}'

exit 0
