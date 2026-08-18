# PR Cockpit — how I actually use it

`prctl` is a **terminal command**. It is not a Claude session and does not need one open.
It answers "what needs me, what's stale, did I already review this, which session is on it",
runs first-pass reviews for you in the background, and stages the reports for you to post.
Claude Code sessions are still where you *work* on a PR (fix, discuss, deep-dive) — the
cockpit just removes the bookkeeping and the review labour around them.

Design: `docs/plans/2026-08-17-pr-cockpit-design.md` (local). Reference: `README.md` → *prctl*, `CLAUDE.md` → *PR Cockpit*.

## Setup (once)

```bash
# already done 2026-08-17: ~/.zshrc exports scripts/ on PATH → `prctl` works bare in every new terminal
scripts/doctor                     # tables + view + hooks should be [ok]
prctl config list                  # model=claude-sonnet-5, max_diff=3000, stale_*=3/7, ignore_repos=…
```

Session hooks are already installed in `~/.claude/settings.json` (`scripts/install-pr-hooks.sh`
re-installs idempotently). They register every Claude session; nothing else to do.

## Where things live

| what | where |
|---|---|
| state (PRs, reviews, sessions, claims, settings) | `tasks.db` — tables `prs`, `pr_reviews`, `sessions`, `pr_claims`, `pr_settings`; view `pr_board` |
| staged / posted reports | `.reviews/<repo>-<n>-<sha7>.md` (markdown, gitignored) |
| raw review-session logs | `.reviews/logs/<same>.log` (stream-json) |
| worker | tmux `ctf-agents:pr-worker`; each review runs in `ctf-agents:review-<repo>-<n>` |

## Web UI (optional, local only)

```bash
prctl serve --bg            # http://127.0.0.1:7787 in tmux ctf-agents:pr-serve   (prctl serve stop; --port N; CTF_PR_UI_PORT)
prctl serve                 # same, in the foreground
```

One page: header (sync age, worker state, model, Start/Stop worker, Sync), the running review with its last
action + agents count, staged reports, queue, the board with **queue review / skip** buttons, live sessions,
last-48h outcomes. Click any ref → the rendered report on the right with **Post to GitHub** (verdict override,
full/stripped), **Discard**, **Re-review**, **Session log**, **Full page ↗** (`/report?ref=repo%23N` — the report
alone, tab-friendly). Every button runs the same `prctl` command the CLI would; posting still asks for
confirmation. Light/dark follows the OS; ☀/☾ in the header overrides (remembered). Bound to 127.0.0.1, no auth
— do not expose it.

## Live status

```bash
prctl watch                 # live dashboard (15s refresh): worker state, current review + its last action,
                            # agents spawned, queue, staged reports, last-24h outcomes. --once for a snapshot.
prctl log <ref>             # readable tail of the review session (follows while running): tools, agents, text
prctl history [--days N]    # every run: status, verdict, attempts, how long it took, errors
prctl worker status         # one-liner + queue/running rows
```

## Three ways to drive it

1. **Terminal**: `prctl board`, `prctl read <ref>`, `prctl post <ref>` …
2. **Inside any Claude Code session**: prefix with `!` — `!prctl board`, `!prctl claim bookneticsaas#3128`.
   Or just ask ("what needs review?") — CLAUDE.md + memory tell Claude to run `prctl` instead of `gh`.
3. **Watching a live review**: `tmux attach -t ctf-agents` → window `review-<repo>-<n>` (optional; `Ctrl-b d` to detach).

## The daily loop

```bash
prctl board                          # 1. read NEEDS YOU top-down (stale first, then oldest)
prctl worker start                   # 2. first-pass reviews run in the background, one at a time (Sonnet 5)
                                     #    --queue-only = run only what you `prctl review`ed; --sync-only = board only
prctl staged                         # 3. what's ready to read
prctl read bookneticsaas#3155        #    the report, in the terminal (or `prctl edit …` in $EDITOR)
prctl post bookneticsaas#3155        # 4. shows verdict → GitHub event, asks y/N, posts under YOUR account
                                     #    --verdict RC|A|C overrides, --full keeps the transparency sections
prctl discard bookneticsaas#3155     #    …or throw the report away
prctl skip <ref> --days 7            # 5. mute noise; unskip <ref> to bring it back
```

