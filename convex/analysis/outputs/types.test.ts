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
  EntityPropertyDef,
  MapsTo,
  Perspective,
  PerspectiveDistribution,
  TrackingEvent,
  MeasurementSpec,
  UserState,
  UserStateCriterion,
  OutputGenerationResult,
  ValueMoment,
  ValueMomentTier,
  ActivationLevel,
  SignalStrength,
} from "./types";

// --- Helper: valid UserState model ---

function makeUserStateModel(): UserState[] {
  return [
    { name: "new", definition: "Just signed up", criteria: [{ event_name: "user_signed_up", condition: "within 7 days" }] },
    { name: "activated", definition: "Reached activation", criteria: [{ event_name: "activation_reached", condition: "completed onboarding" }] },
    { name: "active", definition: "Regularly engaged", criteria: [{ event_name: "session_started", condition: "3+ sessions in 7 days" }] },
    { name: "at_risk", definition: "Declining engagement", criteria: [{ event_name: "session_started", condition: "no session in 14 days" }] },
    { name: "dormant", definition: "Stopped engaging", criteria: [{ event_name: "session_started", condition: "no session in 30 days" }] },
  ];
}

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
  it("includes id, name, description, isHeartbeat, properties", () => {
    const entity: EntityDefinition = {
      id: "issue",
      name: "Issue",
      description: "A trackable work item in the project",
      isHeartbeat: true,
      properties: [
        { name: "issue_id", type: "string", description: "Unique identifier", isRequired: true },
        { name: "status", type: "string", description: "Current status", isRequired: false },
      ],
    };
    expect(entity.id).toBe("issue");
    expect(entity.name).toBe("Issue");
    expect(entity.description).toContain("trackable work item");
    expect(entity.isHeartbeat).toBe(true);
    expect(entity.properties).toHaveLength(2);
    expect(entity.properties[0].isRequired).toBe(true);
    expect(entity.properties[1].isRequired).toBe(false);
  });

  it("isHeartbeat defaults to false for non-heartbeat entities", () => {
    const entity: EntityDefinition = {
      id: "board",
      name: "Board",
      description: "A kanban board",
      isHeartbeat: false,
      properties: [],
    };
    expect(entity.isHeartbeat).toBe(false);
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

describe("Perspective", () => {
  it("supports customer perspective", () => {
    const p: Perspective = "customer";
    expect(p).toBe("customer");
  });

  it("supports product perspective", () => {
    const p: Perspective = "product";
    expect(p).toBe("product");
  });

  it("supports interaction perspective", () => {
    const p: Perspective = "interaction";
    expect(p).toBe("interaction");
  });
});

describe("TrackingEvent", () => {
  it("includes name, entity_id, description, perspective, properties, trigger_condition, maps_to, category", () => {
    const event: TrackingEvent = {
      name: "dashboard_created",
      entity_id: "dashboard",
      description: "User creates their first analytics dashboard",
      perspective: "customer",
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
    expect(event.perspective).toBe("customer");
    expect(event.properties).toHaveLength(2);
    expect(event.trigger_condition).toContain("Create Dashboard");
    expect(event.maps_to.type).toBe("value_moment");
    expect(event.category).toBe("activation");
  });

  it("works with each MapsTo variant and perspective", () => {
    const vmEvent: TrackingEvent = {
      name: "feature_used",
      entity_id: "feature",
      description: "Core feature usage",
      perspective: "interaction",
      properties: [],
      trigger_condition: "Feature invoked",
      maps_to: { type: "value_moment", moment_id: "vm-002" },
      category: "value",
    };
    expect(vmEvent.maps_to.type).toBe("value_moment");
    expect(vmEvent.perspective).toBe("interaction");

    const alEvent: TrackingEvent = {
      name: "tutorial_completed",
      entity_id: "tutorial",
      description: "Onboarding tutorial finished",
      perspective: "customer",
      properties: [],
      trigger_condition: "Last step completed",
      maps_to: { type: "activation_level", activation_level: 2 },
      category: "activation",
    };
    expect(alEvent.maps_to.type).toBe("activation_level");

    const bothEvent: TrackingEvent = {
      name: "team_invited",
      entity_id: "team",
      description: "User invites team members",
      perspective: "customer",
      properties: [{ name: "invitee_count", type: "number", description: "Number invited", isRequired: true }],
      trigger_condition: "Invite sent successfully",
      maps_to: { type: "both", moment_id: "vm-003", activation_level: 3 },
      category: "expansion",
    };
    expect(bothEvent.maps_to.type).toBe("both");
  });

  it("supports product perspective for system-generated events", () => {
    const event: TrackingEvent = {
      name: "insight_delivered",
      entity_id: "insight",
      description: "System delivers an analytics insight",
      perspective: "product",
      properties: [{ name: "insight_type", type: "string", description: "Type of insight", isRequired: true }],
      trigger_condition: "Insight generation pipeline completes",
      maps_to: { type: "value_moment", moment_id: "vm-001" },
      category: "value",
    };
    expect(event.perspective).toBe("product");
  });
});

describe("UserStateCriterion", () => {
  it("includes event_name and condition", () => {
    const criterion: UserStateCriterion = {
      event_name: "user_signed_up",
      condition: "within last 7 days, no activation events",
    };
    expect(criterion.event_name).toBe("user_signed_up");
    expect(criterion.condition).toContain("7 days");
  });
});

describe("UserState", () => {
  it("includes name, definition, and criteria array", () => {
    const state: UserState = {
      name: "new",
      definition: "Users who signed up but haven't activated",
      criteria: [
        { event_name: "user_signed_up", condition: "within last 7 days" },
        { event_name: "activation_reached", condition: "has not occurred" },
      ],
    };
    expect(state.name).toBe("new");
    expect(state.definition).toContain("signed up");
    expect(state.criteria).toHaveLength(2);
  });

  it("supports all 5 required state names", () => {
    const names = ["new", "activated", "active", "at_risk", "dormant"];
    const states: UserState[] = names.map((name) => ({
      name,
      definition: `Definition for ${name}`,
      criteria: [{ event_name: "test_event", condition: "test condition" }],
    }));
    expect(states).toHaveLength(5);
    expect(states.map((s) => s.name)).toEqual(names);
  });
});

describe("PerspectiveDistribution", () => {
  it("includes customer, product, interaction counts", () => {
    const dist: PerspectiveDistribution = { customer: 5, product: 3, interaction: 7 };
    expect(dist.customer).toBe(5);
    expect(dist.product).toBe(3);
    expect(dist.interaction).toBe(7);
  });

  it("supports zero values", () => {
    const dist: PerspectiveDistribution = { customer: 0, product: 0, interaction: 0 };
    expect(dist.customer).toBe(0);
    expect(dist.product).toBe(0);
    expect(dist.interaction).toBe(0);
  });
});

describe("MeasurementSpec", () => {
  it("includes entities, events, total_events, coverage with perspective_distribution, userStateModel, confidence, sources", () => {
    const spec: MeasurementSpec = {
      entities: [
        {
          id: "signup",
          name: "Signup",
          description: "A user signup",
          isHeartbeat: true,
          properties: [{ name: "signup_id", type: "string", description: "Signup ID", isRequired: true }],
        },
      ],
      events: [
        {
          name: "signup_completed",
          entity_id: "signup",
          description: "User completes signup flow",
          perspective: "customer",
          properties: [{ name: "method", type: "string", description: "Auth method used", isRequired: true }],
          trigger_condition: "Signup form submitted successfully",
          maps_to: { type: "activation_level", activation_level: 1 },
          category: "activation",
        },
      ],
      total_events: 1,
      coverage: {
        activation_levels_covered: [1, 2, 3],
        value_moments_covered: ["vm-001", "vm-002"],
        perspective_distribution: { customer: 1, product: 0, interaction: 0 },
      },
      userStateModel: makeUserStateModel(),
      confidence: 0.8,
      sources: ["https://example.com/docs"],
    };
    expect(spec.entities).toHaveLength(1);
    expect(spec.entities[0].isHeartbeat).toBe(true);
    expect(spec.events).toHaveLength(1);
    expect(spec.events[0].perspective).toBe("customer");
    expect(spec.total_events).toBe(1);
    expect(spec.coverage.activation_levels_covered).toEqual([1, 2, 3]);
    expect(spec.coverage.value_moments_covered).toEqual(["vm-001", "vm-002"]);
    expect(spec.coverage.perspective_distribution).toEqual({ customer: 1, product: 0, interaction: 0 });
    expect(spec.userStateModel).toHaveLength(5);
    expect(spec.confidence).toBe(0.8);
    expect(spec.sources).toHaveLength(1);
  });

  it("supports optional warnings field", () => {
    const spec: MeasurementSpec = {
      entities: [
        { id: "item", name: "Item", description: "An item", isHeartbeat: true, properties: [] },
      ],
      events: [],
      total_events: 0,
      coverage: { activation_levels_covered: [], value_moments_covered: [], perspective_distribution: { customer: 0, product: 0, interaction: 0 } },
      userStateModel: makeUserStateModel(),
      confidence: 0.7,
      sources: [],
      warnings: ["Event 0 'item_created': property 'item_id' duplicates a property on entity 'item'"],
    };
    expect(spec.warnings).toHaveLength(1);
    expect(spec.warnings![0]).toContain("duplicates");
  });

  it("has undefined warnings when not set", () => {
    const spec: MeasurementSpec = {
      entities: [
        { id: "item", name: "Item", description: "An item", isHeartbeat: true, properties: [] },
      ],
      events: [],
      total_events: 0,
      coverage: { activation_levels_covered: [], value_moments_covered: [], perspective_distribution: { customer: 0, product: 0, interaction: 0 } },
      userStateModel: makeUserStateModel(),
      confidence: 0.7,
      sources: [],
    };
    expect(spec.warnings).toBeUndefined();
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
      entities: [
        { id: "item", name: "Item", description: "An item", isHeartbeat: true, properties: [] },
      ],
      events: [],
      total_events: 0,
      coverage: {
        activation_levels_covered: [],
        value_moments_covered: [],
        perspective_distribution: { customer: 0, product: 0, interaction: 0 },
      },
      userStateModel: makeUserStateModel(),
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
        entities: [
          { id: "item", name: "Item", description: "An item", isHeartbeat: true, properties: [] },
        ],
        events: [],
        total_events: 0,
        coverage: {
          activation_levels_covered: [1],
          value_moments_covered: [],
          perspective_distribution: { customer: 0, product: 0, interaction: 0 },
        },
        userStateModel: makeUserStateModel(),
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
