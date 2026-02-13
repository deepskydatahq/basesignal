# Tier Weighting for ICP Input Aggregation Design

## Overview
Add weighted scoring to ICP input aggregation so roles with high-tier value moments rank above roles with many low-tier moments. The formula `tier_1 * 5 + tier_2 * 2 + occurrence_count` replaces the current two-key sort.

## Problem Statement
Currently, `aggregateICPInputsCore` sorts roles by tier_1_moments desc, then occurrence_count desc. This doesn't account for tier 2 moments at all, and a role with many T3 moments can outrank a role with fewer but more significant T1/T2 moments. The ICP prompt also only shows T1 counts, giving Claude incomplete tier information.

## Expert Perspectives

### Product
- Show explicit three-tier breakdown (T1 / T2 / T3+ counts) in the LLM prompt, not the weighted score number
- The LLM infers importance from ordering (already sorted by weighted score) and the tier numbers
- Keep the prompt signal sharp — no mechanical weighting formula exposed to the LLM
- The weighted formula intentionally allows some volume signal — a role appearing many times with only low-tier moments still has real presence; the formula just ensures quality heavily outweighs quantity

### Technical
- Compute weighted score inline in the sort comparator, not as a stored field on RoleAggregation
- The formula is simple enough to compute at sort time — avoid storing derived state
- Use `tier_3_plus_moments` (not `tier_3_moments`) since tier 3 is the catch-all bucket
- Update both `RoleAggregation` and `RoleInput` types in parallel — the inline `aggregateRoles()` in `generateICPProfiles.ts` is acknowledged tech debt (TODO at line 175) but needs the tier fields for prompt display; consolidation is a separate task

### Simplification Review
- Removed `weighted_score` field from RoleAggregation — compute only in sort comparator
- Kept `tier_2_moments` and `tier_3_plus_moments` as stored fields — required by acceptance criteria and needed for prompt display
- Keep `weightedScore` as an inline arrow, not a named export
- No new abstractions or helper functions needed
- Reviewer suggested lexicographic sort over weighted formula — rejected because AC explicitly specifies the formula
- Reviewer suggested consolidating `RoleAggregation`/`RoleInput` types now — rejected as out of scope (existing TODO tracks this separately)

## Proposed Solution

### 1. Update `RoleAggregation` interface (`aggregateICPInputs.ts`)
Add `tier_2_moments: number` and `tier_3_plus_moments: number` fields.

### 2. Update aggregation logic (`aggregateICPInputsCore`)
Compute all three tier counts during role building:
- `tier_1_moments`: moments where `tier === 1`
- `tier_2_moments`: moments where `tier === 2`
- `tier_3_plus_moments`: moments where `tier >= 3`

### 3. Replace sorting with weighted composite score
```typescript
const weightedScore = (r: RoleAggregation) =>
  r.tier_1_moments * 5 + r.tier_2_moments * 2 + r.occurrence_count;
roles.sort((a, b) => weightedScore(b) - weightedScore(a));
```

### 4. Update `RoleInput` interface (`generateICPProfiles.ts`)
Add `tier_2_count: number` and `tier_3_plus_count: number`.

### 5. Update inline `aggregateRoles` (`generateICPProfiles.ts`)
Track tier_2_count and tier_3_plus_count during aggregation for prompt consistency.

### 6. Update `buildICPPrompt` format
Change role summary line to compact tier breakdown:
```
- Role: N occurrences (X T1, Y T2, Z T3+)
```

### 7. Update tests
- Fix sort expectations in `aggregateICPInputs.test.ts` for weighted scoring
- Add test: "2 T1 moments outranks 10 T3 moments"
- Add test: "roles with only T3+ moments sort to bottom"
- Add test: "tier_2 and tier_3_plus fields correctly counted"
- Update `generateICPProfiles.test.ts` helper and prompt format assertions

## Files Changed
1. `convex/analysis/outputs/aggregateICPInputs.ts` — interface + scoring + sorting
2. `convex/analysis/outputs/generateICPProfiles.ts` — RoleInput + aggregateRoles + prompt format
3. `convex/analysis/outputs/aggregateICPInputs.test.ts` — sort expectations + new tests
4. `convex/analysis/outputs/generateICPProfiles.test.ts` — helper + prompt format test

## Edge Cases
- **13 T3 moments (score 13) vs 2 T1 moments (score 12):** The weighted formula allows extreme T3 volume to edge past low T1 counts. This is intentional — convergence caps T3 at max 20, bounding the practical range. A role appearing 13+ times with only low-tier moments still has real presence worth surfacing.
- **Ties on weighted score:** V8's stable sort preserves insertion order for equal scores. No secondary tiebreaker needed.

## Alternatives Considered
- **Store `weighted_score` on RoleAggregation:** Rejected by simplification review. The formula is simple enough to compute at sort time. No downstream consumer currently needs it.
- **Lexicographic sort (T1 desc, T2 desc, T3 desc, count desc):** Guarantees tiers always dominate volume, but doesn't match the specified weighted formula in AC. Also loses the intentional volume signal.
- **Compute tier counts on-the-fly in sort:** Rejected because `tier_2_moments` and `tier_3_plus_moments` are required by acceptance criteria as stored fields, and needed for prompt display.

## Success Criteria
- Weighted score produces correct role ordering in all test scenarios
- 2 T1 moments > 10 T3 moments (12 > 10)
- T3-only roles always sort below roles with T1/T2 moments
- ICP prompt includes full tier breakdown per role
- All existing tests pass with updated expectations
