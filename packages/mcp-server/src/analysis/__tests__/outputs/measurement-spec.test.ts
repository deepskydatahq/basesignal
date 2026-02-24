import { describe, it, expect } from "vitest";
import {
  parseMeasurementSpecResponse,
  assembleMeasurementInput,
  buildMeasurementSpecPrompt,
  MEASUREMENT_SPEC_SYSTEM_PROMPT,
} from "../../outputs/measurement-spec.js";
import type { ActivationLevel, LifecycleStatesResult } from "@basesignal/core";
import type { ValueMoment, ICPProfile } from "../../types.js";

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

    // Activation event templates
    expect(input.activation_event_templates).toHaveLength(1);
    expect(input.activation_event_templates[0].level).toBe(1);
    expect(input.activation_event_templates[0].suggested_event_name).toContain("activation_l1");

    // Value event templates (only tier 1 and 2)
    expect(input.value_event_templates).toHaveLength(2);
    expect(input.value_event_templates[0].tier).toBeLessThanOrEqual(2);
    expect(input.value_event_templates[1].tier).toBeLessThanOrEqual(2);
  });
});

describe("buildMeasurementSpecPrompt", () => {
  it("includes all sections in prompt", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    const { system, user } = buildMeasurementSpecPrompt(input);

    expect(system).toContain("measurement specification");
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
});

describe("parseMeasurementSpecResponse", () => {
  it("parses valid measurement spec JSON", () => {
    const input = JSON.stringify({
      entities: [
        {
          id: "issue",
          name: "Issue",
          description: "A trackable work item",
          isHeartbeat: true,
          properties: [{ name: "issue_id", type: "string", description: "ID", isRequired: true }],
        },
      ],
      events: [
        {
          name: "issue_created",
          entity_id: "issue",
          description: "User creates issue",
          perspective: "customer",
          properties: [
            { name: "title", type: "string", description: "Title", required: true },
            { name: "priority", type: "string", description: "Priority", required: false },
          ],
          trigger_condition: "When user creates issue",
          maps_to: { type: "value_moment", moment_id: "vm-1" },
          category: "value",
        },
      ],
      userStateModel: [
        { name: "new", definition: "Just signed up", criteria: [{ event_name: "issue_created", condition: "none yet" }] },
        { name: "activated", definition: "Created first item", criteria: [{ event_name: "issue_created", condition: "at least 1" }] },
        { name: "active", definition: "Regular user", criteria: [{ event_name: "issue_created", condition: "3+ per week" }] },
        { name: "at_risk", definition: "Declining", criteria: [{ event_name: "issue_created", condition: "none in 7 days" }] },
        { name: "dormant", definition: "Gone", criteria: [{ event_name: "issue_created", condition: "none in 30 days" }] },
      ],
      confidence: 0.7,
    });

    const result = parseMeasurementSpecResponse(input);
    expect(result.entities).toHaveLength(1);
    expect(result.events).toHaveLength(1);
    expect(result.total_events).toBe(1);
    expect(result.userStateModel).toHaveLength(5);
    expect(result.confidence).toBe(0.7);
    expect(result.coverage.value_moments_covered).toContain("vm-1");
  });

  it("computes coverage from events", () => {
    const input = JSON.stringify({
      entities: [
        { id: "board", name: "Board", description: "D", isHeartbeat: true, properties: [] },
      ],
      events: [
        {
          name: "board_created",
          entity_id: "board",
          description: "D",
          perspective: "customer",
          properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "boolean", description: "d", required: false }],
          trigger_condition: "T",
          maps_to: { type: "activation_level", activation_level: 1 },
          category: "activation",
        },
        {
          name: "board_shared",
          entity_id: "board",
          description: "D",
          perspective: "interaction",
          properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "c", type: "number", description: "d", required: false }],
          trigger_condition: "T",
          maps_to: { type: "both", moment_id: "vm-1", activation_level: 2 },
          category: "value",
        },
      ],
      userStateModel: [
        { name: "new", definition: "D", criteria: [] },
        { name: "activated", definition: "D", criteria: [] },
        { name: "active", definition: "D", criteria: [] },
        { name: "at_risk", definition: "D", criteria: [] },
        { name: "dormant", definition: "D", criteria: [] },
      ],
      confidence: 0.5,
    });

    const result = parseMeasurementSpecResponse(input);
    expect(result.coverage.activation_levels_covered).toEqual([1, 2]);
    expect(result.coverage.value_moments_covered).toEqual(["vm-1"]);
    expect(result.coverage.perspective_distribution.customer).toBe(1);
    expect(result.coverage.perspective_distribution.interaction).toBe(1);
  });

  it("rejects missing entities", () => {
    const input = JSON.stringify({
      events: [],
      userStateModel: [],
      confidence: 0.5,
    });
    expect(() => parseMeasurementSpecResponse(input)).toThrow("Missing required field: entities");
  });

  it("rejects missing events", () => {
    const input = JSON.stringify({
      entities: [],
      userStateModel: [],
      confidence: 0.5,
    });
    expect(() => parseMeasurementSpecResponse(input)).toThrow("Missing required field: events");
  });

  it("rejects event with invalid entity_id", () => {
    const input = JSON.stringify({
      entities: [
        { id: "board", name: "Board", description: "D", isHeartbeat: true, properties: [] },
      ],
      events: [
        {
          name: "task_created",
          entity_id: "task",
          description: "D",
          perspective: "customer",
          properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "p", type: "string", description: "d", required: false }],
          trigger_condition: "T",
          maps_to: { type: "value_moment", moment_id: "vm-1" },
          category: "value",
        },
      ],
      userStateModel: [],
      confidence: 0.5,
    });
    expect(() => parseMeasurementSpecResponse(input)).toThrow("not in defined entities");
  });

  it("rejects missing confidence", () => {
    const input = JSON.stringify({
      entities: [],
      events: [],
      userStateModel: [],
    });
    expect(() => parseMeasurementSpecResponse(input)).toThrow("Missing required field: confidence");
  });

  it("rejects confidence out of range", () => {
    const input = JSON.stringify({
      entities: [],
      events: [],
      userStateModel: [],
      confidence: 1.5,
    });
    expect(() => parseMeasurementSpecResponse(input)).toThrow("confidence must be between 0 and 1");
  });
});