- **NEEDS YOU** = `staged` (report ready) · `re-review` (author pushed after your review) · `author-replied` ·
  `needs-review` · `review-failed` (worker gave up twice — run it yourself) · `running`.
- **WAITING ON AUTHOR** = you requested changes at head, nothing new since. `STALE` after 3 days → nudge the dev.
- **APPROVED** = your last review at head is an approval; `ready ✓` = also mergeable + CI green. Merging stays manual.
- **MINE** = your own PRs, with the team's review decision.
- Flags: `STALE`, `conflicts`, `ci-red`, `too-big` (over `max_diff` lines — never auto-reviewed; `prctl review <ref>` queues it explicitly), `s:<session>` (who claimed it).

## Reports

`prctl review <ref>` queues a review; the worker runs it; when it finishes you get a macOS notification and the
PR shows `staged <VERDICT>` on the board. Read with `prctl read <ref>`, edit with `prctl edit <ref>`, or open
`.reviews/` in any editor. Reports are never posted automatically. `staged (behind)` = the author pushed after
the report was written — post it anyway or `prctl review <ref>` again.

`prctl review <ref> --now` runs the review in your current terminal (foreground) instead of the worker.

`prctl merge <ref>` (or the **Merge PR** button — with an *admin* checkbox for branch-protection overrides)
merges on GitHub using `config merge_method` (default squash; `--method`, `--admin` on the CLI). It refuses
drafts, warns on conflicts/red CI, always confirms, and **deletes the head branch** afterwards — unless the
head is main/master/develop(ment)/release* or you pass `--keep-branch`. The APPROVED/MINE board rows show a merge button when
`ready ✓`.

The worker's review prompt enforces the severity bar: a numbered finding must name a user action or code path
that breaks; "state intent" / empty-PR-body / TDD-compliance asks are banned from findings (at most one
'Process notes' line, never affecting the verdict). Optimize additionally strips any that slip through.

`prctl optimize <ref>` (or the **Optimize** button) rewrites the report into a compact author-facing version —
verdict + concrete findings only, all "none found"/process narration dropped — saved as `<report>-opt.md`.
The UI then defaults to the optimized view (toggle to original any time) and pre-checks **post optimized**;
CLI: `prctl post <ref> --optimized`. Runs one small headless call on the configured worker model (~1 min).

## Steering a review

A worker review is headless — it takes no input mid-flight. The three controls, all on the UI too:

- **Directions at queue time**: `prctl review <ref> --notes "focus on the payment flow, ignore CSS"` — injected
  into the review prompt as lead directions (the *queue review* buttons ask for them). Requeues keep the notes.
- **Abort**: `prctl abort <ref>` (or the *abort* button on the running card) kills the run, no requeue.
- Interactive sessions (take over / work on it) run on `config session_model` — `claude-sonnet-5` by
  default; `claude-opus-5` / `claude-opus-4-8` allowed; Fable models are rejected. Env override:
  `CTF_PR_SESSION_MODEL`.
- **Take over**: `prctl takeover <ref> [--notes "…"]` (or *Take over*) opens an interactive Claude session in a
  tmux window in the repo (a Terminal window attaches automatically) — it starts `/reviewer-ultra` and follows
  your directions live; it never posts unless you say so.
