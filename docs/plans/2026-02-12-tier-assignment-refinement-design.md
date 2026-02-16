# Tier Assignment Refinement Design

## Overview

Lower tier assignment thresholds and add distribution capping so convergence produces a useful tiered set: max 3 T1, uncapped T2, max 20 T3. Capping uses a single consistent ranking rule based on corroboration strength.

## Problem Statement

Current thresholds (5+ lenses = T1, 3-4 = T2, 1-2 = T3) are too aggressive. Most products analyzed through 4-5 lenses can't produce 5-lens overlap, resulting in few or no T1 moments. Lowering to 4+ = T1, 2-3 = T2, 1 = T3 makes tiers achievable while still meaningful. Distribution capping prevents edge cases where too many moments cluster in T1 or T3.

## Expert Perspectives

### Technical
- Use `contributing_candidates.length` as the ranking signal for both T1 demotion and T3 dropping — it's already available on ValueMoment, semantically defensible ("more corroboration = keep"), and keeps the capping logic pure with no extra parameters.
- Do NOT add a `confidence` field to ValueMoment. The LLM merge synthesizes candidates into new entities; pretending we have confidence in the merged moment conflates layers.
- `lens_count` serves as tiebreaker for equal candidate counts.

### Simplification Review
- Inline constants with comments instead of exported module-level constants — they're only used in one place.
- Use one consistent ranking rule for both T1 demotion and T3 dropping instead of asymmetric sort strategies.
- Keep `capTierDistribution` as a named function for testability but keep tests focused on behavior (4-5 tests, not 8).
- Make the pipeline order explicit: converge -> cap -> compute stats.

## Proposed Solution

### 1. Update `assignTier` thresholds

```typescript
function assignTier(lensCount: number): ValueMomentTier {
  if (lensCount >= 4) return 1;  // 4+ lenses = Tier 1
  if (lensCount >= 2) return 2;  // 2-3 lenses = Tier 2
  return 3;                       // 1 lens = Tier 3
}
```

### 2. Add `capTierDistribution` function

A pure function that enforces max 3 T1 and max 20 T3:
- **T1 over cap**: Sort T1 moments descending by `contributing_candidates.length` (tiebreaker: `lens_count`). Keep top 3, demote rest to T2 via `{ ...m, tier: 2 }`.
- **T3 over cap**: Sort T3 moments descending by `contributing_candidates.length` (tiebreaker: `lens_count`). Keep top 20, drop rest entirely.
- One consistent ranking philosophy: "moments with more corroboration are worth keeping."

### 3. Integrate into pipeline

Call `capTierDistribution` at the end of `convergeAndTier` before returning. Stats in `runConvergencePipeline` are computed from the post-capping array, so they naturally reflect final counts.

### 4. Update tests

- Update `assignTier` test expectations for new thresholds (boundary at 4 and 2).
- Update `convergeAndTier` tier test (2-lens cluster now expects T2 instead of T3).
- Add 4-5 focused `capTierDistribution` tests: within-caps passthrough, T1 demotion, T3 dropping, simultaneous capping, empty input.

## Alternatives Considered

1. **Add confidence field to ValueMoment** — Rejected. Conflates candidate-level confidence with merged-moment quality. The LLM synthesis creates a new semantic entity.
2. **Asymmetric ranking** (lens_count for T1, candidates.length for T3) — Rejected in review. One consistent rule is clearer.
3. **Exported constants** — Rejected. Premature abstraction for values used in one place.

## Success Criteria

- `assignTier(4)` returns T1, `assignTier(2)` returns T2, `assignTier(1)` returns T3
- With 5 T1 moments, only top 3 by corroboration survive as T1; 2 demoted to T2
- With 25 T3 moments, only top 20 by corroboration survive; 5 dropped
- ConvergenceResult stats match post-capping tier counts
- All existing tests pass with updated expectations
