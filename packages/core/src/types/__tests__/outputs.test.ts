import { describe, it, expect } from "vitest";
import type {
  ValueMomentPriority,
  ICPProfile,
  ActivationStage,
  StageTransition,
  ActivationMap,
  EntityPropertyDef,
  EntityDefinition,
  UserStateCriterion,
  UserState,
  EventProperty,
  Perspective,
  PerspectiveDistribution,
  MapsTo,
  TrackingEvent,
  MeasurementSpec,
  ActivationLevel,
  MeasurementInputData,
  OutputGenerationResult,
  ValueMoment,
  ValueMomentTier,
  SignalStrength,
  EntityPropertyType,
  EntityProperty,
  ProductActivity,
  CustomerActivity,
  InteractionActivity,
  ProductEntity,
  CustomerEntity,
  InteractionEntity,
  EntityJsonSchema,
} from "../outputs";

describe("ValueMomentPriority", () => {
  it("supports priority levels 1, 2, 3", () => {
    const p1: ValueMomentPriority = { moment_id: "vm-1", priority: 1, relevance_reason: "High" };
    const p2: ValueMomentPriority = { moment_id: "vm-2", priority: 2, relevance_reason: "Medium" };
    const p3: ValueMomentPriority = { moment_id: "vm-3", priority: 3, relevance_reason: "Low" };
    expect(p1.priority).toBe(1);
    expect(p2.priority).toBe(2);
    expect(p3.priority).toBe(3);
  });
});

describe("ICPProfile", () => {
  it("has all required fields", () => {
    const profile: ICPProfile = {
      id: "icp-001",
      name: "PLG Manager",
      description: "Leads product-led growth",
      value_moment_priorities: [
        { moment_id: "vm-001", priority: 1, relevance_reason: "Core" },
      ],
      activation_triggers: ["trial signup"],
      pain_points: ["no metrics"],
      success_metrics: ["activation > 40%"],
      confidence: 0.85,
      sources: ["https://example.com"],
    };
    expect(profile.id).toBe("icp-001");
    expect(profile.value_moment_priorities).toHaveLength(1);
    expect(profile.confidence).toBe(0.85);
  });
});

describe("ActivationStage", () => {
  it("has required fields and optional drop_off_reasons", () => {
    const stage: ActivationStage = {
      level: 1,
      name: "Explorer",
      signal_strength: "weak",
      trigger_events: ["signup"],
      value_moments_unlocked: ["vm-001"],
      drop_off_risk: "high",
      drop_off_reasons: ["complex onboarding"],
    };
    expect(stage.level).toBe(1);
    expect(stage.signal_strength).toBe("weak");
    expect(stage.drop_off_reasons).toHaveLength(1);
  });
});

describe("StageTransition", () => {
  it("has required and optional fields", () => {
    const transition: StageTransition = {
      from_level: 1,
      to_level: 2,
      trigger_events: ["completed_onboarding"],
      typical_timeframe: "1-3 days",
    };
    expect(transition.from_level).toBe(1);
    expect(transition.to_level).toBe(2);
    expect(transition.typical_timeframe).toBe("1-3 days");
  });
});

describe("ActivationMap", () => {
  it("includes stages, transitions, primary level, confidence, sources", () => {
    const map: ActivationMap = {
      stages: [
        {
          level: 1,
          name: "Explorer",
          signal_strength: "weak",
          trigger_events: ["signup"],
          value_moments_unlocked: [],
          drop_off_risk: "high",
        },
      ],
      transitions: [{ from_level: 1, to_level: 2, trigger_events: ["tutorial_done"] }],
      primary_activation_level: 2,
      confidence: 0.75,
      sources: ["https://example.com"],
    };
    expect(map.stages).toHaveLength(1);
    expect(map.transitions).toHaveLength(1);
    expect(map.primary_activation_level).toBe(2);
  });
});

