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

function makeValidEvent(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    name: "issue_created",
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
  overrides?: Partial<{ events: unknown[]; confidence: number }>,
): string {
  const data = {
    events: overrides?.events ?? [makeValidEvent()],
    confidence: overrides?.confidence ?? 0.75,
  };
  return JSON.stringify(data);
}

// --- System Prompt Tests ---

describe("MEASUREMENT_SPEC_SYSTEM_PROMPT", () => {
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

// --- parseMeasurementSpecResponse Tests ---

describe("parseMeasurementSpecResponse", () => {
  it("parses valid JSON into MeasurementSpec with correct fields", () => {
    const response = makeValidResponse();
    const spec = parseMeasurementSpecResponse(response);

    expect(spec.events).toHaveLength(1);
    expect(spec.events[0].name).toBe("issue_created");
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
      makeValidEvent({ name: "issue_created" }),
      makeValidEvent({
        name: "board_updated",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
    ];
    // Include a wrong total_events to verify it's ignored
    const data = JSON.stringify({
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
      "Expected JSON object with events array",
    );
  });

  it("rejects missing events field", () => {
    const response = JSON.stringify({ confidence: 0.5 });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Missing required field: events",
    );
  });

  it("rejects non-numeric confidence", () => {
    const response = JSON.stringify({
      events: [],
      confidence: "high",
    });
    expect(() => parseMeasurementSpecResponse(response)).toThrow(
      "Missing required field: confidence (must be number)",
    );
  });

  it("rejects confidence outside 0-1 range", () => {
    const response = JSON.stringify({
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
  it("parses a realistic Linear-like response with 20 events", () => {
    const events = [
      // Activation events (5)
      makeValidEvent({
        name: "project_created",
        description: "User creates their first project",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),
      makeValidEvent({
        name: "issue_created",
        description: "User creates a new issue in a project",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "issue_assigned",
        description: "User assigns an issue to a team member",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "workflow_configured",
        description: "User sets up a custom workflow",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "label_created",
        description: "User creates a label for categorization",
        category: "activation",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),

      // Value events (6)
      makeValidEvent({
        name: "cycle_completed",
        description: "A sprint cycle is completed",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "roadmap_viewed",
        description: "User views the team roadmap",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "insight_generated",
        description: "Analytics insight delivered to user",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),
      makeValidEvent({
        name: "report_exported",
        description: "User exports a progress report",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "triage_completed",
        description: "User triages incoming issues",
        category: "value",
        maps_to: { type: "both", moment_id: "vm-2", activation_level: 2 },
      }),
      makeValidEvent({
        name: "board_column_moved",
        description: "Issue moved to a new column on the board",
        category: "value",
        maps_to: { type: "value_moment", moment_id: "vm-1" },
      }),

      // Retention events (5)
      makeValidEvent({
        name: "session_started",
        description: "User opens the app for a new session",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 1 },
      }),
      makeValidEvent({
        name: "inbox_checked",
        description: "User checks notification inbox",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),
      makeValidEvent({
        name: "issue_commented",
        description: "User comments on an issue",
        category: "retention",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "filter_saved",
        description: "User saves a custom filter view",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "shortcut_used",
        description: "User uses a keyboard shortcut",
        category: "retention",
        maps_to: { type: "activation_level", activation_level: 2 },
      }),

      // Expansion events (4)
      makeValidEvent({
        name: "team_member_invited",
        description: "User invites a new team member",
        category: "expansion",
        maps_to: { type: "both", moment_id: "vm-2", activation_level: 3 },
      }),
      makeValidEvent({
        name: "integration_connected",
        description: "User connects an external integration",
        category: "expansion",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
      makeValidEvent({
        name: "workspace_created",
        description: "User creates an additional workspace",
        category: "expansion",
        maps_to: { type: "value_moment", moment_id: "vm-2" },
      }),
      makeValidEvent({
        name: "api_key_generated",
        description: "User generates an API key for automation",
        category: "expansion",
        maps_to: { type: "activation_level", activation_level: 3 },
      }),
    ];

    const response = makeValidResponse({ events, confidence: 0.72 });
    const spec = parseMeasurementSpecResponse(response);

    // total_events equals events.length
    expect(spec.total_events).toBe(20);
    expect(spec.events).toHaveLength(20);

    // All events have valid entity_action names
    const entityActionRegex = /^[a-z][a-z0-9]*_[a-z][a-z0-9_]*$/;
    for (const event of spec.events) {
      expect(event.name).toMatch(entityActionRegex);
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
