import { describe, it, expect } from "vitest";
import {
  parseMeasurementSpecResponse,
  assembleMeasurementInput,
  buildMeasurementSpecPrompt,
  generateEntityJsonSchemas,
  generateMeasurementSpec,
  MEASUREMENT_SPEC_SYSTEM_PROMPT,
} from "../../outputs/measurement-spec.js";
import type { ActivationLevel, LifecycleStatesResult, MeasurementSpec } from "@basesignal/core";
import type { ValueMoment, ICPProfile, LlmProvider } from "../../types.js";

const sampleLevels: ActivationLevel[] = [
  {
    level: 1,
    name: "explorer",
    signalStrength: "weak",
    criteria: [{ action: "create_board", count: 1 }],
    reasoning: "Initial interest",
    confidence: 0.7,
    evidence: [],
  },
];

const sampleMoments: ValueMoment[] = [
  {
    id: "vm-1",
    name: "Sprint planning",
    description: "Plan sprints faster",
    tier: 1,
    lens_count: 4,
    lenses: ["capability_mapping"],
    roles: ["EM"],
    product_surfaces: ["Sprint Planning"],
    contributing_candidates: [],
    is_coherent: true,
  },
  {
    id: "vm-2",
    name: "Status reporting",
    description: "Automated reports",
    tier: 2,
    lens_count: 2,
    lenses: ["artifact_creation"],
    roles: ["EM"],
    product_surfaces: ["Reports"],
    contributing_candidates: [],
    is_coherent: true,
  },
  {
    id: "vm-3",
    name: "Individual tracking",
    description: "Track individual work",
    tier: 3,
    lens_count: 1,
    lenses: ["effort_elimination"],
    roles: ["Developer"],
    product_surfaces: ["Issues"],
    contributing_candidates: [],
    is_coherent: true,
  },
];

const sampleICPs: ICPProfile[] = [
  {
    id: "icp-1",
    name: "Engineering Team Lead",
    description: "Manages team of developers",
    value_moment_priorities: [{ moment_id: "vm-1", priority: 1, relevance_reason: "Core" }],
    activation_triggers: ["create_board"],
    pain_points: ["Manual planning"],
    success_metrics: ["Sprint < 15 min"],
    confidence: 0.8,
    sources: [],
  },
];

// --- Valid new-format spec JSON ---

function makeValidSpecJson(overrides: Partial<{
  productEntities: unknown[];
  interactionEntities: unknown[];
  confidence: number;
}> = {}): string {
  const defaultProductEntity = {
    id: "board",
    name: "Board",
    description: "A collaborative whiteboard",
    isHeartbeat: true,
    properties: [
      { name: "board_id", type: "id", description: "Unique board identifier", isRequired: true },
      { name: "board_name", type: "string", description: "Board name", isRequired: false },
    ],
    activities: [
      { name: "created", properties_supported: ["board_id", "board_name"], activity_properties: [] },
      {
        name: "shared",
        properties_supported: ["board_id"],
        activity_properties: [
          { name: "share_method", type: "string", description: "How shared", isRequired: false },
        ],
      },
    ],
  };

  const defaultInteractionEntity = {
    name: "Interaction",
    properties: [
      { name: "element_type", type: "string", description: "Element type", isRequired: true },
    ],
    activities: [
      { name: "element_clicked", properties_supported: ["element_type"] },
      { name: "element_submitted", properties_supported: ["element_type"] },
    ],
  };

  return JSON.stringify({
    perspectives: {
      product: { entities: overrides.productEntities ?? [defaultProductEntity] },
      interaction: { entities: overrides.interactionEntities ?? [defaultInteractionEntity] },
    },
    confidence: overrides.confidence ?? 0.85,
  });
}

// --- assembleMeasurementInput ---

