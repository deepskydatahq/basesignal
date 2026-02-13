import { action, internalAction } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { v } from "convex/values";
import { extractJson, callClaude } from "../lenses/shared";
import type {
  MeasurementInputData,
  MeasurementSpec,
  TrackingEvent,
  EventProperty,
  EntityDefinition,
  EntityPropertyDef,
  Perspective,
  PerspectiveDistribution,
  UserState,
  UserStateCriterion,
} from "./types";

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
Define a user state model with exactly 5 states representing the user lifecycle:
- new: Users who just signed up
- activated: Users who reached activation criteria
- active: Users who are regularly engaged
- at_risk: Users showing declining engagement
- dormant: Users who have stopped engaging

Each state has:
- name: one of "new", "activated", "active", "at_risk", "dormant"
- definition: human-readable description of what this state means
- criteria: array of { event_name, condition } pairs that define transitions into this state

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
        `- ${t.suggested_event_name} → ${t.moment_name} (tier ${t.tier}, surfaces: ${t.surfaces.join(", ")})`,
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

// --- Response Parser ---

const ENTITY_ACTION_REGEX = /^[a-z][a-z0-9]*_[a-z][a-z0-9_]*$/;
const ENTITY_ID_REGEX = /^[a-z][a-z0-9_]*$/;
const VALID_CATEGORIES = [
  "activation",
  "value",
  "retention",
  "expansion",
] as const;
const VALID_PROPERTY_TYPES = ["string", "number", "boolean", "array"] as const;
const VALID_PERSPECTIVES = ["customer", "product", "interaction"] as const;
const REQUIRED_USER_STATE_NAMES = ["new", "activated", "active", "at_risk", "dormant"] as const;

function parseEntities(
  rawEntities: unknown[],
): EntityDefinition[] {
  if (rawEntities.length < 3 || rawEntities.length > 15) {
    throw new Error(
      `Expected 3-15 entities, got ${rawEntities.length}`,
    );
  }

  const entities: EntityDefinition[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < rawEntities.length; i++) {
    const raw = rawEntities[i] as Record<string, unknown>;
    const label = `Entity ${i}`;

    // Validate id
    if (typeof raw.id !== "string" || !raw.id) {
      throw new Error(`${label}: missing id`);
    }
    if (!ENTITY_ID_REGEX.test(raw.id)) {
      throw new Error(
        `${label}: id '${raw.id}' does not match format /^[a-z][a-z0-9_]*$/`,
      );
    }
    if (seenIds.has(raw.id)) {
      throw new Error(`${label}: duplicate entity id '${raw.id}'`);
    }
    seenIds.add(raw.id);

    // Validate name
    if (typeof raw.name !== "string" || !raw.name) {
      throw new Error(`${label}: missing name`);
    }

    // Validate description
    if (typeof raw.description !== "string" || !raw.description) {
      throw new Error(`${label}: missing description`);
    }

    // Validate properties
    if (!Array.isArray(raw.properties)) {
      throw new Error(`${label}: missing properties array`);
    }

    const properties: EntityPropertyDef[] = [];
    for (const prop of raw.properties as Array<Record<string, unknown>>) {
      if (typeof prop.name !== "string" || !prop.name) {
        throw new Error(`${label}: property missing name`);
      }
      if (
        !VALID_PROPERTY_TYPES.includes(
          prop.type as (typeof VALID_PROPERTY_TYPES)[number],
        )
      ) {
        throw new Error(
          `${label}: property '${prop.name}' has invalid type '${prop.type}'`,
        );
      }
      if (typeof prop.description !== "string" || !prop.description) {
        throw new Error(
          `${label}: property '${prop.name}' missing description`,
        );
      }
      properties.push({
        name: prop.name,
        type: prop.type as EntityPropertyDef["type"],
        description: prop.description,
        isRequired: prop.isRequired === true,
      });
    }

    entities.push({
      id: raw.id,
      name: raw.name,
      description: raw.description,
      isHeartbeat: raw.isHeartbeat === true,
      properties,
    });
  }

  return entities;
}