describe("EntityPropertyDef and EntityDefinition", () => {
  it("defines entities with properties", () => {
    const prop: EntityPropertyDef = {
      name: "email",
      type: "string",
      description: "User email",
      isRequired: true,
    };
    const entity: EntityDefinition = {
      id: "user",
      name: "User",
      description: "A product user",
      isHeartbeat: true,
      properties: [prop],
    };
    expect(entity.properties).toHaveLength(1);
    expect(entity.isHeartbeat).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Double Three-Layer Framework Types
// ---------------------------------------------------------------------------

describe("EntityProperty", () => {
  it("supports all 8 property types", () => {
    const types: EntityPropertyType[] = [
      "string", "number", "boolean", "array",
      "id", "calculated", "experimental", "temporary",
    ];
    expect(types).toHaveLength(8);
  });

  it("has all required fields", () => {
    const prop: EntityProperty = {
      name: "board_id",
      type: "id",
      description: "Unique board identifier",
      isRequired: true,
    };
    expect(prop.name).toBe("board_id");
    expect(prop.type).toBe("id");
  });

  it("supports optional variations field", () => {
    const prop: EntityProperty = {
      name: "board_number_assets",
      type: "calculated",
      description: "Number of assets",
      isRequired: false,
      variations: "1-30, 31-80, 81-150, 150+",
    };
    expect(prop.variations).toBe("1-30, 31-80, 81-150, 150+");
  });
});

describe("ProductActivity", () => {
  it("has all required fields", () => {
    const activity: ProductActivity = {
      name: "shared",
      properties_supported: ["board_id", "board_number_assets"],
      activity_properties: [
        { name: "share_method", type: "string", description: "How the board was shared", isRequired: false },
      ],
    };
    expect(activity.name).toBe("shared");
    expect(activity.properties_supported).toHaveLength(2);
    expect(activity.activity_properties).toHaveLength(1);
  });
});

describe("CustomerActivity", () => {
  it("has derivation_rule", () => {
    const activity: CustomerActivity = {
      name: "first_value_created",
      derivation_rule: "Board shared (first time) OR Asset created/updated (30+ times)",
      properties_used: ["customer_id"],
    };
    expect(activity.derivation_rule).toContain("Board shared");
    expect(activity.properties_used).toHaveLength(1);
  });
});

describe("InteractionActivity", () => {
  it("has properties_supported", () => {
    const activity: InteractionActivity = {
      name: "element_clicked",
      properties_supported: ["element_type", "element_text"],
    };
    expect(activity.name).toBe("element_clicked");
    expect(activity.properties_supported).toHaveLength(2);
  });
});

describe("ProductEntity", () => {
  it("has activities nested inside", () => {
    const entity: ProductEntity = {
      id: "board",
      name: "Board",
      description: "A collaborative whiteboard",
      isHeartbeat: true,
      properties: [
        { name: "board_id", type: "id", description: "Unique board identifier", isRequired: true },
      ],
      activities: [
        { name: "created", properties_supported: ["board_id"], activity_properties: [] },
        { name: "shared", properties_supported: ["board_id"], activity_properties: [
          { name: "share_method", type: "string", description: "How shared", isRequired: false },
        ]},
      ],
    };
    expect(entity.isHeartbeat).toBe(true);
    expect(entity.activities).toHaveLength(2);
    expect(entity.properties).toHaveLength(1);
  });
});

describe("CustomerEntity", () => {
  it("has derived activities", () => {
    const entity: CustomerEntity = {
      name: "Customer",
      properties: [
        { name: "customer_id", type: "id", description: "Customer ID", isRequired: true },
      ],
      activities: [
        { name: "first_value_created", derivation_rule: "Board shared (first time)", properties_used: ["customer_id"] },
      ],
    };
    expect(entity.activities).toHaveLength(1);
    expect(entity.activities[0].derivation_rule).toContain("Board shared");
  });
});

describe("InteractionEntity", () => {
  it("has generic activities", () => {
    const entity: InteractionEntity = {
      name: "Interaction",
      properties: [
        { name: "element_type", type: "string", description: "Type of element", isRequired: true },
      ],
      activities: [
        { name: "element_clicked", properties_supported: ["element_type"] },
        { name: "element_submitted", properties_supported: ["element_type"] },
      ],
    };
    expect(entity.activities).toHaveLength(2);
  });
});

describe("EntityJsonSchema", () => {
  it("has perspective and schema", () => {
    const schema: EntityJsonSchema = {
      entityName: "Board",
      perspective: "product",
      schema: { type: "object", properties: {} },
    };
    expect(schema.perspective).toBe("product");
    expect(schema.schema).toHaveProperty("type");
  });
});

describe("EventProperty", () => {
  it("supports all property types", () => {
    const types: EventProperty["type"][] = ["string", "number", "boolean", "array"];
    expect(types).toHaveLength(4);
  });
});

describe("MapsTo discriminated union", () => {
  it("supports value_moment variant", () => {
    const mapsTo: MapsTo = { type: "value_moment", moment_id: "vm-001" };
    expect(mapsTo.type).toBe("value_moment");
    if (mapsTo.type === "value_moment") {
      expect(mapsTo.moment_id).toBe("vm-001");
    }
  });

  it("supports activation_level variant", () => {
    const mapsTo: MapsTo = { type: "activation_level", activation_level: 2 };
    expect(mapsTo.type).toBe("activation_level");
    if (mapsTo.type === "activation_level") {
      expect(mapsTo.activation_level).toBe(2);
    }
  });

  it("supports both variant", () => {
    const mapsTo: MapsTo = { type: "both", moment_id: "vm-003", activation_level: 3 };
    expect(mapsTo.type).toBe("both");
    if (mapsTo.type === "both") {
      expect(mapsTo.moment_id).toBe("vm-003");
      expect(mapsTo.activation_level).toBe(3);
    }
  });
});

describe("Perspective", () => {
  it("supports all 3 perspectives", () => {
    const perspectives: Perspective[] = ["customer", "product", "interaction"];
    expect(perspectives).toHaveLength(3);
  });
});

describe("PerspectiveDistribution", () => {
  it("has counts for each perspective", () => {
    const dist: PerspectiveDistribution = { customer: 5, product: 3, interaction: 7 };
    expect(dist.customer).toBe(5);
    expect(dist.product).toBe(3);
    expect(dist.interaction).toBe(7);
  });
});

describe("TrackingEvent", () => {
  it("has all required fields", () => {
    const event: TrackingEvent = {
      name: "dashboard_created",
      entity_id: "dashboard",
      description: "User creates a dashboard",
      perspective: "customer",
      properties: [{ name: "dashboard_id", type: "string", description: "ID", isRequired: true }],
      trigger_condition: "User clicks Create",
      maps_to: { type: "value_moment", moment_id: "vm-001" },
      category: "activation",
    };
    expect(event.name).toBe("dashboard_created");
    expect(event.perspective).toBe("customer");
    expect(event.maps_to.type).toBe("value_moment");
  });
});

describe("UserStateCriterion and UserState", () => {
  it("defines user states with criteria", () => {
    const criterion: UserStateCriterion = {
      event_name: "session_started",
      condition: "3+ sessions in 7 days",
    };
    const state: UserState = {
      name: "active",
      definition: "Regularly engaged users",
      criteria: [criterion],
    };
    expect(state.name).toBe("active");
    expect(state.criteria).toHaveLength(1);
  });
});

describe("MeasurementSpec", () => {
  it("has perspective-grouped structure", () => {
    const spec: MeasurementSpec = {
      perspectives: {
        product: {
          entities: [{
            id: "board",
            name: "Board",
            description: "A whiteboard",
            isHeartbeat: true,
            properties: [{ name: "board_id", type: "id", description: "ID", isRequired: true }],
            activities: [{ name: "created", properties_supported: ["board_id"], activity_properties: [] }],
          }],
        },
        customer: {
          entities: [{
            name: "Customer",
            properties: [{ name: "customer_id", type: "id", description: "ID", isRequired: true }],
            activities: [{ name: "first_value_created", derivation_rule: "Board shared (first time)", properties_used: ["customer_id"] }],
          }],
        },
        interaction: {
          entities: [{
            name: "Interaction",
            properties: [{ name: "element_type", type: "string", description: "Type", isRequired: true }],
            activities: [{ name: "element_clicked", properties_supported: ["element_type"] }],
          }],
        },
      },
      jsonSchemas: [],
      confidence: 0.85,
      sources: ["https://example.com"],
    };
    expect(spec.perspectives.product.entities).toHaveLength(1);
    expect(spec.perspectives.customer.entities).toHaveLength(1);
    expect(spec.perspectives.interaction.entities).toHaveLength(1);
    expect(spec.warnings).toBeUndefined();
  });

  it("supports optional warnings", () => {
    const spec: MeasurementSpec = {
      perspectives: {
        product: { entities: [] },
        customer: { entities: [] },
        interaction: { entities: [] },
      },
      jsonSchemas: [],
      confidence: 0.5,
      sources: [],
      warnings: ["Product entity count exceeds recommended maximum"],
    };
    expect(spec.warnings).toHaveLength(1);
  });
});

describe("ActivationLevel", () => {
  it("has all fields including criteria and evidence", () => {
    const level: ActivationLevel = {
      level: 1,
      name: "Explorer",
      signalStrength: "weak",
      criteria: [{ action: "signup", count: 1 }],
      reasoning: "Initial exploration",
      confidence: 0.7,
      evidence: [{ url: "https://example.com", excerpt: "Sign up" }],
    };
    expect(level.level).toBe(1);
    expect(level.signalStrength).toBe("weak");
    expect(level.criteria).toHaveLength(1);
    expect(level.evidence).toHaveLength(1);
  });
});

describe("re-exported types", () => {
  it("ValueMoment is importable from outputs", () => {
    const moment: ValueMoment = {
      id: "vm-001",
      name: "Test",
      description: "Test",
      tier: 1,
      lenses: ["jtbd"],
      lens_count: 1,
      roles: [],
      product_surfaces: [],
      contributing_candidates: [],
    };
    expect(moment.id).toBe("vm-001");
  });

  it("ValueMomentTier is importable from outputs", () => {
    const tiers: ValueMomentTier[] = [1, 2, 3];
    expect(tiers).toHaveLength(3);
  });

  it("SignalStrength is importable from outputs", () => {
    const strengths: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];
    expect(strengths).toHaveLength(4);
  });
});

describe("OutputGenerationResult", () => {
  it("wraps all three output artifacts", () => {
    const result: OutputGenerationResult = {
      productId: "products:abc123",
      icp_profiles: [],
      activation_map: {
        stages: [],
        transitions: [],
        primary_activation_level: 1,
        confidence: 0.7,
        sources: [],
      },
      measurement_spec: {
        perspectives: {
          product: { entities: [] },
          customer: { entities: [] },
          interaction: { entities: [] },
        },
        jsonSchemas: [],
        confidence: 0.6,
        sources: [],
      },
      generated_at: "2026-02-15T12:00:00Z",
      execution_time_ms: 3000,
    };
    expect(result.productId).toBe("products:abc123");
    expect(result.generated_at).toBe("2026-02-15T12:00:00Z");
  });
});

describe("MeasurementInputData", () => {
  it("contains all input artifacts", () => {
    const data: MeasurementInputData = {
      value_moments: [],
      activation_levels: [],
      icp_profiles: [],
      activation_map: {
        stages: [],
        transitions: [],
        primary_activation_level: 1,
        confidence: 0.5,
        sources: [],
      },
    };
    expect(data.value_moments).toHaveLength(0);
    expect(data.activation_levels).toHaveLength(0);
  });
});
