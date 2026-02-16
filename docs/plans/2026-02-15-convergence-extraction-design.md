# Convergence and Tiering Logic Extraction Design

**Story:** M008-E001-S006 — Extract convergence and tiering logic
**Date:** 2026-02-15
**Depends on:** M008-E001-S005 (pure analysis utilities — similarity, clustering, validation)

---

## 1. Overview

Extract the convergence pipeline (validate -> cluster -> converge -> tier -> quality-check) from `convex/analysis/convergence/` into `packages/core/src/analysis/convergence.ts`. The key challenge is that the merge step calls Claude for cluster-to-ValueMoment synthesis. This design uses dependency injection -- a simple `(prompt: string, system: string) => Promise<string>` function parameter -- so the extracted code works without any LLM SDK dependency, falling back to deterministic `directMerge()` when no provider is given.

## 2. Problem Statement

The convergence pipeline currently lives inside `convex/analysis/convergence/` and is tightly coupled to the Convex runtime (via `internalAction`) and directly imports the Anthropic SDK. This prevents reuse outside the Convex environment -- the open source `@basesignal/core` package cannot depend on Convex or a specific LLM vendor. The logic itself is largely pure (tiering, quality validation, merge-response parsing, tier capping), but the LLM calls for clustering and merging create hard dependencies that must be abstracted away.

## 3. Expert Perspectives

### Technical Architect

The convergence pipeline has a clean seam between pure logic and LLM-dependent code. The pure functions (`assignTier`, `directMerge`, `capTierDistribution`, `validateConvergenceQuality`, `parseMergeResponse`, `buildMergePrompt`) are already testable without mocks. The LLM-dependent parts (`convergeAndTier`, `clusterCandidatesLLM`) only need one abstraction: a function that takes a prompt and returns text. Resist the temptation to build a full provider interface -- a simple function type is the minimal API surface, and consumers can wrap any LLM SDK into that shape.

### Simplification Reviewer

**Verdict: APPROVED with one simplification.**