// --- Lifecycle States Integration Tests ---

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

describe("assembleMeasurementInput — lifecycle states", () => {
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
    expect(input.lifecycle_states!.confidence).toBe(0.75);
  });

  it("lifecycle_states is undefined when not provided", () => {
    const input = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
    );

    expect(input.lifecycle_states).toBeUndefined();
  });
});

describe("buildMeasurementSpecPrompt — lifecycle states", () => {
  it("includes lifecycle states section when provided", () => {
    const input = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
      sampleLifecycleStates,
    );
    const { user } = buildMeasurementSpecPrompt(input);

    expect(user).toContain("## Lifecycle States (use for userStateModel)");
    expect(user).toContain("**new**: Just signed up");
    expect(user).toContain("**engaged**: Regular user");
    expect(user).toContain("**churned**: Gone for 60+ days");
    expect(user).toContain("**resurrected**: Returned after churn");
  });

  it("includes entry criteria in lifecycle states section", () => {
    const input = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
      sampleLifecycleStates,
    );
    const { user } = buildMeasurementSpecPrompt(input);

    expect(user).toContain("Entry criteria: signup: account created");
    expect(user).toContain("Entry criteria: daily_use: 3+ days/week");
  });

  it("omits lifecycle states section when not provided", () => {
    const input = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
    );
    const { user } = buildMeasurementSpecPrompt(input);

    expect(user).not.toContain("## Lifecycle States");
  });
});

describe("buildMeasurementSpecPrompt — product-perspective guidance", () => {
  it("includes product-generated events guidance when product surfaces exist", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    const { user } = buildMeasurementSpecPrompt(input);

    expect(user).toContain("## Product-Generated Events Guidance");
    expect(user).toContain("Sprint Planning");
    expect(user).toContain("product-perspective events");
  });

  it("includes identity description when provided", () => {
    const input = assembleMeasurementInput(
      sampleMoments,
      sampleLevels,
      sampleICPs,
      null,
      undefined,
      { productName: "Amplitude", description: "Digital analytics platform with AI-powered insights" },
    );
    const { user } = buildMeasurementSpecPrompt(input);

    expect(user).toContain("Amplitude");
    expect(user).toContain("AI-powered insights");
    expect(user).toContain("product-perspective events");
  });

  it("omits guidance section when no surfaces and no identity", () => {
    const noSurfaceMoments = sampleMoments.map((m) => ({
      ...m,
      product_surfaces: [],
    }));
    const input = assembleMeasurementInput(noSurfaceMoments, sampleLevels, [], null);
    const { user } = buildMeasurementSpecPrompt(input);

    expect(user).not.toContain("## Product-Generated Events Guidance");
  });
});

describe("assembleMeasurementInput — identity", () => {
  it("includes identity when provided", () => {
    const identity = { productName: "Linear", description: "Issue tracking tool" };
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null, undefined, identity);
    expect(input.identity).toEqual(identity);
  });

  it("identity is undefined when not provided", () => {
    const input = assembleMeasurementInput(sampleMoments, sampleLevels, sampleICPs, null);
    expect(input.identity).toBeUndefined();
  });
});

describe("MEASUREMENT_SPEC_SYSTEM_PROMPT — perspective balance", () => {
  it("includes perspective balance guidance", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("Perspective Balance");
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain("product perspective");
  });
});

// --- Format Validation Tests ---

function makeValidSpecJson(overrides: {
  entities?: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
} = {}): string {
  const defaultEntity = {
    id: "issue", name: "Issue", description: "Work item",
    isHeartbeat: true,
    properties: [{ name: "issue_id", type: "string", description: "ID", isRequired: true }],
  };
  const defaultEvent = {
    name: "issue_created", entity_id: "issue", description: "Created",
    perspective: "customer",
    properties: [
      { name: "title", type: "string", description: "T", required: true },
      { name: "p", type: "string", description: "P", required: false },
    ],
    trigger_condition: "When created",
    maps_to: { type: "value_moment", moment_id: "vm-1" },
    category: "activation",
  };
  return JSON.stringify({
    entities: overrides.entities ?? [defaultEntity],
    events: overrides.events ?? [defaultEvent],
    userStateModel: [
      { name: "new", definition: "D", criteria: [] },
    ],
    confidence: 0.7,
  });
}

