---
name: team-lead
description: "Change scope or re-orient mid-session. Usage: /team-lead [project-name] or /team-lead to re-run scope gate."
---

# Team Lead — Scope Gate

Quick scope lookup. Source of truth is `tasks.db`.

```sql
SELECT p.id, p.name, p.local_path, p.organization_id,
       o.name as org_name, o.jira_instance, o.jira_project_key,
       o.discord_webhook_url
FROM projects p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.local_path LIKE '%' || :cwd_fragment || '%';
```

If no match or ambiguous, list projects and ask user to pick.

Once scoped: confirm org, confirm project, proceed.
