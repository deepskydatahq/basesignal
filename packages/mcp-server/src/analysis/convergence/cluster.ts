// LLM-based clustering with TF-IDF fallback.
// Pure clustering functions are imported from @basesignal/core.

import type { LlmProvider } from "../types.js";
import type { ValidatedCandidate, CandidateCluster } from "@basesignal/core";
import {
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
  clusterCandidatesCore,
} from "@basesignal/core";

// Re-export for convenience
export {
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
  clusterCandidatesCore,
};

/**
 * Cluster candidates using LLM semantic grouping.
 * Falls back to TF-IDF clustering on failure.
 */
export async function clusterCandidatesLLM(
  candidates: ValidatedCandidate[],
  llm: LlmProvider,
): Promise<CandidateCluster[]> {
  if (candidates.length === 0) return [];

  const responseText = await llm.complete(
    [
      { role: "system", content: CLUSTERING_SYSTEM_PROMPT },
      { role: "user", content: buildClusteringPrompt(candidates) },
    ],
    { temperature: 0.2, maxTokens: 4096 },
  );

  return parseClusteringResponse(responseText, candidates);
}
