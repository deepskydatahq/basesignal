// Convergence and tiering: merge clusters into named, tiered value moments.
// Pure functions are imported from @basesignal/core.

import type { LlmProvider } from "../types.js";
import type { CandidateCluster, ValueMoment } from "@basesignal/core";
import {
  assignTier,
  parseMergeResponse,
  directMerge,
  MERGE_SYSTEM_PROMPT,
  buildMergePrompt,
  momentIdFromName,
} from "@basesignal/core";

// Re-export for convenience
export {
  assignTier,
  parseMergeResponse,
  directMerge,
  MERGE_SYSTEM_PROMPT,
  buildMergePrompt,
};

/**
 * Merge candidate clusters into tiered value moments using LLM.
 * Falls back to directMerge for individual clusters when LLM fails.
 */
export async function convergeAndTier(
  clusters: CandidateCluster[],
  llm: LlmProvider,
): Promise<ValueMoment[]> {
  const results = await Promise.allSettled(
    clusters.map(async (cluster): Promise<ValueMoment> => {
      const responseText = await llm.complete(
        [
          { role: "system", content: MERGE_SYSTEM_PROMPT },
          { role: "user", content: buildMergePrompt(cluster) },
        ],
        { temperature: 0.2, maxTokens: 4096 },
      );

      const parsed = parseMergeResponse(responseText);

      return {
        id: "", // placeholder — assigned sequentially below for dedup
        name: parsed.name,
        description: parsed.description,
        tier: assignTier(cluster.lens_count),
        lenses: cluster.lenses,
        lens_count: cluster.lens_count,
        roles: parsed.roles,
        product_surfaces: parsed.product_surfaces,
        contributing_candidates: cluster.candidates.map((c) => c.id),
      };
    }),
  );

  const usedIds = new Set<string>();
  return results.map((result, i) => {
    const moment = result.status === "fulfilled" ? result.value : directMerge(clusters[i]);
    const id = momentIdFromName(moment.name, usedIds);
    usedIds.add(id);
    return { ...moment, id };
  });
}
