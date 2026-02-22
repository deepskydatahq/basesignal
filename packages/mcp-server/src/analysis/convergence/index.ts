// Convergence orchestration: validation -> clustering -> merge/tier -> quality.

import type { LlmProvider, OnProgress } from "../types.js";
import type { LensResult } from "../lenses/lens-types.js";
import type { ConvergenceResult, ValidatedCandidate } from "@basesignal/core";

export interface ConvergenceResultWithCandidates extends ConvergenceResult {
  validated_candidates: ValidatedCandidate[];
}
import { runValidationPipeline } from "./validate.js";
import { clusterCandidatesLLM } from "./cluster.js";
import { clusterCandidatesCore } from "@basesignal/core";
import { convergeAndTier } from "./converge.js";
import { capTierDistribution, validateConvergenceQuality } from "./quality.js";

// Re-export for external use
export { runValidationPipeline } from "./validate.js";
export { clusterCandidatesLLM } from "./cluster.js";
export { convergeAndTier } from "./converge.js";
export { capTierDistribution, validateConvergenceQuality } from "./quality.js";

/**
 * Run the full convergence pipeline:
 * 1. Validate lens candidates (deterministic checks)
 * 2. Cluster candidates (LLM with TF-IDF fallback)
 * 3. Merge and tier (LLM with directMerge fallback)
 * 4. Quality validation
 */
export async function runConvergence(
  lensResults: LensResult[],
  llm: LlmProvider,
  knownFeatures?: Set<string>,
  progress?: OnProgress,
): Promise<ConvergenceResultWithCandidates> {
  const features = knownFeatures ?? new Set<string>();

  // 1. Validation
  progress?.({ phase: "validation", status: "started" });
  const validated = runValidationPipeline(lensResults, features);
  const active = validated.filter((c) => c.validation_status !== "removed");
  progress?.({ phase: "validation", status: "completed", detail: `${active.length} active candidates` });

  // 2. Clustering (LLM first, TF-IDF fallback)
  progress?.({ phase: "clustering", status: "started" });
  let clusters;
  try {
    clusters = await clusterCandidatesLLM(active, llm);
  } catch {
    clusters = clusterCandidatesCore(active);
  }
  progress?.({ phase: "clustering", status: "completed", detail: `${clusters.length} clusters` });

  // 3. Converge and tier
  progress?.({ phase: "convergence", status: "started" });
  const rawMoments = await convergeAndTier(clusters, llm);
  const valueMoments = capTierDistribution(rawMoments);
  progress?.({ phase: "convergence", status: "completed", detail: `${valueMoments.length} moments` });

  // 4. Build result with stats
  const result: ConvergenceResultWithCandidates = {
    value_moments: valueMoments,
    clusters,
    validated_candidates: active,
    stats: {
      total_candidates: active.length,
      total_clusters: clusters.length,
      total_moments: valueMoments.length,
      tier_1_count: valueMoments.filter((m) => m.tier === 1).length,
      tier_2_count: valueMoments.filter((m) => m.tier === 2).length,
      tier_3_count: valueMoments.filter((m) => m.tier === 3).length,
    },
  };

  // 5. Quality validation (non-blocking)
  try {
    result.quality = validateConvergenceQuality(result);
  } catch {
    // ignore quality validation errors
  }

  return result;
}
