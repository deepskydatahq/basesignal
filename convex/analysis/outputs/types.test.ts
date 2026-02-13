import { describe, it, expect } from "vitest";
import type {
  ValueMomentPriority,
  ICPProfile,
  ActivationStage,
  StageTransition,
  ActivationMap,
  EventProperty,
  EntityProperty,
  EntityDefinition,
  MapsTo,
  TrackingEvent,
  MeasurementSpec,
  OutputGenerationResult,
  ValueMoment,
  ValueMomentTier,
  ActivationLevel,
  SignalStrength,
  EntityDefinition,
  EntityPropertyDef,
} from "./types";

describe("ValueMomentPriority", () => {
  it("includes moment_id, priority (1-3), relevance_reason", () => {
    const priority: ValueMomentPriority = {
      moment_id: "vm-001",
      priority: 1,
      relevance_reason: "Core value driver for this ICP",
    };
    expect(priority.moment_id).toBe("vm-001");
    expect(priority.priority).toBe(1);
    expect(priority.relevance_reason).toBe("Core value driver for this ICP");
  });

  it("supports all priority levels 1, 2, 3", () => {
    const p1: ValueMomentPriority = { moment_id: "vm-1", priority: 1, relevance_reason: "High" };
    const p2: ValueMomentPriority = { moment_id: "vm-2", priority: 2, relevance_reason: "Medium" };
    const p3: ValueMomentPriority = { moment_id: "vm-3", priority: 3, relevance_reason: "Low" };
    expect(p1.priority).toBe(1);
    expect(p2.priority).toBe(2);
    expect(p3.priority).toBe(3);
  });
});

describe("ICPProfile", () => {
  it("includes all required fields: id, name, description, value_moment_priorities, activation_triggers, pain_points, success_metrics, confidence, sources", () => {
    const profile: ICPProfile = {
      id: "icp-001",
      name: "Product-Led Growth Manager",
      description: "Leads PLG strategy and optimizes activation funnels",
      value_moment_priorities: [
        { moment_id: "vm-001", priority: 1, relevance_reason: "Directly enables activation measurement" },
      ],
      activation_triggers: ["trial signup", "first dashboard view"],
      pain_points: ["can't measure activation rate", "no visibility into user journeys"],
      success_metrics: ["activation rate > 40%", "time-to-value < 5 min"],
      confidence: 0.85,
      sources: ["https://example.com/features", "https://example.com/customers"],
    };
    expect(profile.id).toBe("icp-001");
    expect(profile.name).toBe("Product-Led Growth Manager");
    expect(profile.description).toContain("PLG strategy");
    expect(profile.value_moment_priorities).toHaveLength(1);
    expect(profile.activation_triggers).toHaveLength(2);
    expect(profile.pain_points).toHaveLength(2);
    expect(profile.success_metrics).toHaveLength(2);
    expect(profile.confidence).toBe(0.85);
    expect(profile.sources).toHaveLength(2);
  });
});

describe("ActivationStage", () => {
  it("includes level, name, signal_strength, trigger_events, value_moments_unlocked, drop_off_risk", () => {
    const stage: ActivationStage = {
      level: 1,
      name: "Explorer",
      signal_strength: "weak",
      trigger_events: ["signup", "first_page_view"],
      value_moments_unlocked: ["vm-001"],
      drop_off_risk: "high",
    };
    expect(stage.level).toBe(1);
    expect(stage.name).toBe("Explorer");
    expect(stage.signal_strength).toBe("weak");
    expect(stage.trigger_events).toHaveLength(2);
    expect(stage.value_moments_unlocked).toEqual(["vm-001"]);
    expect(stage.drop_off_risk).toBe("high");
  });

  it("supports optional drop_off_reasons", () => {
    const stage: ActivationStage = {
      level: 2,
      name: "Learner",
      signal_strength: "medium",
      trigger_events: ["completed_tutorial"],
      value_moments_unlocked: ["vm-002"],
      drop_off_risk: "medium",
      drop_off_reasons: ["complex onboarding", "unclear value prop"],
    };
    expect(stage.drop_off_reasons).toEqual(["complex onboarding", "unclear value prop"]);
  });

  it("has undefined drop_off_reasons when not set", () => {
    const stage: ActivationStage = {
      level: 3,
      name: "Achiever",
      signal_strength: "strong",
      trigger_events: ["shared_dashboard"],
      value_moments_unlocked: ["vm-003"],
      drop_off_risk: "low",
    };
    expect(stage.drop_off_reasons).toBeUndefined();
  });
});

