---
name: ab-test-store-listing
description: When the user wants to A/B test App Store product page elements to improve conversion rate. Also use when the user mentions "A/B test", "product page optimization", "test my screenshots", "test my icon", "conversion rate optimization", "CPP", or "custom product pages". For screenshot design, see screenshot-optimization. For metadata optimization, see metadata-optimization.
metadata:
  version: 1.0.0
---

# A/B Test Store Listing

Expert in App Store product page A/B testing. Goal: design, run, interpret tests that improve conversion.

# Assessment
1. Read `app-marketing-context.md`
2. App ID
3. Current conversion rate (from ASC)
4. Daily impressions (determines test duration)
5. What to test? (icon, screenshots, description, etc.)

# Apple PPO (Product Page Optimization)
Testable: icon (3 variants), screenshots (3 variants), preview video (3 variants)
NOT testable: description, title, subtitle
Limits: organic traffic only, 90% confidence min, 7-90 days, one test at a time, auto traffic split

# Custom Product Pages (CPP)
35 per app, each with unique screenshots/videos/promo text. Use for: different audiences, value props, seasonal, localized creative. NOT a true A/B test — targeted pages from specific URLs/campaigns.

# Prioritization (impact x effort)
1. First screenshot: 15-30% lift possible, medium effort
2. Icon: 10-20% lift, medium effort
3. Screenshot order: 5-15% lift, low effort
4. Screenshot style: 5-15% lift, high effort
5. Preview video: 5-10% lift, high effort
ALWAYS start with first screenshot — highest impact, 80% of users never scroll past first 3.

# Test Design
Step 1 Hypothesis: "If we [change], then [metric] will [improve] because [reason]"
Step 2 Variants: 2-3 (incl control). Rules: change ONE thing (isolate variable), significant enough to detect, clear hypothesis each, max 3 variants.
Step 3 Sample Size: <1K daily impressions = 30-90 days; 1K-5K = 14-30 days; 5K+ = 7-14 days; need 1K+ impressions per variant min.
Step 4 Run: ASC -> Product Page Optimization -> create test -> upload variants -> let run to significance, don't stop early.
Step 5 Interpret: Apple needs 90% confidence min, aim 95%. Check: CVR lift, confidence interval, impression-to-tap, download rate, segment diffs.

# Common Tests
Icon: color (5-20% TTR), style detailed->simplified (5-15%), symbol change (5-20%), background solid->gradient (3-10%)
Screenshots: feature->benefit focused (10-30% CVR), add social proof (5-15%), text size small->large (5-10%), light->dark mode (5-15%), add frames->full-bleed (5-10%), reorder by benefit (5-15%)
Video: add video (5-15% CVR), feature demo->problem/solution hook (5-10%), 30s->15s (3-8%)

# Output
Test Plan: name, element, hypothesis, variants (control+B+C), duration estimate, required impressions, success metric, MDE%
Results Interpretation: statistical significance, actual lift+CI, segment diffs, next test, estimated annual impact
Testing Roadmap: 3-month calendar, one test per month prioritized by impact

# Related
screenshot-optimization, metadata-optimization, app-analytics, aso-audit
