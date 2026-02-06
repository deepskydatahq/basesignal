# Suggest Metrics Catalog Based on Business Model — Design

## Overview

Create `convex/analysis/suggestMetrics.ts` as an `internalAction` that reads the product profile's identity and revenue sections, classifies the business model archetype, selects relevant metrics from a hardcoded catalog, and stores the metrics section on the product profile. No LLM call — pure code logic.

## Problem Statement

After identity (S001) and revenue (S002) extraction, the product profile has a business model description and revenue architecture, but no metrics. This action bridges the gap by recommending a curated set of metrics categorized across reach, engagement, retention, revenue, and value — tailored to the product's business model archetype.

## Expert Perspectives

### Technical
This is a recommendation engine, not an extraction problem. The inputs (businessModel string, revenue model, hasFreeTier) are deterministic. The output (a filtered catalog) is deterministic. An LLM would add cost, latency, and nondeterminism with zero benefit. Pure functions (`classifyArchetype`, `selectMetrics`) are independently testable without Convex runtime.

### Simplification Review
- Cut marketplace archetype and its metrics (no marketplace products expected initially)
- Reduced catalog from ~27 to ~16 metrics
- Kept linkedTo populated (required by AC4, deterministic links)
- Kept hybrid archetype (zero-cost derivation from plg + sales-led)

## Proposed Solution

```
suggestMetrics (internalAction)
  ├── ctx.runQuery(internal.productProfiles.getInternal, { productId })
  │     → read identity.businessModel + revenue.model + revenue.hasFreeTier
  │
  ├── classifyArchetype(businessModel, revenueModel, hasFreeTier)
  │     → returns: "plg" | "sales-led" | "hybrid" | "unknown"
  │     → pure function, keyword-based
  │
  ├── selectMetrics(archetype)
  │     → filters METRIC_CATALOG by archetype tags
  │     → returns MetricItem[]
  │
  └── ctx.runMutation(internal.productProfiles.updateSectionInternal, ...)
        → section="metrics", confidence: 0.6, evidence: []
```

## Design Details

### Files

| File | Change |
|------|--------|
| `convex/analysis/suggestMetrics.ts` | New internalAction + pure functions |
| `convex/productProfiles.ts` | Reuses `getInternal` from S004 and `updateSectionInternal` from S001 |

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM vs pure code | Pure code | Deterministic inputs/outputs; LLM adds cost/latency with no benefit |
| Action type | `internalAction` | Server-initiated from orchestrator (S007), no user auth context |
| Archetype count | 4: plg, sales-led, hybrid, unknown | Marketplace cut (no products expected); hybrid is zero-cost |
| Catalog size | ~16 metrics | Universal (~11) + PLG-specific (~3) + sales-led-specific (~3) |
| Confidence | Fixed 0.6 | Suggested, not observed |
| Evidence | Empty array | Schema requires it; no crawled content used |
| linkedTo | Populated where deterministic | AC4 requires it; e.g., "Activation Rate" → "definitions.activation" |
| Missing profile data | Archetype "unknown", universal metrics only | Supports progressive analysis |

### Archetype Classification

Pure function. Keywords case-insensitive:

| Archetype | Signal |
|-----------|--------|
| `"plg"` | hasFreeTier === true, OR businessModel/revenueModel contains "freemium"/"product-led"/"PLG"/"self-serve" |
| `"sales-led"` | businessModel/revenueModel contains "enterprise"/"sales-led"/"sales led"/"contract" (and NOT plg signals) |
| `"hybrid"` | Both plg AND sales-led signals present |
| `"unknown"` | None match or inputs missing |

### Metric Catalog (~16 metrics)

**Universal (all archetypes):**

| Name | Category | Formula | linkedTo |
|------|----------|---------|----------|
| New User Signups | reach | `COUNT(new signups in period)` | `["journey.stages"]` |
| Activation Rate | reach | `activated users / signups` | `["definitions.activation"]` |
| Monthly Active Users | engagement | `COUNT(DISTINCT active users in 30d)` | `["definitions.active"]` |
| DAU/MAU Ratio | engagement | `DAU / MAU` | `["definitions.active"]` |
| Feature Adoption Rate | engagement | `users using feature / active users` | `["outcomes.items"]` |
| 7-Day Retention | retention | `users active day 7 / cohort size` | `["definitions.active"]` |
| 30-Day Retention | retention | `users active day 30 / cohort size` | `["definitions.active"]` |
| Churn Rate | retention | `churned users / start-of-period users` | `["definitions.churn"]` |
| Time to First Value | value | `MEDIAN(signup to first value event)` | `["definitions.firstValue"]` |
| Net Promoter Score | value | `% promoters - % detractors` | `["outcomes.items"]` |
| Active Rate | engagement | `active users / total users` | `["definitions.active"]` |

**PLG-specific (archetypes: plg, hybrid):**

| Name | Category | Formula | linkedTo |
|------|----------|---------|----------|
| Free-to-Paid Conversion | revenue | `paid conversions / free signups` | `["revenue.tiers"]` |
| Expansion Revenue Rate | revenue | `expansion MRR / starting MRR` | `["revenue.expansionPaths"]` |
| Viral Coefficient | reach | `invites sent * conversion rate` | `[]` |

**Sales-led-specific (archetypes: sales-led, hybrid):**

| Name | Category | Formula | linkedTo |
|------|----------|---------|----------|
| Average Contract Value | revenue | `total contract value / deals closed` | `["revenue.tiers"]` |
| Net Revenue Retention | revenue | `(start MRR + expansion - contraction - churn) / start MRR` | `["revenue.expansionPaths", "revenue.contractionRisks"]` |

### Error Handling

- No profile found: throw (same as S001-S005)
- Missing identity/revenue: proceed with archetype "unknown", return universal metrics only
- Empty result impossible (universal metrics always apply)

## Alternatives Considered

- **LLM-based suggestion**: Rejected — deterministic inputs/outputs, LLM adds cost/latency with no benefit.
- **Ship all metrics without filtering**: Rejected — AC5 requires business model influence.
- **5 archetypes including marketplace**: Rejected (simplification review) — no marketplace products expected. Add later when needed.
- **Empty linkedTo for all**: Rejected — AC4 requires linking, and the mappings are deterministic.

## Success Criteria

- Classifies business model archetype from identity + revenue sections
- Selects relevant metrics from catalog based on archetype
- All 5 categories represented (reach, engagement, retention, revenue, value)
- Standard formulas included with linkedTo references
- Stores via updateSectionInternal with confidence 0.6 and empty evidence
- Pure functions testable without Convex runtime
- Works as part of the analysis pipeline (called by orchestrator S007)
