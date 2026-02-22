// Lifecycle States generation.

import type { LlmProvider, ValueMoment, IdentityResult } from "../types.js";
import type { ActivationLevel, LifecycleStatesResult } from "@basesignal/core";
import type { ActivationMapResult } from "./activation-map.js";
import { extractJson } from "@basesignal/core";
import { LifecycleStatesResultSchema } from "@basesignal/core";

// --- Input Type ---

export interface LifecycleStatesInputData {
  identity: IdentityResult;
  value_moments: ValueMoment[];
  activation_levels: ActivationLevel[];
  activation_map: ActivationMapResult;
}

// --- System Prompt ---

export const LIFECYCLE_STATES_SYSTEM_PROMPT = `You are a product analyst generating a lifecycle state machine for a specific product. You must generate states that reflect THIS product's actual usage patterns, not generic SaaS templates.

## Required States

Generate exactly 7 states:

1. **new** — Users who just signed up but haven't taken meaningful action
2. **activated** — Users who reached the product's activation criteria (must align with the provided activation definition)
3. **engaged** — Users who are regularly deriving value from the product
4. **at_risk** — Users showing declining engagement patterns
5. **dormant** — Users who have stopped engaging but haven't been gone long enough to be churned
6. **churned** — Users who have been inactive beyond the product's natural usage cadence
7. **resurrected** — Previously churned or dormant users who have returned

## State Structure

Each state must have:
- **name**: one of the 7 required state names
- **definition**: product-specific description of what this state means for THIS product
- **entry_criteria**: array of measurable criteria using { event_name, condition, threshold? } format
- **exit_triggers**: array of criteria that cause a user to leave this state
- **time_window**: optional duration that contextualizes the state (e.g., "7 days", "30 days")

## Transition Structure

Each transition must have:
- **from_state**: source state name
- **to_state**: destination state name
- **trigger_conditions**: array of human-readable conditions that cause the transition
- **typical_timeframe**: optional expected duration for this transition

## Rules

1. Time windows MUST be calibrated to the product's natural usage cadence:
   - Daily consumer apps: shorter windows (1-7 days)
   - Weekly B2B tools: medium windows (7-30 days)
   - Monthly/quarterly enterprise: longer windows (30-90 days)
2. The "activated" state's entry_criteria MUST align with the activation map's primary activation level
3. Entry criteria must use event_name + condition format that maps to trackable events
4. Include both forward transitions (new → activated → engaged) and backward transitions (engaged → at_risk → dormant → churned)
5. Include resurrection transitions (churned → resurrected, dormant → resurrected)
6. The "resurrected" state needs product-specific re-engagement triggers, not generic "logged in" events
7. Set confidence to a number between 0 and 1 based on data quality
8. Set sources to describe what data informed the states

## Output Format

Return a single JSON object:
{
  "states": [
    {
      "name": "new",
      "definition": "...",
      "entry_criteria": [{ "event_name": "user_signed_up", "condition": "account created" }],
      "exit_triggers": [{ "event_name": "first_project_created", "condition": "completed onboarding" }],
      "time_window": "7 days"
    }
  ],
  "transitions": [
    {
      "from_state": "new",
      "to_state": "activated",
      "trigger_conditions": ["User completes first project setup"],
      "typical_timeframe": "1-3 days"
    }
  ],
  "confidence": 0.7,
  "sources": ["activation_levels", "value_moments", "product_identity"]
}

## Important

- Return ONLY valid JSON, no commentary before or after
- All 7 states must be present
- State names must exactly match the required names
- Entry criteria and exit triggers must be product-specific and measurable`;

// --- Prompt Builder ---

export function buildLifecycleStatesPrompt(
  inputData: LifecycleStatesInputData,
): string {
  const { identity, value_moments, activation_levels, activation_map } =
    inputData;
  const parts: string[] = [];

  // Product context for time window calibration
  parts.push("## Product Context\n");
  parts.push(`Product: ${identity.productName}`);
  parts.push(`Description: ${identity.description}`);
  parts.push(`Business Model: ${identity.businessModel}`);
  parts.push(`Target Customer: ${identity.targetCustomer}`);
  if (identity.industry) {
    parts.push(`Industry: ${identity.industry}`);
  }
  parts.push("");

  // Activation levels
  parts.push("## Activation Levels\n");
  for (const level of activation_levels) {
    parts.push(`### Level ${level.level}: ${level.name}`);
    parts.push(`Signal Strength: ${level.signalStrength}`);
    parts.push("Criteria:");
    for (const c of level.criteria) {
      const tw = c.timeWindow ? ` within ${c.timeWindow}` : "";
      parts.push(`  - ${c.action} (count: ${c.count}${tw})`);
    }
    parts.push("");
  }

  // Primary activation level from activation map
  parts.push(
    `## Primary Activation Level: ${activation_map.primary_activation_level}`,
  );
  parts.push(
    "The 'activated' state must align with this activation level's criteria.\n",
  );

  // Value moments as evidence for engagement signals
  parts.push("## Value Moments\n");
  for (const vm of value_moments) {
    parts.push(`### ${vm.name} (Tier ${vm.tier})`);
    parts.push(`Description: ${vm.description}`);
    parts.push(`Roles: ${vm.roles.join(", ")}`);
    parts.push("");
  }

  parts.push(
    "Generate a lifecycle state machine with product-specific states, transitions, and time windows based on the above inputs.",
  );

  return parts.join("\n");
}

// --- Response Parser ---

export function parseLifecycleStatesResponse(
  responseText: string,
): LifecycleStatesResult {
  const raw = extractJson(responseText);
  return LifecycleStatesResultSchema.parse(raw);
}

// --- Generator ---

export async function generateLifecycleStates(
  inputData: LifecycleStatesInputData,
  llm: LlmProvider,
): Promise<LifecycleStatesResult> {
  const prompt = buildLifecycleStatesPrompt(inputData);

  const responseText = await llm.complete(
    [
      { role: "system", content: LIFECYCLE_STATES_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    { temperature: 0.2 },
  );

  if (!responseText?.trim()) {
    throw new Error(
      "LLM returned empty response for lifecycle states generation",
    );
  }

  return parseLifecycleStatesResponse(responseText);
}