describe("assembleMeasurementInput", () => {
  it("builds input data with event templates", () => {
    const input = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
    );

    expect(input.value_moments).toHaveLength(3);
    expect(input.activation_levels).toHaveLength(1);
    expect(input.icp_profiles).toHaveLength(1);
    expect(input.activation_map).toBeNull();

    expect(input.activation_event_templates).toHaveLength(1);
    expect(input.activation_event_templates[0].level).toBe(1);
    expect(input.activation_event_templates[0].suggested_event_name).toContain("activation_l1");

    expect(input.value_event_templates).toHaveLength(2);
    expect(input.value_event_templates[0].tier).toBeLessThanOrEqual(2);
    expect(input.value_event_templates[1].tier).toBeLessThanOrEqual(2);
  });

  it("includes lifecycle_states when provided", () => {
    const input = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
      sampleLifecycleStates,
    );
    expect(input.lifecycle_states).toBeDefined();
    expect(input.lifecycle_states!.states).toHaveLength(7);
  });

  it("lifecycle_states is undefined when not provided", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    expect(input.lifecycle_states).toBeUndefined();
  });

  it("includes identity when provided", () => {
    const identity = { productName: "Linear", description: "Issue tracking tool" };
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null, undefined, identity);
    expect(input.identity).toEqual(identity);
  });

  it("identity is undefined when not provided", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    expect(input.identity).toBeUndefined();
  });

  it("includes sources when provided", () => {
    const sources = ["https://example.com", "https://example.com/about"];
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null, undefined, undefined, sources);
    expect(input.sources).toEqual(sources);
  });

  it("sources is undefined when not provided", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    expect(input.sources).toBeUndefined();
  });
});

// --- buildMeasurementSpecPrompt ---

describe("buildMeasurementSpecPrompt", () => {
  it("includes all sections in prompt", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    const { system, user } = buildMeasurementSpecPrompt(input);

    expect(system).toContain("Double Three-Layer Framework");
    expect(user).toContain("Value Moments Reference");
    expect(user).toContain("Activation Levels Reference");
    expect(user).toContain("ICP Profiles");
    expect(user).toContain("Sprint planning");
    expect(user).toContain("Level 1: explorer");
  });

  it("omits ICP section when no profiles", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, [], null);
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).not.toContain("## ICP Profiles");
  });

  it("includes lifecycle states section when provided", () => {
    const input = assembleMeasurementInput(
      sampleMoments, sampleLevels, sampleICPs, null, sampleLifecycleStates,
    );
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("## Lifecycle States");
    expect(user).toContain("**new**: Just signed up");
    expect(user).toContain("Entry criteria: signup: account created");
  });

  it("omits lifecycle states section when not provided", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).not.toContain("## Lifecycle States");
  });

  it("includes product context when surfaces exist", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("## Product Context");
    expect(user).toContain("Sprint Planning");
  });

  it("includes identity description when provided", () => {
    const input = assembleMeasurementInput(
      sampleMoments, sampleLevels, sampleICPs, null, undefined,
      { productName: "Amplitude", description: "Digital analytics platform" },
    );
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("Amplitude");
    expect(user).toContain("Digital analytics platform");
  });

  it("omits product context when no surfaces and no identity", () => {
    const noSurfaceMoments = sampleMoments.map((m) => ({ ...m, product_surfaces: [] }));
    const input = assembleMeasurementInput(noSurfaceMoments, sampleLevels, [], null);
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).not.toContain("## Product Context");
  });
});

// --- MEASUREMENT_SPEC_SYSTEM_PROMPT ---

