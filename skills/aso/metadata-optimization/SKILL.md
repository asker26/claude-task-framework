---
name: metadata-optimization
description: When the user wants to optimize App Store metadata — title, subtitle, keyword field, or description. Also use when the user mentions "optimize my title", "ASO metadata", "keyword field", "character limits", "app description", or "write my subtitle". For keyword discovery, see keyword-research. For full ASO audits, see aso-audit.
metadata:
  version: 1.0.0
---

# Metadata Optimization

Expert ASO copywriter. Goal: metadata that ranks for target keywords AND converts.

# Assessment
1. Read `app-marketing-context.md`
2. App ID (current metadata)
3. Target keywords (or run keyword-research first)
4. Platform: iOS / Android / Both
5. Target country (default: US)

# Limits
iOS: Title 30ch (indexed, highest weight), Subtitle 30ch (indexed, 2nd weight), Keywords 100ch (indexed, hidden, comma-sep), Description 4000ch (NOT indexed, conversion only), Promo Text 170ch (not indexed, no review needed), What's New 4000ch
Android: Title 30ch (indexed, highest), Short Desc 80ch (indexed, visible), Full Desc 4000ch (indexed, density matters)

# Title
Goal: #1 keyword + brand name, naturally.
Formulas: "[Brand] - [Primary Keyword]", "[Brand]: [Benefit]", "[Keyword] [Brand]"
Rules: lead brand if known, keyword if not. No stuffing. Must read naturally. Use full 30ch. Avoid special symbols.
Provide 3 options with char counts + keyword analysis.

# Subtitle (iOS)
Goal: secondary keywords complementing title. NEVER repeat title keywords. Benefits > features. Full 30ch.
Provide 3 options with char counts.

# Keyword Field (iOS)
Rules: comma-separated NO spaces, never repeat title/subtitle words, singular forms only (Apple indexes both), exclude app name/category/"app"/"free"/competitor brands. Prioritize: volume x relevance.
Output: `kw1,kw2,kw3,...` + `Characters: [X]/100`

# Description (iOS — conversion)
Structure: 1.Hook (first 3 lines, all users see) 2.Social proof 3.Key features (4-6 bullets, benefits not features) 4.How it works (3 steps) 5.Testimonial 6.CTA
Rules: first 170ch critical (visible pre-"more"), line breaks for scannability, benefits ("Sleep better tonight") not features ("White noise generator"), social proof early

# Description (Android — SEO+conversion)
Same structure + include keywords naturally (2-3% density), front-load first paragraph, use variations/synonyms. NO stuffing (Google penalizes).

# Promo Text (iOS)
No review needed. Use for: seasonal promos, feature launches, awards/milestones, events.

# Output
Per field: recommended + Alt A (different keyword emphasis) + Alt B (different positioning). Each with: char count [X]/[limit], keywords covered, rationale.
Keyword Coverage Matrix: keyword x field (Title/Subtitle/KW Field) presence.
Before/After: current vs recommended + improvement.

# Mistakes to Flag
Repeating keywords across title/subtitle/KW field, plural forms in KW field, spaces after commas, brand in KW field, keyword stuffing hurting readability, not using all chars, description starting "Welcome to..."

# Related
keyword-research, aso-audit, localization, ab-test-store-listing, competitor-analysis
