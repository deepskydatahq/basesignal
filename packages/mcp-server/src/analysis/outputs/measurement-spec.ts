// Measurement Spec generation.

import type { LlmProvider, ValueMoment, ICPProfile, LifecycleStatesResult } from "../types.js";
import type { ActivationLevel, MeasurementSpec } from "@basesignal/core";
import type { ActivationMapResult } from "./activation-map.js";
import { extractJson } from "@basesignal/core";

// --- Local types for input assembly ---

export interface MeasurementInputData {
  value_moments: ValueMoment[];
  activation_levels: ActivationLevel[];
  icp_profiles: ICPProfile[];
  activation_map: ActivationMapResult | null;
  activation_event_templates: ActivationEventTemplate[];
  value_event_templates: ValueEventTemplate[];
  lifecycle_states?: LifecycleStatesResult;
}

interface ActivationEventTemplate {
  level: number;
  suggested_event_name: string;
  criteria: Array<{ action: string; count: number }>;
}

interface ValueEventTemplate {
  suggested_event_name: string;
  moment_name: string;
  tier: number;
  surfaces: string[];
}

// --- System Prompt ---

export const MEASUREMENT_SPEC_SYSTEM_PROMPT = `You are a product analytics specialist generating a measurement specification. You MUST define entities first, then generate events that reference those entities.

## Step 1: Define Entities (5-10)
Before generating events, define the key entities in the product domain. Each entity represents a core object that users interact with.

Entity schema:
- id: lowercase identifier matching /^[a-z][a-z0-9_]*$/ (e.g., "issue", "board", "cycle")
- name: human-readable name (e.g., "Issue", "Board", "Cycle")
- description: what this entity represents in the product
- isHeartbeat: true for exactly ONE entity that represents the core unit of value (e.g., "issue" for a project tracker)
- properties: array of entity properties, each with:
  - name: snake_case property name
  - type: one of "string", "number", "boolean", "array"
  - description: what this property captures
  - isRequired: true or false

Generate 5-10 entities that represent the core objects users interact with. Exactly one entity must have isHeartbeat: true.

## Step 2: Generate Events
Every event MUST reference a defined entity via entity_id.

### Event Naming Rules
Every event name MUST match this regex: /^[a-z][a-z0-9]*_[a-z][a-z0-9_]*$/
This means: entity_action format using lowercase letters, digits, and underscores.
Examples: issue_created, cycle_completed, board_column_moved, feature_flag_toggled

### Event Perspective
Each event must specify a perspective indicating the viewpoint:
- "customer": tracks user-initiated actions (e.g., user creates issue, user invites team)
- "product": tracks system/product-generated events (e.g., insight delivered, report generated)
- "interaction": tracks the interaction between customer and product (e.g., feature adopted, workflow completed)

### Event Categories
Each event must have exactly one category:
- activation: User progresses toward activation (e.g., completes onboarding step, creates first item)
- value: User experiences a value moment (e.g., shares dashboard, gets first insight)
- retention: User returns or re-engages (e.g., opens app again, resumes workflow)
- expansion: User deepens usage (e.g., invites team member, enables integration)

### maps_to Requirement
Every event MUST map to a value moment, activation level, or both. Use this discriminated union format:
- { "type": "value_moment", "moment_id": "<id>" } — maps to a specific value moment
- { "type": "activation_level", "activation_level": <number> } — maps to an activation level
- { "type": "both", "moment_id": "<id>", "activation_level": <number> } — maps to both

### Property Requirements
Each event must include at least 2 properties. Each property has:
- name: snake_case property name
- type: one of "string", "number", "boolean", "array"
- description: what this property captures
- required: true or false

Event properties should be event-specific additions. Avoid duplicating property names from the parent entity.

### Target
Generate 15-25 events that cover:
- All activation level criteria (at least one event per level)
- Key value moments (especially Tier 1 and Tier 2)
- Retention signals (returning users, repeated engagement)
- Expansion signals (team growth, feature adoption)

## Step 3: User State Model
Define a user state model representing the user lifecycle. Each state has:
- name: state identifier
- definition: human-readable description of what this state means
- criteria: array of { event_name, condition } pairs that define transitions into this state

If lifecycle states are provided in the context below, derive your user state model from them.
Otherwise, define 5 representative states: new, activated, active, at_risk, dormant.

## Output Format
Return a JSON object matching this exact schema:
{
  "entities": [
    {
      "id": "issue",
      "name": "Issue",
      "description": "A trackable work item",
      "isHeartbeat": true,
      "properties": [{ "name": "issue_id", "type": "string", "description": "Unique identifier", "isRequired": true }]
    }
  ],
  "events": [
    {
      "name": "issue_created",
      "entity_id": "issue",
      "description": "What this event tracks",
      "perspective": "customer",
      "properties": [{ "name": "prop_name", "type": "string", "description": "...", "required": true }],
      "trigger_condition": "When this event should fire",
      "maps_to": { "type": "value_moment", "moment_id": "..." },
      "category": "activation"
    }
  ],
  "userStateModel": [
    {
      "name": "new",
      "definition": "Users who signed up but haven't activated",
      "criteria": [{ "event_name": "user_signed_up", "condition": "within last 7 days, no activation events" }]
    }
  ],
  "confidence": 0.7
}

Rules:
- Return ONLY valid JSON, no commentary before or after
- confidence must be a number between 0 and 1
- Every event.entity_id MUST reference a defined entity.id
- Do NOT include total_events or coverage fields — they will be computed`;

