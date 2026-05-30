#!/bin/bash
# Interactive setup wizard for Claude Task Framework.
# Run this after cloning to get started quickly.
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB="$ROOT/tasks.db"
TASKCTL="$ROOT/scripts/taskctl"
CLAUDE_SETTINGS="$HOME/.claude/settings.json"

echo "Claude Task Framework — Setup"
echo "=============================="
echo ""

# --- Step 1: Database ---
if [[ ! -f "$DB" ]]; then
  echo "Initializing database..."
  bash "$ROOT/init-db.sh"
  echo ""
fi

# --- Step 2: First Organization ---
read -rp "Organization name [Personal]: " org_name
org_name="${org_name:-Personal}"

read -rp "Jira instance URL (blank to skip): " jira_instance
read -rp "Discord webhook URL (blank to skip): " discord_webhook

org_args=("$org_name")
[[ -n "$jira_instance" ]] && org_args+=(--jira-instance "$jira_instance")
[[ -n "$discord_webhook" ]] && org_args+=(--discord-webhook "$discord_webhook")
"$TASKCTL" add-org "${org_args[@]}"
echo ""

# --- Step 3: First Project ---
default_path="$PWD"
read -rp "Project name [my-app]: " proj_name
proj_name="${proj_name:-my-app}"

read -rp "Local path [$default_path]: " proj_path
proj_path="${proj_path:-$default_path}"

read -rp "GitHub repo URL (blank to skip): " proj_repo

proj_args=("$proj_name" --org "$org_name" --path "$proj_path")
[[ -n "$proj_repo" ]] && proj_args+=(--repo "$proj_repo")
"$TASKCTL" add-project "${proj_args[@]}"
echo ""

# --- Step 4: First Task ---
read -rp "First task title [Set up project]: " task_title
task_title="${task_title:-Set up project}"

read -rp "Type (feature/bug/research/other) [feature]: " task_type
task_type="${task_type:-feature}"

read -rp "Priority (high/medium/low) [medium]: " task_priority
task_priority="${task_priority:-medium}"

"$TASKCTL" add-task "$task_title" --project "$proj_name" --type "$task_type" --priority "$task_priority"
echo ""

# --- Step 5: Install Hooks ---
echo "Hook Installation"
echo "-----------------"
read -rp "Install Claude Code hooks? (y/n) [y]: " install_hooks
install_hooks="${install_hooks:-y}"

if [[ "$install_hooks" == "y" ]]; then
  HOOK_CONFIG=$(cat "$ROOT/hooks.json.example" | sed "s|__FRAMEWORK_PATH__|$ROOT|g")

  mkdir -p "$HOME/.claude"

  if [[ -f "$CLAUDE_SETTINGS" ]]; then
    if jq -e '.hooks' "$CLAUDE_SETTINGS" >/dev/null 2>&1; then
      read -rp "Existing hooks found in settings. Overwrite? (y/n) [n]: " overwrite
      if [[ "${overwrite:-n}" == "y" ]]; then
        jq --argjson hooks "$(echo "$HOOK_CONFIG" | jq '.hooks')" '.hooks = $hooks' "$CLAUDE_SETTINGS" > "${CLAUDE_SETTINGS}.tmp"
        mv "${CLAUDE_SETTINGS}.tmp" "$CLAUDE_SETTINGS"
        echo "Hooks updated."
      else
        echo "Skipped hook installation."
      fi
    else
      jq --argjson hooks "$(echo "$HOOK_CONFIG" | jq '.hooks')" '. + {hooks: $hooks}' "$CLAUDE_SETTINGS" > "${CLAUDE_SETTINGS}.tmp"
      mv "${CLAUDE_SETTINGS}.tmp" "$CLAUDE_SETTINGS"
      echo "Hooks added to existing settings."
    fi
  else
    echo "$HOOK_CONFIG" | jq '.' > "$CLAUDE_SETTINGS"
    echo "Created $CLAUDE_SETTINGS with hooks."
  fi
  echo ""
fi

# --- Step 6: Install Skills ---
echo "Skill Installation"
echo "------------------"
echo "  1) Core (7 skills: refactor, opib, list-prs, summ, team-lead, docs-lookup, isolate-workspace)"
echo "  2) All (core + 17 ASO skills + appstoreconnect)"
echo "  3) None"
read -rp "Which skills to install? [1]: " skill_choice
skill_choice="${skill_choice:-1}"

if [[ "$skill_choice" == "1" || "$skill_choice" == "2" ]]; then
  mkdir -p "$HOME/.claude/skills"
  for skill in refactor opib list-prs summ team-lead docs-lookup isolate-workspace; do
    cp -r "$ROOT/skills/$skill" "$HOME/.claude/skills/"
  done
  echo "Installed 7 core skills."

  if [[ "$skill_choice" == "2" ]]; then
    cp -r "$ROOT/skills/appstoreconnect" "$HOME/.claude/skills/"
    for skill_dir in "$ROOT/skills/aso"/*/; do
      skill_name="$(basename "$skill_dir")"
      cp -r "$skill_dir" "$HOME/.claude/skills/$skill_name"
    done
    echo "Installed 18 additional skills (ASO + App Store Connect)."
  fi
  echo ""
fi

# --- Step 6b: Install superpowers workflow skills (external, from GitHub) ---
echo ""
echo "Superpowers Workflow Skills (external)"
echo "--------------------------------------"
read -rp "Install the superpowers dev-workflow skills from GitHub? [y/N]: " sp_choice
if [[ "${sp_choice:-N}" =~ ^[Yy]$ ]]; then
  sp_tmp="$(mktemp -d)"
  if git clone --depth 1 https://github.com/obra/superpowers.git "$sp_tmp/sp" 2>/dev/null; then
    for s in brainstorming writing-plans executing-plans test-driven-development \
             systematic-debugging verification-before-completion \
             requesting-code-review receiving-code-review finishing-a-development-branch; do
      cp -r "$sp_tmp/sp/skills/$s" "$HOME/.claude/skills/" 2>/dev/null
    done
    echo "Installed 9 superpowers skills."
  else
    echo "WARN: could not clone obra/superpowers — skipped."
  fi
  if git clone --depth 1 https://github.com/obra/the-elements-of-style.git "$sp_tmp/eos" 2>/dev/null; then
    cp -r "$sp_tmp/eos/skills/writing-clearly-and-concisely" "$HOME/.claude/skills/" 2>/dev/null
    echo "Installed writing-clearly-and-concisely."
  else
    echo "WARN: could not clone obra/the-elements-of-style — skipped."
  fi
  rm -rf "$sp_tmp"
  echo ""
fi

# --- Summary ---
echo "Setup Complete"
echo "=============="
echo "  Database: $DB"
echo "  Org: $org_name"
echo "  Project: $proj_name ($proj_path)"
echo "  Task: $task_title"
[[ "$install_hooks" == "y" ]] && echo "  Hooks: installed"
[[ "$skill_choice" != "3" ]] && echo "  Skills: installed to ~/.claude/skills/"
echo ""
echo "Next steps:"
echo "  ./scripts/taskctl dashboard     # See your dashboard"
echo "  ./scripts/doctor                # Verify everything works"
echo "  claude                          # Start a Claude Code session"
