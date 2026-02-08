import { describe, expect, it } from "vitest";
import { aggregateMeasurementInputsCore } from "./aggregateMeasurementInputs";
import type { MeasurementInputData } from "./types";

// --- Test fixture helpers ---

function makeValueMoments() {
  return [
    {
      id: "vm-1",
      name: "Streamlined Issue Tracking",
      description: "Teams track issues through completion efficiently",
      tier: 1 as const,
      lenses: ["jtbd" as const, "outcomes" as const, "workflows" as const, "pains" as const, "gains" as const],
      lens_count: 5,
      roles: ["engineering_lead", "product_manager"],
      product_surfaces: ["web_app", "mobile_app"],
      contributing_candidates: ["c1", "c2", "c3"],
    },
    {
      id: "vm-2",
      name: "Cross-Team Visibility",
      description: "Leadership gets real-time project visibility",
      tier: 1 as const,
      lenses: ["jtbd" as const, "outcomes" as const, "alternatives" as const, "gains" as const, "emotions" as const],
      lens_count: 5,
      roles: ["executive", "product_manager"],
      product_surfaces: ["web_app", "dashboard"],
      contributing_candidates: ["c4", "c5"],
    },
    {
      id: "vm-3",
      name: "Developer Flow State",
      description: "Developers maintain focus with minimal context switching",
      tier: 2 as const,
      lenses: ["workflows" as const, "pains" as const, "emotions" as const],
      lens_count: 3,
      roles: ["developer"],
      product_surfaces: ["ide_extension", "cli"],
      contributing_candidates: ["c6"],
    },
    {
      id: "vm-4",
      name: "Sprint Predictability",
      description: "Teams reliably predict and deliver sprint commitments",
      tier: 2 as const,
      lenses: ["outcomes" as const, "gains" as const, "workflows" as const],
      lens_count: 3,
      roles: ["engineering_lead", "scrum_master"],
      product_surfaces: ["web_app"],
      contributing_candidates: ["c7", "c8"],
    },
  ];
}

function makeActivationLevels() {
  return [
    {
      level: 1,
      name: "explorer",
      signalStrength: "weak" as const,
      criteria: [
        { action: "create_issue", count: 1 },
        { action: "view_board", count: 1 },
      ],
      reasoning: "Creating the first issue shows initial interest",
      confidence: 0.7,
      evidence: [{ url: "https://linear.app/features", excerpt: "Get started by creating your first issue" }],
    },
    {
      level: 2,
      name: "builder",
      signalStrength: "medium" as const,
      criteria: [
        { action: "create_project", count: 1 },
        { action: "assign_issue", count: 3 },
      ],
      reasoning: "Organizing work into projects shows learning the product",
      confidence: 0.6,
      evidence: [{ url: "https://linear.app/docs/projects", excerpt: "Organize issues into projects" }],
    },
    {
      level: 3,
      name: "collaborator",
      signalStrength: "strong" as const,
      criteria: [
        { action: "invite_teammate", count: 1 },
        { action: "complete_cycle", count: 1 },
      ],
      reasoning: "Team collaboration is the core value proposition",
      confidence: 0.8,
      evidence: [{ url: "https://linear.app/docs/teams", excerpt: "Invite your team to collaborate" }],
    },
    {
      level: 4,
      name: "champion",
      signalStrength: "very_strong" as const,
      criteria: [
        { action: "create_workflow", count: 1 },
        { action: "integrate_tool", count: 2, timeWindow: "30d" },
      ],
      reasoning: "Custom workflows indicate deep adoption",
      confidence: 0.5,
      evidence: [{ url: "https://linear.app/docs/workflows", excerpt: "Create custom workflows" }],
    },
  ];
}

