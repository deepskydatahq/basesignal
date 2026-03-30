// Lifecycle States generation.

import type { LlmProvider, ValueMoment, IdentityResult, ActivationLevelsResult } from "../types.js";
import type { LifecycleStatesResult } from "@basesignal/core";
import type { ActivationMapResult } from "./activation-map.js";
import { extractJson } from "@basesignal/core";

export interface LifecycleStatesInputData {
  identity: IdentityResult | null;
  value_moments: ValueMoment[];
  activation_levels: ActivationLevelsResult;
  activation_map: ActivationMapResult;
}

export const LIFECYCLE_STATES_SYSTEM_PROMPT = `You are a product analytics specialist generating lifecycle states for a product. Define the canonical user lifecycle states that describe where users are in their journey from first visit through churning and potential resurrection.

## Output Format
Return a JSON object with this schema:
{
  "states": [
    {
      "name": "new",
      "definition": "What this state means",
      "entry_criteria": [{ "event_name": "signup", "condition": "user signed up within last 7 days" }],
      "exit_triggers": [{ "event_name": "first_action", "condition": "completes first meaningful action" }],
      "time_window": "0-7 days"
    }
  ],
  "transitions": [
    {
      "from_state": "new",
      "to_state": "activated",
      "trigger_conditions": ["completes onboarding", "creates first project"],
      "typical_timeframe": "1-7 days"
    }
  ],
  "confidence": 0.75
}

Rules:
- Define 7 states: new, activated, engaged, at_risk, dormant, churned, resurrected
- Each state must have entry_criteria, exit_triggers, and time_window
- "new" and "activated" can overlap — a user can become activated on day 0 (immediately after signup). The "new" state tracks recency of signup, while "activated" tracks whether the user has completed activation criteria. These are not sequential time windows.
- Define transitions between states with trigger conditions
- Use product entity event names in entity.activity format (e.g., "meeting.recorded", "board.created", "user.signed_up") — NOT customer journey events like "customer.first_value_created". Entry criteria and exit triggers must reference concrete product events that can be tracked.
- NEVER use "login", "login.occurred", "session_started", or similar authentication events as lifecycle criteria — these are too weak to indicate real engagement. Use meaningful product actions instead (creating, sharing, integrating, searching, etc.).
- Return ONLY valid JSON, no commentary
- confidence must be between 0 and 1`;

export function buildLifecycleStatesPrompt(input: LifecycleStatesInputData): {
  system: string;
  user: string;
} {
  const sections: string[] = [];

  if (input.identity) {
    sections.push(`## Product: ${input.identity.productName}`);
    sections.push(`Description: ${input.identity.description}`);
    sections.push(`Target Customer: ${input.identity.targetCustomer}`);
  }

  sections.push("\n## Activation Levels");
  for (const level of input.activation_levels.levels) {
    sections.push(`- Level ${level.level}: ${level.name} (${level.signalStrength})`);
  }

  if (input.activation_map?.stages) {
    sections.push("\n## Activation Map Stages");
    for (const stage of input.activation_map.stages) {
      sections.push(`- ${stage.name}: ${stage.trigger_events.join(", ")}`);
    }
  }

  if (input.value_moments.length > 0) {
    sections.push("\n## Value Moments");
    for (const vm of input.value_moments) {
      sections.push(`- ${vm.name} (tier ${vm.tier}): ${vm.description}`);
    }
  }

  sections.push("\nGenerate lifecycle states for this product based on the above context.");

  return {
    system: LIFECYCLE_STATES_SYSTEM_PROMPT,
    user: sections.join("\n"),
  };
}

export function parseLifecycleStatesResponse(responseText: string): LifecycleStatesResult {
  const parsed = extractJson(responseText) as Record<string, unknown>;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object with states and transitions");
  }

  if (!Array.isArray(parsed.states)) {
    throw new Error("Missing required field: states (must be array)");
  }
  if (!Array.isArray(parsed.transitions)) {
    throw new Error("Missing required field: transitions (must be array)");
  }
  if (typeof parsed.confidence !== "number") {
    throw new Error("Missing required field: confidence (must be number)");
  }

  return {
    states: parsed.states as LifecycleStatesResult["states"],
    transitions: parsed.transitions as LifecycleStatesResult["transitions"],
    confidence: parsed.confidence as number,
    sources: (parsed.sources as string[]) ?? [],
  };
}

export async function generateLifecycleStates(
  input: LifecycleStatesInputData,
  llm: LlmProvider,
): Promise<LifecycleStatesResult> {
  const { system, user } = buildLifecycleStatesPrompt(input);
  const responseText = await llm.complete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.2 },
  );
  return parseLifecycleStatesResponse(responseText);
}
