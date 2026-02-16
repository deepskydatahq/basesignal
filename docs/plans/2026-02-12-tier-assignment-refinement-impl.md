# Tier Assignment Refinement — Implementation Plan

## Summary

Lower `assignTier` thresholds (4+ = T1, 2-3 = T2, 1 = T3) and add a `capTierDistribution` pure function (max 3 T1, max 20 T3) called at the end of `convergeAndTier`. Update existing tests and add capping tests.

## Files to Modify

| File | Change |
|------|--------|
| `convex/analysis/convergence/convergeAndTier.ts` | Update `assignTier`, add `capTierDistribution`, call it in `convergeAndTier` |
| `convex/analysis/convergence/convergeAndTier.test.ts` | Update threshold expectations, add capping tests |

No new files. No type changes needed — `ValueMoment` already has `contributing_candidates` and `lens_count`.

## Step-by-Step Implementation

### Step 1: Update `assignTier` thresholds

In `convergeAndTier.ts:20-24`, change:
```typescript
export function assignTier(lensCount: number): ValueMomentTier {
  if (lensCount >= 4) return 1;  // 4+ lenses = Tier 1 (was 5)
  if (lensCount >= 2) return 2;  // 2-3 lenses = Tier 2 (was 3)
  return 3;                       // 1 lens = Tier 3
}
```

Update the JSDoc comment to match.

### Step 2: Add `capTierDistribution` function

Add after `assignTier` (around line 25), before `parseMergeResponse`:

```typescript
/**
 * Cap tier distribution: max 3 T1, max 20 T3.
 * Ranking for both: contributing_candidates.length desc, lens_count desc as tiebreaker.
 * T1 excess demoted to T2. T3 excess dropped entirely.
 */
export function capTierDistribution(moments: ValueMoment[]): ValueMoment[] {
  const rank = (a: ValueMoment, b: ValueMoment) =>
    b.contributing_candidates.length - a.contributing_candidates.length ||
    b.lens_count - a.lens_count;

  const t1 = moments.filter(m => m.tier === 1).sort(rank);
  const t2 = moments.filter(m => m.tier === 2);
  const t3 = moments.filter(m => m.tier === 3).sort(rank);

  // Demote excess T1 to T2
  const maxT1 = 3;
  const keptT1 = t1.slice(0, maxT1);
  const demotedT1 = t1.slice(maxT1).map(m => ({ ...m, tier: 2 as ValueMomentTier }));

  // Drop excess T3
  const maxT3 = 20;
  const keptT3 = t3.slice(0, maxT3);

  return [...keptT1, ...t2, ...demotedT1, ...keptT3];
}
```

### Step 3: Call `capTierDistribution` in `convergeAndTier`

In the `convergeAndTier` function (line 137-181), apply capping before returning:

```typescript
// After building moments from results (line ~171-180)
const uncapped = results.map((result, i) => { ... });
return capTierDistribution(uncapped);
```

### Step 4: Update `assignTier` tests

In `convergeAndTier.test.ts:74-102`, update expectations:

| Test | Old | New |
|------|-----|-----|
| "assigns Tier 1 for 5 lenses" | Keep (still T1) | Keep |
| "assigns Tier 1 for 7 lenses" | Keep | Keep |
| "assigns Tier 2 for 3 lenses" | Keep (still T2) | Keep |
| "assigns Tier 2 for 4 lenses" | was T2 → **now T1** | `expect(assignTier(4)).toBe(1)` |
| "assigns Tier 3 for 1 lens" | Keep (still T3) | Keep |
| "assigns Tier 3 for 2 lenses" | was T3 → **now T2** | `expect(assignTier(2)).toBe(2)` |

Rename test descriptions to match new boundaries.

### Step 5: Update `convergeAndTier` tier integration test

In `convergeAndTier.test.ts:299-327` ("assigns correct tier based on cluster lens_count"):
- `cluster2` (lens_count: 2) currently expects T3 → change to **T2**

### Step 6: Update `directMerge` tier test

In `convergeAndTier.test.ts:180-216` ("assigns correct tier based on lens count"):
- `cluster3` (lens_count: 3) still expects T2 ✓
- `cluster5` (lens_count: 5) still expects T1 ✓
- `cluster1` (lens_count: 1) still expects T3 ✓
- All still pass — no changes needed.

### Step 7: Add `capTierDistribution` tests

Add a new `describe("capTierDistribution", ...)` block with these tests:

1. **Passthrough when within caps** — 2 T1, 5 T2, 10 T3 → unchanged
2. **T1 demotion** — 5 T1 moments → top 3 kept as T1, bottom 2 demoted to T2 (ranked by `contributing_candidates.length`, tiebreak `lens_count`)
3. **T3 dropping** — 25 T3 moments → top 20 kept, bottom 5 dropped (ranked same way)
4. **Simultaneous capping** — 4 T1 + 22 T3 → 3 T1, 1 demoted to T2, 20 T3 kept, 2 dropped
5. **Empty input** — `[]` → `[]`

## Test Strategy

- Run `npm test -- convergeAndTier` after each step to catch regressions
- All 7 existing `assignTier` tests: 5 unchanged, 2 updated expectations
- All 8 `convergeAndTier` integration tests: 1 updated (2-lens cluster T3→T2), rest unchanged
- 5 new `capTierDistribution` unit tests
- `directMerge` tests: no changes needed

## Acceptance Criteria Mapping

| AC | Implementation |
|----|---------------|
| assignTier with lowered thresholds | Step 1 + Step 4 |
| Post-tier capping: >3 T1 demote | Step 2 (capTierDistribution T1 logic) + Step 7 test #2 |
| Post-tier capping: >20 T3 drop | Step 2 (capTierDistribution T3 logic) + Step 7 test #3 |
| Stats reflect final tier counts | Step 3 — `runConvergencePipeline` computes stats from `convergeAndTier` return value which is post-capping |
| Existing tests updated | Steps 4-6 |
