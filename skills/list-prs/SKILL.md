---
name: list-prs
description: "List open PRs for the current project in a table. Usage: /list-prs"
metadata:
  version: 1.0.0
---

# List PRs

1. Get repo from `git remote get-url origin`, extract org/repo
2. `gh pr list --repo <org>/<repo> --state open --json number,title,author,changedFiles,additions,deletions,mergeable,reviewDecision`
3. Table columns: # | Author | Title | Status | Changes
   Status: ready (mergeable, no conflicts), conflicts, review needed, approved, changes requested
   Changes: N files +additions/-deletions
4. Sort by # descending. Show total count. No commentary.
