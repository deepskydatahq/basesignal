// Top-level analysis pipeline orchestrator.
// Runs: identity + activation (parallel) -> lenses (batch1 -> batch2) -> convergence -> outputs.

import type { PipelineInput, PipelineResult, PipelineError, PipelineIntermediates, LlmProvider, OnProgress } from "./types.js";
import { extractIdentity } from "./identity.js";
import { extractActivationLevels } from "./activation-levels.js";
import { runAllLenses } from "./lenses/index.js";
import { runConvergence } from "./convergence/index.js";
import { generateAllOutputs, type OutputsResult } from "./outputs/index.js";

function settledOrError<T>(
  result: PromiseSettledResult<T>,
  phase: string,
  step: string,
  errors: PipelineError[],
): T | null {
  if (result.status === "fulfilled") return result.value;
  const message = result.reason instanceof Error
    ? result.reason.message
    : String(result.reason);
  errors.push({ phase, step, message });
  return null;
}

/**
 * Run the full analysis pipeline: identity, activation levels, 7 lenses, convergence, outputs.
 *
 * All LLM calls go through the injected LlmProvider.
 * The pipeline returns partial results when individual phases fail.
 */
export async function runAnalysisPipeline(
  input: PipelineInput,
  llm: LlmProvider,
  onProgress?: OnProgress,
): Promise<PipelineResult> {
  const progress = onProgress ?? (() => {});
  const errors: PipelineError[] = [];
  const start = Date.now();

  if (input.pages.length === 0) {
    return {
      identity: null,
      activation_levels: null,
      lens_candidates: [],
      convergence: null,
      intermediates: { lens_results: [], validated_candidates: [], clusters: null, quality_report: null },
      outputs: { icp_profiles: [], activation_map: null, measurement_spec: null, lifecycle_states: null },
      errors: [{ phase: "input", step: "validate", message: "No pages provided" }],
      execution_time_ms: Date.now() - start,
    };
  }

  // Phase 1: Identity + Activation Levels (parallel, independent)
  progress({ phase: "identity", status: "started" });
  progress({ phase: "activation_levels", status: "started" });

  const [identityResult, activationResult] = await Promise.allSettled([
    extractIdentity(input.pages, llm),
    extractActivationLevels(input.pages, llm, input.productContext),
  ]);

  const identity = settledOrError(identityResult, "identity", "extract", errors);
  if (identity) progress({ phase: "identity", status: "completed" });
  else progress({ phase: "identity", status: "failed" });

  const activation_levels = settledOrError(activationResult, "activation_levels", "extract", errors);
  if (activation_levels) progress({ phase: "activation_levels", status: "completed" });
  else progress({ phase: "activation_levels", status: "failed" });

  // Build product context from identity result (enriches lens extraction)
  const productContext = identity
    ? { name: identity.productName, description: identity.description, targetCustomer: identity.targetCustomer }
    : input.productContext;

  // Phase 2: Lens extraction (Batch 1 -> Batch 2)
  progress({ phase: "lenses_batch1", status: "started" });
  const lensResult = await runAllLenses(input.pages, llm, productContext);
  progress({ phase: "lenses_batch1", status: "completed" });
  for (const err of lensResult.errors) {
    errors.push({ phase: "lenses", step: err.lens, message: err.error });
  }

  // Phase 3: Convergence (validation -> clustering -> merge/tier)
  let convergence = null;
  const allLensResults = [...lensResult.batch1Results, ...lensResult.batch2Results];
  if (allLensResults.length > 0) {
    try {
      convergence = await runConvergence(allLensResults, llm, undefined, progress);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ phase: "convergence", step: "full", message });
    }
  }

  // Phase 4: Output generation
  let outputs: OutputsResult = { icp_profiles: [], activation_map: null, measurement_spec: null, lifecycle_states: null };
  if (convergence) {
    const pageUrls = input.pages.map(p => p.url);
    outputs = await generateAllOutputs(convergence, activation_levels, identity, llm, progress, errors, pageUrls);
  }

  // Build intermediates from all pipeline stages
  const intermediates: PipelineIntermediates = {
    lens_results: allLensResults.map((lr) => ({ lens: lr.lens, candidates: lr.candidates })),
    validated_candidates: convergence?.validated_candidates ?? [],
    clusters: convergence?.clusters ?? null,
    quality_report: convergence?.quality ?? null,
  };

  return {
    identity,
    activation_levels,
    lens_candidates: lensResult.allCandidates,
    convergence,
    intermediates,
    outputs,
    errors,
    execution_time_ms: Date.now() - start,
  };
}
