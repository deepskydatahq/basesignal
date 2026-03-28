// Measurement Spec generation — Double Three-Layer Framework.

import type { LlmProvider, ValueMoment, ICPProfile, LifecycleStatesResult } from "../types.js";
import type {
  ActivationLevel,
  MeasurementSpec,
  EntityJsonSchema,
  EntityPropertyType,
} from "@basesignal/core";
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
  identity?: { description: string; productName: string };
  sources?: string[];
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

export const MEASUREMENT_SPEC_SYSTEM_PROMPT = `You are a product analytics specialist generating a measurement specification using the **Double Three-Layer Framework**.

The Double Three-Layer Framework organizes tracking into two perspectives (Product, Interaction), each composed of three building blocks (Entities, Activities, Properties). Your task is to analyze the product context and produce a complete measurement specification.

## Step 1: Discover Product Entities (3-7)

Identify the core objects in the product domain. Each entity represents a thing with a unique ID and a distinct lifecycle.

Entity schema:
- id: lowercase identifier matching /^[a-z][a-z0-9_]*$/ (e.g., "board", "asset", "subscription")
- name: human-readable name (e.g., "Board", "Asset", "Subscription")
- description: what this entity represents in the product
- isHeartbeat: true for exactly ONE entity that represents the core unit of value (e.g., "board" for Miro)
- properties: array of entity-level properties (see Step 3)
- activities: array of lifecycle activities (see Step 2)

Quality test for each entity: "Does it have a unique ID and a distinct lifecycle?"

Aim for 3-7 entities. If you find more than 7, challenge whether each truly has a distinct lifecycle. More than 7 is allowed but should be justified.

## Step 2: Define Activities (past-tense lifecycle markers)

Activities nest inside entities. Each entity defines its lifecycle through past-tense activity names.

ProductActivity schema:
- name: past-tense lifecycle marker (e.g., "created", "shared", "deleted")
- properties_supported: array of entity property names captured with this activity
- activity_properties: array of EntityProperty objects specific to this activity only

Quality test for each activity: "Does this prove or unlock user value?"
If the answer is no, it does NOT belong in the product layer.

IMPORTANT: Do NOT include UI-level interactions like clicked_button, viewed_page, scrolled_to, hovered_element. These belong in the Interaction layer (Step 5), not the Product layer.

Examples of good product activities: created, updated, viewed, shared, presented, deleted, invited, canceled, commented, exported, imported, archived, published, merged.

## Step 3: Design Properties (entity-level catalog)

Properties live at the entity level, NOT per-activity. Activities declare which properties they support via properties_supported.

EntityProperty schema:
- name: snake_case property name (e.g., "board_id", "board_number_assets")
- type: one of "id", "string", "number", "boolean", "array", "calculated", "experimental", "temporary"
- description: what this property captures
- isRequired: true or false
- variations: (optional) for calculated properties, describe value ranges (e.g., "1-30, 31-80, 81-150, 150+")

Property types explained:
- id: identifier fields (board_id, user_id) — stored as string
- string: text fields (board_name, share_method)
- number: numeric fields (board_number_assets, asset_size)
- boolean: true/false flags (is_public, is_template)
- array: list fields (tags, collaborator_ids)
- calculated: computed at query time (board_number_assets, days_since_created)
- experimental: properties being tested, may be removed
- temporary: properties with planned removal date

Instruction: Support as many properties as possible within all activities. Each activity should declare in properties_supported which entity properties are relevant for that activity.

Activity-specific properties (activity_properties) are rare — only use them for properties that ONLY make sense for one specific activity (e.g., "share_method" only applies to "shared").

## Step 4: Define Interaction Layer (generic tracking)

Define a single Interaction entity for UI-level tracking. This captures the interactions that Step 2 explicitly excludes from product entities.

InteractionActivity schema:
- name: generic interaction type (e.g., "element_clicked", "element_submitted")
- properties_supported: array of contextual property names

Standard interaction activities: element_clicked, element_submitted

Standard contextual properties:
- element_type: type of UI element (button, link, input, dropdown, etc.)
- element_text: visible text or label of the element
- element_position: location on page/screen (header, sidebar, main, footer)
- element_target: navigation target or action endpoint
- element_value: value of form fields or selected options
- element_container: parent component or section containing the element

## Reference Example: Miro

Product perspective entities:
- Account (created, updated, deleted) — properties: account_id, account_name, plan_type
- User (invited, created, role_changed, removed_from_account, deleted) — properties: user_id, user_role, user_email
- Board (joined, created, updated, viewed, shared, presented, deleted) — heartbeat — properties: board_id, board_name, board_number_assets, board_number_access
- Asset (added, updated, deleted, commented) — properties: asset_id, asset_type, asset_size
- Subscription (created, canceled, ended) — properties: subscription_id, plan_name, billing_cycle

Interaction perspective:
- Interaction (element_clicked, element_submitted) — properties: element_type, element_text, element_position, element_target, element_value, element_container

## Output Format

Return a JSON object matching this exact schema:
{
  "perspectives": {
    "product": {
      "entities": [
        {
          "id": "board",
          "name": "Board",
          "description": "A collaborative whiteboard in Miro",
          "isHeartbeat": true,
          "properties": [
            { "name": "board_id", "type": "id", "description": "Unique board identifier", "isRequired": true }
          ],
          "activities": [
            {
              "name": "created",
              "properties_supported": ["board_id", "board_name"],
              "activity_properties": []
            },
            {
              "name": "shared",
              "properties_supported": ["board_id", "board_name"],
              "activity_properties": [
                { "name": "share_method", "type": "string", "description": "How the board was shared", "isRequired": false }
              ]
            }
          ]
        }
      ]
    },
    "interaction": {
      "entities": [
        {
          "name": "Interaction",
          "properties": [
            { "name": "element_type", "type": "string", "description": "Type of UI element", "isRequired": true },
            { "name": "element_text", "type": "string", "description": "Visible text or label", "isRequired": false }
          ],
          "activities": [
            { "name": "element_clicked", "properties_supported": ["element_type", "element_text"] },
            { "name": "element_submitted", "properties_supported": ["element_type", "element_text"] }
          ]
        }
      ]
    }
  },
  "confidence": 0.85
}

Rules:
- Return ONLY valid JSON, no commentary before or after
- confidence must be a number between 0 and 1
- Every product entity id must match /^[a-z][a-z0-9_]*$/
- Exactly one product entity must have isHeartbeat: true
- Every activity properties_supported entry must reference an entity property name
- Do NOT include jsonSchemas — they will be computed`;

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
    sections.push("\n## Lifecycle States");
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

  // Product-Generated Events Guidance
  const allProductSurfaces = [
    ...new Set(input.value_moments.flatMap((vm) => vm.product_surfaces)),
  ];

  if (allProductSurfaces.length > 0 || input.identity) {
    sections.push("\n## Product Context");

    if (allProductSurfaces.length > 0) {
      sections.push("\n**Product surfaces discovered from value moments:**");
      for (const surface of allProductSurfaces) {
        sections.push(`- ${surface}`);
      }
      sections.push(
        "\nUse these surfaces to identify product entities and their lifecycles.",
      );
    }

    if (input.identity) {
      sections.push(
        `\n**Product description (${input.identity.productName}):**`,
      );
      sections.push(input.identity.description);
    }
  }

  sections.push(
    "\nGenerate a measurement specification following the Double Three-Layer Framework based on the above inputs.",
  );

  return {
    system: MEASUREMENT_SPEC_SYSTEM_PROMPT,
    user: sections.join("\n"),
  };
}

