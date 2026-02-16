# Implementation Plan: Extract Convergence and Tiering Logic

**Task:** basesignal-4f3 (M008-E001-S006)
**Design:** docs/plans/2026-02-15-convergence-extraction-design.md
**Depends on:** M008-E001-S005 (analysis utilities extraction -- similarity, clustering, validation must be in `packages/core` first)

---

## Step 1: Create `packages/core/src/analysis/convergence-types.ts`

Extract convergence-specific types from `convex/analysis/convergence/types.ts`. Types already extracted by S005 (`ValidatedCandidate`, `LensType`, `ValidationStatus`, `CandidateCluster`) are imported, not duplicated.

**File:** `packages/core/src/analysis/convergence-types.ts`

```typescript
import type { LensType, ValidatedCandidate } from "./clustering"; // from S005

export type ValueMomentTier = 1 | 2 | 3;

export interface ValueMoment {
  id: string;
  name: string;
  description: string;
  tier: ValueMomentTier;
  lenses: LensType[];
  lens_count: number;
  roles: string[];
  product_surfaces: string[];
  contributing_candidates: string[];
}

export type QualityStatus = "pass" | "warn" | "fail";

export interface QualityCheck {
  name: string;
  status: QualityStatus;
  message: string;
}

export interface QualityReport {
  overall: QualityStatus;
  checks: QualityCheck[];
}

export interface CandidateCluster {
  cluster_id: string;
  candidates: ValidatedCandidate[];
  lens_count: number;
  lenses: LensType[];
}

export interface ConvergenceResult {
  value_moments: ValueMoment[];
  clusters: CandidateCluster[];
  stats: {
    total_candidates: number;
    total_clusters: number;
    total_moments: number;
    tier_1_count: number;
    tier_2_count: number;
    tier_3_count: number;
  };
  quality?: QualityReport;
}
```

**Note on CandidateCluster:** S005 exports `CandidateCluster` from `clustering.ts` as well. Check if S005's `CandidateCluster` definition matches. If so, import it and re-export from convergence-types rather than redefining. If S005 re-exports the same type from `convex/analysis/convergence/types.ts`, just re-export it:

```typescript
export type { CandidateCluster } from "./clustering";
```

If there are discrepancies, the convergence-types version (matching `convergeAndTier.ts` usage) is the canonical one. Adjust the import chain accordingly.

---

## Step 2: Create `packages/core/src/analysis/convergence.ts`

Extract all pure functions and constants from `convex/analysis/convergence/convergeAndTier.ts`. Add the `LlmProvider` type and the refactored `converge()` / `runConvergence()` functions.

**File:** `packages/core/src/analysis/convergence.ts`

**Imports:**
```typescript
import type {
  CandidateCluster,
  ValueMoment,
  ValueMomentTier,
  ConvergenceResult,
  QualityStatus,
  QualityCheck,
  QualityReport,
} from "./convergence-types";
```

**Contents (in order):**

### 2a. LlmProvider type (NEW)

```typescript
/**
 * A function that sends a prompt to an LLM and returns the text response.
 * Consumers wrap their preferred SDK into this shape.
 */
export type LlmProvider = (prompt: string, system: string) => Promise<string>;

export interface ConvergeOptions {
  /** Optional LLM provider for semantic merge descriptions. Without it, uses directMerge(). */
  llmProvider?: LlmProvider;
}
```

### 2b. Pure functions (copied verbatim from convergeAndTier.ts)

Copy these functions as-is from `convex/analysis/convergence/convergeAndTier.ts`:

1. **`assignTier(lensCount: number): ValueMomentTier`** (lines 23-27) -- no changes needed.

2. **`parseMergeResponse(text: string)`** (lines 33-67) -- no changes needed. Returns `{ name, description, roles, product_surfaces, is_coherent }`.

3. **`directMerge(cluster: CandidateCluster): ValueMoment`** (lines 73-90) -- no changes needed.

4. **`capTierDistribution(moments: ValueMoment[]): ValueMoment[]`** (lines 98-128) -- no changes needed.

