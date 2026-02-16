// Validation pipeline wrapper.
// Pure validation logic is imported from @basesignal/core.
// LLM-dependent applyLlmReview is implemented here with LlmProvider injection.

import type { LlmProvider } from "../types.js";
import type { ValidatedCandidate } from "@basesignal/core";

// Re-export pure functions from core
export {
  runValidationPipeline,
  buildKnownFeaturesSet,
  type ValidationLensResult,
} from "@basesignal/core";

// --- LLM Integration ---

/** Parse LLM JSON response, handling code fences */
export function parseLlmResponse(
  responseText: string,
): Array<{
  id: string;
  action: "confirm_flag" | "override_valid" | "remove";
  rewritten_name?: string;
  rewritten_description?: string;
  validation_issue?: string;
}> {
  const fenceMatch = responseText.match(
    /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/,
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
  knownFeatures: string[],
): string {
  const candidateList = flaggedCandidates
    .map(
      (c) =>
        `- ID: ${c.id}\n  Lens: ${c.lens}\n  Name: ${c.name}\n  Description: ${c.description}\n  Flags: ${c.flags.join(", ")}`,
    )
    .join("\n\n");

  return `Review these flagged value moment candidates:

${candidateList}

Known product features for reference: ${knownFeatures.length > 0 ? knownFeatures.join(", ") : "(none available)"}

For each candidate, determine the action and provide rewrites where appropriate.`;
}

/**
 * Call LLM to review flagged candidates and apply rewrites.
 * Returns the updated results array with LLM judgments applied.
 * Graceful degradation: if LLM fails, keeps deterministic flags.
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
  knownFeatures: Set<string>,
  llm: LlmProvider,
): Promise<ValidatedCandidate[]> {
  if (flaggedCandidates.length === 0) return results;

  const prompt = buildLlmPrompt(
    flaggedCandidates,
    Array.from(knownFeatures),
  );

  try {
    const responseText = await llm.complete(
      [
        { role: "system", content: VALIDATION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { model: "haiku", temperature: 0.2, maxTokens: 2048 },
    );

    const llmResults = parseLlmResponse(responseText);

    // Apply LLM results back to validated candidates
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
