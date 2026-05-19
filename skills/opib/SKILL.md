---
name: opib
description: "Open anything in the browser. Usage: /opib <URL>, /opib <PR#>, or /opib <path>"
metadata:
  version: 2.0.0
---

# Open in Browser

Input types:
- Full URL (http/https) → open directly
- PR number (digits) → resolve via current repo's git remote → `open <github_url>`
- GitHub shorthand (org/repo#123, #123) → resolve to URL
- Local file path → `open <path>`
- No argument → `gh pr list --limit 5`, ask which to open

Steps: parse input type → resolve URL if needed → `open "<url_or_path>"`
