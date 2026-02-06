# Infer Journey Stages and Lifecycle Definitions — Design

## Overview

Create `convex/analysis/extractJourney.ts` as an `internalAction` with two sequential Haiku calls: one to extract observable journey stages from marketing content, one to infer lifecycle definitions (activation, firstValue, active, atRisk, churn) using the journey output and business model as context. Stores results as two separate profile sections.

## Problem Statement

After identity extraction (S001), crawled pages contain signals about user lifecycle stages visible in pricing tiers, onboarding flows, and feature descriptions. Journey stages are directly observable from marketing copy. Lifecycle definitions (what "activated" or "churned" means for this product) require inference and are lower confidence. Separating these two concerns gives users clear signal about what's observed vs. what's guessed.

## Expert Perspectives

### Product
Two separate LLM calls, not one. Journey stages are high-confidence observables ("trial → signup → paid" is on the pricing page). Definitions are speculative inferences needing their own reasoning chain. Separating them lets each have appropriate confidence and shows users "here's what we observed" vs "here's what we're guessing."

### Simplification Review
- Removed confidence range specifications (prompt tuning, not design)
- Removed page type listing as "key decision" (obvious)
- Clarified orchestration dependency: proceeds without businessModel if unavailable
- Kept two updateSectionInternal calls (required — journey and definitions are different sections)
- Kept getInternal query (required — internalActions can't use ctx.db)

## Proposed Solution

```
extractJourney (internalAction)
  ├── Fetch crawled pages via listByProductInternal
  │     → filter to homepage, about, features, pricing
  │
  ├── Read existing profile via getInternal
  │     → extract identity.businessModel (fallback to null if unavailable)
  │
  ├── LLM Call 1: Journey Stages (observable, higher confidence)
  │     → extract lifecycle stages from marketing copy
  │     → store via updateSectionInternal(productId, 'journey', data)
  │
  └── LLM Call 2: Lifecycle Definitions (inferred, lower confidence)
        → input: pages + businessModel + journey stages from Call 1
        → infer activation/firstValue/active/atRisk/churn with source='ai-inferred'
        → store via updateSectionInternal(productId, 'definitions', data)
```

## Design Details

### Files

| File | Change |
|------|--------|
| `convex/analysis/extractJourney.ts` | New internalAction with two LLM calls |
| `convex/crawledPages.ts` | Reuses `listByProductInternal` from S001 |
| `convex/productProfiles.ts` | Reuses `updateSectionInternal` from S001; adds `getInternal` internalQuery |

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Call count | Two Haiku calls in one action | Journey is observable (higher confidence), definitions are inferred (lower confidence); separate reasoning chains |
| Call order | Journey first, then definitions | Definitions prompt uses journey stages as structured context |
| Partial success | Journey stored before definitions call | If definitions call fails, journey is already persisted |
| businessModel input | Read from stored identity section | S001 runs before S004; if unavailable, proceed with null (general defaults) |
| Definition source | `"ai-inferred"` on every definition | Required by AC; distinguishes from user-validated |
| New query | `getInternal` internalQuery on productProfiles | Needed to read identity.businessModel without auth context |

### getInternal (new internalQuery)

```typescript
export const getInternal = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
  },
});
```

### Error Handling

- No pages found: throw (same as S001-S003)
- Unparseable JSON: throw (no retries)
- Missing profile: throw from updateSectionInternal
- No identity/businessModel: proceed with null, use general defaults for definitions
- Journey succeeds, definitions fails: journey is persisted, error propagates to caller

## Alternatives Considered

- **Single LLM call for both**: Rejected — bundles high-confidence observables with low-confidence inferences, obscuring signal quality.
- **Two separate internalActions**: Rejected — adds orchestrator complexity. The two calls are related and the second uses the first's output.
- **Re-extract businessModel from pages**: Rejected — S001 already extracted it. Re-extracting wastes a call and may produce inconsistent results.

## Success Criteria

- Journey stages extracted with product-specific naming and stored
- All 5 lifecycle definitions populated with criteria, reasoning, evidence, source='ai-inferred'
- Journey confidence reflects observability; definition confidence reflects inference
- Works in analysis pipeline after S001 completes