describe("StageTransition", () => {
  it("includes from_level, to_level, trigger_events", () => {
    const transition: StageTransition = {
      from_level: 1,
      to_level: 2,
      trigger_events: ["completed_onboarding"],
    };
    expect(transition.from_level).toBe(1);
    expect(transition.to_level).toBe(2);
    expect(transition.trigger_events).toEqual(["completed_onboarding"]);
  });

  it("supports optional typical_timeframe", () => {
    const transition: StageTransition = {
      from_level: 2,
      to_level: 3,
      trigger_events: ["invited_teammate"],
      typical_timeframe: "1-3 days",
    };
    expect(transition.typical_timeframe).toBe("1-3 days");
  });
});

describe("ActivationMap", () => {
  it("includes stages, transitions, primary_activation_level, confidence, sources", () => {
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
        {
          level: 2,
          name: "Activated",
          signal_strength: "strong",
          trigger_events: ["created_dashboard"],
          value_moments_unlocked: ["vm-001"],
          drop_off_risk: "low",
        },
      ],
      transitions: [
        { from_level: 1, to_level: 2, trigger_events: ["created_dashboard"] },
      ],
      primary_activation_level: 2,
      confidence: 0.75,
      sources: ["https://example.com/onboarding"],
    };
    expect(map.stages).toHaveLength(2);
    expect(map.transitions).toHaveLength(1);
    expect(map.primary_activation_level).toBe(2);
    expect(map.confidence).toBe(0.75);
    expect(map.sources).toHaveLength(1);
  });
});

describe("EventProperty", () => {
  it("includes name, type, description, isRequired", () => {
    const prop: EventProperty = {
      name: "dashboard_id",
      type: "string",
      description: "Unique identifier of the dashboard created",
      isRequired: true,
    };
    expect(prop.name).toBe("dashboard_id");
    expect(prop.type).toBe("string");
    expect(prop.description).toContain("dashboard");
    expect(prop.isRequired).toBe(true);
  });

  it("supports all property types: string, number, boolean, array", () => {
    const types: EventProperty["type"][] = ["string", "number", "boolean", "array"];
    expect(types).toHaveLength(4);
  });
});

describe("EntityProperty", () => {
  it("includes name, type, description, isRequired", () => {
    const prop: EntityProperty = {
      name: "email",
      type: "string",
      description: "User email address",
      isRequired: true,
    };
    expect(prop.name).toBe("email");
    expect(prop.type).toBe("string");
    expect(prop.description).toContain("email");
    expect(prop.isRequired).toBe(true);
  });

  it("supports all property types: string, number, boolean, array", () => {
    const types: EntityProperty["type"][] = ["string", "number", "boolean", "array"];
    expect(types).toHaveLength(4);
  });
});

describe("EntityDefinition", () => {
  it("includes id, name, description, properties", () => {
    const entity: EntityDefinition = {
      id: "entity-user",
      name: "User",
      description: "A platform user account",
      properties: [
        { name: "email", type: "string", description: "Email address", isRequired: true },
        { name: "plan", type: "string", description: "Subscription plan", isRequired: false },
      ],
    };
    expect(entity.id).toBe("entity-user");
    expect(entity.name).toBe("User");
    expect(entity.description).toContain("platform user");
    expect(entity.properties).toHaveLength(2);
    expect(entity.properties[0].isRequired).toBe(true);
    expect(entity.properties[1].isRequired).toBe(false);
  });
});

describe("MapsTo discriminated union", () => {
  it("supports value_moment variant with moment_id", () => {
    const mapsTo: MapsTo = { type: "value_moment", moment_id: "vm-001" };
    expect(mapsTo.type).toBe("value_moment");
    if (mapsTo.type === "value_moment") {
      expect(mapsTo.moment_id).toBe("vm-001");
    }
  });

  it("supports activation_level variant with activation_level", () => {
    const mapsTo: MapsTo = { type: "activation_level", activation_level: 2 };
    expect(mapsTo.type).toBe("activation_level");
    if (mapsTo.type === "activation_level") {
      expect(mapsTo.activation_level).toBe(2);
    }
  });

  it("supports both variant with moment_id and activation_level", () => {
    const mapsTo: MapsTo = { type: "both", moment_id: "vm-003", activation_level: 3 };
    expect(mapsTo.type).toBe("both");
    if (mapsTo.type === "both") {
      expect(mapsTo.moment_id).toBe("vm-003");
      expect(mapsTo.activation_level).toBe(3);
    }
  });
});