// --- Prompt Builder ---

export function buildMeasurementSpecPrompt(input: MeasurementInputData): {
  system: string;
  user: string;
} {
  const sections: string[] = [];

  // Value Moments Reference
  sections.push("## Value Moments Reference");
  for (const vm of input.value_moments) {
    sections.push(
      `- **${vm.name}** (id: ${vm.id}, tier: ${vm.tier})` +
        `\n  Surfaces: ${vm.product_surfaces.join(", ") || "none"}` +
        `\n  Description: ${vm.description}`,
    );
  }

  // Activation Levels Reference
  sections.push("\n## Activation Levels Reference");
  for (const al of input.activation_levels) {
    const criteriaStr = al.criteria
      .map(
        (c) =>
          `action: ${c.action}, count: ${c.count}${c.timeWindow ? `, timeWindow: ${c.timeWindow}` : ""}`,
      )
      .join("; ");
    sections.push(
      `- **Level ${al.level}: ${al.name}** (signal: ${al.signalStrength})` +
        `\n  Criteria: ${criteriaStr}`,
    );
  }

  // ICP Profiles (conditional)
  if (input.icp_profiles.length > 0) {
    sections.push("\n## ICP Profiles");
    for (const icp of input.icp_profiles) {
      sections.push(
        `- **${icp.name}**` +
          `\n  Description: ${icp.description}` +
          `\n  Activation triggers: ${icp.activation_triggers.join(", ")}` +
          `\n  Pain points: ${icp.pain_points.join(", ")}`,
      );
    }
  }

  // Activation Map Stages (conditional)
  if (input.activation_map) {
    sections.push("\n## Activation Map Stages");
    for (const stage of input.activation_map.stages) {
      sections.push(
        `- **Stage ${stage.level}: ${stage.name}**` +
          `\n  Trigger events: ${stage.trigger_events.join(", ")}` +
          `\n  Value moments unlocked: ${stage.value_moments_unlocked.join(", ")}`,
      );
    }
  }

  // Event Templates (pre-computed suggestions)
  if (input.activation_event_templates.length > 0) {
    sections.push("\n## Activation Event Templates (suggestions)");
    for (const t of input.activation_event_templates) {
      const criteriaStr = t.criteria
        .map((c) => `${c.action} x${c.count}`)
        .join(", ");
      sections.push(
        `- Level ${t.level}: ${t.suggested_event_name} (criteria: ${criteriaStr})`,
      );
    }
  }

  if (input.value_event_templates.length > 0) {
    sections.push("\n## Value Event Templates (suggestions)");
    for (const t of input.value_event_templates) {
      sections.push(
        `- ${t.suggested_event_name} > ${t.moment_name} (tier ${t.tier}, surfaces: ${t.surfaces.join(", ")})`,
      );
    }
  }

  // Lifecycle States (when available from pipeline)
  if (input.lifecycle_states) {
    sections.push("\n## Lifecycle States (use for userStateModel)");
    for (const state of input.lifecycle_states.states) {
      const criteria = state.entry_criteria
        .map((c) => `${c.event_name}: ${c.condition}`)
        .join("; ");
      sections.push(
        `- **${state.name}**: ${state.definition}` +
          `\n  Entry criteria: ${criteria}`,
      );
    }
  }

  sections.push(
    "\nGenerate a measurement specification with trackable events based on the above inputs.",
  );

  return {
    system: MEASUREMENT_SPEC_SYSTEM_PROMPT,
    user: sections.join("\n"),
  };
}

// --- Response Parser (simplified, trusts core types) ---

