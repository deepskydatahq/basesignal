// Lens orchestration: runs all 7 lenses (Batch 1 parallel, then Batch 2 parallel with context).

import type { CrawledPage, LlmProvider, ProductContext } from "../types.js";
import type { LensResult, LensCandidate, AllLensesResult, Batch1Context } from "./lens-types.js";
import { extractCapabilityMapping } from "./capability-mapping.js";
import { extractEffortElimination } from "./effort-elimination.js";
import { extractTimeCompression } from "./time-compression.js";
import { extractArtifactCreation } from "./artifact-creation.js";
import { extractInfoAsymmetry } from "./info-asymmetry.js";
import { extractDecisionEnablement } from "./decision-enablement.js";
import { extractStateTransitions } from "./state-transitions.js";

// Re-export types
export type { LensResult, LensCandidate, AllLensesResult, Batch1Context };

/**
 * Build a context summary from Batch 1 results for Batch 2 lenses.
 * Takes top 5 candidates per lens with name + description.
 */
export function buildBatch1ContextSummary(
  batch1Results: LensResult[],
): Batch1Context {
  const context: Batch1Context = {};

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
 * Run all 7 analytical lenses: Batch 1 (4 parallel), then Batch 2 (3 parallel with Batch 1 context).
 */
export async function runAllLenses(
  pages: CrawledPage[],
  llm: LlmProvider,
  productContext?: ProductContext,
): Promise<AllLensesResult> {
  const startTime = Date.now();
  const errors: Array<{ lens: string; error: string }> = [];

  // Batch 1: 4 parallel lenses
  const batch1Settled = await Promise.allSettled([
    extractCapabilityMapping(pages, llm, productContext),
    extractEffortElimination(pages, llm, productContext),
    extractTimeCompression(pages, llm, productContext),
    extractArtifactCreation(pages, llm, productContext),
  ]);

  const batch1Results: LensResult[] = [];
  const batch1Names = ["capability_mapping", "effort_elimination", "time_compression", "artifact_creation"];
  for (let i = 0; i < batch1Settled.length; i++) {
    const result = batch1Settled[i];
    if (result.status === "fulfilled") {
      batch1Results.push(result.value);
    } else {
      const errorMessage = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
      errors.push({ lens: batch1Names[i], error: errorMessage });
    }
  }

  // Build Batch 1 context for Batch 2
  const batch1Context = buildBatch1ContextSummary(batch1Results);

  // Batch 2: 3 parallel lenses with Batch 1 context
  const batch2Settled = await Promise.allSettled([
    extractInfoAsymmetry(pages, llm, batch1Context, productContext),
    extractDecisionEnablement(pages, llm, batch1Context, productContext),
    extractStateTransitions(pages, llm, batch1Context, productContext),
  ]);

  const batch2Results: LensResult[] = [];
  const batch2Names = ["info_asymmetry", "decision_enablement", "state_transitions"];
  for (let i = 0; i < batch2Settled.length; i++) {
    const result = batch2Settled[i];
    if (result.status === "fulfilled") {
      batch2Results.push(result.value);
    } else {
      const errorMessage = result.reason instanceof Error
        ? result.reason.message
        : String(result.reason);
      errors.push({ lens: batch2Names[i], error: errorMessage });
    }
  }

  const allCandidates = [...batch1Results, ...batch2Results].flatMap((r) => r.candidates);

  return {
    batch1Results,
    batch2Results,
    allCandidates,
    errors,
    execution_time_ms: Date.now() - startTime,
  };
}
