import { describe, it, expect } from "vitest";
import {
  ICPProfileSchema,
  MapsToSchema,
  ActivationStageSchema,
  ActivationMapSchema,
  MeasurementSpecSchema,
  EntityPropertyDefSchema,
  ValueMomentPrioritySchema,
  TrackingEventSchema,
  PerspectiveSchema,
  StateCriterionSchema,
  LifecycleStateSchema,
  StateTransitionSchema,
  LifecycleStatesResultSchema,
  EntityPropertyTypeSchema,
  EntityPropertySchema,
  ProductActivitySchema,
  CustomerActivitySchema,
  InteractionActivitySchema,
  ProductEntitySchema,
  CustomerEntitySchema,
  InteractionEntitySchema,
  EntityJsonSchemaSchema,
} from "../outputs";

const validICPProfile = {
  id: "icp-1",
  name: "Power User",
  description: "Highly engaged user",
  value_moment_priorities: [
    { moment_id: "vm-1", priority: 1 as const, relevance_reason: "Core value" },
  ],
  activation_triggers: ["signup"],
  pain_points: ["complexity"],
  success_metrics: ["retention"],
  confidence: 0.9,
  sources: ["analysis"],
};

const validActivationStage = {
  level: 1,
  name: "Setup",
  signal_strength: "weak" as const,
  trigger_events: ["create_account"],
  value_moments_unlocked: ["vm-1"],
  drop_off_risk: "medium" as const,
};

const validActivationMap = {
  stages: [validActivationStage],
  transitions: [{ from_level: 1, to_level: 2, trigger_events: ["invite_team"] }],
  primary_activation_level: 2,
  confidence: 0.85,
  sources: ["analysis"],
};

const validEntityPropDef = {
  name: "email",
  type: "string" as const,
  description: "User email",
  isRequired: true,
};

const validTrackingEvent = {
  name: "page_view",
  entity_id: "ent-1",
  description: "User views a page",
  perspective: "customer" as const,
  properties: [validEntityPropDef],
  trigger_condition: "page loads",
  maps_to: { type: "value_moment" as const, moment_id: "vm-1" },
  category: "engagement",
};

const validEntityProperty = {
  name: "board_id",
  type: "id" as const,
  description: "Unique board identifier",
  isRequired: true,
};

const validProductEntity = {
  id: "board",
  name: "Board",
  description: "A collaborative whiteboard",
  isHeartbeat: true,
  properties: [validEntityProperty],
  activities: [
    { name: "created", properties_supported: ["board_id"], activity_properties: [] },
    {
      name: "shared",
      properties_supported: ["board_id"],
      activity_properties: [
        { name: "share_method", type: "string" as const, description: "How shared", isRequired: false },
      ],
    },
  ],
};

const validCustomerEntity = {
  name: "Customer",
  properties: [{ name: "customer_id", type: "id" as const, description: "Customer ID", isRequired: true }],
  activities: [
    { name: "first_value_created", derivation_rule: "Board shared (first time)", properties_used: ["customer_id"] },
  ],
};

const validInteractionEntity = {
  name: "Interaction",
  properties: [{ name: "element_type", type: "string" as const, description: "Element type", isRequired: true }],
  activities: [
    { name: "element_clicked", properties_supported: ["element_type"] },
    { name: "element_submitted", properties_supported: ["element_type"] },
  ],
};

const validMeasurementSpec = {
  perspectives: {
    product: { entities: [validProductEntity] },
    customer: { entities: [validCustomerEntity] },
    interaction: { entities: [validInteractionEntity] },
  },
  jsonSchemas: [
    { entityName: "Board", perspective: "product" as const, schema: { type: "object" } },
  ],
  confidence: 0.85,
  sources: ["analysis"],
};

describe("ICPProfileSchema", () => {
  it("accepts valid ICP profile", () => {
    expect(ICPProfileSchema.safeParse(validICPProfile).success).toBe(true);
  });

  it("rejects missing id", () => {
    const { id, ...rest } = validICPProfile;
    expect(ICPProfileSchema.safeParse(rest).success).toBe(false);
  });
});