function makeICPProfiles() {
  return [
    {
      id: "icp-1",
      name: "Growth-Stage Engineering Leader",
      description: "VP/Director of Engineering at 50-200 person company",
      characteristics: ["manages 5-15 engineers", "reports to CTO"],
      goals: ["ship faster", "reduce cycle time"],
      pain_points: ["too many tools", "lack of visibility"],
    },
    {
      id: "icp-2",
      name: "Product Manager",
      description: "PM at a SaaS company managing 2-3 squads",
      characteristics: ["cross-functional collaborator", "data-driven"],
      goals: ["align roadmap with outcomes", "track feature impact"],
      pain_points: ["disconnected tools", "manual reporting"],
    },
    {
      id: "icp-3",
      name: "Individual Contributor Developer",
      description: "Senior engineer focused on deep work",
      characteristics: ["keyboard-first workflow", "values speed"],
      goals: ["minimize context switches", "ship code quickly"],
      pain_points: ["noisy notifications", "slow interfaces"],
    },
  ];
}

function makeActivationMap() {
  return {
    stages: [
      {
        name: "Awareness",
        description: "User discovers the product",
        order: 1,
        key_actions: ["visit_website", "read_docs"],
        success_signals: ["signup"],
      },
      {
        name: "Activation",
        description: "User experiences core value",
        order: 2,
        key_actions: ["create_issue", "invite_teammate"],
        success_signals: ["first_issue_completed"],
      },
      {
        name: "Engagement",
        description: "User builds habit",
        order: 3,
        key_actions: ["daily_usage", "create_project"],
        success_signals: ["weekly_active"],
      },
      {
        name: "Expansion",
        description: "User invites others and expands usage",
        order: 4,
        key_actions: ["invite_team", "integrate_tool"],
        success_signals: ["team_adoption"],
      },
    ],
  };
}

function makeProfile(overrides: Record<string, unknown> = {}) {
  const base = {
    convergence: {
      value_moments: makeValueMoments(),
      clusters: [],
      stats: {
        total_candidates: 20,
        total_clusters: 8,
        total_moments: 4,
        tier_1_count: 2,
        tier_2_count: 2,
        tier_3_count: 0,
      },
    },
    definitions: {
      activation: {
        levels: makeActivationLevels(),
        primaryActivation: 3,
        overallConfidence: 0.65,
      },
    },
    icpProfiles: makeICPProfiles(),
    activationMap: makeActivationMap(),
  };
  return { ...base, ...overrides };
}

// --- Tests ---