describe("parseMeasurementSpecResponse — entity ID format validation", () => {
  it("rejects entity ID starting with digit", () => {
    const json = makeValidSpecJson({
      entities: [{ id: "1issue", name: "Issue", description: "D", isHeartbeat: true, properties: [] }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("id must match");
  });

  it("rejects entity ID with uppercase", () => {
    const json = makeValidSpecJson({
      entities: [{ id: "Issue", name: "Issue", description: "D", isHeartbeat: true, properties: [] }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("id must match");
  });

  it("rejects entity ID with hyphens", () => {
    const json = makeValidSpecJson({
      entities: [{ id: "my-entity", name: "Entity", description: "D", isHeartbeat: true, properties: [] }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("id must match");
  });

  it("accepts valid entity ID with underscores", () => {
    const json = makeValidSpecJson({
      entities: [{ id: "project_board", name: "Board", description: "D", isHeartbeat: true, properties: [] }],
      events: [{
        name: "project_board_created", entity_id: "project_board", description: "D",
        perspective: "customer", category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).not.toThrow();
  });
});

describe("parseMeasurementSpecResponse — heartbeat uniqueness validation", () => {
  it("rejects zero heartbeat entities", () => {
    const json = makeValidSpecJson({
      entities: [
        { id: "issue", name: "Issue", description: "D", isHeartbeat: false, properties: [] },
      ],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("none found");
  });

  it("rejects multiple heartbeat entities", () => {
    const json = makeValidSpecJson({
      entities: [
        { id: "issue", name: "Issue", description: "D", isHeartbeat: true, properties: [] },
        { id: "board", name: "Board", description: "D", isHeartbeat: true, properties: [] },
      ],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("found 2");
  });

  it("accepts exactly one heartbeat entity", () => {
    const json = makeValidSpecJson();
    expect(() => parseMeasurementSpecResponse(json)).not.toThrow();
  });
});

describe("parseMeasurementSpecResponse — event name format validation", () => {
  it("rejects event name without underscore", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "issuecreated", entity_id: "issue", description: "D",
        perspective: "customer", category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("name must match");
  });

  it("rejects event name starting with uppercase", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "Issue_created", entity_id: "issue", description: "D",
        perspective: "customer", category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("name must match");
  });

  it("rejects event name starting with underscore", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "_issue_created", entity_id: "issue", description: "D",
        perspective: "customer", category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("name must match");
  });

  it("accepts valid multi-segment event name", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "board_column_moved", entity_id: "issue", description: "D",
        perspective: "customer", category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).not.toThrow();
  });

  it("rejects event name with only prefix and no action", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "issue_", entity_id: "issue", description: "D",
        perspective: "customer", category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("name must match");
  });

  it("accepts event name with digits in entity prefix", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "v2board_created", entity_id: "issue", description: "D",
        perspective: "customer", category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).not.toThrow();
  });
});

describe("parseMeasurementSpecResponse — perspective enum validation", () => {
  it("rejects invalid perspective", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "issue_created", entity_id: "issue", description: "D",
        perspective: "user", category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("perspective must be one of");
  });

  it("rejects missing perspective", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "issue_created", entity_id: "issue", description: "D",
        category: "activation",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("perspective must be one of");
  });
});

describe("parseMeasurementSpecResponse — category enum validation", () => {
  it("rejects invalid category", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "issue_created", entity_id: "issue", description: "D",
        perspective: "customer", category: "engagement",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("category must be one of");
  });

  it("rejects missing category", () => {
    const json = makeValidSpecJson({
      events: [{
        name: "issue_created", entity_id: "issue", description: "D",
        perspective: "customer",
        properties: [{ name: "n", type: "string", description: "d", required: true }, { name: "t", type: "string", description: "d", required: false }],
        trigger_condition: "T", maps_to: { type: "value_moment", moment_id: "vm-1" },
      }],
    });
    expect(() => parseMeasurementSpecResponse(json)).toThrow("category must be one of");
  });
});

describe("MEASUREMENT_SPEC_SYSTEM_PROMPT — softened Step 3", () => {
  it("does not mandate exactly 5 states", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).not.toContain("exactly 5 states");
  });

  it("instructs to derive from lifecycle states when provided", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain(
      "If lifecycle states are provided in the context below, derive your user state model from them.",
    );
  });

  it("provides 5-state fallback when lifecycle states not available", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).toContain(
      "Otherwise, define 5 representative states: new, activated, active, at_risk, dormant.",
    );
  });

  it("does not mandate specific state names", () => {
    expect(MEASUREMENT_SPEC_SYSTEM_PROMPT).not.toContain(
      'name: one of "new", "activated", "active", "at_risk", "dormant"',
    );
  });
});
