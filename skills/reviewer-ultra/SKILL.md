---
name: reviewer-ultra
description: "Deep PR review: 3 finder agents (regressions, bugs, code smells) + 3 validators + a root-cause adjudication pass that rejects defensive/monkey-patch 'fixes'. Usage: /reviewer-ultra <PR#> [repo]"
metadata:
  version: 1.1.0
---

# Reviewer Ultra

Multi-agent PR review with a validation pass **and** a root-cause adjudication pass. Spawns 6 base agents across 2 rounds, plus one adjudicator agent per defensive-flavored finding in Round 3.

## Core principle: no defensive band-aids

Hardening, adding a fallback, a null-guard, a defensive `try/catch`, or "sanitize just in case" is **never** the fix for a real defect. A finding whose only proposed remedy is defensive is a smell in itself: either (a) there is a real root cause upstream — a writer, caller, or contract that produces the bad state — that must be fixed at the **source**, or (b) the bad state is not actually reachable and the finding is noise. The sole exception is validating **untrusted external input at a true trust boundary** — and even there, **reject loudly, never silently swallow or default**. Round 3 enforces this: any finding whose fix is a band-aid is re-adjudicated to a source fix or dropped.

## Arguments

- `<PR#>` (required): PR number to review
- `[repo]` (optional): org/repo slug. If omitted, detect from `git remote get-url origin` in current directory or project path.

## Round 1: Discovery (3 parallel agents)

Spawn 3 background agents simultaneously. Each runs `gh pr diff <PR#> --repo <repo>` and `gh pr view <PR#> --repo <repo> --json title,body,changedFiles,additions,deletions` to get full context.

### Agent 1: Regression Hunter
Focus ONLY on regressions -- things that worked before and might break after this PR:
- Removed or renamed methods/classes other code depends on
- Changed method signatures (params, return types)
- Changed DB queries that could return different results
- Modified event hooks, filters, callbacks other modules rely on
- Changed access modifiers (public -> private)
- Removed backward compatibility
- Route changes breaking existing API consumers
- Changed error handling surfacing different exceptions
- Removed cleanup/cascade logic that previously existed

For each finding: file + line range, what changed, what could break, severity (critical/high/medium/low).

### Agent 2: Bug Finder
Focus ONLY on actual defects in the new/changed code:
- Null reference / undefined property access
- SQL injection or unsafe query construction
- Logic errors (wrong conditions, inverted booleans, missing cases)
- Type mismatches or wrong casting
- Missing error handling causing uncaught exceptions
- Missing auth/authz checks on new endpoints
- Off-by-one errors, missing return statements
- Array/object access on potentially empty collections
- Incorrect HTTP status codes
- Race conditions

For each finding: file + line range, buggy code snippet, what the bug is, suggested fix, severity (critical/high/medium/low).

### Agent 3: Code Smell Detector
Focus ONLY on design and maintainability issues:
- SOLID violations (god classes, tight coupling, broken SRP)
- Copy-paste / duplicated logic across files
- Inconsistent patterns within the PR
- Overly complex methods (high cyclomatic complexity)
- Poor naming, dead code, unreachable branches
- Missing or unnecessary abstractions
- Mixed responsibilities (controller doing business logic)
- Hard-coded values that should be constants
- Inconsistent error/response formats
- Violation of the project's existing architectural patterns

For each finding: file + line range, the pattern, why it's a problem, suggested fix, priority (should-fix/nice-to-have).

## Between Rounds

After all 3 agents complete:
1. Present a brief summary of Round 1 findings to the user (count by severity per agent)
2. Collect all findings into a combined list
3. Immediately proceed to Round 2

## Round 2: Validation (3 parallel agents)

Spawn 3 NEW background agents. Each receives the FULL findings from Round 1 plus access to the PR diff. Their job is to cross-validate.

### Agent 4: Regression Validator
Receives all regression findings from Agent 1. For each finding:
- Re-read the relevant diff hunks and surrounding code
- Verify the regression is real (not a false positive)
- Check if the old behavior is actually used elsewhere (grep callers/usages)
- Verdict per finding: **CONFIRMED**, **FALSE POSITIVE** (with reason), or **UPGRADED/DOWNGRADED** (with new severity + reason)
- Flag any regressions Agent 1 MISSED

