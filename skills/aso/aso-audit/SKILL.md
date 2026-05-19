---
name: aso-audit
description: When the user wants a full ASO health audit, review their App Store listing quality, or diagnose why their app isn't ranking. Also use when the user mentions "ASO audit", "ASO score", "why am I not ranking", "listing review", or "optimize my app store page". For keyword-specific research, see keyword-research. For metadata writing, see metadata-optimization.
metadata:
  version: 1.0.0
---

# ASO Audit

Expert in App Store Optimization (Apple+Google ranking algorithms). Goal: comprehensive health audit + prioritized actions.

# Assessment
1. Read `app-marketing-context.md` if available
2. App ID (Apple numeric or Google package name)
3. Target country (default: US)
4. Platform: iOS / Android / Both

# Data Collection
If API available: metadata, keyword rankings, competitor data (top 3-5), category position, review sentiment. Otherwise ask user for current metadata.

# Audit (score each 0-10, weighted avg = overall)

## 1. Title (20%)
Checks: #1 keyword present?, close to 30ch?, brand vs keyword balance?, natural (not stuffed)?, distinct from competitors?
9-10: primary kw+brand, natural, full chars | 7-8: has kw, room to optimize | 4-6: missing primary kw or poor balance | 0-3: generic, no kw, truncated

## 2. Subtitle (15%, iOS only)
Checks: secondary keywords (not in title)?, no repetition?, communicates benefit?, close to 30ch?

## 3. Keyword Field (15%, iOS only)
Checks: no repeats from title/subtitle?, commas no spaces?, singular forms?, all 100ch used?, all relevant?, no brand/category/"app"?

## 4. Description (5% iOS / 15% Android)
Checks: compelling first 3 lines?, benefits not just features?, keyword density natural (Android)?, formatting (breaks/bullets/emoji)?, CTA?, social proof?

## 5. Screenshots (15%)
Checks: all 10 slots?, best features first 3?, readable benefit captions?, cohesive design?, localized?, modern frames?

## 6. Preview Video (5%)
Checks: exists?, hook in 3s?, 15-30s?, works without sound?

## 7. Ratings & Reviews (15%)
Checks: 4.5+?, sufficient count?, positive last-30d trend?, dev responds to negatives?, strategic rating prompts?

## 8. Icon (5%)
Checks: distinctive in search?, clear at small size?, category fit?, no text?

## 9. Keyword Rankings (10%)
Checks: top 10 for target kw?, enough coverage?, trend up/down?, missing competitor keywords?

## 10. Conversion Signals (5%)
Checks: promo text used?, recent What's New?, in-app events?, custom product pages?

# Output
ASO Score Card: overall X/100, per-factor X/10 with bar visualization
Quick Wins (today): 3-5 immediate high-impact changes
High-Impact (this week): 3-5 higher-effort significant changes
Strategic (this month): 3-5 long-term improvements
Competitor Comparison: table vs top 3 on key metrics

# Related
keyword-research, metadata-optimization, screenshot-optimization, competitor-analysis, review-management
