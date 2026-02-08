import { describe, it, expect } from "vitest";
import {
  suggestLevel,
  aggregateActivationInputs,
} from "./aggregateActivationInputs";
import type {
  SuggestedMapping,
  ActivationInputData,
} from "./aggregateActivationInputs";
import type { ActivationLevelsResult } from "../extractActivationLevels";
import type { ConvergenceResult, ValueMomentTier } from "../convergence/types";

// --- Fixtures: Linear-realistic data ---

const linearActivationResult: ActivationLevelsResult = {
  levels: [
    {
      level: 1,
      name: "explorer",
      signalStrength: "weak",
      criteria: [{ action: "create_issue", count: 1 }],
      reasoning: "First issue creation shows initial interest",
      confidence: 0.7,
      evidence: [{ url: "https://linear.app/features", excerpt: "Create your first issue" }],
    },
    {
      level: 2,
      name: "workflow_learner",
      signalStrength: "medium",
      criteria: [
        { action: "create_project", count: 1 },
        { action: "set_status", count: 5 },
      ],
      reasoning: "Setting up projects and tracking status shows learning",
      confidence: 0.6,
      evidence: [{ url: "https://linear.app/docs", excerpt: "Organize work into projects" }],
    },
    {
      level: 3,
      name: "workflow_optimizer",
      signalStrength: "strong",
      criteria: [
        { action: "create_cycle", count: 1 },
        { action: "invite_member", count: 2 },
      ],
      reasoning: "Running cycles with team shows core value realized",
      confidence: 0.8,
      evidence: [{ url: "https://linear.app/method", excerpt: "Plan work in cycles" }],
    },
    {
      level: 4,
      name: "product_workflow_master",
      signalStrength: "very_strong",
      criteria: [
        { action: "create_roadmap", count: 1 },
        { action: "integrate_github", count: 1 },
      ],
      reasoning: "Full workflow integration with roadmaps and dev tools",
      confidence: 0.75,
      evidence: [{ url: "https://linear.app/integrations", excerpt: "Connect your development workflow" }],
    },
  ],
  primaryActivation: 3,
  overallConfidence: 0.7,
};

const linearConvergenceResult: ConvergenceResult = {
  value_moments: [
    {
      id: "vm-001",
      name: "First issue tracked to completion",
      description: "User creates an issue and moves it through to done",
      tier: 1 as ValueMomentTier,
      lenses: ["jtbd", "outcomes", "workflows", "pains", "gains"],
      lens_count: 5,
      roles: ["developer", "pm"],
      product_surfaces: ["issues", "board"],
      contributing_candidates: ["c1", "c2", "c3", "c4", "c5"],
    },
    {
      id: "vm-002",
      name: "Team velocity becomes visible",
      description: "Cycle reports show team progress and velocity trends",
      tier: 1 as ValueMomentTier,
      lenses: ["jtbd", "outcomes", "gains", "workflows", "alternatives"],
      lens_count: 5,
      roles: ["pm", "lead"],
      product_surfaces: ["cycles", "analytics"],
      contributing_candidates: ["c6", "c7", "c8", "c9", "c10"],
    },
    {
      id: "vm-003",
      name: "Project scope organized",
      description: "Work organized into projects with clear ownership",
      tier: 2 as ValueMomentTier,
      lenses: ["jtbd", "workflows", "outcomes"],
      lens_count: 3,
      roles: ["pm"],
      product_surfaces: ["projects"],
      contributing_candidates: ["c11", "c12", "c13"],
    },
    {
      id: "vm-004",
      name: "Developer workflow streamlined",
      description: "GitHub integration auto-updates issue status from PRs",
      tier: 2 as ValueMomentTier,
      lenses: ["workflows", "pains", "gains", "alternatives"],
      lens_count: 4,
      roles: ["developer"],
      product_surfaces: ["integrations", "issues"],
      contributing_candidates: ["c14", "c15", "c16", "c17"],
    },
    {
      id: "vm-005",
      name: "Quick issue capture",
      description: "Keyboard shortcuts enable rapid issue creation",
      tier: 3 as ValueMomentTier,
      lenses: ["workflows", "pains"],
      lens_count: 2,
      roles: ["developer"],
      product_surfaces: ["issues"],
      contributing_candidates: ["c18", "c19"],
    },
    {
      id: "vm-006",
      name: "Status at a glance",
      description: "Board view shows current state of all work",
      tier: 3 as ValueMomentTier,
      lenses: ["outcomes"],
      lens_count: 1,
      roles: ["pm", "lead"],
      product_surfaces: ["board"],
      contributing_candidates: ["c20"],
    },
  ],
  clusters: [],
  stats: {
    total_candidates: 20,
    total_clusters: 6,
    total_moments: 6,
    tier_1_count: 2,
    tier_2_count: 2,
    tier_3_count: 2,
  },
};

// --- suggestLevel tests ---

