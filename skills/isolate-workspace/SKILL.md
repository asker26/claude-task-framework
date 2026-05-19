---
name: isolate-workspace
description: >
  Work on tasks in an isolated clone of a repo. Use when the user says "work on this in isolation",
  "fix this PR", "fix this in isolation", or invokes /isolate. Do NOT auto-trigger for new features
  unless the user explicitly asks for isolation.
---

# Isolated Workspace

Clone repo into scratch folder, work there, clean up when done.

# Workflow

## 1. Identify Target
What: PR (link/number/task), branch (existing/new), task from tasks.db
Lookup in tasks.db: github_repo (clone URL), organization.name (folder path), local_path (NEVER touch original)

## 2. Create Workspace
Path: .workspaces/{orgName}/{projectName}/{8-char-random}/
Clone -> checkout target branch (or create new). All work in this folder only.

## 3. Work
Fix PR feedback, resolve conflicts, fix CI, whatever needed. Run tests if applicable. NEVER modify original repo.

## 4. Review Checkpoint
Show summary (git diff --stat + key changes). Ask user to review. Wait for approval.

## 5. Commit (after approval only)
Ask first. Descriptive message per repo conventions. Stage only relevant files.

## 6. Push (after approval only)
Ask first. Push with -u flag.

## 7. Cleanup (after approval only)
Ask to delete workspace. If no, leave for reference.

# Rules
NEVER auto-trigger unless explicitly asked
NEVER commit/push/delete without asking
NEVER modify original repo
ALWAYS lookup project info from tasks.db
ALWAYS use Discord embed templates for notifications if webhooks are configured
