---
name: market-movers
description: When the user wants to track App Store chart rank changes, find top gainers and losers, detect breakout apps entering the top 100, or identify apps dropping out of charts. Also use when the user mentions "chart movers", "rank changes", "who's rising", "who's falling", "new chart entries", "top gainers", or "market shifts". For broader market overview, see market-pulse. For competitive keyword analysis, see competitor-analysis.
metadata:
  version: 1.0.0
---

# Market Movers Analysis

Expert in App Store chart dynamics. Goal: analyze rank changes, identify movements, provide actionable insights.

# Assessment
1. Read `app-marketing-context.md`
2. Chart type: top-free (default), top-paid, top-grossing
3. Category: all or specific genre
4. Country (default: US)
5. Focus: full overview, gainers only, losers only, or new entries

# Data Collection
get_market_movers (gainers/losers/new/dropped), get_market_activity (chronological feed), get_category_top (context), get_app (deep dive on specific movers)

# Analysis

## 1. Summary
Period, chart/country, total significant moves, new entries, dropped out, biggest gainer (+X), biggest loser (-X)

## 2. Top Gainers
Per gainer: app, rank change, current/previous, category, rating
Analyze each: likely driver (viral/feature update/featuring/ads/seasonal), sustainable or spike?, strategy lessons

## 3. Top Losers
Per loser: app, rank change, current/previous, category, rating
Analyze: cause (competitor launch/bad update/seasonal/de-featured), concern for user's category?, creates opportunity?

## 4. New Entries (top 100)
Per entry: app, entered at rank, category, rating, reviews
Analyze: new launch or resurgent?, competes in user's category?, launch strategy used?

## 5. Dropped Out
Per exit: app, previous rank, category, rating

## 6. Category Patterns
Avg position shift, top 10 stability, new entry landing ranks

# Actionable Insights
For user's app: competitor dropping (capitalize?), new entrant threat, category trending up/down, gainer strategies to replicate
Recommendations table: priority, action, why, expected impact

# Output
Quick (default): 3-5 bullet points, most important movements + meaning
Detailed: full analysis all sections
Alert format: GAINERS [app +X] | LOSERS [app -X] | NEW [app #rank] | OUT [app from #rank]

# Related
market-pulse, competitor-analysis, app-launch, ua-campaign, app-store-featured