describe("suggestLevel", () => {
  describe("T1 (75% of maxLevel)", () => {
    it("maxLevel 3 → 3", () => {
      expect(suggestLevel(1, 3)).toBe(3); // ceil(3 * 0.75) = ceil(2.25) = 3
    });

    it("maxLevel 4 → 3", () => {
      expect(suggestLevel(1, 4)).toBe(3); // ceil(4 * 0.75) = ceil(3) = 3
    });

    it("maxLevel 5 → 4", () => {
      expect(suggestLevel(1, 5)).toBe(4); // ceil(5 * 0.75) = ceil(3.75) = 4
    });
  });

  describe("T2 (50% of maxLevel)", () => {
    it("maxLevel 3 → 2", () => {
      expect(suggestLevel(2, 3)).toBe(2); // ceil(3 * 0.5) = ceil(1.5) = 2
    });

    it("maxLevel 4 → 2", () => {
      expect(suggestLevel(2, 4)).toBe(2); // ceil(4 * 0.5) = ceil(2) = 2
    });

    it("maxLevel 5 → 3", () => {
      expect(suggestLevel(2, 5)).toBe(3); // ceil(5 * 0.5) = ceil(2.5) = 3
    });
  });

  describe("T3 (25% of maxLevel)", () => {
    it("maxLevel 3 → 1", () => {
      expect(suggestLevel(3, 3)).toBe(1); // ceil(3 * 0.25) = ceil(0.75) = 1
    });

    it("maxLevel 4 → 1", () => {
      expect(suggestLevel(3, 4)).toBe(1); // ceil(4 * 0.25) = ceil(1) = 1
    });

    it("maxLevel 5 → 2", () => {
      expect(suggestLevel(3, 5)).toBe(2); // ceil(5 * 0.25) = ceil(1.25) = 2
    });
  });

  describe("edge case: maxLevel 1", () => {
    it("all tiers map to 1", () => {
      expect(suggestLevel(1, 1)).toBe(1);
      expect(suggestLevel(2, 1)).toBe(1);
      expect(suggestLevel(3, 1)).toBe(1);
    });
  });

  describe("edge case: maxLevel 2", () => {
    it("T1 → 2, T2 → 1, T3 → 1", () => {
      expect(suggestLevel(1, 2)).toBe(2); // ceil(2 * 0.75) = ceil(1.5) = 2
      expect(suggestLevel(2, 2)).toBe(1); // ceil(2 * 0.5) = ceil(1) = 1
      expect(suggestLevel(3, 2)).toBe(1); // ceil(2 * 0.25) = ceil(0.5) = 1
    });
  });
});

// --- aggregateActivationInputs tests ---

describe("aggregateActivationInputs", () => {
  it("includes all activation levels from input", () => {
    const result = aggregateActivationInputs(
      linearActivationResult,
      linearConvergenceResult,
    );
    expect(result.activation_levels).toEqual(linearActivationResult.levels);
    expect(result.activation_levels).toHaveLength(4);
  });

  it("includes all value moments from input", () => {
    const result = aggregateActivationInputs(
      linearActivationResult,
      linearConvergenceResult,
    );
    expect(result.value_moments).toEqual(linearConvergenceResult.value_moments);
    expect(result.value_moments).toHaveLength(6);
  });

  it("pre-maps value moments to suggested stages based on tier", () => {
    const result = aggregateActivationInputs(
      linearActivationResult,
      linearConvergenceResult,
    );

    expect(result.suggested_mappings).toHaveLength(6);

    // T1 moments (vm-001, vm-002) → level 3 (ceil(4 * 0.75) = 3)
    const t1Mappings = result.suggested_mappings.filter((m) => m.tier === 1);
    expect(t1Mappings).toHaveLength(2);
    for (const m of t1Mappings) {
      expect(m.suggested_level).toBe(3);
    }

    // T2 moments (vm-003, vm-004) → level 2 (ceil(4 * 0.5) = 2)
    const t2Mappings = result.suggested_mappings.filter((m) => m.tier === 2);
    expect(t2Mappings).toHaveLength(2);
    for (const m of t2Mappings) {
      expect(m.suggested_level).toBe(2);
    }

    // T3 moments (vm-005, vm-006) → level 1 (ceil(4 * 0.25) = 1)
    const t3Mappings = result.suggested_mappings.filter((m) => m.tier === 3);
    expect(t3Mappings).toHaveLength(2);
    for (const m of t3Mappings) {
      expect(m.suggested_level).toBe(1);
    }
  });

  it("sets primary_activation_level from input", () => {
    const result = aggregateActivationInputs(
      linearActivationResult,
      linearConvergenceResult,
    );
    expect(result.primary_activation_level).toBe(3);
  });

  it("maps moment_id and moment_name correctly in suggested_mappings", () => {
    const result = aggregateActivationInputs(
      linearActivationResult,
      linearConvergenceResult,
    );

    expect(result.suggested_mappings[0].moment_id).toBe("vm-001");
    expect(result.suggested_mappings[0].moment_name).toBe("First issue tracked to completion");
    expect(result.suggested_mappings[5].moment_id).toBe("vm-006");
    expect(result.suggested_mappings[5].moment_name).toBe("Status at a glance");
  });

  it("handles minimal data (1 level, 1 moment)", () => {
    const minActivation: ActivationLevelsResult = {
      levels: [
        {
          level: 1,
          name: "starter",
          signalStrength: "weak",
          criteria: [{ action: "sign_up", count: 1 }],
          reasoning: "Basic signup",
          confidence: 0.5,
          evidence: [],
        },
      ],
      primaryActivation: 1,
      overallConfidence: 0.5,
    };

    const minConvergence: ConvergenceResult = {
      value_moments: [
        {
          id: "vm-solo",
          name: "Account created",
          description: "User creates an account",
          tier: 2 as ValueMomentTier,
          lenses: ["jtbd", "outcomes", "pains"],
          lens_count: 3,
          roles: ["user"],
          product_surfaces: ["auth"],
          contributing_candidates: ["c1"],
        },
      ],
      clusters: [],
      stats: {
        total_candidates: 1,
        total_clusters: 1,
        total_moments: 1,
        tier_1_count: 0,
        tier_2_count: 1,
        tier_3_count: 0,
      },
    };

    const result = aggregateActivationInputs(minActivation, minConvergence);

    expect(result.activation_levels).toHaveLength(1);
    expect(result.value_moments).toHaveLength(1);
    expect(result.suggested_mappings).toHaveLength(1);
    // maxLevel=1, T2: ceil(1 * 0.5) = ceil(0.5) = 1
    expect(result.suggested_mappings[0].suggested_level).toBe(1);
    expect(result.primary_activation_level).toBe(1);
  });

  it("handles empty value moments", () => {
    const emptyConvergence: ConvergenceResult = {
      value_moments: [],
      clusters: [],
      stats: {
        total_candidates: 0,
        total_clusters: 0,
        total_moments: 0,
        tier_1_count: 0,
        tier_2_count: 0,
        tier_3_count: 0,
      },
    };

    const result = aggregateActivationInputs(
      linearActivationResult,
      emptyConvergence,
    );

    expect(result.activation_levels).toHaveLength(4);
    expect(result.value_moments).toHaveLength(0);
    expect(result.suggested_mappings).toHaveLength(0);
  });
});