export function parseUserStateModel(rawStates: unknown[]): UserState[] {
  if (!Array.isArray(rawStates) || rawStates.length !== 5) {
    throw new Error(
      `userStateModel must have exactly 5 states, got ${Array.isArray(rawStates) ? rawStates.length : 0}`,
    );
  }

  const states: UserState[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < rawStates.length; i++) {
    const raw = rawStates[i] as Record<string, unknown>;
    const label = `UserState ${i}`;

    if (typeof raw.name !== "string" || !raw.name) {
      throw new Error(`${label}: missing name`);
    }

    if (
      !REQUIRED_USER_STATE_NAMES.includes(
        raw.name as (typeof REQUIRED_USER_STATE_NAMES)[number],
      )
    ) {
      throw new Error(
        `${label}: invalid name '${raw.name}'. Must be one of: ${REQUIRED_USER_STATE_NAMES.join(", ")}`,
      );
    }

    if (seenNames.has(raw.name)) {
      throw new Error(`${label}: duplicate state name '${raw.name}'`);
    }
    seenNames.add(raw.name);

    if (typeof raw.definition !== "string" || !raw.definition) {
      throw new Error(`${label}: missing definition`);
    }

    if (!Array.isArray(raw.criteria) || raw.criteria.length === 0) {
      throw new Error(`${label}: must have at least one criterion`);
    }

    const criteria: UserStateCriterion[] = [];
    for (const c of raw.criteria as Array<Record<string, unknown>>) {
      if (typeof c.event_name !== "string" || !c.event_name) {
        throw new Error(`${label}: criterion missing event_name`);
      }
      if (typeof c.condition !== "string" || !c.condition) {
        throw new Error(`${label}: criterion missing condition`);
      }
      criteria.push({
        event_name: c.event_name,
        condition: c.condition,
      });
    }

    states.push({
      name: raw.name,
      definition: raw.definition,
      criteria,
    });
  }

  // Verify all 5 required states are present
  for (const requiredName of REQUIRED_USER_STATE_NAMES) {
    if (!seenNames.has(requiredName)) {
      throw new Error(
        `userStateModel missing required state: '${requiredName}'`,
      );
    }
  }

  return states;
}

export function computePerspectiveDistribution(
  events: TrackingEvent[],
): PerspectiveDistribution {
  const dist: PerspectiveDistribution = { customer: 0, product: 0, interaction: 0 };
  for (const e of events) {
    dist[e.perspective]++;
  }
  return dist;
}

