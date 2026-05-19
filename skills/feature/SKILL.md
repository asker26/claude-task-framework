---
name: feature
description: "End-to-end autonomous feature implementation. Explores, plans, builds, tests, commits, pushes, and creates PR without stopping. Use when you want a complete feature delivered in one shot."
metadata:
  version: 2.0.0
---

# Autonomous Feature Implementation

You are executing an end-to-end feature. Complete ALL steps below in sequence.
Do NOT stop between steps. Do NOT ask "shall I continue?" or "ready to proceed?" — just do the next step.
User override always wins — if they said "don't push" or "stop after build", respect that.

## Step 1: EXPLORE (2 minutes max)

- Read the project structure: key directories, existing patterns, tech stack
- Find similar features or components to use as a template
- Identify the files that need to change
- Check for a test suite (where tests live, how to run them)

Do NOT spend more than 2 minutes exploring. Get oriented and move on.

## Step 2: PLAN (internal only)

Scale planning to task size:
- **1-2 files**: No written plan. Hold it in your head.
- **3-9 files**: Write a brief internal outline (don't show to user unless asked).
- **10+ files**: Write a plan to `docs/plans/` if the project has that structure.

Pick the best approach based on existing codebase patterns. Do NOT present options or ask which approach the user prefers — be opinionated and proceed.

## Step 3: IMPLEMENT

- Write all code changes following existing project patterns exactly
- Match the style: naming conventions, file organization, import patterns, error handling
- Don't over-engineer. Implement exactly what was requested, nothing more
- Don't add comments to code you didn't write. Only comment non-obvious logic

## Step 4: TEST

- Run the project's test suite (look for `npm test`, `dotnet test`, `phpunit`, `pytest`, etc.)
- If tests fail because of your changes, fix them
- If the project has no test suite, skip this step
- If the feature is testable and the project has tests, add a test for the new feature

## Step 5: COMMIT

- Stage only the files you changed (not `git add .`)
- Write a clear conventional commit message: `feat: short description`
- Include `Co-Authored-By: Claude <noreply@anthropic.com>`

## Step 6: PUSH

- Push to the current branch
- If on `main`/`master`, create a feature branch first: `git checkout -b feat/short-name`

## Step 7: PR (if on feature branch)

- Create a PR with `gh pr create`
- Short title (under 70 chars)
- Body: 2-3 bullet summary + test plan

## Step 8: REPORT

One line:
```
[what was built] — branch: [name], PR: #[number]
```

If any step was skipped, note why. Then stop.
