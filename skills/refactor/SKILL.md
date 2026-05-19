---
name: refactor
description: "End-to-end autonomous refactor. Assesses, plans, executes in safe batches, tests, commits, and creates PR without stopping. Use for restructuring, cleanup, or migration work."
metadata:
  version: 2.0.0
---

# Autonomous Refactor

You are executing a refactor. Complete ALL steps below in sequence.
Do NOT stop between steps. Do NOT ask for confirmation — just do the next step.

## Step 1: ASSESS

- Read the code that needs refactoring
- Identify what's wrong with the current structure (duplication, coupling, naming, etc.)
- Map the blast radius: which files change, which callers are affected

## Step 2: PLAN

- Outline the refactor steps internally
- Group related changes into batches that can each be tested independently
- Order batches so each one leaves the code in a working state

## Step 3: EXECUTE

For each batch:
1. Make the changes
2. Run tests
3. If tests fail, fix before moving to next batch

Do NOT refactor more than was requested. Stay within scope.

## Step 4: VERIFY

- Run the full test suite
- Ensure no regressions
- If tests fail, fix them

## Step 5: COMMIT + PUSH + PR

- Stage changed files, commit: `refactor: short description`
- Include `Co-Authored-By: Claude <noreply@anthropic.com>`
- Push to current branch
- If on feature branch, create PR with before/after summary

## Step 6: REPORT

One line:
```
Refactored: [what changed] — [why it's better]
```

Then stop.