export function parseMeasurementSpecResponse(
  responseText: string,
): MeasurementSpec {
  const parsed = extractJson(responseText) as Record<string, unknown>;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object with entities and events arrays");
  }

  if (!Array.isArray(parsed.entities)) {
    throw new Error("Missing required field: entities (must be array)");
  }
  if (!Array.isArray(parsed.events)) {
    throw new Error("Missing required field: events (must be array)");
  }
  if (typeof parsed.confidence !== "number") {
    throw new Error("Missing required field: confidence (must be number)");
  }
  if (parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error(`confidence must be between 0 and 1, got ${parsed.confidence}`);
  }
  if (!Array.isArray(parsed.userStateModel)) {
    throw new Error("Missing required field: userStateModel (must be array)");
  }

  // Minimal validation for entities
  const entityIds = new Set<string>();
  for (const entity of parsed.entities as Array<Record<string, unknown>>) {
    if (typeof entity.id !== "string") {
      throw new Error("Entity missing id");
    }
    entityIds.add(entity.id);
  }

  // Minimal validation for events
  for (const event of parsed.events as Array<Record<string, unknown>>) {
    if (typeof event.name !== "string") {
      throw new Error("Event missing name");
    }
    if (typeof event.entity_id !== "string" || !entityIds.has(event.entity_id)) {
      throw new Error(`Event '${event.name}': entity_id '${event.entity_id}' not in defined entities`);
    }
  }

  // Compute coverage
  const events = parsed.events as Array<Record<string, unknown>>;
  const activationLevelsCovered = [
    ...new Set(
      events
        .filter((e) => {
          const mt = e.maps_to as Record<string, unknown> | undefined;
          return mt?.type === "activation_level" || mt?.type === "both";
        })
        .map((e) => (e.maps_to as Record<string, unknown>).activation_level as number)
        .filter((n) => n !== undefined),
    ),
  ].sort((a, b) => a - b);

  const valueMomentsCovered = [
    ...new Set(
      events
        .filter((e) => {
          const mt = e.maps_to as Record<string, unknown> | undefined;
          return mt?.type === "value_moment" || mt?.type === "both";
        })
        .map((e) => (e.maps_to as Record<string, unknown>).moment_id as string)
        .filter((s) => s !== undefined),
    ),
  ];

  // Compute perspective distribution
  const perspectiveDist = { customer: 0, product: 0, interaction: 0 };
  for (const e of events) {
    const p = e.perspective as string;
    if (p in perspectiveDist) {
      perspectiveDist[p as keyof typeof perspectiveDist]++;
    }
  }

  return {
    entities: parsed.entities as MeasurementSpec["entities"],
    events: parsed.events as MeasurementSpec["events"],
    total_events: events.length,
    coverage: {
      activation_levels_covered: activationLevelsCovered,
      value_moments_covered: valueMomentsCovered,
      perspective_distribution: perspectiveDist,
    },
    userStateModel: parsed.userStateModel as MeasurementSpec["userStateModel"],
    confidence: parsed.confidence as number,
    sources: [],
  };
}

// --- Input assembly ---

/**
 * Build MeasurementInputData from pipeline intermediate results.
 * Computes activation_event_templates and value_event_templates inline.
 */
export function assembleMeasurementInput(
  valueMoments: ValueMoment[],
  activationLevels: ActivationLevel[],
  icpProfiles: ICPProfile[],
  activationMap: ActivationMapResult | null,
  lifecycleStates?: LifecycleStatesResult,
): MeasurementInputData {
  // Build activation event templates from activation level criteria
  const activationEventTemplates: ActivationEventTemplate[] = activationLevels.map((level) => ({
    level: level.level,
    suggested_event_name: `activation_l${level.level}_${level.name.replace(/\s+/g, "_").toLowerCase()}`,
    criteria: level.criteria.map((c) => ({
      action: c.action,
      count: c.count,
    })),
  }));

  // Build value event templates from top value moments
  const valueEventTemplates: ValueEventTemplate[] = valueMoments
    .filter((vm) => vm.tier <= 2) // Only Tier 1 and 2
    .map((vm) => ({
      suggested_event_name: vm.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, ""),
      moment_name: vm.name,
      tier: vm.tier,
      surfaces: vm.product_surfaces,
    }));

  return {
    value_moments: valueMoments,
    activation_levels: activationLevels,
    icp_profiles: icpProfiles,
    activation_map: activationMap,
    activation_event_templates: activationEventTemplates,
    value_event_templates: valueEventTemplates,
    lifecycle_states: lifecycleStates,
  };
}

// --- Generator ---

export async function generateMeasurementSpec(
  inputData: MeasurementInputData,
  llm: LlmProvider,
): Promise<MeasurementSpec> {
  const { system, user } = buildMeasurementSpecPrompt(inputData);
  const responseText = await llm.complete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.2 },
  );
  return parseMeasurementSpecResponse(responseText);
}
