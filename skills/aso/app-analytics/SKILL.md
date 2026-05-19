---
name: app-analytics
description: When the user wants to set up, interpret, or improve their app analytics and tracking. Also use when the user mentions "analytics", "tracking", "metrics", "KPIs", "App Store Connect analytics", "install tracking", "funnel", "attribution", or "how is my app performing". For A/B testing, see ab-test-store-listing. For retention metrics, see retention-optimization.
metadata:
  version: 1.0.0
---

# App Analytics

Expert in mobile app analytics/measurement. Goal: meaningful tracking, data interpretation, data-driven decisions.

# Assessment
1. Read `app-marketing-context.md`
2. Current analytics tools?
3. Top 3 performance questions?
4. What decisions need data?
5. Running paid acquisition? (attribution matters)

# Analytics Stack
Must have: App Store Connect (free, store metrics), Firebase Analytics (free, events/funnels), Crashlytics (free, stability)
Recommended: Mixpanel/Amplitude (product analytics/cohorts, free tier)
If subscriptions: RevenueCat (sub analytics/paywall testing, free tier)
If ads: Adjust/AppsFlyer (attribution, paid)

# ASC Metrics (free)
Impressions, Product Page Views, App Units (first-time DL), Conversion Rate (views->DL), Proceeds, Sessions, Active Devices, Retention (D1/D7/D28), Crash Rate
Sources: App Store Search, Browse, Web Referral, App Referral

# Metrics Framework
Acquisition: Impressions, TTR(taps/impressions=icon+title effectiveness), CVR(DL/views=product page), CPI(spend/installs), Organic%(organic/total)
Engagement: DAU, MAU, DAU/MAU(stickiness, >20% good), Sessions/User, Session Length
Retention: D1 25-40%, D7 10-20%, D30 5-10%, Monthly churn <5%(subscriptions)
Revenue: ARPU(rev/all users), ARPPU(rev/paying, 3-10x ARPU), LTV(ARPU x avg lifetime), Trial-to-Paid, MRR, Revenue Churn(lost MRR/start MRR)

# Event Tracking Plan (minimum)
```
onboarding_started, onboarding_step_completed(step_name,step_number), onboarding_completed, onboarding_skipped
[action]_started, [action]_completed, [action]_failed(error_type)
paywall_viewed(source,variant), trial_started(plan,source), purchase_completed(plan,price,source), purchase_failed(error_type), subscription_renewed, subscription_cancelled(reason)
session_started(source), feature_used(feature_name), content_viewed(type,id), share_tapped(type), notification_received(type), notification_tapped(type)
settings_changed(name,old,new), notification_permission(granted:bool)
```
Naming: snake_case, [object]_[action], specific not granular, include properties (no PII), consistent cross-platform

# Dashboards
Executive (weekly): downloads+rev+DAU+conversion+D1 retention+rating, all with trend %
Funnel (daily): Impressions->Page Views->Downloads->Activation->Purchase with conversion % between each
Cohort (monthly): retention curves by install date, acquisition source, country, plan

# Output
Analytics Audit: tools in use, events tracked count, key gaps, recommendations (tracking gaps, metrics to monitor, dashboards to create)
Tracking Plan: event name, trigger, properties, which tool
Metric Interpretation: benchmark comparison, trend analysis, specific actions

# Related
ab-test-store-listing, retention-optimization, monetization-strategy, ua-campaign
