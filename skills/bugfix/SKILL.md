---
name: bugfix
description: "End-to-end autonomous bugfix. Diagnoses, fixes, tests, commits, and pushes without stopping. Use for any bug, error, or broken behavior."
metadata:
  version: 2.0.0
---

# Autonomous Bugfix

You are fixing a bug. Complete ALL steps below in sequence.
Do NOT stop between steps. Do NOT ask for confirmation — just do the next step.

## Step 1: DIAGNOSE

- Read the error message, stack trace, or broken behavior description
- Trace the root cause through the code
- Identify the minimal set of files that need to change

## Step 2: FIX

- Make the smallest correct change that fixes the root cause
- Do NOT refactor surrounding code. Do NOT "clean up while you're in there"
- Match existing code style exactly

## Step 3: TEST

- Run the project's test suite
- If the bug has no test coverage, add a regression test
- If no test suite exists, verify the fix by reading the corrected code path

## Step 4: COMMIT + PUSH

- Stage changed files, commit: `fix: short description of what was broken`
- Include `Co-Authored-By: Claude <noreply@anthropic.com>`
- Push to current branch

## Step 5: REPORT

One line:
```
Fixed: [what was broken] -> [what fixed it]
```

Then stop.