describe("MEASUREMENT_SPEC_SYSTEM_PROMPT", () => {
  it("names the framework", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Double Three-Layer Framework");
  });

  it("has Step 1: Discover Product Entities", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Step 1: Discover Product Entities");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("3-7");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("heartbeat");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("/^[a-z][a-z0-9_]*$/");
  });

  it("has Step 2: Define Activities with quality test", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Step 2: Define Activities");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("past-tense");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Does this prove or unlock user value");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("clicked_button");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("viewed_page");
  });

  it("has Step 3: Design Properties with all 8 types", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Step 3: Design Properties");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("properties_supported");
    for (const type of ["id", "string", "number", "boolean", "array", "calculated", "experimental", "temporary"]) {
      expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain(type);
    }
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Support as many properties as possible");
  });

  it("has Step 4: Interaction Layer", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Step 4: Define Interaction Layer");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("element_clicked");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("element_submitted");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("element_type");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("element_text");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("element_position");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("element_target");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("element_container");
  });

  it("includes Miro reference example", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Miro");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Account");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("User");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Board");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Asset");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Subscription");
  });

  it("includes output JSON schema with perspectives", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain('"perspectives"');
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain('"product"');
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain('"interaction"');
  });

  it("instructs JSON-only output", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("ONLY valid JSON");
  });
});

// --- parseMeasurementSpecResponse ---