describe("aggregateMeasurementInputsCore", () => {
  it("returns all four sections when profile is complete", () => {
    const profile = makeProfile();
    const result: MeasurementInputData = aggregateMeasurementInputsCore(profile);

    expect(result.value_moments).toBeDefined();
    expect(result.value_moments).toHaveLength(4);
    expect(result.activation_levels).toBeDefined();
    expect(result.activation_levels).toHaveLength(4);
    expect(result.icp_profiles).toBeDefined();
    expect(result.icp_profiles).toHaveLength(3);
    expect(result.activation_map).toBeDefined();
    expect(result.activation_map.stages).toHaveLength(4);
  });

  it("value_moments include product_surfaces", () => {
    const profile = makeProfile();
    const result = aggregateMeasurementInputsCore(profile);

    for (const moment of result.value_moments) {
      expect(moment.product_surfaces).toBeDefined();
      expect(Array.isArray(moment.product_surfaces)).toBe(true);
      expect(moment.product_surfaces.length).toBeGreaterThan(0);
    }
    expect(result.value_moments[0].product_surfaces).toEqual(["web_app", "mobile_app"]);
  });

  it("activation_levels include criteria", () => {
    const profile = makeProfile();
    const result = aggregateMeasurementInputsCore(profile);

    for (const level of result.activation_levels) {
      expect(level.criteria).toBeDefined();
      expect(Array.isArray(level.criteria)).toBe(true);
      expect(level.criteria.length).toBeGreaterThan(0);
    }
    expect(result.activation_levels[0].criteria[0].action).toBe("create_issue");
  });

  it("icp_profiles pass through unchanged", () => {
    const profile = makeProfile();
    const input = makeICPProfiles();
    const result = aggregateMeasurementInputsCore(profile);

    expect(result.icp_profiles).toEqual(input);
  });

  it("activation_map includes stages", () => {
    const profile = makeProfile();
    const result = aggregateMeasurementInputsCore(profile);

    expect(result.activation_map.stages).toBeDefined();
    expect(result.activation_map.stages).toHaveLength(4);
    expect(result.activation_map.stages[0].name).toBe("Awareness");
    expect(result.activation_map.stages[3].name).toBe("Expansion");
  });

  it("throws when convergence is missing", () => {
    const profile = makeProfile({ convergence: undefined });

    expect(() => aggregateMeasurementInputsCore(profile)).toThrow(
      "convergence.value_moments"
    );
  });

  it("throws when convergence.value_moments is missing", () => {
    const profile = makeProfile({ convergence: { stats: {} } });

    expect(() => aggregateMeasurementInputsCore(profile)).toThrow(
      "convergence.value_moments"
    );
  });

  it("throws when definitions.activation is missing", () => {
    const profile = makeProfile({ definitions: {} });

    expect(() => aggregateMeasurementInputsCore(profile)).toThrow(
      "definitions.activation"
    );
  });

  it("throws when definitions is missing entirely", () => {
    const profile = makeProfile({ definitions: undefined });

    expect(() => aggregateMeasurementInputsCore(profile)).toThrow(
      "definitions.activation"
    );
  });

  it("throws when icpProfiles is missing", () => {
    const profile = makeProfile({ icpProfiles: undefined });

    expect(() => aggregateMeasurementInputsCore(profile)).toThrow("icpProfiles");
  });

  it("throws when activationMap is missing", () => {
    const profile = makeProfile({ activationMap: undefined });

    expect(() => aggregateMeasurementInputsCore(profile)).toThrow("activationMap");
  });

  it("lists all missing sections in single error", () => {
    expect(() => aggregateMeasurementInputsCore({})).toThrow(
      /Missing required profile sections:/
    );

    try {
      aggregateMeasurementInputsCore({});
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain("convergence.value_moments");
      expect(msg).toContain("definitions.activation");
      expect(msg).toContain("icpProfiles");
      expect(msg).toContain("activationMap");
    }
  });

  it("Linear integration: comprehensive input data", () => {
    const profile = makeProfile();
    const result = aggregateMeasurementInputsCore(profile);

    // Verify comprehensive data: 4 value moments, 4 activation levels, 3 ICP profiles, 4 stages
    expect(result.value_moments.length).toBeGreaterThanOrEqual(4);
    expect(result.activation_levels).toHaveLength(4);
    expect(result.icp_profiles).toHaveLength(3);
    expect(result.activation_map.stages).toHaveLength(4);

    // Verify value moments have tier distribution
    const tier1 = result.value_moments.filter((m) => m.tier === 1);
    const tier2 = result.value_moments.filter((m) => m.tier === 2);
    expect(tier1.length).toBeGreaterThanOrEqual(2);
    expect(tier2.length).toBeGreaterThanOrEqual(2);

    // Verify activation levels have signal strength progression
    expect(result.activation_levels[0].signalStrength).toBe("weak");
    expect(result.activation_levels[3].signalStrength).toBe("very_strong");

    // Verify ICP profiles have required fields
    for (const profile of result.icp_profiles) {
      expect(profile.id).toBeDefined();
      expect(profile.name).toBeDefined();
      expect(profile.characteristics.length).toBeGreaterThan(0);
      expect(profile.goals.length).toBeGreaterThan(0);
    }

    // Verify activation map stages are ordered
    for (let i = 0; i < result.activation_map.stages.length - 1; i++) {
      expect(result.activation_map.stages[i].order).toBeLessThan(
        result.activation_map.stages[i + 1].order
      );
    }
  });
});