What to remove: The `MERGE_SYSTEM_PROMPT` and `CLUSTERING_SYSTEM_PROMPT` constants should be exported but the prompt-building functions (`buildMergePrompt`, `buildClusteringPrompt`) should be considered part of the public API so users can customize them. However, do NOT add a "prompt customization" feature -- just export the functions and let consumers compose. The design feels unified: types in, value moments out, LLM is optional. The one cut: do not extract the `applyLlmReview` function from `validateCandidates.ts` in this story -- it belongs to the validation step (S005's scope), not the convergence step. Keep the boundary clean.

## 4. Proposed Solution

### 4.1 What Gets Extracted

From `convex/analysis/convergence/convergeAndTier.ts` -- the convergence and tiering logic:

| Source Function | Target Location | Pure? |
|----------------|-----------------|-------|
| `assignTier(lensCount)` | `packages/core/src/analysis/convergence.ts` | Yes |
| `directMerge(cluster)` | `packages/core/src/analysis/convergence.ts` | Yes |
| `parseMergeResponse(text)` | `packages/core/src/analysis/convergence.ts` | Yes |
| `capTierDistribution(moments)` | `packages/core/src/analysis/convergence.ts` | Yes |
| `isBusinessVerb(name)` | `packages/core/src/analysis/convergence.ts` | Yes |
| `BUSINESS_VERBS`, `USER_ACTION_VERBS` | `packages/core/src/analysis/convergence.ts` | Yes |
| `validateConvergenceQuality(result)` | `packages/core/src/analysis/convergence.ts` | Yes |
| `convergeAndTier(clusters, client)` | Refactored into `converge(clusters, options?)` | LLM-optional |
| `MERGE_SYSTEM_PROMPT` | `packages/core/src/analysis/convergence.ts` | Yes (constant) |
| `buildMergePrompt(cluster)` | `packages/core/src/analysis/convergence.ts` | Yes |

From `convex/analysis/convergence/types.ts`:

| Source Type | Target Location |
|-------------|-----------------|
| `ValueMomentTier` | `packages/core/src/analysis/convergence-types.ts` |
| `ValueMoment` | `packages/core/src/analysis/convergence-types.ts` |
| `CandidateCluster` | `packages/core/src/analysis/convergence-types.ts` |
| `QualityStatus`, `QualityCheck`, `QualityReport` | `packages/core/src/analysis/convergence-types.ts` |
| `ConvergenceResult` | `packages/core/src/analysis/convergence-types.ts` |
| `ValidatedCandidate` | Already extracted in S005 |
| `LensType`, `ValidationStatus` | Already extracted in S005 |

### 4.2 LLM Abstraction Strategy

The simplest possible abstraction -- a function type, not an interface:

```typescript
/**
 * A function that sends a prompt to an LLM and returns the text response.
 * Consumers wrap their preferred SDK into this shape.
 */
export type LlmProvider = (prompt: string, system: string) => Promise<string>;
```

The refactored `converge` function:

```typescript
export interface ConvergeOptions {
  /** Optional LLM provider for semantic merge descriptions. Without it, uses directMerge(). */
  llmProvider?: LlmProvider;
}

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

### 4.3 Full Pipeline Function

A convenience function that runs the complete post-clustering convergence:

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

### 4.4 Module Structure

```
packages/core/src/analysis/
  convergence-types.ts     # Types: ValueMoment, CandidateCluster, ConvergenceResult, etc.
  convergence.ts           # Logic: assignTier, directMerge, converge, capTierDistribution, etc.
  convergence.test.ts      # Tests adapted from convergeAndTier.test.ts
```

All types that S005 already extracts (`ValidatedCandidate`, `LensType`, `ValidationStatus`) are imported from their S005 location, not duplicated.

### 4.5 Convex Integration Point

After extraction, the Convex `runConvergencePipeline` action becomes a thin wrapper:

```typescript
// convex/analysis/convergence/convergeAndTier.ts (after extraction)
import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import {
  converge,
  capTierDistribution,
  validateConvergenceQuality,
  type LlmProvider,
} from "@basesignal/core";
import { clusterCandidatesCore, clusterCandidatesLLM } from "./clusterCandidates";

function makeAnthropicProvider(client: Anthropic): LlmProvider {
  return async (prompt: string, system: string) => {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  };
}

export const runConvergencePipeline = internalAction({
  // ... same args ...
  handler: async (ctx, args) => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const llmProvider = makeAnthropicProvider(client);
    // ... clustering step (also uses LLM but that's a separate extraction) ...
    // ... call converge(clusters, { llmProvider }) ...
    // ... store result ...
  },
});
```

This is NOT done in this story -- it is the future integration step. This story only extracts the logic into `packages/core`.

## 5. Key Decisions

1. **LlmProvider is a function, not an interface.** A `(prompt: string, system: string) => Promise<string>` is the simplest possible abstraction. It requires zero framework knowledge to implement. Any consumer wraps their SDK in 5 lines.

2. **System prompt is passed through, not embedded.** The `LlmProvider` receives both `prompt` and `system` so it can use whatever system prompt mechanism the underlying SDK supports. The `MERGE_SYSTEM_PROMPT` constant is exported for consumers who want the default behavior.

3. **directMerge is the zero-dependency default.** Calling `converge(clusters)` without options produces valid ValueMoments with deterministic names ("Achieve X / Y"). Not as good as LLM-generated names, but functional and testable.

4. **Types go in a separate file from logic.** `convergence-types.ts` for types, `convergence.ts` for functions. This matches the existing pattern in the convergence directory and keeps imports clean.

5. **Tier capping is NOT optional.** `capTierDistribution` is always applied in `runConvergence`. The max-3-T1 / max-20-T3 policy is a business rule, not a preference. If someone wants raw moments, they call `converge()` directly instead of `runConvergence()`.

6. **LLM clustering is NOT extracted in this story.** The `clusterCandidatesLLM` function in `clusterCandidates.ts` also uses an LLM, but clustering extraction is S005's scope (it already extracts `clusterCandidatesCore`). The LLM clustering abstraction follows the same `LlmProvider` pattern but is a separate concern.

## 6. What This Does NOT Do

- **Does NOT extract the validation pipeline** (`validateCandidates.ts` / `applyLlmReview`). That is S005's scope.
- **Does NOT extract LLM-based clustering** (`clusterCandidatesLLM`). S005 extracts the deterministic `clusterCandidatesCore`; LLM clustering follows the same provider pattern but is a separate extraction.
- **Does NOT change the Convex action signatures.** The existing `runConvergencePipeline` action continues to work unchanged. Integration (rewiring Convex to call `@basesignal/core`) happens in a later story.
- **Does NOT create a full LLM provider abstraction** (model selection, temperature, retries). That is M008-E004's scope. This story uses the simplest possible function type.
- **Does NOT publish the package to npm.** The package is created locally in the monorepo; publishing is M008-E005/E006.
- **Does NOT extract prompt constants as configurable.** The `MERGE_SYSTEM_PROMPT` is exported as a constant. Consumers can pass a different system prompt by wrapping their `LlmProvider` to ignore the system parameter and use their own.

## 7. Verification Steps

1. **Unit test: `assignTier`** -- Verify 4+ lenses -> T1, 2-3 -> T2, 1 -> T3. (Migrate existing tests from `convergeAndTier.test.ts`.)

2. **Unit test: `directMerge`** -- Verify deterministic ValueMoment generation from a cluster. Name format, tier assignment, contributing candidates.

3. **Unit test: `converge` without LLM** -- Call `converge(clusters)` with no options. Verify it produces one ValueMoment per cluster using `directMerge` logic.

4. **Unit test: `converge` with mock LLM** -- Inject a mock `LlmProvider` that returns valid JSON. Verify parsed fields flow into the ValueMoment.

5. **Unit test: `converge` with failing LLM** -- Inject a provider that throws. Verify fallback to `directMerge` per cluster (mixed success/failure).

6. **Unit test: `capTierDistribution`** -- T1 demotion, T3 dropping, both together, empty input. (Migrate existing tests.)

7. **Unit test: `validateConvergenceQuality`** -- Tier distribution checks, total count, empty fields, experiential names. (Migrate existing tests.)

8. **Unit test: `parseMergeResponse`** -- JSON in fences, raw JSON, missing fields, invalid JSON. (Migrate existing tests.)

9. **Integration test: `runConvergence`** -- Full pipeline without LLM: clusters in, ConvergenceResult out with stats and quality report.

10. **Zero-dependency check:** `packages/core/src/analysis/convergence.ts` imports nothing outside `packages/core`. No Convex, no Anthropic SDK, no Node.js builtins beyond what's available in any JS runtime.

## 8. Success Criteria

- `assignTier(lensCount)` is exported from `packages/core` and correctly maps lens counts to tiers 1/2/3
- `directMerge()` creates ValueMoments from clusters without any LLM (deterministic fallback)
- `converge()` accepts an optional `LlmProvider` -- works without one, uses it when provided
- Full pipeline: clusters -> `converge` -> `capTierDistribution` -> `ConvergenceResult` with quality report
- LLM provider is injected as a function parameter, not imported directly
- All existing convergence tests pass in the new location with updated imports
- The extracted module has zero external dependencies (pure TypeScript only, plus types from S005)
