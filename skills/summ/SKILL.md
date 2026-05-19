---
name: summ
description: "Summarize the current session - what's being worked on, progress, and next steps. Usage: /summ"
metadata:
  version: 1.0.0
---

# Session Summary

Generate a terse summary of the current conversation. Include:

1. **Focus**: What project/task this session is about (one line)
2. **Done**: Bullet list of completed actions (commits, edits, fixes, decisions made)
3. **In Progress**: What's actively being worked on right now, if anything
4. **Next**: The immediate next step or pending item
5. **Blockers**: Anything waiting on user input or external dependency (omit if none)

Rules:
- Keep it short — max 10 lines total
- No filler, no commentary
- If the session just started or nothing meaningful has happened yet, say so in one line
- Use the conversation history as the sole source of truth
