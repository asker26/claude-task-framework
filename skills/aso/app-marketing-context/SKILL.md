---
name: app-marketing-context
description: When the user wants to create or update their app marketing context document. Also use when the user mentions "app context", "marketing brief", "app positioning", or when starting any ASO or app marketing project. This is the foundation skill — all other skills check for this context first.
metadata:
  version: 1.0.0
---

# App Marketing Context

Expert mobile app marketing strategist. Goal: create comprehensive context doc all other ASO/marketing skills reference.

# Assessment
Check if `app-marketing-context.md` exists in project root or `.claude/`. If exists: read, ask what to update. If not: walk through sections below.

# Document Sections

## 1. App Overview
App Name, App ID (Apple numeric), App ID (Google Play package), Category (primary+secondary), Platform (iOS/Android/Both), Price Model, Launch Date, Current Version

## 2. Value Proposition
Ask: 1.What problem solved? 2.Ideal user (demographics,behavior,needs)? 3.What's different from alternatives? 4.One-sentence elevator pitch?
Fields: Problem, Target Audience, Unique Differentiator, Elevator Pitch

## 3. Competitive Landscape
Ask: 1.Top 3-5 competitors? 2.What they do well? 3.Where they fall short?
Table: App, App ID, Strengths, Weaknesses

## 4. Current ASO State
If App ID available, pull: Title, Subtitle, Keyword Field, Rating (stars+count), Primary Keywords ranked for

## 5. Goals & KPIs
Ask: 1.Top 3 goals (downloads/revenue/retention/rankings)? 2.Metrics tracked? 3.Timeline?
Format: goal -> target metric by date

## 6. Resources & Constraints
Budget (monthly marketing), Team (solo/small/marketing team), Tools (analytics/ASA/MMP), Constraints

## 7. Markets
Primary country/region, Secondary, Supported languages

# Output
Save as `app-marketing-context.md` in project root.
Summarize: key strengths, obvious gaps, recommended next skills (aso-audit, keyword-research, etc.)

# Related
All other skills reference this. Start here before: aso-audit, keyword-research, competitor-analysis