export function parseMeasurementSpecResponse(
  responseText: string,
): MeasurementSpec {
  const parsed = extractJson(responseText) as Record<string, unknown>;

  // Validate top-level
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
    throw new Error(
      `confidence must be between 0 and 1, got ${parsed.confidence}`,
    );
  }

  // Parse and validate entities first
  const entities = parseEntities(parsed.entities as unknown[]);
  const entityIds = new Set(entities.map((e) => e.id));

  // Validate exactly one heartbeat entity
  const heartbeatCount = entities.filter((e) => e.isHeartbeat).length;
  if (heartbeatCount !== 1) {
    throw new Error(
      `Expected exactly 1 heartbeat entity, got ${heartbeatCount}`,
    );
  }

  // Build entity property name lookup for duplication warnings
  const entityPropertyNames = new Map<string, Set<string>>();
  for (const entity of entities) {
    entityPropertyNames.set(
      entity.id,
      new Set(entity.properties.map((p) => p.name)),
    );
  }

  const warnings: string[] = [];
  const events: TrackingEvent[] = [];

  for (let i = 0; i < parsed.events.length; i++) {
    const raw = parsed.events[i] as Record<string, unknown>;
    const eventLabel = `Event ${i}`;

    // Validate name
    if (typeof raw.name !== "string" || !raw.name) {
      throw new Error(`${eventLabel}: missing name`);
    }
    if (!ENTITY_ACTION_REGEX.test(raw.name)) {
      throw new Error(
        `${eventLabel}: name '${raw.name}' does not match entity_action format`,
      );
    }

    // Validate entity_id
    if (typeof raw.entity_id !== "string" || !raw.entity_id) {
      throw new Error(`${eventLabel}: missing entity_id`);
    }
    if (!entityIds.has(raw.entity_id)) {
      throw new Error(
        `${eventLabel}: entity_id '${raw.entity_id}' does not reference a defined entity`,
      );
    }

    // Validate description
    if (typeof raw.description !== "string" || !raw.description) {
      throw new Error(`${eventLabel}: missing description`);
    }

    // Validate perspective
    if (
      !VALID_PERSPECTIVES.includes(
        raw.perspective as (typeof VALID_PERSPECTIVES)[number],
      )
    ) {
      throw new Error(
        `${eventLabel}: invalid perspective '${raw.perspective}'. Must be one of: ${VALID_PERSPECTIVES.join(", ")}`,
      );
    }

    // Validate trigger_condition
    if (typeof raw.trigger_condition !== "string" || !raw.trigger_condition) {
      throw new Error(`${eventLabel}: missing trigger_condition`);
    }

    // Validate properties
    if (!Array.isArray(raw.properties)) {
      throw new Error(`${eventLabel}: missing properties array`);
    }
    if (raw.properties.length < 2) {
      throw new Error(
        `${eventLabel}: must have at least 2 properties, got ${raw.properties.length}`,
      );
    }

    const properties: EventProperty[] = [];
    for (const prop of raw.properties as Array<Record<string, unknown>>) {
      if (typeof prop.name !== "string" || !prop.name) {
        throw new Error(`${eventLabel}: property missing name`);
      }
      if (
        !VALID_PROPERTY_TYPES.includes(
          prop.type as (typeof VALID_PROPERTY_TYPES)[number],
        )
      ) {
        throw new Error(
          `${eventLabel}: property '${prop.name}' has invalid type '${prop.type}'`,
        );
      }
      if (typeof prop.description !== "string" || !prop.description) {
        throw new Error(
          `${eventLabel}: property '${prop.name}' missing description`,
        );
      }
      properties.push({
        name: prop.name,
        type: prop.type as EventProperty["type"],
        description: prop.description,
        isRequired: prop.required === true,
      });
    }

    // Check for property name duplication with parent entity
    const parentEntityProps = entityPropertyNames.get(raw.entity_id as string);
    if (parentEntityProps) {
      for (const prop of properties) {
        if (parentEntityProps.has(prop.name)) {
          warnings.push(
            `${eventLabel} '${raw.name}': property '${prop.name}' duplicates a property on entity '${raw.entity_id}'`,
          );
        }
      }
    }

    // Validate category
    if (
      !VALID_CATEGORIES.includes(
        raw.category as (typeof VALID_CATEGORIES)[number],
      )
    ) {
      throw new Error(
        `${eventLabel}: invalid category '${raw.category}'. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
      );
    }

    // Validate maps_to discriminated union
    const mapsTo = raw.maps_to as Record<string, unknown> | undefined;
    if (!mapsTo || typeof mapsTo !== "object") {
      throw new Error(`${eventLabel}: missing maps_to`);
    }

    if (mapsTo.type === "value_moment") {
      if (typeof mapsTo.moment_id !== "string" || !mapsTo.moment_id) {
        throw new Error(
          `${eventLabel}: maps_to type 'value_moment' requires moment_id`,
        );
      }
    } else if (mapsTo.type === "activation_level") {
      if (typeof mapsTo.activation_level !== "number") {
        throw new Error(
          `${eventLabel}: maps_to type 'activation_level' requires activation_level (number)`,
        );
      }
    } else if (mapsTo.type === "both") {
      if (typeof mapsTo.moment_id !== "string" || !mapsTo.moment_id) {
        throw new Error(
          `${eventLabel}: maps_to type 'both' requires moment_id`,
        );
      }
      if (typeof mapsTo.activation_level !== "number") {
        throw new Error(
          `${eventLabel}: maps_to type 'both' requires activation_level (number)`,
        );
      }
    } else {
      throw new Error(
        `${eventLabel}: maps_to type must be 'value_moment', 'activation_level', or 'both', got '${mapsTo.type}'`,
      );
    }

    events.push({
      name: raw.name,
      entity_id: raw.entity_id,
      description: raw.description,
      perspective: raw.perspective as Perspective,
      properties,
      trigger_condition: raw.trigger_condition,
      maps_to: mapsTo as TrackingEvent["maps_to"],
      category: raw.category as TrackingEvent["category"],
    });
  }

  // Compute coverage from events
  const activationLevelsCovered = [
    ...new Set(
      events
        .filter(
          (e) =>
            e.maps_to.type === "activation_level" ||
            e.maps_to.type === "both",
        )
        .map((e) => e.maps_to.activation_level!)
        .filter((n) => n !== undefined),
    ),
  ].sort((a, b) => a - b);

  const valueMomentsCovered = [
    ...new Set(
      events
        .filter(
          (e) =>
            e.maps_to.type === "value_moment" || e.maps_to.type === "both",
        )
        .map((e) => e.maps_to.moment_id!)
        .filter((s) => s !== undefined),
    ),
  ];

  // Compute perspective distribution
  const perspectiveDistribution = computePerspectiveDistribution(events);

  // Perspective coverage warnings
  for (const p of VALID_PERSPECTIVES) {
    if (perspectiveDistribution[p] === 0) {
      warnings.push(`No events with '${p}' perspective — all three perspectives should be represented`);
    }
  }
  if (
    perspectiveDistribution.product > 0 &&
    (perspectiveDistribution.product < perspectiveDistribution.customer ||
      perspectiveDistribution.product < perspectiveDistribution.interaction)
  ) {
    warnings.push(
      `Product perspective has fewer events (${perspectiveDistribution.product}) than other perspectives — consider adding more system-generated events`,
    );
  }

  // Parse userStateModel
  const userStateModel = Array.isArray(parsed.userStateModel)
    ? parseUserStateModel(parsed.userStateModel as unknown[])
    : (() => {
        throw new Error("Missing required field: userStateModel (must be array)");
      })();

  // Validate user state model criteria against existing event names
  const eventNames = new Set(events.map((e) => e.name));
  for (const state of userStateModel) {
    for (const criterion of state.criteria) {
      if (!eventNames.has(criterion.event_name)) {
        warnings.push(
          `UserState '${state.name}': criterion references event '${criterion.event_name}' which is not defined in events`,
        );
      }
    }
  }

  // Validate activated state criteria against activation-level events
  const activationEventNames = new Set(
    events
      .filter(
        (e) =>
          e.maps_to.type === "activation_level" ||
          e.maps_to.type === "both",
      )
      .map((e) => e.name),
  );
  const activatedState = userStateModel.find((s) => s.name === "activated");
  if (activatedState) {
    for (const criterion of activatedState.criteria) {
      if (eventNames.has(criterion.event_name) && !activationEventNames.has(criterion.event_name)) {
        warnings.push(
          `UserState 'activated': criterion event '${criterion.event_name}' exists but does not map to an activation level`,
        );
      }
    }
  }

  return {
    entities,
    events,
    total_events: events.length,
    coverage: {
      activation_levels_covered: activationLevelsCovered,
      value_moments_covered: valueMomentsCovered,
      perspective_distribution: perspectiveDistribution,
    },
    userStateModel,
    confidence: parsed.confidence,
    sources: [],
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// --- InternalAction ---

export const generateMeasurementSpec = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, args): Promise<MeasurementSpec> => {
    // 1. Fetch aggregated input data
    const inputData: MeasurementInputData = await ctx.runAction(
      internal.analysis.outputs.aggregateMeasurementInputs
        .aggregateMeasurementInputs,
      { productId: args.productId },
    );

    // 2. Build prompt
    const { system, user } = buildMeasurementSpecPrompt(inputData);

    // 3. Call Claude
    const responseText = await callClaude({
      system,
      user,
      temperature: 0.2,
    });

    // 4. Parse response
    const spec = parseMeasurementSpecResponse(responseText);

    // 5. Store result on profile
    const profile = await ctx.runQuery(internal.productProfiles.getInternal, {
      productId: args.productId,
    });
    const existingOutputs =
      (profile as Record<string, unknown> | null)?.outputs as Record<string, unknown> ?? {};

    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "outputs",
      data: { ...existingOutputs, measurementSpec: spec },
    });

    return spec;
  },
});

// --- Test Action ---

export const testGenerateMeasurementSpec = action({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    const spec = await ctx.runAction(
      internal.analysis.outputs.generateMeasurementSpec.generateMeasurementSpec,
      { productId: args.productId },
    );

    const byCategory = spec.events.reduce(
      (acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      spec,
      total_events: spec.total_events,
      by_category: byCategory,
      execution_time_ms: Date.now() - startTime,
    };
  },
});
