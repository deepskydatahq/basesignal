import { describe, it, expect } from "vitest";
import {
  MEASUREMENT_SPEC_SYSTEM_PROMPT,
  buildMeasurementSpecPrompt,
  parseMeasurementSpecResponse,
  parseUserStateModel,
  computePerspectiveDistribution,
} from "./generateMeasurementSpec";
import type { MeasurementInputData, TrackingEvent } from "./types";

// --- Fixture Factories ---

function makeMeasurementInputData(
  overrides?: Partial<MeasurementInputData>,
): MeasurementInputData {
  return {
    value_moments: [
      {
        id: "vm-1",
        name: "First Insight Delivered",
        description: "User sees their first actionable insight",
        tier: 1 as const,
        lenses: ["jtbd"],
        lens_count: 3,
        roles: ["product_manager"],
        product_surfaces: ["dashboard", "reports"],
        contributing_candidates: ["c-1"],
      },
      {
        id: "vm-2",
        name: "Team Collaboration Started",
        description: "User invites team and starts collaborating",
        tier: 2 as const,
        lenses: ["outcomes"],
        lens_count: 2,
        roles: ["team_lead"],
        product_surfaces: ["workspace"],
        contributing_candidates: ["c-2"],
      },
    ],
    activation_levels: [
      {
        level: 1,
        name: "explorer",
        signalStrength: "weak",
        criteria: [
          { action: "create_project", count: 1 },
          { action: "view_dashboard", count: 1 },
        ],
        reasoning: "Initial exploration",
        confidence: 0.7,
        evidence: [],
      },
      {
        level: 2,
        name: "builder",
        signalStrength: "medium",
        criteria: [
          { action: "create_issue", count: 3, timeWindow: "7 days" },
        ],
        reasoning: "Active usage",
        confidence: 0.8,
        evidence: [],
      },
      {
        level: 3,
        name: "champion",
        signalStrength: "strong",
        criteria: [{ action: "invite_team_member", count: 2 }],
        reasoning: "Team adoption",
        confidence: 0.6,
        evidence: [],
      },
    ],
    icp_profiles: [
      {
        id: "icp-1",
        name: "Product Manager",
        description: "Manages roadmap and priorities",
        value_moment_priorities: [],
        activation_triggers: ["create_roadmap", "prioritize_features"],
        pain_points: ["lack of visibility", "manual reporting"],
        success_metrics: ["roadmap velocity"],
        confidence: 0.7,
        sources: [],
      },
    ],
    activation_map: {
      stages: [
        {
          level: 1,
          name: "Explorer",
          signal_strength: "weak",
          trigger_events: ["project_created"],
          value_moments_unlocked: ["vm-1"],
          drop_off_risk: "high",
        },
        {
          level: 2,
          name: "Builder",
          signal_strength: "medium",
          trigger_events: ["issue_created"],
          value_moments_unlocked: ["vm-2"],
          drop_off_risk: "medium",
        },
      ],
      transitions: [
        { from_level: 1, to_level: 2, trigger_events: ["issue_created"] },
      ],
      primary_activation_level: 2,
      confidence: 0.7,
      sources: [],
    },
    activation_event_templates: [
      {
        level: 1,
        criteria: [{ action: "create_project", count: 1 }],
        suggested_event_name: "project_created",
      },
    ],
    value_event_templates: [
      {
        moment_id: "vm-1",
        moment_name: "First Insight Delivered",
        tier: 1 as const,
        surfaces: ["dashboard", "reports"],
        suggested_event_name: "insight_delivered",
      },
    ],
    ...overrides,
  };
}

function makeValidEntity(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "issue",
    name: "Issue",
    description: "A trackable work item in the project",
    isHeartbeat: false,
    properties: [
      {
        name: "issue_id",
        type: "string",
        description: "Unique identifier for the issue",
        isRequired: true,
      },
    ],
    ...overrides,
  };
}

function makeMinimalEntitySet(): Record<string, unknown>[] {
  return [
    makeValidEntity({ id: "issue", name: "Issue", description: "A work item", isHeartbeat: true }),
    makeValidEntity({ id: "project", name: "Project", description: "A project container" }),
    makeValidEntity({ id: "board", name: "Board", description: "A kanban board" }),
  ];
}

function makeValidEvent(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    name: "issue_created",
    entity_id: "issue",
    description: "User creates a new issue",
    perspective: "customer",
    properties: [
      {
        name: "title",
        type: "string",
        description: "Title of the issue",
        required: true,
      },
      {
        name: "project_id",
        type: "string",
        description: "Project the issue belongs to",
        required: true,
      },
    ],
    trigger_condition: "When a user submits a new issue form",
    maps_to: { type: "activation_level", activation_level: 2 },
    category: "activation",
    ...overrides,
  };
}

function makeValidUserStateModel(eventNames?: { newEvent?: string; activatedEvent?: string; activeEvent?: string }): Record<string, unknown>[] {
  const n = eventNames?.newEvent ?? "issue_created";
  const a = eventNames?.activatedEvent ?? "issue_created";
  const s = eventNames?.activeEvent ?? "issue_created";
  return [
    { name: "new", definition: "Just signed up", criteria: [{ event_name: n, condition: "within 7 days" }] },
    { name: "activated", definition: "Reached activation", criteria: [{ event_name: a, condition: "completed onboarding" }] },
    { name: "active", definition: "Regularly engaged", criteria: [{ event_name: s, condition: "3+ sessions in 7 days" }] },
    { name: "at_risk", definition: "Declining engagement", criteria: [{ event_name: s, condition: "no session in 14 days" }] },
    { name: "dormant", definition: "Stopped engaging", criteria: [{ event_name: s, condition: "no session in 30 days" }] },
  ];
}

function makeThreePerspectiveEvents(): Record<string, unknown>[] {
  return [
    makeValidEvent({ name: "issue_created", entity_id: "issue", perspective: "customer", maps_to: { type: "activation_level", activation_level: 2 } }),
    makeValidEvent({ name: "board_updated", entity_id: "board", perspective: "product", maps_to: { type: "value_moment", moment_id: "vm-1" } }),
    makeValidEvent({ name: "project_viewed", entity_id: "project", perspective: "interaction", maps_to: { type: "activation_level", activation_level: 1 } }),
  ];
}