- **Work on it**: `prctl work <ref> [--notes "…"]` (or *Work on it*) — an interactive session ON the PR branch,
  checked out in a dedicated worktree under `.workspaces/pr-<repo>-<n>` (your main checkout is never touched;
  falls back to the repo dir with a don't-switch-branches warning when no worktree is possible). It gets the
  staged report path so "fix findings 1 and 3" works directly; it never pushes/merges without an explicit go.
  Clean up later: `git -C <repo> worktree remove .workspaces/pr-…` (or /ctf-clean).

If a runner dies mid-review (Mac sleep is the usual killer), nothing is lost: reviews run under `caffeinate`,
and the reaper stages a finished report it finds instead of re-running (`error: runner died; report salvaged`).

## Web terminal & Jira tickets

- The UI is a React + TypeScript + Tailwind + shadcn-style app in `ui/` (Vite). `prctl serve` serves the
  committed build from `ui/dist` — no Node needed to run it. To change the UI: `cd ui && npm install &&
  npm run dev` (proxies /api to :7787), then `npm run build` and commit `dist/`.
- `/term` (linked as **web term** on running cards and report pages) mirrors any tmux window of the cockpit
  session in the browser — watch what Claude does live and type to it (input box + Esc/Ctrl-C keys). Your
  interactive sessions are the `take-*` / `work-*` windows; `review-*` are the headless runs.
- **→ Jira** next to every finding row in a report creates a BOOKNETIC work item from it (via `acli`;
  the summary is editable in the prompt, the body carries file:line + finding + PR link). CLI:
  `prctl ticket <ref> --title "…" [--body "…"]` — the Jira project comes from the org's `jira_project_key`.
  Created tickets are saved (`pr_tickets`) and shown as links on the PR's report card; `prctl tickets`
  lists them all, `prctl show <ref>` includes the PR's own.
- **discard** next to each finding hides it from the report AND from the posted review body (a slim
  "discarded — undiscard" strip replaces the row; fully undoable). Stored per review + view in
  `pr_finding_discards` — a discard made on the optimized view applies when posting optimized, and
  vice versa. CLI: `prctl fdiscard/frestore <ref> <fkey>`.

## Sessions and claims

When you start working on a PR in a Claude session: `!prctl claim <ref>` (optionally `--note "…"`).
The board shows `s:<label>` on that PR so other sessions/you-later know it's taken.
`!prctl whoami` = which session am I; `prctl sessions` = live sessions with their claims; `prctl release [<ref>|--all]`.
Claims auto-release when the session ends (hook) or goes silent for 48h.

## Worker

- `prctl worker start | stop | status`. Picks: explicit queue → `re-review` (oldest push first) → `needs-review`
  (oldest PR first). Never drafts, bots, your PRs, `too-big`, or PRs that already have a staged/running review.
- **Modes**: `start` (auto) also picks from the board by itself; `start --queue-only` runs only what you queued
  (`prctl review <ref>` / the *queue review* button); `start --sync-only` keeps the board fresh and reviews nothing.
- **Concurrency**: `prctl config set max_reviews N` (applies live, no restart; env `CTF_PR_MAX_REVIEWS` overrides). Set to 3 on 2026-08-18.
  One reviewer-ultra run is already ~7–10 parallel agents; two PRs at once doubles the burn and hits the
  usage cap mid-flight (in-flight agents die). Serial = a cap hit costs one review, then the cooldown resumes.
- Model from `prctl config model` (only `claude-sonnet-5` / `claude-opus-4-8`; `CTF_PR_CLAUDE_MODEL` overrides).
  Subagents inherit it.
- Session cap hit → the run is marked `failed:cap`, requeued, and the worker cools down until the reset time
  (board header shows `cooldown until HH:MM`).
- Reap: a review whose runner died (no heartbeat 30 min) is failed and retried once; twice → `review-failed`.
- `worker stop` kills the running review (not requeued).
- Syncs GitHub every 5 min; `prctl board` self-syncs when older than 10 min; `prctl sync` / `board --fresh` force it.

## Config

```bash
prctl config set model claude-opus-4-8          # or claude-sonnet-5 (default)
prctl config set max_reviews 2                  # concurrent review sessions (default 1 — see Worker)
prctl config set max_diff 3000                  # too-big threshold (added+deleted lines)
prctl config set stale_author_days 3            # waiting-on-author → STALE
prctl config set stale_days 7                   # no activity at all → STALE
prctl config set ignore_repos "open-appointment-backend,planly-frontend"
prctl config set ignore_authors "dependabot[bot],github-actions[bot]"
```

## When something looks off

| symptom | do |
|---|---|
| board says `synced ?m ago` / empty | `prctl sync` — needs `gh auth status` OK |
| a PR shows `review-failed` | `prctl show <ref>` → `error` column; `.reviews/logs/…` has the stream; `prctl review <ref>` retries |
| worker `stopped` but a `running` row remains | `prctl worker start` (its reap fixes it within 30 min) or `prctl discard <ref>` |
| you reviewed on GitHub directly | next sync picks it up (`my_review_*` come from GitHub) — nothing to do |
| a session isn't listed | it registers on its next prompt (UserPromptSubmit hook); `prctl claim` also registers it |
| tests | `scripts/test-prctl` (offline, ~1 min) |
