---
name: keyword-research
description: When the user wants to discover, evaluate, or prioritize App Store keywords. Also use when the user mentions "keyword research", "find keywords", "search volume", "keyword difficulty", "keyword ideas", or "what keywords should I target". For implementing keywords into metadata, see metadata-optimization. For auditing current keyword performance, see aso-audit.
metadata:
  version: 1.0.0
---

# Keyword Research

Expert ASO keyword researcher. Goal: discover high-value keywords, build prioritized strategy.

# Assessment
1. Read `app-marketing-context.md`
2. App ID (current rankings)
3. Target country (default: US)
4. Seed keywords (3-5 core function words)
5. Intent: downloads, revenue, or brand awareness?

# Process

## Phase 1: Seed Expansion
Apple Search Suggestions: each seed -> autocomplete, try "[kw] app", "[kw] for [audience]", "best [kw]", note long-tail (lower competition)
Competitor Keywords: top 3-5 competitors' rankings, find gaps (they rank, you don't), find weak spots (they rank poorly)
Category Analysis: top apps' target keywords, category-specific terms
Synonyms: related terms, user problem language (not solution), misspellings, abbreviations

## Phase 2: Evaluation
Per keyword: Search Volume (1-100), Difficulty (1-100), Relevance (match to app), Intent (download intent? "how to edit photos" vs "photo editor app"), Current Rank (existing > new)

## Phase 3: Opportunity Score
Score = (Volume x 0.4) + ((100-Difficulty) x 0.3) + (Relevance x 0.3)

## Phase 4: Grouping
Primary (3-5): highest opportunity, must be in title/subtitle, define positioning
Secondary (5-10): good opportunity, subtitle+keyword field, may rotate
Long-tail (10-20): lower volume+specific intent, fill keyword field, easier to rank
Aspirational (3-5): high volume+difficulty, long-term targets, track don't sacrifice primaries

# Output
Summary: total analyzed, high-opportunity count, estimated total monthly volume
Top Keywords table: keyword, volume, difficulty, relevance, opportunity score, current rank, action (primary/secondary/long-tail)
Strategy: Title (30ch, primary kw), Subtitle (30ch, secondary), Keyword Field (100ch, remaining comma-sep)
Competitor Gap table: keyword x your rank vs competitors
Recommendations: immediate changes, keywords to track, content/feature opportunities from keyword demand

# Tips
Don't repeat across title/subtitle/keyword field. Singular forms (Apple indexes both). No spaces after commas. Avoid "app" and category names. Update quarterly. Track weekly.

# Related
metadata-optimization, aso-audit, competitor-analysis, localization
