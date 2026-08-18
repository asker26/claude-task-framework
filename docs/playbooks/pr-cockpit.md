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

## Sessions and claims

When you start working on a PR in a Claude session: `!prctl claim <ref>` (optionally `--note "…"`).
The board shows `s:<label>` on that PR so other sessions/you-later know it's taken.
`!prctl whoami` = which session am I; `prctl sessions` = live sessions with their claims; `prctl release [<ref>|--all]`.
Claims auto-release when the session ends (hook) or goes silent for 48h.

## Worker

- `prctl worker start | stop | status`. Picks: explicit queue → `re-review` (oldest push first) → `needs-review`
  (oldest PR first). Never drafts, bots, your PRs, `too-big`, or PRs that already have a staged/running review.
- One review at a time (`CTF_PR_MAX_REVIEWS`), model from `prctl config model` (only `claude-sonnet-5` /
  `claude-opus-4-8`; `CTF_PR_CLAUDE_MODEL` overrides). Subagents inherit it.
- Session cap hit → the run is marked `failed:cap`, requeued, and the worker cools down until the reset time
  (board header shows `cooldown until HH:MM`).
- Reap: a review whose runner died (no heartbeat 30 min) is failed and retried once; twice → `review-failed`.
- `worker stop` kills the running review (not requeued).
- Syncs GitHub every 5 min; `prctl board` self-syncs when older than 10 min; `prctl sync` / `board --fresh` force it.

## Config

```bash
prctl config set model claude-opus-4-8          # or claude-sonnet-5 (default)
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
