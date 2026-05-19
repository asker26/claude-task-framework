---
name: appstoreconnect
description: "Manage App Store Connect metadata via the ASC API. Usage: /appstoreconnect"
metadata:
  version: 2.0.0
---

# App Store Connect CLI

tool: tools/asc/ (or your own ASC API wrapper)
run: cd tools/asc && npx tsx bin/asc.ts <command>

# Commands
list-apps: list all apps
get-app <appId>: name, subtitle per locale
get-version <appId>: keywords, description, whatsNew
update-info <localizationId> --name "..." --subtitle "..."
update-version <localizationId> --keywords "..." --description "..." --whats-new "..."

# Setup
1. Create an API key in App Store Connect (Users and Access -> Integrations -> App Store Connect API)
2. Download the .p8 file and place it at ~/.appstoreconnect/AuthKey_<KEY_ID>.p8
3. Note your Key ID and Issuer ID from the same page
4. Configure auth in your ASC tool (JWT signed with the .p8 key, cached 20min)

# Workflows
Rename: list-apps -> get-app <id> -> update-info <locId> --name --subtitle
Update Keywords: list-apps -> get-version <id> -> update-version <locId> --keywords

# Constraints
Name: 30ch, Subtitle: 30ch, Keywords: 100ch comma-separated
Name/subtitle changes need new version+review. Keywords can update on existing versions.
ALWAYS get-app/get-version first for localization IDs (change between versions).
