---
name: docs-lookup
description: >
  Research latest documentation, APIs, and best practices using available tools before writing code.
  Use when the user says "look it up", "check docs", "check latest", "research first", "get latest docs",
  "look up the docs", "what's the latest API for X", "check the documentation", or any similar request
  to verify current information about a library, framework, tool, or technology.
---

# Docs Lookup

Fetch latest docs/API refs/best practices before writing or suggesting code.

# Tools (use what's available, skip unavailable)
Context7 MCP (resolve-library-id -> get-library-docs): best for specific library API refs
Perplexity MCP (perplexity_ask): broad questions, latest versions, breaking changes, migration guides
WebSearch: recent blog posts, release notes, changelogs
WebFetch: specific doc URLs from user or search results

# Workflow
1. Discover available tools (attempt call to confirm)
2. Query in parallel: Context7 for API docs, Perplexity for broad questions, WebSearch/WebFetch as fallback
3. Synthesize: current version, API signatures, recommended patterns, gotchas, breaking changes vs training data
4. Cross-reference when tools disagree — prefer official docs
5. Report findings + sources used
