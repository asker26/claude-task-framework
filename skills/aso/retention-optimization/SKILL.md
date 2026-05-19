---
name: retention-optimization
description: When the user wants to reduce churn, improve user engagement, or increase lifetime value. Also use when the user mentions "retention", "churn", "users leaving", "engagement", "DAU/MAU", "user activation", or "why are users uninstalling". For onboarding-specific issues, see app-launch. For monetization, see monetization-strategy.
metadata:
  version: 1.0.0
---

# Retention Optimization

Expert in mobile app retention/engagement. Goal: diagnose retention issues, prioritized plan.

# Assessment
1. Read `app-marketing-context.md`
2. Current retention: Day 1, Day 7, Day 30
3. App category (benchmarks vary)
4. Monetization model (free vs subscription)
5. Current engagement features (push, streaks, etc.)

# Benchmarks (D1/D7/D30, "Good" threshold)
Games: 25-30/10-15/3-5, Good: D1>35 D30>8
Social: 30-35/15-20/8-12, Good: D1>40 D30>15
Health/Fitness: 20-25/10-12/4-6, Good: D1>30 D30>10
Productivity: 15-20/8-10/3-5, Good: D1>25 D30>8
E-commerce: 15-20/5-8/2-3, Good: D1>25 D30>5
Finance: 20-25/10-12/5-8, Good: D1>30 D30>10
Education: 15-20/8-10/3-5, Good: D1>25 D30>8

# Framework

## 1. Activation (D0-1)
First session determines everything. Users not reaching "aha moment" in session 1 rarely return.
Diagnose: onboarding completion %, time-to-value, first session drop-off point
Optimize: value in <60s, remove unnecessary onboarding, defer account creation, progressive disclosure, quick win in session 1

## 2. Habit Formation (D1-7)
Diagnose: return triggers, natural usage frequency, retained vs churned user behavior diff
Optimize: push notifications (personalized, value-driven), streaks+progress visuals, daily content/challenges, social hooks (friends, leaderboards)
Push schedule: D1 "welcome back", D3 "specific value waiting", D7 "N-day streak!"

## 3. Engagement Deepening (D7-30)
Diagnose: power-user features casual users miss, engagement cliff timing
Optimize: feature discovery prompts (gradual), personalization, community features, achievements

## 4. Long-term (D30+)
Diagnose: late-stage churn causes, seasonal patterns, update impact
Optimize: regular content updates, feature launches re-engaging dormant users, win-back campaigns, loyalty rewards

# Push Strategy
D1: welcome+tip | D3: value reminder | D5: social proof | D7: streak/progress | D14: feature discovery | D30: milestone
Rules: max 3-5/week, always provide value (never just "come back"), personalize per behavior, granular prefs, A/B test

# Win-back (7+ days inactive)
Email: "We added [feature] since your last visit"
Push: "[Value] waiting for you"
In-app on return: "Welcome back! Here's what's new"

# Cancellation Flow (subscriptions)
1. Ask why (multiple choice)
2. Offer per reason: too expensive->discount/downgrade, don't use->usage stats+features, missing feature->roadmap+notify, found alternative->highlight unique value
3. Offer pause instead of cancel
4. Make cancellation easy (forced retention backfires)

# Output
Diagnostic: D1/D7/D30 vs benchmarks, biggest drop-off, estimated impact of improvement
Action Plan: Week 1 quick wins, Month 1 high impact, Quarter 1 strategic — each with specific tactic + expected impact

# Related
app-analytics, monetization-strategy, review-management, app-launch