function makeValidResponse(
  overrides?: Partial<{ entities: unknown[]; events: unknown[]; confidence: number; userStateModel: unknown[] }>,
): string {
  const data = {
    entities: overrides?.entities ?? makeMinimalEntitySet(),
    events: overrides?.events ?? makeThreePerspectiveEvents(),
    userStateModel: overrides?.userStateModel ?? makeValidUserStateModel(),
    confidence: overrides?.confidence ?? 0.75,
  };
  return JSON.stringify(data);
}

// --- System Prompt Tests ---

describe("MEASUREMENT_SPEC_SYSTEM_PROMPT", () => {
  it("contains entity-first generation instructions", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Define Entities (5-10)");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("entity_id");
  });

  it("contains entity schema definition with isHeartbeat", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("isRequired");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("/^[a-z][a-z0-9_]*$/");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("isHeartbeat");
  });

  it("contains entity_action naming regex", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain(
      "/^[a-z][a-z0-9]*_[a-z][a-z0-9_]*$/",
    );
  });

  it("contains all four category names", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("activation");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("value");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("retention");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("expansion");
  });

  it("contains maps_to requirement", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("maps_to");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("value_moment");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("activation_level");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("both");
  });

  it("contains property count requirement", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("at least 2 properties");
  });

  it("contains target event range", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("15-25");
  });

  it("requires confidence field", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("confidence");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("between 0 and 1");
  });

  it("includes entities in output format example", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain('"entities"');
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain('"entity_id": "issue"');
  });

  it("contains perspective requirement", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("perspective");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain('"customer"');
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain('"product"');
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain('"interaction"');
  });

  it("contains user state model requirement with 5 states", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("User State Model");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("new");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("activated");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("active");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("at_risk");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("dormant");
  });

  it("warns about event property duplication", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Avoid duplicating property names");
  });
});

// --- buildMeasurementSpecPrompt Tests ---

describe("buildMeasurementSpecPrompt", () => {
  it("returns system prompt as MEASUREMENT_SPEC_SYSTEM_PROMPT", () => {
    const input = makeMeasurementInputData();
    const result = buildMeasurementSpecPrompt(input);
    expect(result.system).toBe(MEASUREMENT_SPEC_SYSTEM_PROMPT);
  });

  it("user prompt includes value moment names, tiers, and product surfaces", () => {
    const input = makeMeasurementInputData();
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("First Insight Delivered");
    expect(user).toContain("tier: 1");
    expect(user).toContain("dashboard, reports");
    expect(user).toContain("Team Collaboration Started");
    expect(user).toContain("tier: 2");
  });

  it("user prompt includes activation level criteria", () => {
    const input = makeMeasurementInputData();
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("Level 1: explorer");
    expect(user).toContain("action: create_project");
    expect(user).toContain("count: 1");
    expect(user).toContain("Level 2: builder");
    expect(user).toContain("action: create_issue");
    expect(user).toContain("count: 3");
    expect(user).toContain("timeWindow: 7 days");
  });

  it("user prompt includes ICP profile names when present", () => {
    const input = makeMeasurementInputData();
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("ICP Profiles");
    expect(user).toContain("Product Manager");
    expect(user).toContain("create_roadmap");
    expect(user).toContain("lack of visibility");
  });

  it("user prompt omits ICP section when icp_profiles is empty", () => {
    const input = makeMeasurementInputData({ icp_profiles: [] });
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).not.toContain("ICP Profiles");
  });

  it("user prompt includes activation map stages when present", () => {
    const input = makeMeasurementInputData();
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("Activation Map Stages");
    expect(user).toContain("Stage 1: Explorer");
    expect(user).toContain("project_created");
    expect(user).toContain("vm-1");
  });

  it("user prompt omits activation map section when null", () => {
    const input = makeMeasurementInputData({ activation_map: null });
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).not.toContain("Activation Map Stages");
  });

  it("user prompt includes activation event templates", () => {
    const input = makeMeasurementInputData();
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("Activation Event Templates");
    expect(user).toContain("project_created");
  });

  it("user prompt includes value event templates", () => {
    const input = makeMeasurementInputData();
    const { user } = buildMeasurementSpecPrompt(input);
    expect(user).toContain("Value Event Templates");
    expect(user).toContain("insight_delivered");
  });
});

// --- parseMeasurementSpecResponse: Entity Validation ---

