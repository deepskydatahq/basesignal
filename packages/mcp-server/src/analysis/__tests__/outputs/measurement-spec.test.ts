import { describe, it, expect } from "vitest";
import {
  parseMeasurementSpecResponse,
  assembleMeasurementInput,
  buildMeasurementSpecPrompt,
} from "../../outputs/measurement-spec.js";
import type { ActivationLevel } from "@basesignal/core";
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