5. **`BUSINESS_VERBS`** (lines 134-138) -- no changes needed.

6. **`USER_ACTION_VERBS`** (lines 144-148) -- no changes needed.

7. **`isBusinessVerb(name: string): boolean`** (lines 154-157) -- no changes needed.

8. **`validateConvergenceQuality(result: ConvergenceResult): QualityReport`** (lines 169-245) -- no changes needed.

### 2c. Prompt constants and builders (visibility change: `buildMergePrompt` becomes public)

9. **`MERGE_SYSTEM_PROMPT`** (lines 249-286) -- copy the full string constant. Change from `const` to `export const`.

10. **`buildMergePrompt(cluster: CandidateCluster): string`** (lines 291-300) -- copy. Change from `function` to `export function` (it was private in the original; the design doc says it should be part of the public API).

### 2d. Refactored `converge()` (replaces `convergeAndTier`)

Replace the old `convergeAndTier(clusters, client)` with the new LLM-optional signature:

```typescript
/**
 * Merge clusters into named, tiered value moments.
 * With llmProvider: calls LLM per cluster for rich merge descriptions.
 * Without llmProvider: uses directMerge() for deterministic fallback.
 */
export async function converge(
  clusters: CandidateCluster[],
  options?: ConvergeOptions
): Promise<ValueMoment[]> {
  if (!options?.llmProvider) {
    return clusters.map(directMerge);
  }

  const results = await Promise.allSettled(
    clusters.map(async (cluster): Promise<ValueMoment> => {
      const prompt = buildMergePrompt(cluster);
      const text = await options.llmProvider!(prompt, MERGE_SYSTEM_PROMPT);
      const parsed = parseMergeResponse(text);

      return {
        id: `moment-${cluster.cluster_id}`,
        name: parsed.name,
        description: parsed.description,
        tier: assignTier(cluster.lens_count),
        lenses: cluster.lenses,
        lens_count: cluster.lens_count,
        roles: parsed.roles,
        product_surfaces: parsed.product_surfaces,
        contributing_candidates: cluster.candidates.map((c) => c.id),
      };
    })
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") return result.value;
    return directMerge(clusters[i]);
  });
}
```

### 2e. Full pipeline `runConvergence()` (NEW)

```typescript
/**
 * Run the full convergence pipeline: merge clusters, cap tiers, compute stats, validate quality.
 */
export async function runConvergence(
  clusters: CandidateCluster[],
  totalCandidates: number,
  options?: ConvergeOptions
): Promise<ConvergenceResult> {
  const rawMoments = await converge(clusters, options);
  const valueMoments = capTierDistribution(rawMoments);

  const result: ConvergenceResult = {
    value_moments: valueMoments,
    clusters,
    stats: {
      total_candidates: totalCandidates,
      total_clusters: clusters.length,
      total_moments: valueMoments.length,
      tier_1_count: valueMoments.filter((m) => m.tier === 1).length,
      tier_2_count: valueMoments.filter((m) => m.tier === 2).length,
      tier_3_count: valueMoments.filter((m) => m.tier === 3).length,
    },
  };

  result.quality = validateConvergenceQuality(result);
  return result;
}
```

### 2f. Re-exports

At the bottom of the file, re-export all types for convenience:

```typescript
export type {
  ValueMomentTier,
  ValueMoment,
  CandidateCluster,
  QualityStatus,
  QualityCheck,
  QualityReport,
  ConvergenceResult,
} from "./convergence-types";
```

---

## Step 3: Update barrel exports in `packages/core/src/analysis/index.ts`

Add convergence exports to the existing barrel (S005 creates this file with similarity, clustering, validation exports):

```typescript
// Existing from S005:
export * from "./similarity";
export * from "./clustering";
export * from "./validation";
export { extractJson } from "./json";

// NEW: convergence and tiering (S006)
export * from "./convergence";
export * from "./convergence-types";
```

---

## Step 4: Create test file `packages/core/src/analysis/convergence.test.ts`