describe("MapsToSchema", () => {
  it("accepts value_moment variant", () => {
    expect(MapsToSchema.safeParse({ type: "value_moment", moment_id: "vm-1" }).success).toBe(true);
  });

  it("accepts activation_level variant", () => {
    expect(MapsToSchema.safeParse({ type: "activation_level", activation_level: 2 }).success).toBe(true);
  });

  it("accepts both variant", () => {
    expect(
      MapsToSchema.safeParse({ type: "both", moment_id: "vm-1", activation_level: 2 }).success,
    ).toBe(true);
  });

  it("rejects invalid type value", () => {
    expect(MapsToSchema.safeParse({ type: "invalid", moment_id: "vm-1" }).success).toBe(false);
  });
});

describe("ActivationStageSchema", () => {
  it.each(["weak", "medium", "strong", "very_strong"])("accepts signal_strength '%s'", (val) => {
    expect(
      ActivationStageSchema.safeParse({ ...validActivationStage, signal_strength: val }).success,
    ).toBe(true);
  });
});

describe("ActivationMapSchema", () => {
  it("accepts valid activation map", () => {
    expect(ActivationMapSchema.safeParse(validActivationMap).success).toBe(true);
  });
});

describe("MeasurementSpecSchema", () => {
  it("accepts valid measurement spec", () => {
    expect(MeasurementSpecSchema.safeParse(validMeasurementSpec).success).toBe(true);
  });

  it("accepts optional warnings absent", () => {
    expect(MeasurementSpecSchema.safeParse(validMeasurementSpec).success).toBe(true);
  });

  it("accepts optional warnings present", () => {
    const data = { ...validMeasurementSpec, warnings: ["Low coverage"] };
    expect(MeasurementSpecSchema.safeParse(data).success).toBe(true);
  });
});

describe("TrackingEventSchema", () => {
  it.each(["customer", "product", "interaction"])("accepts perspective '%s'", (val) => {
    expect(
      TrackingEventSchema.safeParse({ ...validTrackingEvent, perspective: val }).success,
    ).toBe(true);
  });
});

describe("EntityPropertyDefSchema", () => {
  it.each(["string", "number", "boolean", "array"])("accepts type '%s'", (val) => {
    expect(
      EntityPropertyDefSchema.safeParse({ ...validEntityPropDef, type: val }).success,
    ).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(
      EntityPropertyDefSchema.safeParse({ ...validEntityPropDef, type: "object" }).success,
    ).toBe(false);
  });
});

describe("ValueMomentPrioritySchema", () => {
  it.each([1, 2, 3])("accepts priority %d", (p) => {
    expect(
      ValueMomentPrioritySchema.safeParse({ moment_id: "vm-1", priority: p, relevance_reason: "R" })
        .success,
    ).toBe(true);
  });

  it("rejects priority 4", () => {
    expect(
      ValueMomentPrioritySchema.safeParse({ moment_id: "vm-1", priority: 4, relevance_reason: "R" })
        .success,
    ).toBe(false);
  });
});

// --- Double Three-Layer Framework Schemas ---

