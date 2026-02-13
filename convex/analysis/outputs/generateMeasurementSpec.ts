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
} from "./types";

// --- System Prompt ---

export const MEASUREMENT_SPEC_SYSTEM_PROMPT = `You are a product analytics specialist generating a measurement specification using the Double Three-Layer Framework. Entities define reusable properties (designed once), events (activities) inherit all parent entity properties, and every activity uses a past-tense verb name.

## Step 1: Define Entities (3-7)
Define 3-7 core entities that represent the objects users interact with. Design 3-7 reusable properties per entity, inherited by ALL events that reference the entity. Mark exactly one entity as the heartbeat — the primary unit of work or value delivery.

Entity schema:
- id: lowercase identifier matching /^[a-z][a-z0-9_]*$/ (e.g., "account", "board", "asset")
- name: human-readable name (e.g., "Account", "Board", "Asset")
- description: what this entity represents in the product
- isHeartbeat: true for exactly one entity (the primary unit of work), false for all others
- properties: array of 3-7 reusable entity properties, each with:
  - name: snake_case property name
  - type: one of "string", "number", "boolean", "array"
  - description: what this property captures
  - isRequired: true or false

### Miro Example
For a product like Miro:
- Account (id: "account") — the organization/workspace
- Board (id: "board", isHeartbeat: true) — the primary unit of work
- Asset (id: "asset") — items placed on boards (sticky notes, shapes, images)

## Step 2: Define Activities (Events)
Every activity MUST reference a defined entity via entity_id. Each event inherits ALL parent entity properties. Only specify ADDITIONAL event-specific properties (0 or more).

### Activity Naming Rules
Activity names use past-tense verbs. Every name MUST match this regex: /^[a-z][a-z0-9]*_[a-z][a-z0-9_]*$/
This means: entity_action format using lowercase letters, digits, and underscores.
Examples: board_created, board_shared, asset_added, account_upgraded
Do NOT use present tense (board_create) — always use past tense (board_created).

### Activity Categories
Each activity must have exactly one category:
- activation: User progresses toward activation (e.g., completes onboarding step, creates first item)
- value: User experiences a value moment (e.g., shares dashboard, gets first insight)
- retention: User returns or re-engages (e.g., opens app again, resumes workflow)
- expansion: User deepens usage (e.g., invites team member, enables integration)

### maps_to Requirement
Every activity MUST map to a value moment, activation level, or both. Use this discriminated union format:
- { "type": "value_moment", "moment_id": "<id>" } — maps to a specific value moment
- { "type": "activation_level", "activation_level": <number> } — maps to an activation level
- { "type": "both", "moment_id": "<id>", "activation_level": <number> } — maps to both

### Property Requirements
Each event inherits ALL parent entity properties. Only specify ADDITIONAL event-specific properties. Each additional property has:
- name: snake_case property name
- type: one of "string", "number", "boolean", "array"
- description: what this property captures
- required: true or false

Do NOT invent properties per event. Entity properties are inherited automatically.

## Step 3: Assign Perspective
Each activity must have a perspective field indicating which viewpoint it captures:
- customer: how the user experiences the product (e.g., account_created, board_shared)
- product: what the product delivers (e.g., insight_generated, report_exported)
- interaction: how the user interacts with the product (e.g., asset_moved, board_filtered)

## Step 4: Define User State Model
Define a user state model with 5 states. Each state has event-based criteria that determine when a user transitions into that state:
- new: just signed up, no meaningful activity yet
- activated: completed key activation actions
- active: regular ongoing usage of the product
- at_risk: declining engagement signals
- dormant: no activity for an extended period

### Target
Generate 15-25 activities that cover:
- All activation level criteria (at least one activity per level)
- Key value moments (especially Tier 1 and Tier 2)
- Retention signals (returning users, repeated engagement)
- Expansion signals (team growth, feature adoption)
- All three perspectives (customer, product, interaction)

## Output Format
Return a JSON object matching this exact schema:
{
  "entities": [
    {
      "id": "board",
      "name": "Board",
      "description": "The primary collaboration canvas",
      "isHeartbeat": true,
      "properties": [
        { "name": "board_id", "type": "string", "description": "Unique identifier", "isRequired": true },
        { "name": "board_type", "type": "string", "description": "Template or blank", "isRequired": false },
        { "name": "member_count", "type": "number", "description": "Number of collaborators", "isRequired": false }
      ]
    }
  ],
  "events": [
    {
      "name": "board_created",
      "entity_id": "board",
      "description": "User creates a new board",
      "properties": [{ "name": "template_id", "type": "string", "description": "Template used if any", "required": false }],
      "trigger_condition": "When a user creates a new board",
      "maps_to": { "type": "activation_level", "activation_level": 1 },
      "category": "activation",
      "perspective": "customer"
    }
  ],
  "userStateModel": [
    { "state": "new", "criteria": "User has signed up but not created any boards" },
    { "state": "activated", "criteria": "User has created at least 1 board and added 3+ assets" },
    { "state": "active", "criteria": "User has board_opened events in 3+ of the last 7 days" },
    { "state": "at_risk", "criteria": "No board_opened events in 7+ days after being active" },
    { "state": "dormant", "criteria": "No activity of any kind in 30+ days" }
  ],
  "confidence": 0.7
}

Rules:
- Return ONLY valid JSON, no commentary before or after
- confidence must be a number between 0 and 1
- Every event.entity_id MUST reference a defined entity.id
- Exactly one entity must have isHeartbeat: true
- Every event must have a perspective: "customer", "product", or "interaction"
- Activity names must use past-tense verbs (board_created, not board_create)
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
      properties,
      ...(raw.isHeartbeat === true ? { isHeartbeat: true } : {}),
    });
  }

  return entities;
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

    // Validate trigger_condition
    if (typeof raw.trigger_condition !== "string" || !raw.trigger_condition) {
      throw new Error(`${eventLabel}: missing trigger_condition`);
    }

    // Validate properties
    if (!Array.isArray(raw.properties)) {
      throw new Error(`${eventLabel}: missing properties array`);
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

    const event: TrackingEvent = {
      name: raw.name,
      entity_id: raw.entity_id,
      description: raw.description,
      properties,
      trigger_condition: raw.trigger_condition,
      maps_to: mapsTo as TrackingEvent["maps_to"],
      category: raw.category as TrackingEvent["category"],
      ...(typeof raw.perspective === "string" && raw.perspective
        ? { perspective: raw.perspective }
        : {}),
    };
    if (typeof raw.entity_id === "string" && raw.entity_id) {
      event.entity_id = raw.entity_id;
    }
    events.push(event);
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

  return {
    entities,
    events,
    total_events: events.length,
    coverage: {
      activation_levels_covered: activationLevelsCovered,
      value_moments_covered: valueMomentsCovered,
    },
    confidence: parsed.confidence,
    sources: [],
    ...(Array.isArray(parsed.userStateModel)
      ? { userStateModel: parsed.userStateModel as unknown[] }
      : {}),
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