// --- Validation Constants ---
const ENTITY_ID_RE = /^[a-z][a-z0-9_]*$/;

// --- Response Parser ---

export function parseMeasurementSpecResponse(
  responseText: string,
): MeasurementSpec {
  const parsed = extractJson(responseText) as Record<string, unknown>;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object with perspectives");
  }

  // Top-level structure
  if (!parsed.perspectives || typeof parsed.perspectives !== "object") {
    throw new Error("Missing required field: perspectives");
  }

  const perspectives = parsed.perspectives as Record<string, unknown>;

  if (!perspectives.product || typeof perspectives.product !== "object") {
    throw new Error("Missing required field: perspectives.product");
  }
  if (!perspectives.interaction || typeof perspectives.interaction !== "object") {
    throw new Error("Missing required field: perspectives.interaction");
  }

  // Confidence
  if (typeof parsed.confidence !== "number") {
    throw new Error("Missing required field: confidence (must be number)");
  }
  if (parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error(`confidence must be between 0 and 1, got ${parsed.confidence}`);
  }

  const warnings: string[] = [];

  // --- Validate product entities ---
  const productPerspective = perspectives.product as Record<string, unknown>;
  const productEntities = productPerspective.entities;
  if (!Array.isArray(productEntities) || productEntities.length === 0) {
    throw new Error("Product entities must be a non-empty array");
  }

  for (const entity of productEntities as Array<Record<string, unknown>>) {
    if (typeof entity.id !== "string") {
      throw new Error("Product entity missing id");
    }
    if (!ENTITY_ID_RE.test(entity.id)) {
      throw new Error(
        `Product entity '${entity.id}': id must match /^[a-z][a-z0-9_]*$/`,
      );
    }

    // Cross-reference: properties_supported must reference entity property names
    const propertyNames = new Set(
      (entity.properties as Array<Record<string, unknown>> || [])
        .map((p) => p.name as string),
    );
    const activities = entity.activities as Array<Record<string, unknown>> || [];
    for (const activity of activities) {
      const supported = activity.properties_supported as string[] || [];
      for (const propName of supported) {
        if (!propertyNames.has(propName)) {
          throw new Error(
            `Product entity '${entity.id}', activity '${activity.name}': properties_supported references '${propName}' but no such property found on entity`,
          );
        }
      }
    }
  }

  // Heartbeat validation
  const heartbeatEntities = (productEntities as Array<Record<string, unknown>>)
    .filter((e) => e.isHeartbeat === true);
  if (heartbeatEntities.length === 0) {
    throw new Error("Exactly one product entity must have isHeartbeat: true, but none found");
  }
  if (heartbeatEntities.length > 1) {
    const ids = heartbeatEntities.map((e) => e.id).join(", ");
    throw new Error(
      `Exactly one product entity must have isHeartbeat: true, but found ${heartbeatEntities.length}: ${ids}`,
    );
  }

  // Entity count warning
  if (productEntities.length > 7) {
    warnings.push(
      `Product entity count (${productEntities.length}) exceeds recommended maximum of 7`,
    );
  }

  // --- Validate interaction entities ---
  const interactionPerspective = perspectives.interaction as Record<string, unknown>;
  const interactionEntities = interactionPerspective.entities;
  if (!Array.isArray(interactionEntities)) {
    throw new Error("Interaction entities must be an array");
  }
  for (const entity of interactionEntities as Array<Record<string, unknown>>) {
    const activities = entity.activities as Array<Record<string, unknown>> || [];
    if (activities.length === 0) {
      throw new Error(
        `Interaction entity '${entity.name}': must have at least one activity`,
      );
    }
  }

  return {
    perspectives: parsed.perspectives as MeasurementSpec["perspectives"],
    jsonSchemas: [],
    confidence: parsed.confidence as number,
    sources: [],
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

// --- JSON Schema Generator ---

function mapPropertyType(type: EntityPropertyType): Record<string, unknown> {
  switch (type) {
    case "string":
    case "id":
      return { type: "string" };
    case "number":
    case "calculated":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "array":
      return { type: "array" };
    case "experimental":
    case "temporary":
      return {};
    default:
      return { type: "string" };
  }
}

export function generateEntityJsonSchemas(spec: MeasurementSpec): EntityJsonSchema[] {
  const results: EntityJsonSchema[] = [];

  // Product entities
  for (const entity of spec.perspectives.product.entities) {
    const properties: Record<string, unknown> = {
      activity: {
        type: "string",
        enum: entity.activities.map((a) => a.name),
        description: "The lifecycle activity performed on this entity",
      },
    };

    // Entity-level properties
    for (const prop of entity.properties) {
      properties[prop.name] = {
        ...mapPropertyType(prop.type),
        description: prop.description,
      };
    }

    // Activity-specific properties (deduplicated)
    const activityPropsSeen = new Set<string>();
    for (const activity of entity.activities) {
      for (const prop of activity.activity_properties) {
        if (!activityPropsSeen.has(prop.name)) {
          activityPropsSeen.add(prop.name);
          properties[prop.name] = {
            ...mapPropertyType(prop.type),
            description: prop.description,
          };
        }
      }
    }

    const required = [
      "activity",
      ...entity.properties.filter((p) => p.isRequired).map((p) => p.name),
    ];

    results.push({
      entityName: entity.name,
      perspective: "product",
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: `basesignal/product/${entity.id}/v1.0.json`,
        title: entity.name,
        description: entity.description,
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    });
  }

  // Interaction entities
  for (const entity of spec.perspectives.interaction.entities) {
    const entityId = entity.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const properties: Record<string, unknown> = {
      activity: {
        type: "string",
        enum: entity.activities.map((a) => a.name),
        description: "The type of interaction",
      },
    };

    for (const prop of entity.properties) {
      properties[prop.name] = {
        ...mapPropertyType(prop.type),
        description: prop.description,
      };
    }

    const required = [
      "activity",
      ...entity.properties.filter((p) => p.isRequired).map((p) => p.name),
    ];

    results.push({
      entityName: entity.name,
      perspective: "interaction",
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: `basesignal/interaction/${entityId}/v1.0.json`,
        title: entity.name,
        description: `Interaction tracking entity: ${entity.name}`,
        type: "object",
        properties,
        required,
        additionalProperties: false,
      },
    });
  }

  return results;
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
  identity?: { description: string; productName: string },
  sources?: string[],
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
    identity,
    sources,
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
    { temperature: 0.2, maxTokens: 16384 },
  );
  const spec = parseMeasurementSpecResponse(responseText);
  // Populate sources from crawled page URLs (deduplicated)
  spec.sources = [...new Set(inputData.sources ?? [])];
  // Populate JSON schemas
  spec.jsonSchemas = generateEntityJsonSchemas(spec);
  return spec;
}