Migrate and adapt tests from `convex/analysis/convergence/convergeAndTier.test.ts`. The key changes:

1. **Import paths** change from `./convergeAndTier` and `./types` to `./convergence` and `./convergence-types`.
2. **`convergeAndTier` tests** become `converge` tests with mock `LlmProvider` replacing mock Anthropic client.
3. **New tests** for `converge()` without LLM and for `runConvergence()`.

### 4a. Test helpers

Copy `makeCandidate`, `makeCluster`, `makeMoment`, `makeConvergenceResult` from the original test file. Update type imports:

```typescript
import { describe, it, expect, vi } from "vitest";
import {
  assignTier,
  parseMergeResponse,
  directMerge,
  converge,
  runConvergence,
  buildMergePrompt,
  capTierDistribution,
  validateConvergenceQuality,
  BUSINESS_VERBS,
  USER_ACTION_VERBS,
  isBusinessVerb,
  MERGE_SYSTEM_PROMPT,
} from "./convergence";
import type {
  CandidateCluster,
  ValueMoment,
  ValueMomentTier,
  ConvergenceResult,
} from "./convergence-types";
// ValidatedCandidate and LensType from S005's clustering types
import type { ValidatedCandidate, LensType } from "./clustering";
```

### 4b. Migrate existing test blocks (copy as-is, update imports only)

These test blocks are copied directly with only import path changes:

| Original describe block | Changes needed |
|---|---|
| `describe("assignTier", ...)` | None -- copy all 7 tests |
| `describe("parseMergeResponse", ...)` | None -- copy all 7 tests |
| `describe("directMerge", ...)` | None -- copy all 5 tests |
| `describe("buildMergePrompt", ...)` | None -- copy 1 test |
| `describe("capTierDistribution", ...)` | None -- copy all 4 tests |
| `describe("validateConvergenceQuality", ...)` | None -- copy all 12 tests |
| `describe("isBusinessVerb", ...)` | None -- copy all 4 tests |
| `describe("verb constants", ...)` | None -- copy all 3 tests |

### 4c. Replace `convergeAndTier` tests with `converge` tests

Remove the mock Anthropic client helpers (`makeMockAnthropicResponse`, `makeMockClient`) and replace with a mock `LlmProvider`:

```typescript
function makeMockLlmProvider(
  responses: Array<Record<string, unknown>>
): { provider: LlmProvider; calls: Array<{ prompt: string; system: string }> } {
  const calls: Array<{ prompt: string; system: string }> = [];
  let callIndex = 0;

  const provider: LlmProvider = async (prompt, system) => {
    calls.push({ prompt, system });
    const response = responses[callIndex++];
    if (!response) throw new Error("No more mock responses");
    return "```json\n" + JSON.stringify(response, null, 2) + "\n```";
  };

  return { provider, calls };
}
```

**New test block -- `describe("converge", ...)`:**

| # | Test name | Behavior |
|---|-----------|----------|
| 1 | "returns one ValueMoment per cluster using directMerge when no LLM" | Call `converge(clusters)` with no options. Verify each moment name starts with "Achieve". |
| 2 | "returns one ValueMoment per cluster with LLM provider" | Inject mock provider with 2 responses. Verify names come from LLM output. |
| 3 | "makes one LLM call per cluster" | Inject mock provider for 3 clusters. Check `calls.length === 3`. |
| 4 | "passes MERGE_SYSTEM_PROMPT as system parameter" | Inject mock provider. Check that `calls[0].system === MERGE_SYSTEM_PROMPT`. |
| 5 | "assigns correct tier based on cluster lens_count" | 5-lens cluster (T1) and 2-lens cluster (T2) with mock provider. |
| 6 | "includes contributing_candidates from cluster" | Verify candidate ids flow through. |
| 7 | "preserves LLM description referencing lens insights" | Provider returns description with "JTBD lens". Verify it appears in output. |
| 8 | "falls back to directMerge when LLM provider throws" | Provider throws. Verify moment name starts with "Achieve". |
| 9 | "falls back to directMerge when response parsing fails" | Provider returns non-JSON. Verify fallback. |
| 10 | "handles mixed success and failure across clusters" | Provider succeeds then throws. Verify first is LLM, second is fallback. |
| 11 | "returns empty array for empty clusters input" | `converge([])` returns `[]`. |
| 12 | "returns empty array for empty clusters with LLM provider" | `converge([], { llmProvider })` returns `[]`. |