describe("EntityDefinition", () => {
  it("includes id, name, description, properties", () => {
    const entity: EntityDefinition = {
      id: "issue",
      name: "Issue",
      description: "A trackable work item",
      properties: [
        { name: "issue_id", type: "string", description: "Unique identifier", isRequired: true },
      ],
    };
    expect(entity.id).toBe("issue");
    expect(entity.name).toBe("Issue");
    expect(entity.description).toContain("trackable work item");
    expect(entity.properties).toHaveLength(1);
  });

  it("EntityPropertyDef includes isRequired flag", () => {
    const prop: EntityPropertyDef = {
      name: "status",
      type: "string",
      description: "Current status",
      isRequired: false,
    };
    expect(prop.isRequired).toBe(false);
    expect(prop.type).toBe("string");
  });

  it("supports optional isHeartbeat field", () => {
    const heartbeat: EntityDefinition = {
      id: "board",
      name: "Board",
      description: "Primary collaboration canvas",
      properties: [{ name: "board_id", type: "string", description: "ID", isRequired: true }],
      isHeartbeat: true,
    };
    expect(heartbeat.isHeartbeat).toBe(true);

    const nonHeartbeat: EntityDefinition = {
      id: "account",
      name: "Account",
      description: "An organization",
      properties: [],
    };
    expect(nonHeartbeat.isHeartbeat).toBeUndefined();
  });
});

describe("TrackingEvent", () => {
  it("includes name, entity_id, description, properties, trigger_condition, maps_to, category", () => {
    const event: TrackingEvent = {
      name: "dashboard_created",
      entity_id: "dashboard",
      description: "User creates their first analytics dashboard",
      properties: [
        { name: "dashboard_id", type: "string", description: "Dashboard identifier", isRequired: true },
        { name: "template_used", type: "boolean", description: "Whether a template was used", isRequired: false },
      ],
      trigger_condition: "User clicks 'Create Dashboard' and saves",
      maps_to: { type: "value_moment", moment_id: "vm-001" },
      category: "activation",
    };
    expect(event.name).toBe("dashboard_created");
    expect(event.entity_id).toBe("dashboard");
    expect(event.description).toContain("first analytics dashboard");
    expect(event.properties).toHaveLength(2);
    expect(event.trigger_condition).toContain("Create Dashboard");
    expect(event.maps_to.type).toBe("value_moment");
    expect(event.category).toBe("activation");
  });

  it("works with each MapsTo variant", () => {
    const vmEvent: TrackingEvent = {
      name: "feature_used",
      entity_id: "feature",
      description: "Core feature usage",
      properties: [],
      trigger_condition: "Feature invoked",
      maps_to: { type: "value_moment", moment_id: "vm-002" },
      category: "engagement",
    };
    expect(vmEvent.maps_to.type).toBe("value_moment");

    const alEvent: TrackingEvent = {
      name: "tutorial_completed",
      entity_id: "tutorial",
      description: "Onboarding tutorial finished",
      properties: [],
      trigger_condition: "Last step completed",
      maps_to: { type: "activation_level", activation_level: 2 },
      category: "onboarding",
    };
    expect(alEvent.maps_to.type).toBe("activation_level");

    const bothEvent: TrackingEvent = {
      name: "team_invited",
      entity_id: "team",
      description: "User invites team members",
      properties: [{ name: "invitee_count", type: "number", description: "Number invited", isRequired: true }],
      trigger_condition: "Invite sent successfully",
      maps_to: { type: "both", moment_id: "vm-003", activation_level: 3 },
      category: "collaboration",
    };
    expect(bothEvent.maps_to.type).toBe("both");
  });

  it("supports optional entity_id", () => {
    const eventWithEntityId: TrackingEvent = {
      name: "issue_created",
      description: "New issue created",
      properties: [],
      trigger_condition: "Form submitted",
      maps_to: { type: "activation_level", activation_level: 1 },
      category: "activation",
      entity_id: "entity-issue",
    };
    expect(eventWithEntityId.entity_id).toBe("entity-issue");
  });

  it("has undefined entity_id when not set", () => {
    const eventWithout: TrackingEvent = {
      name: "issue_created",
      description: "New issue created",
      properties: [],
      trigger_condition: "Form submitted",
      maps_to: { type: "activation_level", activation_level: 1 },
      category: "activation",
    };
    expect(eventWithout.entity_id).toBeUndefined();
  });

  it("supports optional perspective field", () => {
    const eventWithPerspective: TrackingEvent = {
      name: "board_created",
      entity_id: "board",
      description: "User creates a board",
      properties: [],
      trigger_condition: "Board created",
      maps_to: { type: "activation_level", activation_level: 1 },
      category: "activation",
      perspective: "customer",
    };
    expect(eventWithPerspective.perspective).toBe("customer");

    const eventWithout: TrackingEvent = {
      name: "board_opened",
      entity_id: "board",
      description: "User opens a board",
      properties: [],
      trigger_condition: "Board opened",
      maps_to: { type: "activation_level", activation_level: 1 },
      category: "retention",
    };
    expect(eventWithout.perspective).toBeUndefined();
  });
});

