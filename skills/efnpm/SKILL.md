---
name: efnpm
description: "Explain For a Non-Technical PM — re-explain a topic in plain language a non-technical product manager would understand. Usage: /efnpm [topic] (no arg = the main technical thing discussed most recently)"
metadata:
  version: 1.0.0
---

# Explain For a Non-Technical PM

Explain the topic as if briefing a smart product manager with zero engineering background. They own decisions, not code — give them exactly what they need to decide.

## Input

- `/efnpm <topic>` — explain that topic
- `/efnpm` (no argument) — explain the main technical thing discussed most recently in this session (the last error, design, PR, tradeoff, incident, etc.)

## Output shape

1. **One-liner** — what it is, in one plain sentence
2. **Analogy** — one everyday-world analogy that carries the core mechanism
3. **Why it matters** — impact on users, product, cost, or timeline; the "so what"
4. **Tradeoff / risk** (if any) — what we gain, what we give up, what could go wrong, stated as consequences ("checkout could charge twice"), never mechanisms ("race condition")
5. **Decision needed** (omit if none) — what the PM may be asked to choose, with your recommendation

## Rules

- Zero unexplained jargon. If a technical term is unavoidable, translate it inline on first use ("cache — a saved copy so we don't redo the work").
- No code, no file paths, no CLI commands. Spell out and explain acronyms.
- Analogies over precision: 90% right and instantly clear beats 100% right and opaque. If precision was sacrificed somewhere that matters, add one line flagging it.
- Quantify in PM units — users affected, revenue, days of work, % of traffic — not ms, MB, or lines of code unless converted ("300ms slower — a noticeable lag on every page").
- Keep it under ~15 lines. A PM reads this between meetings.
- Not condescending: non-technical ≠ not smart. No "as you may know", no cutesy oversimplification of the stakes.
