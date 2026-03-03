// Value moment enrichment: cross-reference value moments with measurement spec and lifecycle states.

import type { MeasurementSpec, LifecycleStatesResult, ValueMoment } from "@basesignal/core";
import { extractJson } from "@basesignal/core";
import type { LlmProvider } from "../types.js";
import { buildEventVocabulary, type EventVocabularyEntry } from "./reconcile.js";

// ---------------------------------------------------------------------------
// Enrichment prompt
// ---------------------------------------------------------------------------

const ENRICHMENT_SYSTEM_PROMPT = `You are a product analytics assistant. Your job is to cross-reference value moments with a measurement specification and lifecycle states.

## Instructions

You will receive:
1. A list of value moments (each with id, name, description, tier, and product surfaces)
2. A canonical event vocabulary from the measurement spec (entity.activity pairs)
3. Lifecycle state definitions (if available)

For each value moment, determine:
- **measurement_references**: Which entity.activity pairs from the vocabulary can measure or track this value moment
- **lifecycle_relevance**: Which lifecycle states this value moment is most relevant to
- **suggested_metrics**: 2-3 derivable metric names that could quantify this value moment

## Rules

- Every value moment id in the input MUST appear in your output
- measurement_references must use exact entity.activity pairs from the vocabulary
- lifecycle_relevance must use exact state names from the lifecycle states (if provided)
- suggested_metrics should be snake_case metric names (e.g., "boards_shared_per_user")
- If a value moment has no clear measurement references, use an empty array
- Return ONLY a JSON array, no explanation

## Example

Output:
[
  {
    "id": "vm-1",
    "measurement_references": [{ "entity": "board", "activity": "shared" }],
    "lifecycle_relevance": ["activated", "engaged"],
    "suggested_metrics": ["boards_shared_per_user", "time_to_first_share"]
  }
]`;

function buildEnrichmentUserPrompt(
  valueMoments: ValueMoment[],
  vocabulary: EventVocabularyEntry[],
  lifecycleStates: LifecycleStatesResult | null,
): string {
  const vmLines = valueMoments
    .map((vm) => `- id: ${vm.id} | name: ${vm.name} | tier: ${vm.tier} | surfaces: ${vm.product_surfaces.join(", ") || "none"}\n  description: ${vm.description}`)
    .join("\n");

  const vocabLines = vocabulary
    .map((v) => `- ${v.event} (${v.perspective}: ${v.entity} → ${v.activity})`)
    .join("\n");

  const stateLines = lifecycleStates
    ? lifecycleStates.states
        .map((s) => `- ${s.name}: ${s.definition}`)
        .join("\n")
    : "(no lifecycle states available)";

  return `## Value Moments

${vmLines}

## Canonical Event Vocabulary

${vocabLines}

## Lifecycle States

${stateLines}`;
}

// ---------------------------------------------------------------------------
// Enrichment result type
// ---------------------------------------------------------------------------

export interface EnrichmentEntry {
  id: string;
  measurement_references: Array<{ entity: string; activity: string }>;
  lifecycle_relevance: string[];
  suggested_metrics: string[];
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

/**
 * Parse and validate the LLM enrichment response.
 *
 * Expects a JSON array of EnrichmentEntry objects.
 * Throws on non-array input or entries missing required fields.
 */
export function parseEnrichmentResponse(responseText: string): EnrichmentEntry[] {
  const parsed = extractJson(responseText);

  if (!Array.isArray(parsed)) {
    throw new Error("Expected JSON array of enrichment entries");
  }

  return parsed.map((entry: unknown, i: number) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`Enrichment entry ${i} must be an object`);
    }
    const obj = entry as Record<string, unknown>;

    if (typeof obj.id !== "string" || !obj.id) {
      throw new Error(`Enrichment entry ${i} missing required field: id (must be non-empty string)`);
    }

    const measurement_references = Array.isArray(obj.measurement_references)
      ? obj.measurement_references.filter(
          (r: unknown) => r && typeof r === "object" && typeof (r as Record<string, unknown>).entity === "string" && typeof (r as Record<string, unknown>).activity === "string",
        ) as Array<{ entity: string; activity: string }>
      : [];

    const lifecycle_relevance = Array.isArray(obj.lifecycle_relevance)
      ? obj.lifecycle_relevance.filter((s: unknown) => typeof s === "string") as string[]
      : [];

    const suggested_metrics = Array.isArray(obj.suggested_metrics)
      ? obj.suggested_metrics.filter((s: unknown) => typeof s === "string") as string[]
      : [];

    return { id: obj.id, measurement_references, lifecycle_relevance, suggested_metrics };
  });
}

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

/**
 * Enrich value moments with cross-references to measurement spec entities,
 * lifecycle states, and suggested metrics.
 *
 * Makes a single LLM call. Returns enriched copies — does not mutate input.
 * Returns original value moments when measurement spec is null or has no vocabulary.
 */
export async function enrichValueMoments(
  valueMoments: ValueMoment[],
  measurementSpec: MeasurementSpec | null,
  lifecycleStates: LifecycleStatesResult | null,
  llm: LlmProvider,
): Promise<ValueMoment[]> {
  if (!measurementSpec) return valueMoments;

  const vocabulary = buildEventVocabulary(measurementSpec);
  if (vocabulary.length === 0) return valueMoments;
  if (valueMoments.length === 0) return valueMoments;

  const userPrompt = buildEnrichmentUserPrompt(valueMoments, vocabulary, lifecycleStates);
  const responseText = await llm.complete(
    [
      { role: "system", content: ENRICHMENT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.1 },
  );

  const enrichments = parseEnrichmentResponse(responseText);

  // Build lookup by id
  const enrichmentMap = new Map<string, EnrichmentEntry>();
  for (const entry of enrichments) {
    enrichmentMap.set(entry.id, entry);
  }

  // Merge enrichments onto copies of original value moments
  return valueMoments.map((vm) => {
    const enrichment = enrichmentMap.get(vm.id);
    if (!enrichment) return vm;
    return {
      ...vm,
      measurement_references: enrichment.measurement_references,
      lifecycle_relevance: enrichment.lifecycle_relevance,
      suggested_metrics: enrichment.suggested_metrics,
    };
  });
}