describe("parseMeasurementSpecResponse entity validation", () => {
  it("parses valid entities with correct fields including isHeartbeat", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.entities).toHaveLength(3);
    expect(spec.entities[0].id).toBe("issue");
    expect(spec.entities[0].name).toBe("Issue");
    expect(spec.entities[0].description).toBe("A work item");
    expect(spec.entities[0].isHeartbeat).toBe(true);
    expect(spec.entities[0].properties).toHaveLength(1);
    expect(spec.entities[1].isHeartbeat).toBe(false);
    expect(spec.entities[2].isHeartbeat).toBe(false);
  });

  it("validates entity property fields", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    const prop = spec.entities[0].properties[0];
    expect(prop.name).toBe("issue_id");
    expect(prop.type).toBe("string");
    expect(prop.description).toBe("Unique identifier for the issue");
    expect(prop.isRequired).toBe(true);
  });

  describe("entity count bounds", () => {
    it("rejects fewer than 3 entities", () => {
      const response = makeValidResponse({
        entities: [
          makeValidEntity({ id: "a", isHeartbeat: true }),
          makeValidEntity({ id: "b" }),
        ],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Expected 3-15 entities, got 2",
      );
    });

    it("rejects more than 15 entities", () => {
      const entities = Array.from({ length: 16 }, (_, i) =>
        makeValidEntity({ id: `entity${i}`, name: `Entity ${i}`, description: `Entity ${i} desc`, isHeartbeat: i === 0 }),
      );
      const response = makeValidResponse({ entities });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Expected 3-15 entities, got 16",
      );
    });

    it("accepts exactly 3 entities (lower bound)", () => {
      const response = makeValidResponse();
      expect(() => parseMeasurementSpecResponse(response)).not.toThrow();
    });

    it("accepts exactly 15 entities (upper bound)", () => {
      const entities = Array.from({ length: 15 }, (_, i) =>
        makeValidEntity({ id: `entity${i}`, name: `Entity ${i}`, description: `Entity ${i} desc`, isHeartbeat: i === 0 }),
      );
      const events = [makeValidEvent({ entity_id: "entity0" })];
      const response = makeValidResponse({ entities, events });
      expect(() => parseMeasurementSpecResponse(response)).not.toThrow();
    });
  });

  describe("entity ID format", () => {
    it("accepts valid entity IDs", () => {
      const validIds = ["widget", "feature_flag", "a1", "my_entity_2"];
      for (const id of validIds) {
        const entities = [
          ...makeMinimalEntitySet().slice(0, 2),
          makeValidEntity({ id, name: "Test", description: "Test entity" }),
        ];
        const events = [makeValidEvent({ entity_id: "issue" })];
        const response = makeValidResponse({ entities, events });
        expect(() => parseMeasurementSpecResponse(response)).not.toThrow();
      }
    });

    it("rejects entity IDs starting with uppercase", () => {
      const entities = [
        ...makeMinimalEntitySet().slice(0, 2),
        makeValidEntity({ id: "Issue", name: "Issue", description: "Test" }),
      ];
      const response = makeValidResponse({ entities });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "does not match format",
      );
    });

    it("rejects entity IDs starting with digit", () => {
      const entities = [
        ...makeMinimalEntitySet().slice(0, 2),
        makeValidEntity({ id: "1issue", name: "Issue", description: "Test" }),
      ];
      const response = makeValidResponse({ entities });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "does not match format",
      );
    });
  });

  it("rejects duplicate entity IDs", () => {
    const entities = [
      makeValidEntity({ id: "issue", isHeartbeat: true }),
      makeValidEntity({ id: "project", name: "Project", description: "A project" }),
      makeValidEntity({ id: "issue", name: "Duplicate", description: "Duplicate" }),
    ];
    const response = makeValidResponse({ entities });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "duplicate entity id 'issue'",
    );
  });

  it("rejects entity missing id", () => {
    const entities = [
      ...makeMinimalEntitySet().slice(0, 2),
      { name: "NoId", description: "Missing id", properties: [] },
    ];
    const response = makeValidResponse({ entities });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Entity 2: missing id",
    );
  });

  it("rejects entity missing name", () => {
    const entities = [
      ...makeMinimalEntitySet().slice(0, 2),
      { id: "noname", description: "Missing name", properties: [] },
    ];
    const response = makeValidResponse({ entities });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Entity 2: missing name",
    );
  });

  it("rejects entity missing description", () => {
    const entities = [
      ...makeMinimalEntitySet().slice(0, 2),
      { id: "nodesc", name: "NoDesc", properties: [] },
    ];
    const response = makeValidResponse({ entities });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Entity 2: missing description",
    );
  });

  it("rejects entity missing properties array", () => {
    const entities = [
      ...makeMinimalEntitySet().slice(0, 2),
      { id: "noprops", name: "NoProps", description: "Missing properties" },
    ];
    const response = makeValidResponse({ entities });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Entity 2: missing properties array",
    );
  });

  it("rejects entity property with invalid type", () => {
    const entities = [
      ...makeMinimalEntitySet().slice(0, 2),
      makeValidEntity({
        id: "badprop",
        name: "BadProp",
        description: "Bad prop type",
        properties: [{ name: "x", type: "date", description: "bad", isRequired: false }],
      }),
    ];
    const response = makeValidResponse({ entities });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Entity 2: property 'x' has invalid type 'date'",
    );
  });
});

// --- parseMeasurementSpecResponse: Heartbeat Validation ---

describe("parseMeasurementSpecResponse heartbeat validation", () => {
  it("accepts exactly one heartbeat entity", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    const heartbeats = spec.entities.filter((e) => e.isHeartbeat);
    expect(heartbeats).toHaveLength(1);
    expect(heartbeats[0].id).toBe("issue");
  });

  it("rejects zero heartbeat entities", () => {
    const entities = [
      makeValidEntity({ id: "issue", name: "Issue", description: "A work item", isHeartbeat: false }),
      makeValidEntity({ id: "project", name: "Project", description: "A project" }),
      makeValidEntity({ id: "board", name: "Board", description: "A board" }),
    ];
    const response = makeValidResponse({ entities });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Expected exactly 1 heartbeat entity, got 0",
    );
  });

  it("rejects multiple heartbeat entities", () => {
    const entities = [
      makeValidEntity({ id: "issue", name: "Issue", description: "A work item", isHeartbeat: true }),
      makeValidEntity({ id: "project", name: "Project", description: "A project", isHeartbeat: true }),
      makeValidEntity({ id: "board", name: "Board", description: "A board" }),
    ];
    const response = makeValidResponse({ entities });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Expected exactly 1 heartbeat entity, got 2",
    );
  });

  it("defaults isHeartbeat to false when not provided", () => {
    const entities = [
      makeValidEntity({ id: "issue", name: "Issue", description: "A work item", isHeartbeat: true }),
      { id: "project", name: "Project", description: "A project", properties: [] },
      { id: "board", name: "Board", description: "A board", properties: [] },
    ];
    const response = makeValidResponse({ entities });
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.entities[1].isHeartbeat).toBe(false);
    expect(spec.entities[2].isHeartbeat).toBe(false);
  });
});

// --- parseMeasurementSpecResponse: Perspective Validation ---

describe("parseMeasurementSpecResponse perspective validation", () => {
  it("accepts all three valid perspectives", () => {
    for (const perspective of ["customer", "product", "interaction"]) {
      const response = makeValidResponse({
        events: [makeValidEvent({ perspective })],
      });
      expect(() => parseMeasurementSpecResponse(response)).not.toThrow();
    }
  });

  it("parses perspective field on events", () => {
    const response = makeValidResponse({
      events: [makeValidEvent({ perspective: "product" })],
    });
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.events[0].perspective).toBe("product");
  });

  it("rejects missing perspective", () => {
    const { perspective: _, ...eventNoPerspective } = makeValidEvent() as Record<string, unknown>;
    const response = makeValidResponse({
      events: [eventNoPerspective],
    });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Event 0: invalid perspective 'undefined'",
    );
  });

  it("rejects invalid perspective value", () => {
    const response = makeValidResponse({
      events: [makeValidEvent({ perspective: "observer" })],
    });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Event 0: invalid perspective 'observer'. Must be one of: customer, product, interaction",
    );
  });
});

// --- parseMeasurementSpecResponse: Property Duplication Warnings ---