// --- Linear integration test ---

describe("Linear integration test", () => {
  it("4 levels with value moment suggestions", () => {
    const result = aggregateActivationInputs(
      linearActivationResult,
      linearConvergenceResult,
    );

    // AC5: 4 activation levels
    expect(result.activation_levels).toHaveLength(4);
    expect(result.activation_levels.map((l) => l.name)).toEqual([
      "explorer",
      "workflow_learner",
      "workflow_optimizer",
      "product_workflow_master",
    ]);

    // AC5: 6 suggested mappings (one per value moment)
    expect(result.suggested_mappings).toHaveLength(6);

    // AC5: Correct proportional level assignments for maxLevel=4
    // T1 → ceil(4 * 0.75) = 3
    expect(result.suggested_mappings[0]).toEqual({
      moment_id: "vm-001",
      moment_name: "First issue tracked to completion",
      tier: 1,
      suggested_level: 3,
    });
    expect(result.suggested_mappings[1]).toEqual({
      moment_id: "vm-002",
      moment_name: "Team velocity becomes visible",
      tier: 1,
      suggested_level: 3,
    });

    // T2 → ceil(4 * 0.5) = 2
    expect(result.suggested_mappings[2]).toEqual({
      moment_id: "vm-003",
      moment_name: "Project scope organized",
      tier: 2,
      suggested_level: 2,
    });
    expect(result.suggested_mappings[3]).toEqual({
      moment_id: "vm-004",
      moment_name: "Developer workflow streamlined",
      tier: 2,
      suggested_level: 2,
    });

    // T3 → ceil(4 * 0.25) = 1
    expect(result.suggested_mappings[4]).toEqual({
      moment_id: "vm-005",
      moment_name: "Quick issue capture",
      tier: 3,
      suggested_level: 1,
    });
    expect(result.suggested_mappings[5]).toEqual({
      moment_id: "vm-006",
      moment_name: "Status at a glance",
      tier: 3,
      suggested_level: 1,
    });

    // Primary activation level
    expect(result.primary_activation_level).toBe(3);

    // Value moments are passed through unchanged
    expect(result.value_moments).toHaveLength(6);
    expect(result.value_moments[0].id).toBe("vm-001");
    expect(result.value_moments[5].id).toBe("vm-006");
  });
});

// --- Type tests ---

describe("type contracts", () => {
  it("SuggestedMapping has required fields", () => {
    const mapping: SuggestedMapping = {
      moment_id: "vm-001",
      moment_name: "Test moment",
      tier: 1,
      suggested_level: 3,
    };
    expect(mapping.moment_id).toBe("vm-001");
    expect(mapping.moment_name).toBe("Test moment");
    expect(mapping.tier).toBe(1);
    expect(mapping.suggested_level).toBe(3);
  });

  it("ActivationInputData has required fields", () => {
    const data: ActivationInputData = {
      activation_levels: [],
      value_moments: [],
      suggested_mappings: [],
      primary_activation_level: 1,
    };
    expect(data.activation_levels).toEqual([]);
    expect(data.value_moments).toEqual([]);
    expect(data.suggested_mappings).toEqual([]);
    expect(data.primary_activation_level).toBe(1);
  });
});
