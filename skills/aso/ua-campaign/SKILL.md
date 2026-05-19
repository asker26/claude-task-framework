---
name: ua-campaign
description: When the user wants to plan or optimize paid user acquisition campaigns. Also use when the user mentions "Apple Search Ads", "user acquisition", "paid ads", "UA", "ad campaign", "install campaign", "Facebook ads for apps", "TikTok ads", or "cost per install". For organic growth, see aso-audit. For launch-specific UA, see app-launch.
metadata:
  version: 1.0.0
---

# User Acquisition Campaigns

Expert in mobile UA across all major ad platforms. Goal: profitable paid installs.

# Assessment
1. Read `app-marketing-context.md`
2. Monthly UA budget
3. Target CPI or ROAS
4. Current LTV
5. Target audience (demographics, interests)
6. Target countries
7. App category

# Channel Selection by Budget
<$1K: ASA Basic only
$1K-5K: ASA Advanced + 1 social
$5K-20K: ASA + Meta + Google UAC
$20K-100K: ASA + Meta + Google + TikTok + test new
$100K+: all + programmatic + influencer

# Channel Comparison (avg CPI, intent, best for, complexity)
Apple Search Ads: $1-3, very high intent, all iOS, low complexity
Google UAC: $0.5-2, medium, Android+broad, medium
Meta (FB/IG): $1-4, low-medium, consumer/social/ecom, high
TikTok: $0.5-3, low, young demos/games, medium
Snapchat: $0.5-2, low, Gen Z/AR, medium
X: $2-5, low, news/tech/finance, medium
Reddit: $1-3, medium, niche communities, low

# Apple Search Ads (Priority)
Why first: highest intent, 30-50% tap-to-install, direct ASC integration, any budget.
Structure: Brand (exact: app name+misspellings), Category (broad+exact: category+feature terms), Competitor (exact: competitor names), Discovery (Search Match auto-targeting for new keywords)
Bidding: Brand <$0.50 CPA, Category $1-3, Competitor $2-5, Discovery $1-3
Optimize: move winning Discovery keywords to exact, add negatives from Discovery, pause CPA>2x target, increase bids on CPA<target, test CPPs per keyword intent, review Search Match weekly, adjust by day/time

# Meta (FB/IG)
Structure: Campaign(App Installs) -> AdSet1(Lookalike 1% of payers) -> ads(video 15s, carousel, static) | AdSet2(interest-based) -> ads(problem/solution video, UGC) | AdSet3(broad, let Meta optimize) -> best performers + new tests
Video: hook in 3s, show app, 15-30s, captions, CTA+App Store badge
Static: bold headline+benefit, screenshot/mockup, social proof, "Download Free" CTA
Audience: seed(paying user emails->Lookalike), expand(1%->3%->5%), layer(interest targeting), broad(Meta algorithm at scale)

# Google UAC
Provide: 4 text ideas, 20 images, 5 videos. Set target CPI/CPA. Google auto-creates+tests combos across Search/Display/YouTube/Play. Focus on creative quality (Google handles targeting). Start CPA high, lower gradually.

# Key Metrics
Funnel: Impressions->Taps->Installs->Activations->Purchases (CTR->CVR->CPI->CPA->ROAS)
Targets: CTR >5%(ASA) >1%(social), CVR >30%(ASA) >10%(social), CPI <LTV/3, CPA <LTV, ROAS >2.0 good, D7 ROAS predicts long-term
Cadence: daily(spend pacing), weekly(CPI/CPA by keyword/adset, adjust bids), biweekly(refresh creative, fatigue after 2-3wk), monthly(channel mix realloc), quarterly(strategic review+new channels)

# Output
UA Plan: budget, target CPI, target monthly installs, channel allocation %, per-channel campaign brief (structure, targeting, creative reqs, budget+bids, KPI targets), weekly setup->launch->optimize timeline.

# Related
app-launch, monetization-strategy, app-analytics, competitor-analysis, ab-test-store-listing