describe("parseMeasurementSpecResponse property duplication warnings", () => {
  it("warns when event property duplicates parent entity property name", () => {
    const entities = [
      makeValidEntity({
        id: "issue",
        name: "Issue",
        description: "A work item",
        isHeartbeat: true,
        properties: [
          { name: "issue_id", type: "string", description: "ID", isRequired: true },
          { name: "status", type: "string", description: "Status", isRequired: true },
        ],
      }),
      makeValidEntity({ id: "project", name: "Project", description: "A project" }),
      makeValidEntity({ id: "board", name: "Board", description: "A board" }),
    ];
    const events = [
      makeValidEvent({
        name: "issue_created", entity_id: "issue", perspective: "customer",
        properties: [
          { name: "issue_id", type: "string", description: "Duplicated!", required: true },
          { name: "assignee", type: "string", description: "New prop", required: true },
        ],
      }),
      makeValidEvent({ name: "board_updated", entity_id: "board", perspective: "product", maps_to: { type: "value_moment", moment_id: "vm-1" } }),
      makeValidEvent({ name: "project_viewed", entity_id: "project", perspective: "interaction", maps_to: { type: "activation_level", activation_level: 1 } }),
    ];
    const response = makeValidResponse({ entities, events });
    const spec = parseMeasurementSpecResponse(response);
    const dupWarnings = spec.warnings?.filter((w) => w.includes("duplicates")) ?? [];
    expect(dupWarnings).toHaveLength(1);
    expect(dupWarnings[0]).toContain("property 'issue_id' duplicates a property on entity 'issue'");
  });

  it("does not warn when event properties are unique", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.warnings).toBeUndefined();
  });

  it("generates multiple warnings for multiple duplications", () => {
    const entities = [
      makeValidEntity({
        id: "issue",
        name: "Issue",
        description: "A work item",
        isHeartbeat: true,
        properties: [
          { name: "issue_id", type: "string", description: "ID", isRequired: true },
          { name: "status", type: "string", description: "Status", isRequired: true },
        ],
      }),
      makeValidEntity({ id: "project", name: "Project", description: "A project" }),
      makeValidEntity({ id: "board", name: "Board", description: "A board" }),
    ];
    const events = [
      makeValidEvent({
        name: "issue_created", entity_id: "issue", perspective: "customer",
        properties: [
          { name: "issue_id", type: "string", description: "Dup 1", required: true },
          { name: "status", type: "string", description: "Dup 2", required: true },
        ],
      }),
      makeValidEvent({ name: "board_updated", entity_id: "board", perspective: "product", maps_to: { type: "value_moment", moment_id: "vm-1" } }),
      makeValidEvent({ name: "project_viewed", entity_id: "project", perspective: "interaction", maps_to: { type: "activation_level", activation_level: 1 } }),
    ];
    const response = makeValidResponse({ entities, events });
    const spec = parseMeasurementSpecResponse(response);
    const dupWarnings = spec.warnings?.filter((w) => w.includes("duplicates")) ?? [];
    expect(dupWarnings).toHaveLength(2);
    expect(dupWarnings[0]).toContain("issue_id");
    expect(dupWarnings[1]).toContain("status");
  });
});

// --- parseMeasurementSpecResponse: Entity-Event Linkage ---

describe("parseMeasurementSpecResponse entity_id validation", () => {
  it("accepts event with entity_id referencing a defined entity", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.events[0].entity_id).toBe("issue");
  });

  it("rejects event missing entity_id", () => {
    const { entity_id: _, ...eventWithoutEntityId } = makeValidEvent() as Record<string, unknown>;
    const response = makeValidResponse({
      events: [eventWithoutEntityId],
    });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Event 0: missing entity_id",
    );
  });

  it("rejects event with entity_id not referencing any defined entity", () => {
    const response = makeValidResponse({
      events: [makeValidEvent({ entity_id: "nonexistent" })],
    });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Event 0: entity_id 'nonexistent' does not reference a defined entity",
    );
  });

  it("allows events to reference different entities", () => {
    const events = [
      makeValidEvent({ name: "issue_created", entity_id: "issue" }),
      makeValidEvent({ name: "project_archived", entity_id: "project" }),
      makeValidEvent({ name: "board_updated", entity_id: "board" }),
    ];
    const response = makeValidResponse({ events });
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.events[0].entity_id).toBe("issue");
    expect(spec.events[1].entity_id).toBe("project");
    expect(spec.events[2].entity_id).toBe("board");
  });
});

// --- parseMeasurementSpecResponse: Structure Tests ---

