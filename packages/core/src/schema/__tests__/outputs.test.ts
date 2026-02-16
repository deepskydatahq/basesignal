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

const validMeasurementSpec = {
  entities: [
    {
      id: "ent-1",
      name: "User",
      description: "App user",
      isHeartbeat: false,
      properties: [validEntityPropDef],
    },
  ],
  events: [validTrackingEvent],
  total_events: 1,
  coverage: {
    activation_levels_covered: [1, 2],
    value_moments_covered: ["vm-1"],
    perspective_distribution: { customer: 0.5, product: 0.3, interaction: 0.2 },
  },
  userStateModel: [
    {
      name: "Active",
      definition: "Used in last 7 days",
      criteria: [{ event_name: "page_view", condition: "count > 0" }],
    },
  ],
  confidence: 0.8,
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
