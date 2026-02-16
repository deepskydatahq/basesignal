import { internalAction } from "../../_generated/server";
import { v } from "convex/values";
import type Anthropic from "@anthropic-ai/sdk";
import type { ValidatedCandidate, CandidateCluster } from "./types";

// Re-export pure functions from @basesignal/core for backward compatibility
export {
  DEFAULT_SIMILARITY_THRESHOLD,
  UnionFind,
  candidateText,
  sameLens,
  canMerge,
  buildCluster,
  clusterCandidatesCore,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
} from "@basesignal/core";

import {
  clusterCandidatesCore,
  DEFAULT_SIMILARITY_THRESHOLD,
  CLUSTERING_SYSTEM_PROMPT,
  buildClusteringPrompt,
  parseClusteringResponse,
} from "@basesignal/core";

// --- Convex internalAction ---

export const clusterCandidates = internalAction({
  args: {
    productId: v.id("products"),
    validatedCandidates: v.any(),
    threshold: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const candidates = args.validatedCandidates as ValidatedCandidate[];

    // Filter out removed candidates
    const active = candidates.filter((c) => c.validation_status !== "removed");

    const threshold = args.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    return clusterCandidatesCore(active, threshold);
  },
});

// --- LLM-based clustering ---

/**
 * Cluster candidates using an LLM call for semantic grouping.
 * Requires an Anthropic client instance.
 */
export async function clusterCandidatesLLM(
  candidates: ValidatedCandidate[],
  client: Anthropic
): Promise<CandidateCluster[]> {
  if (candidates.length === 0) return [];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    temperature: 0.2,
    system: CLUSTERING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildClusteringPrompt(candidates) }],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseClusteringResponse(text, candidates);
}