### Agent 5: Bug Validator
Receives all bug findings from Agent 2. For each finding:
- Re-read the code path end-to-end
- Verify the bug is real and reproducible from the code
- Check if there are guards/checks elsewhere that prevent it
- Verdict per finding: **CONFIRMED**, **FALSE POSITIVE** (with reason), or **UPGRADED/DOWNGRADED** (with new severity + reason)
- Flag any bugs Agent 2 MISSED

### Agent 6: Code Smell Validator
Receives all code smell findings from Agent 3. For each finding:
- Verify the pattern exists as described
- Check if the project has established conventions that justify or contradict the finding
- Verdict per finding: **CONFIRMED**, **FALSE POSITIVE** (with reason), or **RECLASSIFIED** (with new priority + reason)
- Flag any smells Agent 3 MISSED

## Round 3: Root-cause adjudication (1 agent per defensive finding)

After Round 2, scan every **CONFIRMED / RECLASSIFIED** finding (plus validator-caught misses). Flag any whose suggested fix is **defensive** — the fix text contains "harden", "fallback", "add a guard", "null check", "defensive", "try/catch" (to swallow), "sanitize just in case", "add a default", "gracefully handle", "safety net", `?.`/`??` as the remedy, or similar band-aid language.

For each flagged finding, spawn ONE adjudicator agent. It re-reads the actual code and **traces the writer / caller / contract** that could produce the bad state, then returns exactly one verdict:

- **ROOT_CAUSE** — a real, reachable defect whose correct fix is at the **source** (fix the writer/caller/type/contract so the bad state cannot occur), NOT the defensive guard. Provide the concrete source fix; that replaces the band-aid in the report.
- **BOUNDARY** — genuine validation of **untrusted external input** at a true trust boundary (HTTP request, third-party API, file upload). Legitimate to keep, but it must **reject/fail loudly**, not swallow or default. Provide the reject-don't-swallow fix.
- **DROP** — the flagged state is not actually reachable (guaranteed by an upstream invariant), so the only "fix" would be monkey-patching. Remove the finding from the report.

Only **ROOT_CAUSE** and **BOUNDARY** survive. The adjudicator must justify its verdict with `file:line` evidence from the actual writers/callers, not the diff alone. Default to **DROP** when the finding cannot be shown to be a real reachable defect. Never report a finding with a band-aid fix — every surviving finding carries a source (or reject-at-boundary) fix.

## Final Report

After Round 2 completes, compile the final validated report:

```markdown
## PR #<N> Review: <title>
**Repo:** <org/repo> | **Files:** <N> | **Changes:** +<additions>/-<deletions>

---

### Critical / High

| # | Type | File:Line | Finding | Severity | Status |
|---|------|-----------|---------|----------|--------|
(Confirmed critical and high findings only. Include validator notes.)

### Medium

| # | Type | File:Line | Finding | Severity | Status |
|---|------|-----------|---------|----------|--------|

### Low / Nice-to-have

| # | Type | File:Line | Finding | Priority | Status |
|---|------|-----------|---------|----------|--------|

### False Positives Removed
(List what was flagged in Round 1 but rejected in Round 2, with reason -- keeps the review transparent)

### Missed in Round 1 (caught by validators)
(Any new findings validators discovered)

### Dropped as defensive / not a real problem (Round 3)
(Findings whose only remedy was a band-aid and that the adjudicator could not tie to a reachable defect — list each with the one-line reason, for transparency. Surviving defensive findings appear in the tables above with their ROOT_CAUSE source fix or BOUNDARY reject fix, never the band-aid.)

---

**Verdict:** BLOCK / REQUEST_CHANGES / APPROVE_WITH_COMMENTS
**Summary:** 1-2 sentence overall assessment
```

## Rules

- ALL agents run with `run_in_background: true`
- Round 1 agents run in parallel (single message, 3 tool calls)
- Round 2 agents run in parallel (single message, 3 tool calls) AFTER Round 1 completes
- Agents must use `gh pr diff` -- never clone or checkout the branch
- Present Round 1 summary to user while launching Round 2 (don't wait silently)
- Final report must clearly distinguish confirmed vs rejected findings
- If PR diff is very large (>200 files), tell agents to batch by directory/module
- Round 3 runs after Round 2: one adjudicator per defensive-flavored finding. A finding whose only fix is "harden / add a fallback / add a guard / null-check / swallow" must be re-confirmed as ROOT_CAUSE or BOUNDARY, or DROPPED — never reported with a band-aid fix.
- When a finding is real, always report the root-cause (source) fix, never a defensive patch. Defensive validation is acceptable only at a true untrusted-input boundary, and must reject loudly rather than silently default/swallow.
