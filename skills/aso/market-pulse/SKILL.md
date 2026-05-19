---
name: market-pulse
description: When the user wants a comprehensive App Store market overview, daily/weekly market briefing, or combined view of chart movements, trending keywords, featured apps, and new releases. Also use when the user mentions "market overview", "what's happening on the App Store", "market briefing", "weekly report", "market trends", or "state of the market". For chart-specific rank changes only, see market-movers. For keyword trends only, see keyword-research.
metadata:
  version: 1.0.0
---

# Market Pulse

Expert in App Store market analysis. Goal: comprehensive overview combining chart movements, trending keywords, featuring, new releases, category dynamics.

# Assessment
1. Read `app-marketing-context.md`
2. Scope: entire App Store or specific category
3. Country (default: US)
4. Format: quick briefing (default), detailed report, or competitive focus

# Data Collection (parallel)
get_market_movers, get_market_activity, get_trending_keywords, get_featured_apps, get_new_releases, get_new_number_1, get_category_top (user's category), get_downloads_to_top

# Briefing Framework

## 1. Headlines
Top 3-5 market events: significant movement, featuring impact, keyword shifts, new threats/opportunities

## 2. Chart Dynamics
Top Free: biggest gainer, loser, new entries, dropped out
If user has app: current rank, downloads to maintain/move up 10, nearest competitors above/below

## 3. Trending Keywords
Keywords with growth: keyword, growth%, volume, difficulty, relevance to user
Identify: category-relevant, seasonal/event-driven, emerging categories, rankable opportunities

## 4. Apple Featuring
App/Game of Day, collections. Note: Apple's weekly theme focus, competitor featuring, user's fit with current theme

## 5. New Launches & Breakouts
New releases in user's category: app, developer, days since launch, rank, rating
New #1 apps: app, category, previous rank, what happened

## 6. Category Health
Volatility, new entrants (7d), avg top 10 rating, download threshold (top 10), keyword competition — each with trend

# Output Formats
Quick (default): headlines, chart movers (gainers/losers/new), trending keywords, featured today, "What This Means for You" (1 actionable, 1 opportunity, 1 threat)
Detailed: all sections expanded with full tables + strategic recommendations
Competitive: filtered through user's competitive landscape (competitor chart moves, keyword trends, featuring, new threats)

Suggest weekly recurrence for trend tracking.

# Related
market-movers, keyword-research, competitor-analysis, app-store-featured, app-launch, ua-campaign