describe("parseMeasurementSpecResponse", () => {
  it("parses valid JSON into MeasurementSpec with entities, events, and userStateModel", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);

    expect(spec.entities).toHaveLength(3);
    expect(spec.events).toHaveLength(3);
    expect(spec.events[0].name).toBe("issue_created");
    expect(spec.events[0].entity_id).toBe("issue");
    expect(spec.events[0].perspective).toBe("customer");
    expect(spec.events[1].perspective).toBe("product");
    expect(spec.events[2].perspective).toBe("interaction");
    expect(spec.total_events).toBe(3);
    expect(spec.confidence).toBe(0.75);
    expect(spec.coverage.activation_levels_covered).toEqual([1, 2]);
    expect(spec.coverage.value_moments_covered).toEqual(["vm-1"]);
    expect(spec.coverage.perspective_distribution).toEqual({ customer: 1, product: 1, interaction: 1 });
    expect(spec.userStateModel).toHaveLength(5);
  });

  it("extracts JSON from markdown code fences", () => {
    const response =
      "```json\n" + makeValidResponse() + "\n```";
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.events).toHaveLength(3);
    expect(spec.events[0].name).toBe("issue_created");
  });

  it("computes total_events from events.length, ignoring LLM total_events", () => {
    const events = [
      makeValidEvent({ name: "issue_created", entity_id: "issue" }),
      makeValidEvent({
        name: "board_updated",
        entity_id: "board",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
    ];
    const data = JSON.stringify({
      entities: makeMinimalEntitySet(),
      events,
      userStateModel: makeValidUserStateModel(),
      confidence: 0.8,
      total_events: 999,
    });
    const spec = parseMeasurementSpecResponse(data);
    expect(spec.total_events).toBe(2);
  });

  describe("entity_action name validation", () => {
    it("accepts valid entity_action names", () => {
      const validNames = [
        "issue_created",
        "board_column_moved",
        "feature_flag_toggled",
        "a1_b2",
        "user_session_started",
      ];
      for (const name of validNames) {
        const response = makeValidResponse({
          events: [makeValidEvent({ name })],
        });
        expect(() => parseMeasurementSpecResponse(response)).not.toThrow();
      }
    });

    it("rejects camelCase names", () => {
      const response = makeValidResponse({
        events: [makeValidEvent({ name: "issueCreated" })],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Event 0: name 'issueCreated' does not match entity_action format",
      );
    });

    it("rejects UPPER_CASE names", () => {
      const response = makeValidResponse({
        events: [makeValidEvent({ name: "ISSUE_CREATED" })],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "does not match entity_action format",
      );
    });

    it("rejects leading underscore", () => {
      const response = makeValidResponse({
        events: [makeValidEvent({ name: "_leading" })],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "does not match entity_action format",
      );
    });

    it("rejects names starting with digit", () => {
      const response = makeValidResponse({
        events: [makeValidEvent({ name: "123start_action" })],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "does not match entity_action format",
      );
    });

    it("rejects single-word names (no underscore)", () => {
      const response = makeValidResponse({
        events: [makeValidEvent({ name: "singleword" })],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "does not match entity_action format",
      );
    });
  });

  it("rejects events with fewer than 2 properties", () => {
    const response = makeValidResponse({
      events: [
        makeValidEvent({
          properties: [
            {
              name: "only_one",
              type: "string",
              description: "Only property",
              required: true,
            },
          ],
        }),
      ],
    });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Event 0: must have at least 2 properties, got 1",
    );
  });

  describe("category validation", () => {
    it("accepts all four valid categories", () => {
      const categories = [
        "activation",
        "value",
        "retention",
        "expansion",
      ] as const;
      for (const category of categories) {
        const response = makeValidResponse({
          events: [makeValidEvent({ category })],
        });
        expect(() => parseMeasurementSpecResponse(response)).not.toThrow();
      }
    });

    it("rejects unknown category", () => {
      const response = makeValidResponse({
        events: [makeValidEvent({ category: "unknown" })],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Event 0: invalid category 'unknown'",
      );
    });
  });

  describe("maps_to discriminated union validation", () => {
    it("accepts value_moment with moment_id", () => {
      const response = makeValidResponse({
        events: [
          makeValidEvent({
            maps_to: { type: "value_moment", moment_id: "vm-1" },
          }),
        ],
      });
      const spec = parseMeasurementSpecResponse(response);
      expect(spec.events[0].maps_to.type).toBe("value_moment");
      expect(spec.events[0].maps_to.moment_id).toBe("vm-1");
    });

    it("accepts activation_level with number", () => {
      const response = makeValidResponse({
        events: [
          makeValidEvent({
            maps_to: { type: "activation_level", activation_level: 2 },
          }),
        ],
      });
      const spec = parseMeasurementSpecResponse(response);
      expect(spec.events[0].maps_to.type).toBe("activation_level");
      expect(spec.events[0].maps_to.activation_level).toBe(2);
    });

    it("accepts both with moment_id and activation_level", () => {
      const response = makeValidResponse({
        events: [
          makeValidEvent({
            maps_to: {
              type: "both",
              moment_id: "vm-1",
              activation_level: 2,
            },
          }),
        ],
      });
      const spec = parseMeasurementSpecResponse(response);
      expect(spec.events[0].maps_to.type).toBe("both");
      expect(spec.events[0].maps_to.moment_id).toBe("vm-1");
      expect(spec.events[0].maps_to.activation_level).toBe(2);
    });

    it("rejects value_moment without moment_id", () => {
      const response = makeValidResponse({
        events: [
          makeValidEvent({
            maps_to: { type: "value_moment" },
          }),
        ],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Event 0: maps_to type 'value_moment' requires moment_id",
      );
    });

    it("rejects activation_level without number", () => {
      const response = makeValidResponse({
        events: [
          makeValidEvent({
            maps_to: { type: "activation_level" },
          }),
        ],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Event 0: maps_to type 'activation_level' requires activation_level (number)",
      );
    });

    it("rejects both without moment_id", () => {
      const response = makeValidResponse({
        events: [
          makeValidEvent({
            maps_to: { type: "both", activation_level: 2 },
          }),
        ],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Event 0: maps_to type 'both' requires moment_id",
      );
    });

    it("rejects both without activation_level", () => {
      const response = makeValidResponse({
        events: [
          makeValidEvent({
            maps_to: { type: "both", moment_id: "vm-1" },
          }),
        ],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Event 0: maps_to type 'both' requires activation_level (number)",
      );
    });

    it("rejects invalid maps_to type", () => {
      const response = makeValidResponse({
        events: [
          makeValidEvent({
            maps_to: { type: "invalid" },
          }),
        ],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "maps_to type must be 'value_moment', 'activation_level', or 'both'",
      );
    });
  });

  it("error messages include event index", () => {
    const events = [
      makeValidEvent({ name: "valid_event" }),
      makeValidEvent({ name: "valid_event2" }),
      makeValidEvent({ name: "INVALID" }),
    ];
    const response = makeValidResponse({ events });
    expect(() => parseMeasurementSpecResponse(response)).toThrow("Event 2:");
  });

  it("rejects non-object top-level", () => {
    expect(() => parseMeasurementSpecResponse("[1,2,3]")).toThrow(
      "Expected JSON object with entities and events arrays",
    );
  });

  it("rejects missing entities field", () => {
    const response = JSON.stringify({ events: [], confidence: 0.5 });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Missing required field: entities",
    );
  });

  it("rejects missing events field", () => {
    const response = JSON.stringify({ entities: [], confidence: 0.5 });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Missing required field: events",
    );
  });

  it("rejects non-numeric confidence", () => {
    const response = JSON.stringify({
      entities: [],
      events: [],
      confidence: "high",
    });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Missing required field: confidence (must be number)",
    );
  });

  it("rejects confidence outside 0-1 range", () => {
    const response = JSON.stringify({
      entities: [],
      events: [],
      confidence: 1.5,
    });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "confidence must be between 0 and 1",
    );
  });

  it("rejects missing userStateModel field", () => {
    const data = {
      entities: makeMinimalEntitySet(),
      events: [makeValidEvent()],
      confidence: 0.75,
    };
    expect(() => parseMeasurementSpecResponse(JSON.stringify(data))).toThrow(
      "Missing required field: userStateModel (must be array)",
    );
  });
});

// --- parseUserStateModel Tests ---

describe("parseUserStateModel", () => {
  it("parses valid 5-state model", () => {
    const states = parseUserStateModel(makeValidUserStateModel());
    expect(states).toHaveLength(5);
    expect(states.map((s) => s.name)).toEqual(["new", "activated", "active", "at_risk", "dormant"]);
  });

  it("rejects fewer than 5 states", () => {
    const states = makeValidUserStateModel().slice(0, 3);
    expect(() => parseUserStateModel(states)).toThrow(
      "userStateModel must have exactly 5 states, got 3",
    );
  });

  it("rejects more than 5 states", () => {
    const states = [
      ...makeValidUserStateModel(),
      { name: "extra", definition: "Extra", criteria: [{ event_name: "e", condition: "c" }] },
    ];
    expect(() => parseUserStateModel(states)).toThrow(
      "userStateModel must have exactly 5 states, got 6",
    );
  });

  it("rejects invalid state name", () => {
    const states = makeValidUserStateModel();
    states[0] = { ...states[0], name: "invalid_name" };
    expect(() => parseUserStateModel(states)).toThrow(
      "UserState 0: invalid name 'invalid_name'",
    );
  });

  it("rejects duplicate state names", () => {
    const states = makeValidUserStateModel();
    states[1] = { ...states[1], name: "new" };
    expect(() => parseUserStateModel(states)).toThrow(
      "UserState 1: duplicate state name 'new'",
    );
  });

  it("rejects state missing definition", () => {
    const states = makeValidUserStateModel();
    states[0] = { name: "new", criteria: [{ event_name: "e", condition: "c" }] };
    expect(() => parseUserStateModel(states)).toThrow(
      "UserState 0: missing definition",
    );
  });

  it("rejects state with empty criteria", () => {
    const states = makeValidUserStateModel();
    states[0] = { name: "new", definition: "New users", criteria: [] };
    expect(() => parseUserStateModel(states)).toThrow(
      "UserState 0: must have at least one criterion",
    );
  });

  it("rejects criterion missing event_name", () => {
    const states = makeValidUserStateModel();
    states[0] = { name: "new", definition: "New users", criteria: [{ condition: "some condition" }] };
    expect(() => parseUserStateModel(states)).toThrow(
      "UserState 0: criterion missing event_name",
    );
  });

  it("rejects criterion missing condition", () => {
    const states = makeValidUserStateModel();
    states[0] = { name: "new", definition: "New users", criteria: [{ event_name: "user_signed_up" }] };
    expect(() => parseUserStateModel(states)).toThrow(
      "UserState 0: criterion missing condition",
    );
  });
});

// --- Fixture-based Integration Test ---

describe("fixture integration", () => {
  it("parses a realistic Linear-like response with entities, 20 events, and user state model", () => {
    const entities = [
      makeValidEntity({ id: "project", name: "Project", description: "A project workspace", isHeartbeat: true }),
      makeValidEntity({ id: "issue", name: "Issue", description: "A trackable work item" }),
      makeValidEntity({ id: "cycle", name: "Cycle", description: "A sprint cycle" }),
      makeValidEntity({ id: "board", name: "Board", description: "A kanban board" }),
      makeValidEntity({ id: "workflow", name: "Workflow", description: "A custom workflow" }),
      makeValidEntity({ id: "label", name: "Label", description: "A categorization label" }),
      makeValidEntity({ id: "roadmap", name: "Roadmap", description: "A product roadmap" }),
      makeValidEntity({ id: "insight", name: "Insight", description: "An analytics insight" }),
      makeValidEntity({ id: "report", name: "Report", description: "A progress report" }),
      makeValidEntity({ id: "session", name: "Session", description: "A user session" }),
    ];

    const events = [
      // Activation events (5)
      makeValidEvent({
        name: "project_created",
        entity_id: "project",
        description: "User creates their first project",
        perspective: "customer",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),
      makeValidEvent({
        name: "issue_created",
        entity_id: "issue",
        description: "User creates a new issue in a project",
        perspective: "customer",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "issue_assigned",
        entity_id: "issue",
        description: "User assigns an issue to a team member",
        perspective: "customer",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "workflow_configured",
        entity_id: "workflow",
        description: "User sets up a custom workflow",
        perspective: "customer",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "label_created",
        entity_id: "label",
        description: "User creates a label for categorization",
        perspective: "customer",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),

      // Value events (6)
      makeValidEvent({
        name: "cycle_completed",
        entity_id: "cycle",
        description: "A sprint cycle is completed",
        perspective: "interaction",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "roadmap_viewed",
        entity_id: "roadmap",
        description: "User views the team roadmap",
        perspective: "customer",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "insight_generated",
        entity_id: "insight",
        description: "Analytics insight delivered to user",
        perspective: "product",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "report_exported",
        entity_id: "report",
        description: "User exports a progress report",
        perspective: "customer",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "issue_triaged",
        entity_id: "issue",
        description: "User triages incoming issues",
        perspective: "interaction",
        category: "value",
        maps_to: { type: "both", moment_id: "vm-2", activation_level: 2 },
      }),
      makeValidEvent({
        name: "board_column_moved",
        entity_id: "board",
        description: "Issue moved to a new column on the board",
        perspective: "interaction",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),

      // Retention events (5)
      makeValidEvent({
        name: "session_started",
        entity_id: "session",
        description: "User opens the app for a new session",
        perspective: "customer",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),
      makeValidEvent({
        name: "issue_commented",
        entity_id: "issue",
        description: "User comments on an issue",
        perspective: "customer",
        category: "retention",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "board_filtered",
        entity_id: "board",
        description: "User saves a custom filter view",
        perspective: "customer",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "issue_updated",
        entity_id: "issue",
        description: "User updates issue status",
        perspective: "customer",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "session_resumed",
        entity_id: "session",
        description: "User returns to continue work",
        perspective: "customer",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),

      // Expansion events (4)
      makeValidEvent({
        name: "project_member_invited",
        entity_id: "project",
        description: "User invites a new team member",
        perspective: "customer",
        category: "expansion",
        maps_to: { type: "both", moment_id: "vm-2", activation_level: 3 },
      }),
      makeValidEvent({
        name: "project_integration_connected",
        entity_id: "project",
        description: "User connects an external integration",
        perspective: "customer",
        category: "expansion",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "project_workspace_created",
        entity_id: "project",
        description: "User creates an additional workspace",
        perspective: "customer",
        category: "expansion",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "project_api_key_generated",
        entity_id: "project",
        description: "User generates an API key for automation",
        perspective: "customer",
        category: "expansion",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
    ];

    const response = makeValidResponse({ entities, events, confidence: 0.72 });
    const spec = parseMeasurementSpecResponse(response);

    // entities are present with heartbeat
    expect(spec.entities).toHaveLength(10);
    expect(spec.entities.filter((e) => e.isHeartbeat)).toHaveLength(1);

    // total_events equals events.length
    expect(spec.total_events).toBe(20);
    expect(spec.events).toHaveLength(20);

    // All events have valid entity_action names
    const entityActionRegex = /^[a-z][a-z0-9]*_[a-z][a-z0-9_]*$/;
    for (const event of spec.events) {
      expect(event.name).toMatch(entityActionRegex);
    }

    // All events have entity_id referencing a defined entity
    const entityIdSet = new Set(spec.entities.map((e) => e.id));
    for (const event of spec.events) {
      expect(entityIdSet.has(event.entity_id)).toBe(true);
    }

    // All events have a valid perspective
    for (const event of spec.events) {
      expect(["customer", "product", "interaction"]).toContain(event.perspective);
    }

    // All events have 2+ properties
    for (const event of spec.events) {
      expect(event.properties.length).toBeGreaterThanOrEqual(2);
    }

    // All four categories represented
    const categories = new Set(spec.events.map((e) => e.category));
    expect(categories).toContain("activation");
    expect(categories).toContain("value");
    expect(categories).toContain("retention");
    expect(categories).toContain("expansion");

    // Coverage computed correctly
    expect(spec.coverage.activation_levels_covered).toEqual([1, 2, 3]);
    expect(spec.coverage.value_moments_covered).toContain("vm-1");
    expect(spec.coverage.value_moments_covered).toContain("vm-2");

    // User state model present
    expect(spec.userStateModel).toHaveLength(5);

    // Confidence is a number 0-1
    expect(spec.confidence).toBe(0.72);
    expect(spec.confidence).toBeGreaterThanOrEqual(0);
    expect(spec.confidence).toBeLessThanOrEqual(1);
  });
});

// --- isRequired, entities, entity_id Tests ---

describe("EventProperty isRequired field", () => {
  it("parsed properties have isRequired field instead of required", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);

    expect(spec.events[0].properties[0]).toHaveProperty("isRequired");
    expect(spec.events[0].properties[0]).not.toHaveProperty("required");
    expect(spec.events[0].properties[0].isRequired).toBe(true);
  });

  it("sets isRequired to false when raw required is false", () => {
    const event = makeValidEvent({
      properties: [
        { name: "prop_a", type: "string", description: "A", required: true },
        { name: "prop_b", type: "string", description: "B", required: false },
      ],
    });
    const response = makeValidResponse({ events: [event] });
    const spec = parseMeasurementSpecResponse(response);

    expect(spec.events[0].properties[0].isRequired).toBe(true);
    expect(spec.events[0].properties[1].isRequired).toBe(false);
  });

  it("sets isRequired to false when raw required is missing", () => {
    const event = makeValidEvent({
      properties: [
        { name: "prop_a", type: "string", description: "A" },
        { name: "prop_b", type: "string", description: "B" },
      ],
    });
    const response = makeValidResponse({ events: [event] });
    const spec = parseMeasurementSpecResponse(response);

    expect(spec.events[0].properties[0].isRequired).toBe(false);
    expect(spec.events[0].properties[1].isRequired).toBe(false);
  });
});

describe("MeasurementSpec entities field", () => {
  it("spec includes entities from parsed response", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);

    expect(spec.entities).toBeDefined();
    expect(spec.entities.length).toBeGreaterThan(0);
  });

  it("entity has required fields including isHeartbeat", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);

    const entity = spec.entities[0];
    expect(entity.id).toBeDefined();
    expect(entity.name).toBeDefined();
    expect(entity.description).toBeDefined();
    expect(entity.isHeartbeat).toBeDefined();
    expect(entity.properties).toBeDefined();
    expect(entity.properties[0].isRequired).toBeDefined();
  });
});

describe("TrackingEvent entity_id field", () => {
  it("event has entity_id referencing a defined entity", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);

    expect(spec.events[0].entity_id).toBeDefined();
    const entityIds = spec.entities.map((e) => e.id);
    expect(entityIds).toContain(spec.events[0].entity_id);
  });
});

// --- computePerspectiveDistribution Tests ---

describe("computePerspectiveDistribution", () => {
  function makeTypedEvent(perspective: "customer" | "product" | "interaction"): TrackingEvent {
    return {
      name: "test_event",
      entity_id: "test",
      description: "test",
      perspective,
      properties: [],
      trigger_condition: "test",
      maps_to: { type: "activation_level", activation_level: 1 },
      category: "activation",
    };
  }

  it("counts events by perspective", () => {
    const events = [
      makeTypedEvent("customer"),
      makeTypedEvent("customer"),
      makeTypedEvent("product"),
      makeTypedEvent("interaction"),
      makeTypedEvent("interaction"),
      makeTypedEvent("interaction"),
    ];
    const dist = computePerspectiveDistribution(events);
    expect(dist).toEqual({ customer: 2, product: 1, interaction: 3 });
  });

  it("returns all zeros for empty events", () => {
    const dist = computePerspectiveDistribution([]);
    expect(dist).toEqual({ customer: 0, product: 0, interaction: 0 });
  });

  it("handles single-perspective events", () => {
    const events = [makeTypedEvent("product"), makeTypedEvent("product")];
    const dist = computePerspectiveDistribution(events);
    expect(dist).toEqual({ customer: 0, product: 2, interaction: 0 });
  });
});

// --- Perspective Coverage Warning Tests ---

describe("parseMeasurementSpecResponse perspective coverage warnings", () => {
  it("warns when a perspective has zero events", () => {
    const events = [
      makeValidEvent({ name: "issue_created", entity_id: "issue", perspective: "customer" }),
      makeValidEvent({ name: "board_updated", entity_id: "board", perspective: "customer" }),
    ];
    const response = makeValidResponse({ events });
    const spec = parseMeasurementSpecResponse(response);
    const perspWarnings = spec.warnings?.filter((w) => w.includes("perspective")) ?? [];
    expect(perspWarnings.length).toBeGreaterThanOrEqual(2);
    expect(perspWarnings.some((w) => w.includes("'product' perspective"))).toBe(true);
    expect(perspWarnings.some((w) => w.includes("'interaction' perspective"))).toBe(true);
  });

  it("warns when product perspective has fewer events than others", () => {
    const events = [
      makeValidEvent({ name: "issue_created", entity_id: "issue", perspective: "customer" }),
      makeValidEvent({ name: "board_updated", entity_id: "board", perspective: "customer" }),
      makeValidEvent({ name: "project_viewed", entity_id: "project", perspective: "interaction" }),
      makeValidEvent({ name: "project_archived", entity_id: "project", perspective: "interaction" }),
      makeValidEvent({ name: "issue_generated", entity_id: "issue", perspective: "product", maps_to: { type: "value_moment", moment_id: "vm-1" } }),
    ];
    const response = makeValidResponse({ events });
    const spec = parseMeasurementSpecResponse(response);
    const productWarnings = spec.warnings?.filter((w) => w.includes("Product perspective has fewer events")) ?? [];
    expect(productWarnings).toHaveLength(1);
    expect(productWarnings[0]).toContain("(1)");
  });

  it("does not warn when all perspectives are balanced", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    const perspWarnings = spec.warnings?.filter((w) => w.includes("perspective")) ?? [];
    expect(perspWarnings).toHaveLength(0);
  });

  it("includes perspective_distribution in coverage", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.coverage.perspective_distribution).toEqual({
      customer: 1,
      product: 1,
      interaction: 1,
    });
  });
});

// --- User State Model Event Name Validation Tests ---

describe("parseMeasurementSpecResponse user state model event validation", () => {
  it("warns when user state criterion references non-existent event", () => {
    const userStateModel = makeValidUserStateModel({
      newEvent: "nonexistent_event",
    });
    const response = makeValidResponse({ userStateModel });
    const spec = parseMeasurementSpecResponse(response);
    const stateWarnings = spec.warnings?.filter((w) => w.includes("UserState")) ?? [];
    expect(stateWarnings.some((w) => w.includes("'nonexistent_event'") && w.includes("not defined"))).toBe(true);
  });

  it("does not warn when all user state criteria reference existing events", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    const stateWarnings = spec.warnings?.filter((w) => w.includes("UserState")) ?? [];
    expect(stateWarnings).toHaveLength(0);
  });

  it("warns for each non-existent event reference across all states", () => {
    const userStateModel = [
      { name: "new", definition: "Just signed up", criteria: [{ event_name: "missing_event_a", condition: "within 7 days" }] },
      { name: "activated", definition: "Reached activation", criteria: [{ event_name: "missing_event_b", condition: "completed onboarding" }] },
      { name: "active", definition: "Regularly engaged", criteria: [{ event_name: "issue_created", condition: "3+ sessions in 7 days" }] },
      { name: "at_risk", definition: "Declining engagement", criteria: [{ event_name: "issue_created", condition: "no session in 14 days" }] },
      { name: "dormant", definition: "Stopped engaging", criteria: [{ event_name: "issue_created", condition: "no session in 30 days" }] },
    ];
    const response = makeValidResponse({ userStateModel });
    const spec = parseMeasurementSpecResponse(response);
    const stateWarnings = spec.warnings?.filter((w) => w.includes("not defined in events")) ?? [];
    expect(stateWarnings).toHaveLength(2);
    expect(stateWarnings[0]).toContain("missing_event_a");
    expect(stateWarnings[1]).toContain("missing_event_b");
  });
});

// --- Activated State Criteria Validation Tests ---

describe("parseMeasurementSpecResponse activated state activation-level validation", () => {
  it("warns when activated state references event that does not map to activation level", () => {
    const events = [
      makeValidEvent({ name: "issue_created", entity_id: "issue", perspective: "customer", maps_to: { type: "value_moment", moment_id: "vm-1" } }),
      makeValidEvent({ name: "board_updated", entity_id: "board", perspective: "product", maps_to: { type: "value_moment", moment_id: "vm-1" } }),
      makeValidEvent({ name: "project_viewed", entity_id: "project", perspective: "interaction", maps_to: { type: "activation_level", activation_level: 1 } }),
    ];
    const userStateModel = makeValidUserStateModel({ activatedEvent: "issue_created" });
    const response = makeValidResponse({ events, userStateModel });
    const spec = parseMeasurementSpecResponse(response);
    const activatedWarnings = spec.warnings?.filter((w) => w.includes("activated") && w.includes("activation level")) ?? [];
    expect(activatedWarnings).toHaveLength(1);
    expect(activatedWarnings[0]).toContain("issue_created");
  });

  it("does not warn when activated state references activation-level event", () => {
    const events = [
      makeValidEvent({ name: "issue_created", entity_id: "issue", perspective: "customer", maps_to: { type: "activation_level", activation_level: 2 } }),
      makeValidEvent({ name: "board_updated", entity_id: "board", perspective: "product", maps_to: { type: "value_moment", moment_id: "vm-1" } }),
      makeValidEvent({ name: "project_viewed", entity_id: "project", perspective: "interaction", maps_to: { type: "activation_level", activation_level: 1 } }),
    ];
    const userStateModel = makeValidUserStateModel({ activatedEvent: "issue_created" });
    const response = makeValidResponse({ events, userStateModel });
    const spec = parseMeasurementSpecResponse(response);
    const activatedWarnings = spec.warnings?.filter((w) => w.includes("activated") && w.includes("activation level")) ?? [];
    expect(activatedWarnings).toHaveLength(0);
  });

  it("does not warn when activated state references event with maps_to type both", () => {
    const events = [
      makeValidEvent({ name: "issue_created", entity_id: "issue", perspective: "customer", maps_to: { type: "both", moment_id: "vm-1", activation_level: 2 } }),
      makeValidEvent({ name: "board_updated", entity_id: "board", perspective: "product", maps_to: { type: "value_moment", moment_id: "vm-1" } }),
      makeValidEvent({ name: "project_viewed", entity_id: "project", perspective: "interaction", maps_to: { type: "activation_level", activation_level: 1 } }),
    ];
    const userStateModel = makeValidUserStateModel({ activatedEvent: "issue_created" });
    const response = makeValidResponse({ events, userStateModel });
    const spec = parseMeasurementSpecResponse(response);
    const activatedWarnings = spec.warnings?.filter((w) => w.includes("activated") && w.includes("activation level")) ?? [];
    expect(activatedWarnings).toHaveLength(0);
  });

  it("does not warn for activated state when event does not exist (covered by event existence check)", () => {
    const userStateModel = makeValidUserStateModel({ activatedEvent: "nonexistent_event" });
    const response = makeValidResponse({ userStateModel });
    const spec = parseMeasurementSpecResponse(response);
    const activatedWarnings = spec.warnings?.filter((w) => w.includes("activated") && w.includes("activation level")) ?? [];
    expect(activatedWarnings).toHaveLength(0);
    // But should have an event-existence warning
    const existWarnings = spec.warnings?.filter((w) => w.includes("not defined in events")) ?? [];
    expect(existWarnings.some((w) => w.includes("nonexistent_event"))).toBe(true);
  });
});
