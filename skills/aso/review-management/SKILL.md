---
name: review-management
description: When the user wants to analyze, respond to, or improve their app reviews and ratings. Also use when the user mentions "reviews", "ratings", "negative reviews", "how to get more reviews", "review response", or "my rating is dropping". For broader ASO audit, see aso-audit. For retention issues causing bad reviews, see retention-optimization.
metadata:
  version: 1.0.0
---

# Review Management

Expert in app review strategy and reputation management. Goal: turn reviews into growth lever.

# Assessment
1. Read `app-marketing-context.md`
2. App ID (to fetch reviews)
3. Target country (default: US)
4. Current rating + trend (improving/declining?)
5. Currently responding to reviews?

# Sentiment Categories
Bugs/Crashes -> fix + respond with timeline
Feature Requests -> track frequency, consider roadmap
UX Complaints -> prioritize UX improvements
Pricing Complaints -> review monetization
Love/Praise -> thank, ask for sharing
Competitor Mentions -> understand gaps

# Metrics Targets
Avg rating: 4.5+ (below 4.0 hurts conversion significantly)
Trend: stable or improving
Review velocity: consistent (sudden drops = prompt issues)
Response rate: 100% of negative
Response time: <24hrs

# Rating Prompt (SKStoreReviewController)
WHEN: after positive experience (task completed, goal achieved), 3+ sessions, 7+ days usage
NEVER: after crash/error/frustration, during onboarding/first session
Apple rules: max 3 calls per 365 days per device, Apple controls display, no customization
Triggers: achievement, streak (N consecutive days), value delivery (saved money/time), delight moment

# Negative Review Response (HEAR)
H=Hear (acknowledge specific issue), E=Empathize, A=Act (explain fix/timeline), R=Resolve (invite support contact)

Templates:
Bug: "Thank you for reporting. Fixed in [X.X] releasing [date]. Please update and let us know."
Feature request: "Great suggestion, added to roadmap. Stay tuned."
Vague negative: "Sorry about your experience. Please reach out to [support email] with details so we can help."

DON'T: be defensive, copy-paste same response, ignore negatives, ask to change rating (guideline violation), offer incentives

# Detractor->Advocate
Fix issue -> respond acknowledging fix -> follow up via support -> many users update review after resolution

# Competitor Review Mining
Find: unmet needs, common complaints (your opportunity), switching triggers, feature expectations (table stakes)

# Your Review Patterns
Analyze: most mentioned features (pos+neg), user segments, emotional language, competitor mentions

# Output
Review Health Report:
```
Rating: [X.X] stars ([trend up/down/stable]), Total: [N], Last 30d: [N] reviews [X.X] avg, Response rate: [X]%
Top Issues: 1.[issue]x[N] 2.[issue]x[N] 3.[issue]x[N]
Top Praise: 1.[praise]x[N] 2.[praise]x[N]
```
Action Plan: Immediate (respond to negatives), This week (fix top bug, optimize prompt), This month (top feature request, competitor review analysis)
Response drafts for most impactful negatives.

# Related
aso-audit, retention-optimization, competitor-analysis, app-analytics
