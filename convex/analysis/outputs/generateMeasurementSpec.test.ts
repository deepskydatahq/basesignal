import { describe, it, expect } from "vitest";
import {
  MEASUREMENT_SPEC_SYSTEM_PROMPT,
  buildMeasurementSpecPrompt,
  parseMeasurementSpecResponse,
} from "./generateMeasurementSpec";
import type { MeasurementInputData } from "./types";

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
    makeValidEntity({ id: "issue", name: "Issue", description: "A work item" }),
    makeValidEntity({ id: "project", name: "Project", description: "A project container" }),
    makeValidEntity({ id: "board", name: "Board", description: "A kanban board" }),
  ];
}

function makeValidEvent(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    name: "issue_created",
    entity_id: "issue",
    description: "User creates a new issue",
    properties: [
      {
        name: "issue_id",
        type: "string",
        description: "Unique identifier for the issue",
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

function makeValidResponse(
  overrides?: Partial<{ entities: unknown[]; events: unknown[]; confidence: number }>,
): string {
  const data = {
    entities: overrides?.entities ?? makeMinimalEntitySet(),
    events: overrides?.events ?? [makeValidEvent()],
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

  it("contains entity schema definition", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("isRequired");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("/^[a-z][a-z0-9_]*$/");
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
  it("parses valid entities with correct fields", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.entities).toHaveLength(3);
    expect(spec.entities[0].id).toBe("issue");
    expect(spec.entities[0].name).toBe("Issue");
    expect(spec.entities[0].description).toBe("A work item");
    expect(spec.entities[0].properties).toHaveLength(1);
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
          makeValidEntity({ id: "a" }),
          makeValidEntity({ id: "b" }),
        ],
      });
      expect(() => parseMeasurementSpecResponse(response)).toThrow(
        "Expected 3-15 entities, got 2",
      );
    });

    it("rejects more than 15 entities", () => {
      const entities = Array.from({ length: 16 }, (_, i) =>
        makeValidEntity({ id: `entity${i}`, name: `Entity ${i}`, description: `Entity ${i} desc` }),
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
        makeValidEntity({ id: `entity${i}`, name: `Entity ${i}`, description: `Entity ${i} desc` }),
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
      makeValidEntity({ id: "issue" }),
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
  it("parses valid JSON into MeasurementSpec with entities and events", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);

    expect(spec.entities).toHaveLength(3);
    expect(spec.events).toHaveLength(1);
    expect(spec.events[0].name).toBe("issue_created");
    expect(spec.events[0].entity_id).toBe("issue");
    expect(spec.total_events).toBe(1);
    expect(spec.confidence).toBe(0.75);
    expect(spec.coverage.activation_levels_covered).toEqual([2]);
    expect(spec.coverage.value_moments_covered).toEqual([]);
  });

  it("extracts JSON from markdown code fences", () => {
    const response =
      "```json\n" + makeValidResponse() + "\n```";
    const spec = parseMeasurementSpecResponse(response);
    expect(spec.events).toHaveLength(1);
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
});

// --- Fixture-based Integration Test ---

describe("fixture integration", () => {
  it("parses a realistic Linear-like response with entities and 20 events", () => {
    const entities = [
      makeValidEntity({ id: "project", name: "Project", description: "A project workspace" }),
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
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),
      makeValidEvent({
        name: "issue_created",
        entity_id: "issue",
        description: "User creates a new issue in a project",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "issue_assigned",
        entity_id: "issue",
        description: "User assigns an issue to a team member",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "workflow_configured",
        entity_id: "workflow",
        description: "User sets up a custom workflow",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "label_created",
        entity_id: "label",
        description: "User creates a label for categorization",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),

      // Value events (6)
      makeValidEvent({
        name: "cycle_completed",
        entity_id: "cycle",
        description: "A sprint cycle is completed",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "roadmap_viewed",
        entity_id: "roadmap",
        description: "User views the team roadmap",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "insight_generated",
        entity_id: "insight",
        description: "Analytics insight delivered to user",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "report_exported",
        entity_id: "report",
        description: "User exports a progress report",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "issue_triaged",
        entity_id: "issue",
        description: "User triages incoming issues",
        category: "value",
        maps_to: { type: "both", moment_id: "vm-2", activation_level: 2 },
      }),
      makeValidEvent({
        name: "board_column_moved",
        entity_id: "board",
        description: "Issue moved to a new column on the board",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),

      // Retention events (5)
      makeValidEvent({
        name: "session_started",
        entity_id: "session",
        description: "User opens the app for a new session",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),
      makeValidEvent({
        name: "issue_commented",
        entity_id: "issue",
        description: "User comments on an issue",
        category: "retention",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "board_filtered",
        entity_id: "board",
        description: "User saves a custom filter view",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "issue_updated",
        entity_id: "issue",
        description: "User updates issue status",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "session_resumed",
        entity_id: "session",
        description: "User returns to continue work",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),

      // Expansion events (4)
      makeValidEvent({
        name: "project_member_invited",
        entity_id: "project",
        description: "User invites a new team member",
        category: "expansion",
        maps_to: { type: "both", moment_id: "vm-2", activation_level: 3 },
      }),
      makeValidEvent({
        name: "project_integration_connected",
        entity_id: "project",
        description: "User connects an external integration",
        category: "expansion",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "project_workspace_created",
        entity_id: "project",
        description: "User creates an additional workspace",
        category: "expansion",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "project_api_key_generated",
        entity_id: "project",
        description: "User generates an API key for automation",
        category: "expansion",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
    ];

    const response = makeValidResponse({ entities, events, confidence: 0.72 });
    const spec = parseMeasurementSpecResponse(response);

    // entities are present
    expect(spec.entities).toHaveLength(10);

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

    // Confidence is a number 0-1
    expect(spec.confidence).toBe(0.72);
    expect(spec.confidence).toBeGreaterThanOrEqual(0);
    expect(spec.confidence).toBeLessThanOrEqual(1);
  });
});
