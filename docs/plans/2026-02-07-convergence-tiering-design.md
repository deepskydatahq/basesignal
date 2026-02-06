# Convergence and Tiering Design

## Overview

An LLM-assisted convergence function that merges each candidate cluster into a single named value moment, combining insights from all contributing lenses. Moments are tiered by lens count: 5+ = Tier 1, 3-4 = Tier 2, 1-2 = Tier 3.

## Problem Statement

The 7-lens analysis pipeline produces 60-140 candidate value moments across multiple analytical lenses. Many candidates describe the same underlying value moment from different perspectives. We need to merge overlapping candidates into consolidated, named value moments and rank them by how many lenses corroborate them.

## Expert Perspectives

### Product
- Value moment names must follow "verb + what user gets" format (e.g., "Gain visibility into team progress")
- Tiering by lens convergence is a strong signal — moments validated by 5+ independent lenses are high-confidence

### Technical
- Use `updateSectionInternal` for storage (no schema changes needed) — convergence results are derived, not first-class entities
- Define types in `convergence/types.ts` as a temporary standalone file until S001 lands
- One LLM call per cluster, sequential processing — 15-30 Haiku calls is fast and avoids rate limits
- Extract pure functions for testability: all logic that doesn't need LLM or Convex runtime

### Simplification Review
- Consolidated `parseMergeResponse` + `buildValueMoment` into single `parseAndBuildMoment` function
- Dropped `should_split` field — captured by LLM but not stored or acted on
- Removed verb-format soft validation — rely on prompt quality instead of noisy log warnings
- Kept `testRunConvergencePipeline` per task guidance but made it minimal

## Proposed Solution

Create `convex/analysis/convergence/convergeAndTier.ts` as an internalAction that:
1. Iterates clusters sequentially
2. Calls Claude Haiku per cluster with a merge prompt
3. Parses JSON response and assembles a ValueMoment
4. Assigns tier based on lens count
5. Stores results via `updateSectionInternal("convergenceResult", ...)`

## Design Details

### File Structure

```
convex/analysis/convergence/
  types.ts                    # Temporary types (replaced when S001 lands)
  convergeAndTier.ts          # internalAction + pure functions
  convergeAndTier.test.ts     # Unit tests for pure functions
```

### Types (in convergence/types.ts)

```typescript
export type ValueMomentTier = 1 | 2 | 3;

export interface CandidateCluster {
  cluster_id: string;
  candidates: ValidatedCandidate[];
  lens_count: number;
  lenses: string[];
}

export interface ValidatedCandidate {
  id: string;
  lens: string;
  name: string;
  description: string;
  roles: string[];
  product_surfaces: string[];
  validation_status: "valid" | "rewritten" | "removed";
}

export interface ValueMoment {
  id: string;
  name: string;
  tier: ValueMomentTier;
  convergence_count: number;
  contributing_lenses: string[];
  description: string;
  roles: string[];
  product_surfaces: string[];
  contributing_candidates: string[];
}

export interface ConvergenceResult {
  productId: string;
  value_moments: ValueMoment[];
  tier_1_count: number;
  tier_2_count: number;
  tier_3_count: number;
  total_moments: number;
  execution_time_ms: number;
}
```

### Pure Functions

1. **`assignTier(lensCount: number): ValueMomentTier`** — Deterministic: 5+ → T1, 3-4 → T2, 1-2 → T3

2. **`buildMergePrompt(cluster: CandidateCluster): string`** — Builds user message listing candidates with lens labels, requesting JSON response with name (verb + outcome), description, roles, product_surfaces

3. **`parseAndBuildMoment(cluster: CandidateCluster, responseText: string): ValueMoment`** — Parses JSON from LLM response (handles code fences), validates required fields, assembles ValueMoment with tier and traceability

### internalAction: convergeAndTier

- Args: `productId: v.id("products")`, `clusters: v.any()`
- Iterates clusters sequentially
- Per cluster: buildMergePrompt → call Claude Haiku → parseAndBuildMoment
- Builds ConvergenceResult with tier counts and timing
- Stores via `updateSectionInternal("convergenceResult", result)`
- Returns ConvergenceResult

### Public test action: testRunConvergencePipeline

Minimal wrapper per task guidance. Calls convergeAndTier with productId. Currently passes empty clusters (wired to real pipeline when S002/S003 exist).

### LLM Prompt

System: "You are a product analyst merging value moment candidates into a single consolidated value moment. Always use verb + outcome format for names."

User prompt lists candidates with lens labels and requests JSON: `{ name, description, roles, product_surfaces }`

### Tests

Unit tests for pure functions:
- `assignTier`: all tier boundaries + edge cases
- `buildMergePrompt`: includes candidates, lens labels, format instructions
- `parseAndBuildMoment`: raw JSON, code fences, missing fields, invalid JSON, type coercion

## Alternatives Considered

1. **Parallel LLM calls** — Rejected: rate limit risk, sequential is fast enough for 15-30 clusters
2. **Batch all clusters in one prompt** — Rejected: context length risk, harder to debug/retry
3. **Typed schema field** — Rejected: convergence types are still settling, use updateSectionInternal for now
4. **Full pipeline implementation** — Rejected: bleeds into S002/S003 scope

## Success Criteria

- convergeAndTier accepts CandidateCluster[] and returns ValueMoment[]
- Each cluster merged into named moment via LLM with verb + outcome format
- Tier assignment: 5+ lenses = T1, 3-4 = T2, 1-2 = T3
- Results stored via updateSectionInternal
- All pure functions have unit tests
- Test action exists for manual pipeline invocation