describe("MeasurementSpec", () => {
  it("includes entities, events, total_events, coverage, confidence, sources", () => {
    const spec: MeasurementSpec = {
      entities: [
        {
          id: "signup",
          name: "Signup",
          description: "A user signup",
          properties: [{ name: "signup_id", type: "string", description: "Signup ID", isRequired: true }],
        },
      ],
      events: [
        {
          name: "signup_completed",
          entity_id: "signup",
          description: "User completes signup flow",
          properties: [{ name: "method", type: "string", description: "Auth method used", isRequired: true }],
          trigger_condition: "Signup form submitted successfully",
          maps_to: { type: "activation_level", activation_level: 1 },
          category: "acquisition",
        },
      ],
      total_events: 1,
      coverage: {
        activation_levels_covered: [1, 2, 3],
        value_moments_covered: ["vm-001", "vm-002"],
      },
      confidence: 0.8,
      sources: ["https://example.com/docs"],
    };
    expect(spec.entities).toHaveLength(1);
    expect(spec.events).toHaveLength(1);
    expect(spec.total_events).toBe(1);
    expect(spec.coverage.activation_levels_covered).toEqual([1, 2, 3]);
    expect(spec.coverage.value_moments_covered).toEqual(["vm-001", "vm-002"]);
    expect(spec.confidence).toBe(0.8);
    expect(spec.sources).toHaveLength(1);
  });

  it("supports optional entities field", () => {
    const specWithEntities: MeasurementSpec = {
      events: [],
      total_events: 0,
      coverage: { activation_levels_covered: [], value_moments_covered: [] },
      confidence: 0.7,
      sources: [],
      entities: [
        {
          id: "entity-user",
          name: "User",
          description: "A platform user",
          properties: [
            { name: "email", type: "string", description: "Email", isRequired: true },
          ],
        },
      ],
    };
    expect(specWithEntities.entities).toHaveLength(1);
    expect(specWithEntities.entities![0].name).toBe("User");
  });

  it("has undefined entities when not set", () => {
    const specWithout: MeasurementSpec = {
      events: [],
      total_events: 0,
      coverage: { activation_levels_covered: [], value_moments_covered: [] },
      confidence: 0.7,
      sources: [],
    };
    expect(specWithout.entities).toBeUndefined();
  });

  it("supports optional userStateModel field", () => {
    const specWithModel: MeasurementSpec = {
      entities: [],
      events: [],
      total_events: 0,
      coverage: { activation_levels_covered: [], value_moments_covered: [] },
      confidence: 0.7,
      sources: [],
      userStateModel: [
        { state: "new", criteria: "Just signed up" },
        { state: "activated", criteria: "Completed onboarding" },
        { state: "active", criteria: "Regular usage" },
        { state: "at_risk", criteria: "Declining engagement" },
        { state: "dormant", criteria: "No activity 30+ days" },
      ],
    };
    expect(specWithModel.userStateModel).toHaveLength(5);

    const specWithout: MeasurementSpec = {
      entities: [],
      events: [],
      total_events: 0,
      coverage: { activation_levels_covered: [], value_moments_covered: [] },
      confidence: 0.7,
      sources: [],
    };
    expect(specWithout.userStateModel).toBeUndefined();
  });
});

