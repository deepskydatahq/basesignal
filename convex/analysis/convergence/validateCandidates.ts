import { internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import type { ValidatedCandidate } from "./types";
import type { LensResult } from "../lenses/types";

// Re-export pure functions from @basesignal/core for backward compatibility
export {
  FEATURE_AS_VALUE_PATTERNS,
  MARKETING_LANGUAGE_PATTERNS,
  ABSTRACT_OUTCOME_PATTERNS,
  VAGUE_PHRASES,
  isFeatureAsValue,
  isVagueCandidate,
  isMarketingLanguage,
  findWithinLensDuplicates,
  hasUnverifiedFeatureRef,
  buildKnownFeaturesSet,
  runValidationPipeline,
} from "@basesignal/core";

import {
  buildKnownFeaturesSet,
  runValidationPipeline,
} from "@basesignal/core";

// --- LLM Integration ---

/** Parse Claude's JSON response, handling code fences */
export function parseLlmResponse(
  responseText: string
): Array<{
  id: string;
  action: "confirm_flag" | "override_valid" | "remove";
  rewritten_name?: string;
  rewritten_description?: string;
  validation_issue?: string;
}> {
  const fenceMatch = responseText.match(
    /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/
  );
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : responseText.trim();
  const parsed = JSON.parse(jsonStr);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array from LLM response");
  }

  return parsed;
}

const VALIDATION_SYSTEM_PROMPT = `You are a product value analyst. Review flagged value moment candidates and determine the correct action.

For each candidate:
- "confirm_flag": The flag is correct. Provide a rewritten_name and rewritten_description that reframes it as an outcome ("Users achieve X" not "Use the Y feature"). Also provide validation_issue explaining the problem.
- "override_valid": The flag was incorrect, the candidate is actually valid. Provide validation_issue explaining why the flag was wrong.
- "remove": The candidate should be removed entirely. Provide validation_issue explaining why.

Return a JSON array. Example:
[
  {
    "id": "candidate_id",
    "action": "confirm_flag",
    "rewritten_name": "Outcome-focused name",
    "rewritten_description": "Users achieve specific measurable outcome through this capability",
    "validation_issue": "Original was feature-as-value: started with 'Use the...'"
  }
]

Rules:
- Return ONLY valid JSON array, no commentary
- Every rewritten description should be outcome-focused and specific
- Prefer "confirm_flag" with rewrite over "remove" when an outcome can be inferred
- Use "remove" only when no meaningful outcome can be extracted`;

function buildLlmPrompt(
  flaggedCandidates: Array<{
    id: string;
    name: string;
    description: string;
    lens: string;
    flags: string[];
  }>,
  knownFeatures: string[]
): string {
  const candidateList = flaggedCandidates
    .map(
      (c) =>
        `- ID: ${c.id}\n  Lens: ${c.lens}\n  Name: ${c.name}\n  Description: ${c.description}\n  Flags: ${c.flags.join(", ")}`
    )
    .join("\n\n");

  return `Review these flagged value moment candidates:

${candidateList}

Known product features for reference: ${knownFeatures.length > 0 ? knownFeatures.join(", ") : "(none available)"}

For each candidate, determine the action and provide rewrites where appropriate.`;
}

// --- Orchestrator ---

/**
 * Validate lens candidates: run deterministic checks, then LLM review for flagged ones.
 *
 * Flow:
 * 1. Load product profile for knowledge graph
 * 2. Run deterministic checks on all candidates
 * 3. Find duplicates within each lens
 * 4. Send flagged candidates to Claude Haiku for judgment/rewriting
 * 5. Merge results and return ValidatedCandidate[]
 */
export const validateCandidatesAction = internalAction({
  args: {
    lensResults: v.any(),
    productId: v.id("products"),
  },
  handler: async (ctx, args): Promise<ValidatedCandidate[]> => {
    const lensResults = args.lensResults as LensResult[];

    // 1. Load product profile
    const profile = await ctx.runQuery(
      internal.productProfiles.getInternal,
      { productId: args.productId }
    );
    const knownFeatures = profile
      ? buildKnownFeaturesSet(profile)
      : new Set<string>();

    // 2. Run validation pipeline
    return runValidationPipeline(lensResults, knownFeatures);
  },
});

/**
 * Call Claude Haiku to review flagged candidates and apply rewrites.
 * Returns the updated results array with LLM judgments applied.
 */
export async function applyLlmReview(
  results: ValidatedCandidate[],
  flaggedCandidates: Array<{
    id: string;
    name: string;
    description: string;
    lens: string;
    flags: string[];
  }>,
  knownFeatures: Set<string>
): Promise<ValidatedCandidate[]> {
  if (flaggedCandidates.length === 0) return results;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Graceful degradation: keep deterministic flags without rewriting
    return results;
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildLlmPrompt(
    flaggedCandidates,
    Array.from(knownFeatures)
  );

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: VALIDATION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const llmResults = parseLlmResponse(textContent);

    // Apply LLM results back to our validated candidates
    for (const llmResult of llmResults) {
      const idx = results.findIndex((r) => r.id === llmResult.id);
      if (idx === -1) continue;

      if (llmResult.action === "override_valid") {
        results[idx].validation_status = "valid";
        results[idx].validation_issue = llmResult.validation_issue;
      } else if (llmResult.action === "remove") {
        results[idx].validation_status = "removed";
        results[idx].validation_issue = llmResult.validation_issue;
      } else if (llmResult.action === "confirm_flag") {
        results[idx].validation_status = "rewritten";
        results[idx].validation_issue = llmResult.validation_issue;
        if (llmResult.rewritten_name || llmResult.rewritten_description) {
          results[idx].rewritten_from = {
            name: results[idx].name,
            description: results[idx].description,
          };
          if (llmResult.rewritten_name) {
            results[idx].name = llmResult.rewritten_name;
          }
          if (llmResult.rewritten_description) {
            results[idx].description = llmResult.rewritten_description;
          }
        }
      }
    }
  } catch {
    // Graceful degradation: keep deterministic flags if LLM fails
  }

  return results;
}