describe("EntityPropertySchema", () => {
  it.each(["string", "number", "boolean", "array", "id", "calculated", "experimental", "temporary"])(
    "accepts type '%s'",
    (val) => {
      expect(
        EntityPropertySchema.safeParse({ ...validEntityProperty, type: val }).success,
      ).toBe(true);
    },
  );

  it("rejects unknown type", () => {
    expect(
      EntityPropertySchema.safeParse({ ...validEntityProperty, type: "object" }).success,
    ).toBe(false);
  });

  it("accepts optional variations", () => {
    expect(
      EntityPropertySchema.safeParse({ ...validEntityProperty, variations: "1-30, 31-80" }).success,
    ).toBe(true);
  });

  it("accepts absent variations", () => {
    expect(EntityPropertySchema.safeParse(validEntityProperty).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(
      EntityPropertySchema.safeParse({ ...validEntityProperty, name: "" }).success,
    ).toBe(false);
  });
});

describe("ProductActivitySchema", () => {
  it("accepts valid activity with nested activity_properties", () => {
    expect(
      ProductActivitySchema.safeParse({
        name: "shared",
        properties_supported: ["board_id"],
        activity_properties: [
          { name: "share_method", type: "string", description: "How shared", isRequired: false },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(
      ProductActivitySchema.safeParse({ name: "", properties_supported: [], activity_properties: [] }).success,
    ).toBe(false);
  });
});

describe("CustomerActivitySchema", () => {
  it("accepts valid activity", () => {
    expect(
      CustomerActivitySchema.safeParse({
        name: "first_value_created",
        derivation_rule: "Board shared (first time)",
        properties_used: ["customer_id"],
      }).success,
    ).toBe(true);
  });

  it("rejects empty derivation_rule", () => {
    expect(
      CustomerActivitySchema.safeParse({
        name: "first_value_created",
        derivation_rule: "",
        properties_used: [],
      }).success,
    ).toBe(false);
  });
});

describe("InteractionActivitySchema", () => {
  it("accepts valid activity", () => {
    expect(
      InteractionActivitySchema.safeParse({
        name: "element_clicked",
        properties_supported: ["element_type"],
      }).success,
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(
      InteractionActivitySchema.safeParse({ name: "", properties_supported: [] }).success,
    ).toBe(false);
  });
});

describe("ProductEntitySchema", () => {
  it("accepts valid entity", () => {
    expect(ProductEntitySchema.safeParse(validProductEntity).success).toBe(true);
  });

  it("rejects invalid id format (uppercase)", () => {
    expect(
      ProductEntitySchema.safeParse({ ...validProductEntity, id: "Board" }).success,
    ).toBe(false);
  });

  it("rejects missing activities", () => {
    const { activities, ...rest } = validProductEntity;
    expect(ProductEntitySchema.safeParse(rest).success).toBe(false);
  });
});

describe("CustomerEntitySchema", () => {
  it("accepts valid entity", () => {
    expect(CustomerEntitySchema.safeParse(validCustomerEntity).success).toBe(true);
  });

  it("rejects missing name", () => {
    const { name, ...rest } = validCustomerEntity;
    expect(CustomerEntitySchema.safeParse(rest).success).toBe(false);
  });
});

describe("InteractionEntitySchema", () => {
  it("accepts valid entity", () => {
    expect(InteractionEntitySchema.safeParse(validInteractionEntity).success).toBe(true);
  });

  it("rejects missing name", () => {
    const { name, ...rest } = validInteractionEntity;
    expect(InteractionEntitySchema.safeParse(rest).success).toBe(false);
  });
});

describe("EntityJsonSchemaSchema", () => {
  it("accepts valid schema", () => {
    expect(
      EntityJsonSchemaSchema.safeParse({
        entityName: "Board",
        perspective: "product",
        schema: { type: "object", properties: {} },
      }).success,
    ).toBe(true);
  });

  it("rejects invalid perspective", () => {
    expect(
      EntityJsonSchemaSchema.safeParse({
        entityName: "Board",
        perspective: "invalid",
        schema: {},
      }).success,
    ).toBe(false);
  });
});

// --- Lifecycle States ---

const validStateCriterion = {
  event_name: "login",
  condition: "count >= 3",
};

const validLifecycleState = {
  name: "activated",
  definition: "User has completed onboarding and performed core action",
  entry_criteria: [validStateCriterion],
  exit_triggers: [{ event_name: "activity_check", condition: "no activity for 14 days" }],
};

const validStateTransition = {
  from_state: "new",
  to_state: "activated",
  trigger_conditions: ["completed onboarding"],
};

const validLifecycleStatesResult = {
  states: [validLifecycleState],
  transitions: [validStateTransition],
  confidence: 0.85,
  sources: ["analysis"],
};

describe("StateCriterionSchema", () => {
  it("accepts valid criterion", () => {
    expect(StateCriterionSchema.safeParse(validStateCriterion).success).toBe(true);
  });

  it("accepts optional threshold", () => {
    expect(
      StateCriterionSchema.safeParse({ ...validStateCriterion, threshold: 5 }).success,
    ).toBe(true);
  });

  it("accepts absent threshold", () => {
    expect(StateCriterionSchema.safeParse(validStateCriterion).success).toBe(true);
  });

  it("rejects empty event_name", () => {
    expect(
      StateCriterionSchema.safeParse({ ...validStateCriterion, event_name: "" }).success,
    ).toBe(false);
  });

  it("rejects empty condition", () => {
    expect(
      StateCriterionSchema.safeParse({ ...validStateCriterion, condition: "" }).success,
    ).toBe(false);
  });

  it("rejects missing event_name", () => {
    const { event_name, ...rest } = validStateCriterion;
    expect(StateCriterionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing condition", () => {
    const { condition, ...rest } = validStateCriterion;
    expect(StateCriterionSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects non-number threshold", () => {
    expect(
      StateCriterionSchema.safeParse({ ...validStateCriterion, threshold: "high" }).success,
    ).toBe(false);
  });
});

describe("LifecycleStateSchema", () => {
  it("accepts valid state", () => {
    expect(LifecycleStateSchema.safeParse(validLifecycleState).success).toBe(true);
  });

  it("accepts optional time_window", () => {
    expect(
      LifecycleStateSchema.safeParse({ ...validLifecycleState, time_window: "7 days" }).success,
    ).toBe(true);
  });

  it("rejects empty name", () => {
    expect(
      LifecycleStateSchema.safeParse({ ...validLifecycleState, name: "" }).success,
    ).toBe(false);
  });

  it("rejects empty definition", () => {
    expect(
      LifecycleStateSchema.safeParse({ ...validLifecycleState, definition: "" }).success,
    ).toBe(false);
  });

  it("rejects missing entry_criteria", () => {
    const { entry_criteria, ...rest } = validLifecycleState;
    expect(LifecycleStateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing exit_triggers", () => {
    const { exit_triggers, ...rest } = validLifecycleState;
    expect(LifecycleStateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects invalid entry_criteria item", () => {
    expect(
      LifecycleStateSchema.safeParse({
        ...validLifecycleState,
        entry_criteria: [{ event_name: "" }],
      }).success,
    ).toBe(false);
  });
});

describe("StateTransitionSchema", () => {
  it("accepts valid transition", () => {
    expect(StateTransitionSchema.safeParse(validStateTransition).success).toBe(true);
  });

  it("accepts optional typical_timeframe", () => {
    expect(
      StateTransitionSchema.safeParse({ ...validStateTransition, typical_timeframe: "2-5 days" })
        .success,
    ).toBe(true);
  });

  it("rejects empty from_state", () => {
    expect(
      StateTransitionSchema.safeParse({ ...validStateTransition, from_state: "" }).success,
    ).toBe(false);
  });

  it("rejects empty to_state", () => {
    expect(
      StateTransitionSchema.safeParse({ ...validStateTransition, to_state: "" }).success,
    ).toBe(false);
  });

  it("rejects missing trigger_conditions", () => {
    const { trigger_conditions, ...rest } = validStateTransition;
    expect(StateTransitionSchema.safeParse(rest).success).toBe(false);
  });
});

describe("LifecycleStatesResultSchema", () => {
  it("accepts valid result", () => {
    expect(LifecycleStatesResultSchema.safeParse(validLifecycleStatesResult).success).toBe(true);
  });

  it("rejects missing states", () => {
    const { states, ...rest } = validLifecycleStatesResult;
    expect(LifecycleStatesResultSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing transitions", () => {
    const { transitions, ...rest } = validLifecycleStatesResult;
    expect(LifecycleStatesResultSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing confidence", () => {
    const { confidence, ...rest } = validLifecycleStatesResult;
    expect(LifecycleStatesResultSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects missing sources", () => {
    const { sources, ...rest } = validLifecycleStatesResult;
    expect(LifecycleStatesResultSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects non-number confidence", () => {
    expect(
      LifecycleStatesResultSchema.safeParse({
        ...validLifecycleStatesResult,
        confidence: "high",
      }).success,
    ).toBe(false);
  });
});