describe("confidence and sources on all output types", () => {
  it("ICPProfile has confidence and sources", () => {
    const profile: ICPProfile = {
      id: "icp-1",
      name: "Test",
      description: "Test ICP",
      value_moment_priorities: [],
      activation_triggers: [],
      pain_points: [],
      success_metrics: [],
      confidence: 0.9,
      sources: ["source1"],
    };
    expect(profile.confidence).toBe(0.9);
    expect(profile.sources).toEqual(["source1"]);
  });

  it("ActivationMap has confidence and sources", () => {
    const map: ActivationMap = {
      stages: [],
      transitions: [],
      primary_activation_level: 1,
      confidence: 0.7,
      sources: ["source2"],
    };
    expect(map.confidence).toBe(0.7);
    expect(map.sources).toEqual(["source2"]);
  });

  it("MeasurementSpec has confidence and sources", () => {
    const spec: MeasurementSpec = {
      entities: [],
      events: [],
      total_events: 0,
      coverage: {
        activation_levels_covered: [],
        value_moments_covered: [],
      },
      confidence: 0.6,
      sources: ["source3"],
    };
    expect(spec.confidence).toBe(0.6);
    expect(spec.sources).toEqual(["source3"]);
  });
});

describe("OutputGenerationResult", () => {
  it("wraps all three output artifacts with metadata", () => {
    const result: OutputGenerationResult = {
      productId: "products:abc123",
      icp_profiles: [
        {
          id: "icp-001",
          name: "PLG Manager",
          description: "Leads product-led growth",
          value_moment_priorities: [{ moment_id: "vm-001", priority: 1, relevance_reason: "Core" }],
          activation_triggers: ["trial start"],
          pain_points: ["no metrics"],
          success_metrics: ["activation > 40%"],
          confidence: 0.85,
          sources: ["https://example.com"],
        },
      ],
      activation_map: {
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
        transitions: [],
        primary_activation_level: 1,
        confidence: 0.75,
        sources: ["https://example.com"],
      },
      measurement_spec: {
        entities: [],
        events: [],
        total_events: 0,
        coverage: {
          activation_levels_covered: [1],
          value_moments_covered: [],
        },
        confidence: 0.7,
        sources: ["https://example.com"],
      },
      generated_at: "2026-02-08T12:00:00Z",
      execution_time_ms: 3200,
    };
    expect(result.productId).toBe("products:abc123");
    expect(result.icp_profiles).toHaveLength(1);
    expect(result.activation_map.stages).toHaveLength(1);
    expect(result.measurement_spec.total_events).toBe(0);
    expect(result.generated_at).toBe("2026-02-08T12:00:00Z");
    expect(result.execution_time_ms).toBe(3200);
  });
});

describe("re-exported upstream types", () => {
  it("ValueMoment is importable", () => {
    const moment: ValueMoment = {
      id: "vm-001",
      name: "Test moment",
      description: "A test value moment",
      tier: 1,
      lenses: ["jtbd"],
      lens_count: 1,
      roles: ["User"],
      product_surfaces: ["Dashboard"],
      contributing_candidates: ["c-001"],
    };
    expect(moment.id).toBe("vm-001");
    expect(moment.tier).toBe(1);
  });

  it("ValueMomentTier is importable", () => {
    const tiers: ValueMomentTier[] = [1, 2, 3];
    expect(tiers).toHaveLength(3);
  });

  it("SignalStrength is importable", () => {
    const strengths: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];
    expect(strengths).toHaveLength(4);
  });

  it("ActivationLevel is importable", () => {
    const level: ActivationLevel = {
      level: 1,
      name: "Explorer",
      signalStrength: "weak",
      criteria: [{ action: "signup", count: 1 }],
      reasoning: "Initial exploration",
      confidence: 0.7,
      evidence: [{ url: "https://example.com", excerpt: "Sign up to get started" }],
    };
    expect(level.level).toBe(1);
    expect(level.signalStrength).toBe("weak");
  });
});