### 4d. New test block -- `describe("runConvergence", ...)`

| # | Test name | Behavior |
|---|-----------|----------|
| 1 | "produces ConvergenceResult with stats and quality report" | Call `runConvergence(clusters, 50)` with no LLM. Verify `result.stats`, `result.quality`, and `result.value_moments`. |
| 2 | "applies tier capping" | Pass 5 clusters all with `lens_count >= 4` (all T1). Verify max 3 remain T1 after capping. |
| 3 | "includes quality report with overall status" | Verify `result.quality.overall` is defined and `result.quality.checks` has 4 entries. |
| 4 | "works with LLM provider" | Inject mock provider. Verify LLM-generated names in output. |

---

## Step 5: Zero-dependency verification

After creating the files, verify no imports leak outside `packages/core`:

```bash
# Must return zero results
grep -r "from.*convex" packages/core/src/analysis/convergence.ts
grep -r "from.*convex" packages/core/src/analysis/convergence-types.ts
grep -r "from.*@anthropic" packages/core/src/analysis/convergence.ts
grep -r "from.*@anthropic" packages/core/src/analysis/convergence-types.ts
```

The only imports in `convergence.ts` should be:
- `from "./convergence-types"` (local types)
- Possibly `from "./clustering"` if `CandidateCluster` / `ValidatedCandidate` are re-exported through there

The only imports in `convergence-types.ts` should be:
- `from "./clustering"` (for S005 types like `LensType`, `ValidatedCandidate`)

---

## Step 6: Run tests

```bash
cd packages/core && npm test -- --run src/analysis/convergence.test.ts
```

All tests must pass. Then run the full suite to check for regressions:

```bash
npm test -- --run
```

---

## Files Created

| File | Description |
|------|-------------|
| `packages/core/src/analysis/convergence-types.ts` | Types: `ValueMoment`, `ValueMomentTier`, `CandidateCluster`, `ConvergenceResult`, `QualityStatus`, `QualityCheck`, `QualityReport` |
| `packages/core/src/analysis/convergence.ts` | Logic: `assignTier`, `directMerge`, `parseMergeResponse`, `capTierDistribution`, `isBusinessVerb`, `validateConvergenceQuality`, `converge`, `runConvergence`, `buildMergePrompt`, `MERGE_SYSTEM_PROMPT`, `BUSINESS_VERBS`, `USER_ACTION_VERBS`, `LlmProvider`, `ConvergeOptions` |
| `packages/core/src/analysis/convergence.test.ts` | Tests: migrated from `convergeAndTier.test.ts` + new tests for `converge()` and `runConvergence()` |

## Files Modified

| File | Change |
|------|--------|
| `packages/core/src/analysis/index.ts` | Add `export * from "./convergence"` and `export * from "./convergence-types"` |

No Convex files are modified in this story. No schema changes. No UI changes. The Convex `runConvergencePipeline` action continues to work unchanged -- rewiring it to use `@basesignal/core` is a future integration story.

---

## Verification

```bash
# Run convergence tests
cd packages/core && npm test -- --run src/analysis/convergence.test.ts

# Verify zero external dependencies in the convergence module
grep -rn "from.*convex\|from.*@anthropic\|from.*node:" packages/core/src/analysis/convergence.ts packages/core/src/analysis/convergence-types.ts

# Run full package test suite
cd packages/core && npm test -- --run

# TypeScript build check
cd packages/core && npx tsc --noEmit
```

All existing tests must continue to pass. The extracted module must have zero external dependencies.
