---
name: readable-ultra
description: "Deep readability review of a PR with finder + adversarial validator agents, based on Clean Code / The Art of Readable Code principles. Usage: /readable-ultra <PR#> [repo]"
metadata:
  version: 1.0.0
---

# Readable Ultra

Multi-agent **readability** review. Finds code that compiles fine and works fine but slows the next reader down. Companion to `/reviewer-ultra` (which hunts regressions/bugs/smells) — this skill hunts comprehension cost only. Can run standalone or as an extra finder inside a reviewer-ultra run.

**Core metric** (The Art of Readable Code): minimize *time-to-understand* for a new reader. A finding is only valid if it materially slows a reader down or misleads them — not because it violates a rule in the abstract.

## Arguments

- `<PR#>` (required): PR number to review
- `[repo]` (optional): org/repo slug. If omitted, detect from `git remote get-url origin`.

## Round 1: Discovery (1–3 parallel finder agents)

For PRs under ~30 changed files, one finder. Larger PRs: split file list into 2–3 batches by directory/module, one finder per batch. Each finder reads the PR diff (`gh pr diff <PR#> --repo <repo>`, or a pre-cached copy in /tmp) and may grep the local clone **read-only** for surrounding context and sibling-file conventions.

Each finder checks ONLY new/changed code against this checklist:

### Naming
- Vague/generic names on non-trivial scopes: `tmp`, `data`, `result`, `info`, `handle()`, `process()`, `manager`
- Names that can be misread or lie about what the thing does/holds
- Missing units or qualifiers: `timeout` vs `timeoutSeconds`, `size` vs `sizeMb`
- Booleans not named `is/has/can/should`, or negated (`notDisabled`, `skipValidation = false`)
- Inconsistent vocabulary for one concept within the PR (`fetch`/`get`/`load`/`retrieve` for the same kind of operation)
- Unsearchable names: single letters or magic numbers where a named constant is warranted

### Functions & structure
- Function does several unrelated things (name contains "and", or wants to)
- Mixed abstraction levels in one body (business rule next to byte-twiddling)
- Long parameter lists (>3) or boolean flag parameters that fork behavior
- Surprising side effects (a getter/checker that mutates or writes)
- Copy-paste blocks with slight variations that should be one extracted helper (DRY)
- Speculative generality: abstraction/config/indirection nothing uses yet (YAGNI)

### Control flow & expressions
- Deep nesting where guard clauses / early returns would flatten it
- Complex boolean expressions needing "explaining variables" or De Morgan simplification
- Clever one-liners requiring mental simulation to verify
- Redundant `else` after `return`/`throw`; positive case not first

### Comments
- Comments restating the code; noise comments; commented-out code
- Stale or wrong comments (worse than none)
- Surprising/counterintuitive code with NO why-comment ("director's commentary" missing)
- TODOs with no context, owner, or condition

### Error handling readability
- Happy path buried inside error handling
- Silently swallowed exceptions
- Returning `null`/sentinels that force checks at every call site

### Consistency
- Deviates from this codebase's established patterns (always check 1–2 sibling files before flagging)
- Inconsistent response/DTO/format shapes introduced within the PR itself

### Tests
- Test names that don't state the behavior under test
- Multiple unrelated assertions in one test; no arrange/act/assert shape

**Out of scope**: pure formatter territory (indentation, spacing, import order — linters/php-cs-fixer own that), bugs/regressions (that's `/reviewer-ultra`), and personal style preferences with no comprehension cost.

For each finding: file + line range, the issue, why it slows a reader down, suggested fix, severity:
- **high** — actively misleading (name/comment lies; will cause maintenance bugs)
- **medium** — real comprehension cost, should fix in this PR
- **low** — nice-to-have polish

## Round 2: Validation (adversarial, chunked)

Spawn validators with ≤5 findings each (never more than 6 per validator). Each validator tries to **refute** every finding:
- Re-read the actual diff hunk and surrounding code
- Grep the local clone (read-only) — if the "violation" is the project-wide convention, it's a FALSE POSITIVE
- Verdict per finding: **CONFIRMED**, **FALSE_POSITIVE** (reason), or **ADJUSTED** (new severity + reason)
- Flag high-confidence readability issues Round 1 MISSED

## Final Report

```markdown
## PR #<N> Readability Review: <title>
**Repo:** <org/repo> | **Files:** <N> | **Changes:** +<adds>/-<dels>

### High (misleading)
| # | File:Line | Finding | Fix | Status |

### Medium (should fix)
| # | File:Line | Finding | Fix | Status |

### Low (polish)
| # | File:Line | Finding | Fix | Status |

### False positives removed
(what Round 1 flagged, why Round 2 rejected it)

**Verdict:** READABLE / NEEDS_WORK / HARD_TO_MAINTAIN
**Summary:** 1–2 sentences on overall time-to-understand for this PR.
```

## Rules

- Finders and validators are READ-ONLY — never edit, checkout, or run mutating commands in the local clone
- Validators get ≤5 findings each; split larger sets across parallel validators
- Every finding must name the principle it violates AND the concrete reader cost
- Project conventions beat book rules: consistent-but-imperfect beats novel-but-clean
- Prefer a cached diff in /tmp over re-fetching per agent on large PRs

## Sources

Distilled from:
- [5 key practices for improving code readability](https://www.invensity.com/2023/10/04/from-confusion-to-clarity-5-key-practices-for-improving-code-readability/) — Invensity
- [The Complete Guide to Readable Code: 11 Principles](https://fellow.ai/blog/the-complete-guide-to-readable-code/) — Fellow
- [7 Clean Coding Principles Every Developer Should Know](https://www.pullchecklist.com/posts/clean-coding-principles) — PullChecklist
- [Summary of Clean Code by Robert C. Martin](https://gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29) — wojteklu gist
- [The Art of Readable Code](https://www.oreilly.com/library/view/the-art-of/9781449318482/) — Boswell & Foster, O'Reilly
