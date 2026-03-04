// Outcome enrichment: cross-reference outcomes with measurement spec entities.

import type { MeasurementSpec, OutcomeItem } from "@basesignal/core";
import { extractJson } from "@basesignal/core";
import type { LlmProvider } from "../types.js";
import { buildEventVocabulary, formatVocabulary, type EventVocabularyEntry } from "./reconcile.js";

// ---------------------------------------------------------------------------
// Enrichment prompt
// ---------------------------------------------------------------------------

const ENRICHMENT_SYSTEM_PROMPT = `You are a product analytics assistant. Your job is to cross-reference product outcomes with a measurement specification.

## Instructions

You will receive:
1. A numbered list of outcomes (each with index, description, type, and linkedFeatures)
2. A canonical event vocabulary from the measurement spec (entity.activity pairs)

For each outcome, determine:
- **measurement_references**: Which entity.activity pairs from the vocabulary can measure or track this outcome
- **suggested_metrics**: 2-3 derivable metric names that could quantify this outcome

## Rules

- Every outcome description in the input MUST appear in your output
- measurement_references must use exact entity.activity pairs from the vocabulary
- suggested_metrics should be snake_case metric names (e.g., "boards_shared_per_user")
- If an outcome has no clear measurement references, use an empty array
- Return ONLY a JSON array, no explanation

## Example

Output:
[
  {
    "description": "Increase team velocity",
    "measurement_references": [{ "entity": "sprint", "activity": "completed" }],
    "suggested_metrics": ["sprints_completed_per_week", "avg_velocity_trend"]
  }
]`;

function buildOutcomeEnrichmentUserPrompt(
  outcomes: OutcomeItem[],
  vocabulary: EventVocabularyEntry[],
): string {
  const outcomeLines = outcomes
    .map((o, i) => `- [${i}] description: ${o.description} | type: ${o.type} | linkedFeatures: ${o.linkedFeatures.join(", ") || "none"}`)
    .join("\n");

  const vocabLines = formatVocabulary(vocabulary);

  return `## Outcomes

${outcomeLines}

## Canonical Event Vocabulary

${vocabLines}`;
}

// ---------------------------------------------------------------------------
// Enrichment result type
// ---------------------------------------------------------------------------

export interface OutcomeEnrichmentEntry {
  description: string;
  measurement_references: Array<{ entity: string; activity: string }>;
  suggested_metrics: string[];
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/**
 * Parse and validate the LLM outcome enrichment response.
 *
 * Expects a JSON array of OutcomeEnrichmentEntry objects.
 * Throws on non-array input or entries missing required fields.
 */
export function parseOutcomeEnrichmentResponse(responseText: string): OutcomeEnrichmentEntry[] {
  const parsed = extractJson(responseText);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of outcome enrichment entries");
  }

  return parsed.map((entry: unknown, i: number) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Outcome enrichment entry ${i} must be an object`);
    }
    const obj = entry as Record<string, unknown>;

    if (typeof obj.description !== "string" || !obj.description) {
      throw new Error(`Outcome enrichment entry ${i} missing required field: description (must be non-empty string)`);
    }

    const measurement_references = Array.isArray(obj.measurement_references)
      ? obj.measurement_references.filter(
          (r: unknown) => r && typeof r === "object" && typeof (r as Record<string, unknown>).entity === "string" && typeof (r as Record<string, unknown>).activity === "string",
        ) as Array<{ entity: string; activity: string }>
      : [];

    const suggested_metrics = Array.isArray(obj.suggested_metrics)
      ? obj.suggested_metrics.filter((s: unknown) => typeof s === "string") as string[]
      : [];

    return { description: obj.description, measurement_references, suggested_metrics };
  });
}

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

/**
 * Enrich outcomes with cross-references to measurement spec entities
 * and suggested metrics.
 *
 * Makes a single LLM call. Returns enriched copies — does not mutate input.
 * Returns original outcomes when measurement spec is null or has no vocabulary.
 */
export async function enrichOutcomes(
  outcomes: OutcomeItem[],
  measurementSpec: MeasurementSpec | null,
  llm: LlmProvider,
): Promise<OutcomeItem[]> {
  if (!measurementSpec) return outcomes;

  const vocabulary = buildEventVocabulary(measurementSpec);
  if (vocabulary.length === 0) return outcomes;
  if (outcomes.length === 0) return outcomes;

  const userPrompt = buildOutcomeEnrichmentUserPrompt(outcomes, vocabulary);
  const responseText = await llm.complete(
    [
      { role: "system", content: ENRICHMENT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.1 },
  );

  const enrichments = parseOutcomeEnrichmentResponse(responseText);

  // Build lookup by description
  const enrichmentMap = new Map<string, OutcomeEnrichmentEntry>();
  for (const entry of enrichments) {
    enrichmentMap.set(entry.description, entry);
  }

  // Merge enrichments onto copies of original outcomes
  return outcomes.map((outcome) => {
    const enrichment = enrichmentMap.get(outcome.description);
    if (!enrichment) return outcome;
    return {
      ...outcome,
      measurement_references: enrichment.measurement_references,
      suggested_metrics: enrichment.suggested_metrics,
    };
  });
}