describe("parseMeasurementSpecResponse", () => {
  it("parses valid new-format measurement spec", () => {
    const result = parseMeasurementSpecResponse(makeValidSpecJson());
    expect(result.perspectives.product.entities).toHaveLength(1);
    expect(result.perspectives.interaction.entities).toHaveLength(1);
    expect(result.confidence).toBe(0.85);
    expect(result.jsonSchemas).toHaveLength(0); // populated by generateEntityJsonSchemas
    expect(result.sources).toHaveLength(0);
  });

  it("rejects missing perspectives", () => {
    const json = JSON.stringify({ confidence: 0.5 });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("Missing required field: perspectives");
  });

  it("rejects missing perspectives.product", () => {
    const json = JSON.stringify({
      perspectives: { interaction: { entities: [] } },
      confidence: 0.5,
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("Missing required field: perspectives.product");
  });

  it("rejects missing perspectives.interaction", () => {
    const json = JSON.stringify({
      perspectives: { product: { entities: [] } },
      confidence: 0.5,
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("Missing required field: perspectives.interaction");
  });

  it("rejects empty product entities", () => {
    const json = makeValidSpecJson({ productEntities: [] });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("Product entities must be a non-empty array");
  });

  it("rejects missing confidence", () => {
    const json = JSON.stringify({
      perspectives: {
        product: { entities: [] },
        interaction: { entities: [] },
      },
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("Missing required field: confidence");
  });

  it("rejects confidence out of range", () => {
    const json = makeValidSpecJson({ confidence: 1.5 });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("confidence must be between 0 and 1");
  });
});

describe("parseMeasurementSpecResponse — entity ID validation", () => {
  it("rejects entity ID starting with digit", () => {
    const json = makeValidSpecJson({
      productEntities: [{
        id: "1board", name: "Board", description: "D", isHeartbeat: true,
        properties: [], activities: [{ name: "created", properties_supported: [], activity_properties: [] }],
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("id must match");
  });

  it("rejects entity ID with uppercase", () => {
    const json = makeValidSpecJson({
      productEntities: [{
        id: "Board", name: "Board", description: "D", isHeartbeat: true,
        properties: [], activities: [{ name: "created", properties_supported: [], activity_properties: [] }],
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("id must match");
  });

  it("accepts valid entity ID with underscores", () => {
    const json = makeValidSpecJson({
      productEntities: [{
        id: "project_board", name: "Board", description: "D", isHeartbeat: true,
        properties: [], activities: [{ name: "created", properties_supported: [], activity_properties: [] }],
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).not.toThrow();
  });
});

describe("parseMeasurementSpecResponse — heartbeat validation", () => {
  it("rejects zero heartbeat entities", () => {
    const json = makeValidSpecJson({
      productEntities: [{
        id: "board", name: "Board", description: "D", isHeartbeat: false,
        properties: [], activities: [{ name: "created", properties_supported: [], activity_properties: [] }],
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("none found");
  });

  it("rejects multiple heartbeat entities", () => {
    const json = makeValidSpecJson({
      productEntities: [
        { id: "board", name: "Board", description: "D", isHeartbeat: true, properties: [], activities: [{ name: "created", properties_supported: [], activity_properties: [] }] },
        { id: "asset", name: "Asset", description: "D", isHeartbeat: true, properties: [], activities: [{ name: "added", properties_supported: [], activity_properties: [] }] },
      ],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("found 2");
  });

  it("accepts exactly one heartbeat entity", () => {
    expect(() => parseMeasurementSpecResponse(makeValidSpecJson())).not.toThrow();
  });
});

describe("parseMeasurementSpecResponse — cross-reference validation", () => {
  it("rejects properties_supported referencing non-existent property", () => {
    const json = makeValidSpecJson({
      productEntities: [{
        id: "board", name: "Board", description: "D", isHeartbeat: true,
        properties: [{ name: "board_id", type: "id", description: "ID", isRequired: true }],
        activities: [{ name: "created", properties_supported: ["board_id", "nonexistent"], activity_properties: [] }],
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("properties_supported references");
  });

  it("accepts valid properties_supported references", () => {
    expect(() => parseMeasurementSpecResponse(makeValidSpecJson())).not.toThrow();
  });
});

describe("parseMeasurementSpecResponse — legacy customer sanitization", () => {
  it("strips legacy customer perspective from LLM response", () => {
    // Simulate an LLM that still returns a customer perspective
    const legacyJson = JSON.stringify({
      perspectives: {
        product: {
          entities: [{
            id: "board", name: "Board", description: "D", isHeartbeat: true,
            properties: [], activities: [{ name: "created", properties_supported: [], activity_properties: [] }],
          }],
        },
        customer: {
          entities: [{
            name: "Customer", properties: [],
            activities: [{ name: "first_value_created", derivation_rule: "Board shared", properties_used: [] }],
          }],
        },
        interaction: {
          entities: [{
            name: "Interaction", properties: [],
            activities: [{ name: "element_clicked", properties_supported: [] }],
          }],
        },
      },
      confidence: 0.8,
    });
    const result = parseMeasurementSpecResponse(legacyJson);
    expect(result.perspectives).not.toHaveProperty("customer");
    expect(result.perspectives).toHaveProperty("product");
    expect(result.perspectives).toHaveProperty("interaction");
  });
});

describe("parseMeasurementSpecResponse — interaction validation", () => {
  it("rejects interaction entity with zero activities", () => {
    const json = makeValidSpecJson({
      interactionEntities: [{
        name: "Interaction",
        properties: [],
        activities: [],
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("must have at least one activity");
  });
});

describe("parseMeasurementSpecResponse — warnings", () => {
  it("warns but does not throw when entity count exceeds 7", () => {
    const entities = Array.from({ length: 8 }, (_, i) => ({
      id: `entity_${i}`,
      name: `Entity ${i}`,
      description: "D",
      isHeartbeat: i === 0,
      properties: [],
      activities: [{ name: "created", properties_supported: [], activity_properties: [] }],
    }));
    const json = makeValidSpecJson({ productEntities: entities });
    const result = parseMeasurementSpecResponse(json);
    expect(result.warnings).toBeDefined();
    expect(result.warnings![0]).toContain("exceeds recommended maximum of 7");
  });
});

// --- generateEntityJsonSchemas ---

describe("generateEntityJsonSchemas", () => {
  const spec: MeasurementSpec = {
    perspectives: {
      product: {
        entities: [{
          id: "board",
          name: "Board",
          description: "A collaborative whiteboard",
          isHeartbeat: true,
          properties: [
            { name: "board_id", type: "id", description: "Unique board identifier", isRequired: true },
            { name: "board_name", type: "string", description: "Board name", isRequired: false },
          ],
          activities: [
            { name: "created", properties_supported: ["board_id", "board_name"], activity_properties: [] },
            {
              name: "shared",
              properties_supported: ["board_id"],
              activity_properties: [
                { name: "share_method", type: "string", description: "How shared", isRequired: false },
              ],
            },
          ],
        }],
      },
      interaction: {
        entities: [{
          name: "Interaction",
          properties: [
            { name: "element_type", type: "string", description: "Element type", isRequired: true },
          ],
          activities: [
            { name: "element_clicked", properties_supported: ["element_type"] },
            { name: "element_submitted", properties_supported: ["element_type"] },
          ],
        }],
      },
    },
    jsonSchemas: [],
    confidence: 0.85,
    sources: [],
  };

  it("produces one schema per entity across all perspectives", () => {
    const schemas = generateEntityJsonSchemas(spec);
    expect(schemas).toHaveLength(2); // 1 product + 1 interaction
  });

  it("product schema has activity enum and entity properties", () => {
    const schemas = generateEntityJsonSchemas(spec);
    const boardSchema = schemas.find((s) => s.entityName === "Board")!;
    expect(boardSchema.perspective).toBe("product");
    const schema = boardSchema.schema as Record<string, unknown>;
    expect(schema.$id).toBe("basesignal/product/board/v1.0.json");
    expect(schema.additionalProperties).toBe(false);

    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.activity.enum).toEqual(["created", "shared"]);
    expect(props.board_id.type).toBe("string"); // id maps to string
    expect(props.board_name.type).toBe("string");
    expect(props.share_method.type).toBe("string"); // activity-specific property

    const required = schema.required as string[];
    expect(required).toContain("activity");
    expect(required).toContain("board_id");
    expect(required).not.toContain("board_name"); // not required
  });

  it("interaction schema has activity enum with element types", () => {
    const schemas = generateEntityJsonSchemas(spec);
    const interactionSchema = schemas.find((s) => s.entityName === "Interaction")!;
    expect(interactionSchema.perspective).toBe("interaction");
    const schema = interactionSchema.schema as Record<string, unknown>;

    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.activity.enum).toEqual(["element_clicked", "element_submitted"]);
    expect(props.element_type.type).toBe("string");
  });

  it("isRequired=true properties appear in required array", () => {
    const schemas = generateEntityJsonSchemas(spec);
    const boardSchema = schemas.find((s) => s.entityName === "Board")!;
    const required = (boardSchema.schema as Record<string, unknown>).required as string[];
    expect(required).toContain("board_id");
  });

  it("isRequired=false properties do NOT appear in required array", () => {
    const schemas = generateEntityJsonSchemas(spec);
    const boardSchema = schemas.find((s) => s.entityName === "Board")!;
    const required = (boardSchema.schema as Record<string, unknown>).required as string[];
    expect(required).not.toContain("board_name");
    expect(required).not.toContain("share_method");
  });

  it("empty entity (no activities) produces schema with empty activity enum", () => {
    const emptySpec: MeasurementSpec = {
      perspectives: {
        product: {
          entities: [{
            id: "thing", name: "Thing", description: "Empty", isHeartbeat: true,
            properties: [], activities: [],
          }],
        },
        interaction: { entities: [] },
      },
      jsonSchemas: [],
      confidence: 0.5,
      sources: [],
    };
    const schemas = generateEntityJsonSchemas(emptySpec);
    expect(schemas).toHaveLength(1);
    const props = (schemas[0].schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
    expect(props.activity.enum).toEqual([]);
  });

  it("maps all property types correctly", () => {
    const typedSpec: MeasurementSpec = {
      perspectives: {
        product: {
          entities: [{
            id: "test", name: "Test", description: "Test", isHeartbeat: true,
            properties: [
              { name: "p_id", type: "id", description: "d", isRequired: true },
              { name: "p_str", type: "string", description: "d", isRequired: false },
              { name: "p_num", type: "number", description: "d", isRequired: false },
              { name: "p_bool", type: "boolean", description: "d", isRequired: false },
              { name: "p_arr", type: "array", description: "d", isRequired: false },
              { name: "p_calc", type: "calculated", description: "d", isRequired: false },
              { name: "p_exp", type: "experimental", description: "d", isRequired: false },
              { name: "p_temp", type: "temporary", description: "d", isRequired: false },
            ],
            activities: [],
          }],
        },
        interaction: { entities: [] },
      },
      jsonSchemas: [],
      confidence: 0.5,
      sources: [],
    };
    const schemas = generateEntityJsonSchemas(typedSpec);
    const props = (schemas[0].schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>;
    expect(props.p_id.type).toBe("string");
    expect(props.p_str.type).toBe("string");
    expect(props.p_num.type).toBe("number");
    expect(props.p_bool.type).toBe("boolean");
    expect(props.p_arr.type).toBe("array");
    expect(props.p_calc.type).toBe("number");
    expect(props.p_exp.type).toBeUndefined(); // experimental → {}
    expect(props.p_temp.type).toBeUndefined(); // temporary → {}
  });
});

// --- generateMeasurementSpec ---

describe("generateMeasurementSpec — sources population", () => {
  it("populates spec.sources from inputData.sources with deduplication", async () => {
    const mockLlm: LlmProvider = {
      complete: async () => makeValidSpecJson(),
    } as LlmProvider;

    const inputData = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
      undefined,
      undefined,
      ["https://example.com", "https://example.com/about", "https://example.com"],
    );

    const spec = await generateMeasurementSpec(inputData, mockLlm);
    expect(spec.sources).toEqual(["https://example.com", "https://example.com/about"]);
  });

  it("populates spec.sources as empty array when no sources provided", async () => {
    const mockLlm: LlmProvider = {
      complete: async () => makeValidSpecJson(),
    } as LlmProvider;

    const inputData = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
    );

    const spec = await generateMeasurementSpec(inputData, mockLlm);
    expect(spec.sources).toEqual([]);
  });
});

// --- Lifecycle States ---

const sampleLifecycleStates: LifecycleStatesResult = {
  states: [
    {
      name: "new",
      definition: "Just signed up",
      entry_criteria: [{ event_name: "signup", condition: "account created" }],
      exit_triggers: [{ event_name: "create_project", condition: "first project" }],
      time_window: "7 days",
    },
    {
      name: "activated",
      definition: "Created first project",
      entry_criteria: [{ event_name: "create_project", condition: "project created" }],
      exit_triggers: [{ event_name: "daily_use", condition: "3+ days" }],
      time_window: "14 days",
    },
    {
      name: "engaged",
      definition: "Regular user",
      entry_criteria: [{ event_name: "daily_use", condition: "3+ days/week" }],
      exit_triggers: [{ event_name: "session_gap", condition: "7 days" }],
      time_window: "30 days",
    },
    {
      name: "at_risk",
      definition: "Declining engagement",
      entry_criteria: [{ event_name: "session_gap", condition: "7 days" }],
      exit_triggers: [{ event_name: "session_gap", condition: "30 days" }],
      time_window: "14 days",
    },
    {
      name: "dormant",
      definition: "Stopped using product",
      entry_criteria: [{ event_name: "session_gap", condition: "30 days" }],
      exit_triggers: [{ event_name: "session_gap", condition: "60 days" }],
      time_window: "30 days",
    },
    {
      name: "churned",
      definition: "Gone for 60+ days",
      entry_criteria: [{ event_name: "session_gap", condition: "60 days" }],
      exit_triggers: [{ event_name: "session_started", condition: "returns" }],
    },
    {
      name: "resurrected",
      definition: "Returned after churn",
      entry_criteria: [{ event_name: "create_project", condition: "new project after churn" }],
      exit_triggers: [{ event_name: "daily_use", condition: "regular use" }],
      time_window: "14 days",
    },
  ],
  transitions: [
    { from_state: "new", to_state: "activated", trigger_conditions: ["Creates first project"], typical_timeframe: "1-3 days" },
  ],
  confidence: 0.75,
  sources: ["activation_levels", "value_moments"],
};
