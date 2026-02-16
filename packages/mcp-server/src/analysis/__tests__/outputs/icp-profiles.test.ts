import { describe, it, expect } from "vitest";
import {
  parseICPProfiles,
  aggregateRoles,
  buildICPPrompt,
} from "../../outputs/icp-profiles.js";
import type { ValueMoment } from "../../types.js";

function makeValueMoment(overrides: Partial<ValueMoment> = {}): ValueMoment {
  return {
    id: "vm-1",
    name: "Sprint planning efficiency",
    description: "Engineering managers plan sprints faster",
    tier: 1,
    lens_count: 4,
    lenses: ["capability_mapping", "effort_elimination", "time_compression", "artifact_creation"],
    roles: ["Engineering Manager"],
    product_surfaces: ["Sprint Planning"],
    contributing_candidates: [],
    is_coherent: true,
    ...overrides,
  };
}

describe("aggregateRoles", () => {
  it("aggregates roles from value moments", () => {
    const vms: ValueMoment[] = [
      makeValueMoment({ id: "vm-1", tier: 1, roles: ["Engineering Manager", "Tech Lead"] }),
      makeValueMoment({ id: "vm-2", tier: 2, roles: ["Engineering Manager"] }),
      makeValueMoment({ id: "vm-3", tier: 3, roles: ["Developer"] }),
    ];

    const roles = aggregateRoles(vms);
    expect(roles).toHaveLength(3);

    const em = roles.find((r) => r.name === "Engineering Manager");
    expect(em).toBeDefined();
    expect(em!.occurrence_count).toBe(2);
    expect(em!.tier_1_count).toBe(1);
    expect(em!.tier_2_count).toBe(1);
    expect(em!.tier_3_plus_count).toBe(0);

    const dev = roles.find((r) => r.name === "Developer");
    expect(dev).toBeDefined();
    expect(dev!.tier_3_plus_count).toBe(1);
  });

  it("returns empty array for no value moments", () => {
    expect(aggregateRoles([])).toEqual([]);
  });
});

describe("buildICPPrompt", () => {
  it("includes target customer", () => {
    const prompt = buildICPPrompt([], "Engineering teams at B2B SaaS companies");
    expect(prompt).toContain("Engineering teams at B2B SaaS companies");
  });

  it("includes roles summary with tier counts", () => {
    const roles = aggregateRoles([
      makeValueMoment({ tier: 1, roles: ["Engineering Manager"] }),
      makeValueMoment({ id: "vm-2", tier: 2, roles: ["Engineering Manager"] }),
    ]);
    const prompt = buildICPPrompt(roles, "Teams");
    expect(prompt).toContain("Engineering Manager");
    expect(prompt).toContain("2 occurrences");
    expect(prompt).toContain("1 T1");
    expect(prompt).toContain("1 T2");
  });
});

describe("parseICPProfiles", () => {
  it("parses valid ICP profiles", () => {
    const input = JSON.stringify([
      {
        name: "Engineering Team Lead",
        description: "Manages a team of developers",
        value_moment_priorities: [
          { moment_id: "vm-1", priority: 1, relevance_reason: "Core workflow" },
        ],
        activation_triggers: ["create_board"],
        pain_points: ["Manual planning"],
        success_metrics: ["Sprint time < 15 min"],
        confidence: 0.8,
      },
      {
        name: "Senior Developer",
        description: "Ships code daily",
        value_moment_priorities: [
          { moment_id: "vm-2", priority: 1, relevance_reason: "Task management" },
        ],
        activation_triggers: ["create_issue"],
        pain_points: ["Context switching"],
        success_metrics: ["All tasks visible"],
        confidence: 0.7,
      },
    ]);

    const result = parseICPProfiles(input);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Engineering Team Lead");
    expect(result[0].confidence).toBe(0.8);
    expect(result[0].value_moment_priorities).toHaveLength(1);
    expect(result[1].name).toBe("Senior Developer");
  });

  it("clamps confidence to [0, 1]", () => {
    const input = JSON.stringify([
      {
        name: "A",
        description: "D",
        value_moment_priorities: [{ moment_id: "m1", priority: 1, relevance_reason: "r" }],
        activation_triggers: ["t"],
        pain_points: ["p"],
        success_metrics: ["s"],
        confidence: 1.5,
      },
      {
        name: "B",
        description: "D",
        value_moment_priorities: [{ moment_id: "m2", priority: 1, relevance_reason: "r" }],
        activation_triggers: ["t"],
        pain_points: ["p"],
        success_metrics: ["s"],
        confidence: -0.5,
      },
    ]);
    const result = parseICPProfiles(input);
    expect(result[0].confidence).toBe(1);
    expect(result[1].confidence).toBe(0);
  });

  it("rejects fewer than 2 profiles", () => {
    const input = JSON.stringify([
      {
        name: "Only One",
        description: "D",
        value_moment_priorities: [{ moment_id: "m1", priority: 1, relevance_reason: "r" }],
        activation_triggers: ["t"],
        pain_points: ["p"],
        success_metrics: ["s"],
        confidence: 0.5,
      },
    ]);
    expect(() => parseICPProfiles(input)).toThrow("Expected 2-3 profiles");
  });

  it("rejects profiles with identical moment priorities", () => {
    const input = JSON.stringify([
      {
        name: "A",
        description: "D",
        value_moment_priorities: [{ moment_id: "m1", priority: 1, relevance_reason: "r" }],
        activation_triggers: ["t"],
        pain_points: ["p"],
        success_metrics: ["s"],
        confidence: 0.5,
      },
      {
        name: "B",
        description: "D",
        value_moment_priorities: [{ moment_id: "m1", priority: 2, relevance_reason: "r" }],
        activation_triggers: ["t"],
        pain_points: ["p"],
        success_metrics: ["s"],
        confidence: 0.5,
      },
    ]);
    expect(() => parseICPProfiles(input)).toThrow("identical value_moment_priorities");
  });

  it("rejects missing required fields", () => {
    const input = JSON.stringify([
      { name: "A" },
      { name: "B" },
    ]);
    expect(() => parseICPProfiles(input)).toThrow("missing required field");
  });

  it("rejects non-array response", () => {
    expect(() => parseICPProfiles('{"not":"array"}')).toThrow("Expected array");
  });
});
