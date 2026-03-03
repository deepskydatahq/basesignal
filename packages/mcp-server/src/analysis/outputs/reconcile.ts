// Output reconciliation: align trigger events across outputs to measurement spec vocabulary.

import type { MeasurementSpec, LifecycleStatesResult } from "@basesignal/core";
import { extractJson } from "@basesignal/core";
import type { LlmProvider } from "../types.js";
import type { OutputsResult } from "./index.js";
import type { ActivationMapResult } from "./activation-map.js";

// ---------------------------------------------------------------------------
// Event vocabulary
// ---------------------------------------------------------------------------

/** A single entry in the canonical event vocabulary extracted from a MeasurementSpec. */
export interface EventVocabularyEntry {
  /** Canonical event name in entity.activity format (e.g., 'board.created'). */
  event: string;
  /** Entity identifier (product entity id or 'customer'). */
  entity: string;
  /** Activity name (e.g., 'created', 'first_value_created'). */
  activity: string;
  /** Which perspective this event belongs to. */
  perspective: "product" | "customer";
}

/**
 * Extract a canonical event vocabulary from a MeasurementSpec.
 *
 * Product entity events use format `entity_id.activity_name` (e.g., 'board.created').
 * Customer entity events use format `customer.activity_name` (e.g., 'customer.first_value_created').
 * Interaction perspective entities are excluded.
 */
export function buildEventVocabulary(spec: MeasurementSpec): EventVocabularyEntry[] {
  const entries: EventVocabularyEntry[] = [];

  for (const entity of spec.perspectives.product.entities) {
    for (const activity of entity.activities) {
      entries.push({
        event: `${entity.id}.${activity.name}`,
        entity: entity.id,
        activity: activity.name,
        perspective: "product",
      });
    }
  }

  for (const entity of spec.perspectives.customer.entities) {
    for (const activity of entity.activities) {
      entries.push({
        event: `customer.${activity.name}`,
        entity: "customer",
        activity: activity.name,
        perspective: "customer",
      });
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Trigger collection
// ---------------------------------------------------------------------------

/**
 * Collect all unique free-text trigger strings from activation map and lifecycle states.
 */
export function collectTriggers(
  activationMap: ActivationMapResult | null,
  lifecycleStates: LifecycleStatesResult | null,
): string[] {
  const triggers = new Set<string>();

  if (activationMap) {
    for (const stage of activationMap.stages) {
      for (const t of stage.trigger_events) triggers.add(t);
    }
    for (const trans of activationMap.transitions) {
      for (const t of trans.trigger_events) triggers.add(t);
    }
  }

  if (lifecycleStates) {
    for (const state of lifecycleStates.states) {
      for (const c of state.entry_criteria) triggers.add(c.event_name);
      for (const c of state.exit_triggers) triggers.add(c.event_name);
    }
  }

  return [...triggers];
}

// ---------------------------------------------------------------------------
// Reconciliation prompt
// ---------------------------------------------------------------------------

const RECONCILIATION_SYSTEM_PROMPT = `You are a data alignment assistant. Your job is to map free-text event trigger names to a canonical event vocabulary from a measurement specification.

## Instructions

You will receive:
1. A canonical event vocabulary — structured event names in entity.activity format
2. A list of free-text trigger names extracted from other outputs

For each trigger, find the best matching canonical event. Return a JSON object mapping each original trigger to its canonical event name.

## Rules

- Every trigger in the input MUST appear as a key in your output
- Map each trigger to the single best matching canonical event
- If a trigger clearly doesn't match any canonical event, map it to itself (keep original)
- Use exact canonical event names from the vocabulary (do not invent new ones)
- Return ONLY a JSON object, no explanation

## Example

Vocabulary: board.created, board.shared, board.updated, customer.first_value_created
Triggers: create_board, share_with_team, first_board_shared

Output:
{
  "create_board": "board.created",
  "share_with_team": "board.shared",
  "first_board_shared": "customer.first_value_created"
}`;

function buildReconciliationUserPrompt(
  vocabulary: EventVocabularyEntry[],
  triggers: string[],
): string {
  const vocabLines = vocabulary
    .map((v) => `- ${v.event} (${v.perspective}: ${v.entity} → ${v.activity})`)
    .join("\n");

  const triggerLines = triggers.map((t) => `- ${t}`).join("\n");

  return `## Canonical Event Vocabulary

${vocabLines}

## Triggers to Map

${triggerLines}`;
}

// ---------------------------------------------------------------------------
// Apply mapping
// ---------------------------------------------------------------------------

function applyMappingToActivationMap(
  map: ActivationMapResult,
  mapping: Record<string, string>,
): ActivationMapResult {
  return {
    ...map,
    stages: map.stages.map((s) => ({
      ...s,
      trigger_events: s.trigger_events.map((t) => mapping[t] ?? t),
    })),
    transitions: map.transitions.map((t) => ({
      ...t,
      trigger_events: t.trigger_events.map((e) => mapping[e] ?? e),
    })),
  };
}

function applyMappingToLifecycleStates(
  states: LifecycleStatesResult,
  mapping: Record<string, string>,
): LifecycleStatesResult {
  return {
    ...states,
    states: states.states.map((s) => ({
      ...s,
      entry_criteria: s.entry_criteria.map((c) => ({
        ...c,
        event_name: mapping[c.event_name] ?? c.event_name,
      })),
      exit_triggers: s.exit_triggers.map((c) => ({
        ...c,
        event_name: mapping[c.event_name] ?? c.event_name,
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Main reconciliation
// ---------------------------------------------------------------------------

/**
 * Reconcile all output trigger events to use measurement spec entity.activity names.
 *
 * Makes a single LLM call to map free-text triggers to canonical vocabulary.
 * Returns a new OutputsResult — does not mutate the input.
 * No-ops when measurement spec is null or vocabulary is empty.
 */
export async function reconcileOutputs(
  outputs: OutputsResult,
  llm: LlmProvider,
): Promise<OutputsResult> {
  if (!outputs.measurement_spec) return outputs;

  const vocabulary = buildEventVocabulary(outputs.measurement_spec);
  if (vocabulary.length === 0) return outputs;

  const triggers = collectTriggers(outputs.activation_map, outputs.lifecycle_states);
  if (triggers.length === 0) return outputs;

  const userPrompt = buildReconciliationUserPrompt(vocabulary, triggers);
  const responseText = await llm.complete(
    [
      { role: "system", content: RECONCILIATION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.1 },
  );

  const mapping = extractJson(responseText) as Record<string, string>;

  const result: OutputsResult = { ...outputs };

  if (result.activation_map) {
    result.activation_map = applyMappingToActivationMap(result.activation_map, mapping);
  }

  if (result.lifecycle_states) {
    result.lifecycle_states = applyMappingToLifecycleStates(result.lifecycle_states, mapping);
  }

  return result;
}
