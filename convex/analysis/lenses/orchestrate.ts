import { action, internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import type { LensType, LensResult, AllLensesResult } from "./types";

export const BATCH1_LENSES: LensType[] = [
  "capability_mapping",
  "effort_elimination",
  "time_compression",
  "artifact_creation",
];

export const BATCH2_LENSES: LensType[] = [
  "info_asymmetry",
  "decision_enablement",
  "state_transitions",
];

/**
 * Build a context summary string from Batch 1 results for Batch 2 lenses.
 * Takes top 5 candidates per lens with name + description.
 */
export function buildBatch1ContextSummary(
  batch1Results: LensResult[],
): Record<string, { candidates: Array<{ name: string; description: string }> }> {
  const context: Record<string, { candidates: Array<{ name: string; description: string }> }> = {};

  for (const result of batch1Results) {
    context[result.lens] = {
      candidates: result.candidates.slice(0, 5).map((c) => ({
        name: c.name,
        description: c.description,
      })),
    };
  }

  return context;
}

/**
 * Process settled promises from Promise.allSettled, extracting results and errors.
 */
export function processSettledResults(
  settled: PromiseSettledResult<LensResult>[],
  lensNames: LensType[],
): {
  results: LensResult[];
  errors: Array<{ lens: LensType; error: string }>;
} {
  const results: LensResult[] = [];
  const errors: Array<{ lens: LensType; error: string }> = [];

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    const lens = lensNames[i];

    if (outcome.status === "fulfilled") {
      results.push(outcome.value);
    } else {
      const errorMessage =
        outcome.reason instanceof Error
          ? outcome.reason.message
          : String(outcome.reason);
      errors.push({ lens, error: errorMessage });
    }
  }

  return { results, errors };
}

export const runAllLenses = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args): Promise<AllLensesResult> => {
    const startTime = Date.now();
    const allErrors: Array<{ lens: LensType; error: string }> = [];
    const allPerLens: AllLensesResult["per_lens"] = [];

    // Batch 1: Run 4 independent lenses in parallel
    const batch1Settled = await Promise.allSettled([
      ctx.runAction(
        internal.analysis.lenses.extractCapabilityMapping.extractCapabilityMapping,
        { productId: args.productId },
      ),
      ctx.runAction(
        internal.analysis.lenses.extractEffortElimination.extractEffortElimination,
        { productId: args.productId },
      ),
      ctx.runAction(
        internal.analysis.lenses.extractTimeCompression.extractTimeCompression,
        { productId: args.productId },
      ),
      ctx.runAction(
        internal.analysis.lenses.extractArtifactCreation.extractArtifactCreation,
        { productId: args.productId },
      ),
    ]);

    const batch1 = processSettledResults(batch1Settled, BATCH1_LENSES);
    allErrors.push(...batch1.errors);

    for (const result of batch1.results) {
      allPerLens.push({
        lens: result.lens,
        candidate_count: result.candidate_count,
        execution_time_ms: result.execution_time_ms,
      });
    }

    // Build context summary from Batch 1 results for Batch 2
    const batch1Context = buildBatch1ContextSummary(batch1.results);

    // Batch 2: Run 3 inference-heavy lenses with Batch 1 context
    const batch2Settled = await Promise.allSettled([
      ctx.runAction(
        internal.analysis.lenses.extractInfoAsymmetry.extractInfoAsymmetry,
        { productId: args.productId, batch1Results: batch1Context },
      ),
      ctx.runAction(
        internal.analysis.lenses.extractDecisionEnablement.extractDecisionEnablement,
        { productId: args.productId, batch1Results: batch1Context },
      ),
      ctx.runAction(
        internal.analysis.lenses.extractStateTransitions.extractStateTransitions,
        { productId: args.productId, batch1Results: batch1Context },
      ),
    ]);

    const batch2 = processSettledResults(batch2Settled, BATCH2_LENSES);
    allErrors.push(...batch2.errors);

    for (const result of batch2.results) {
      allPerLens.push({
        lens: result.lens,
        candidate_count: result.candidate_count,
        execution_time_ms: result.execution_time_ms,
      });
    }

    // Collect all candidates
    const allResults = [...batch1.results, ...batch2.results];
    const candidates = allResults.flatMap((r) => r.candidates);

    return {
      productId: args.productId,
      candidates,
      per_lens: allPerLens,
      total_candidates: candidates.length,
      execution_time_ms: Date.now() - startTime,
      errors: allErrors,
    };
  },
});

export const testRunAllLenses = action({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    return await ctx.runAction(
      internal.analysis.lenses.orchestrate.runAllLenses,
      { productId: args.productId },
    );
  },
});
