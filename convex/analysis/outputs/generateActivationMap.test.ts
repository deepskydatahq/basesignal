import { describe, it, expect } from "vitest";
import {
  ACTIVATION_MAP_SYSTEM_PROMPT,
  buildActivationMapUserPrompt,
  parseActivationMapResponse,
} from "./generateActivationMap";
import type {
  ActivationMap,
  ActivationMapStage,
  ActivationMapTransition,
} from "./generateActivationMap";
import type { ActivationLevel } from "../extractActivationLevels";
import type { ValueMoment } from "../convergence/types";

// --- Linear Fixture Data ---
// Simulates a project management tool like Linear with 4 activation levels

const linearActivationLevels: ActivationLevel[] = [
  {
    level: 1,
    name: "explorer",
    signalStrength: "weak",
    criteria: [
      { action: "create_issue", count: 1 },
      { action: "browse_projects", count: 1 },
    ],
    reasoning: "Initial exploration of issue tracking capabilities",
    confidence: 0.7,
    evidence: [{ url: "https://linear.app/features", excerpt: "Create your first issue" }],
  },
  {
    level: 2,
    name: "workflow_learner",
    signalStrength: "medium",
    criteria: [
      { action: "create_project", count: 1 },
      { action: "assign_issue", count: 3 },
      { action: "use_status_workflow", count: 5 },
    ],
    reasoning: "Learning the workflow management capabilities",
    confidence: 0.65,
    evidence: [
      { url: "https://linear.app/docs/workflows", excerpt: "Customize your workflow" },
    ],
  },
  {
    level: 3,
    name: "workflow_optimizer",
    signalStrength: "strong",
    criteria: [
      { action: "complete_cycle", count: 1, timeWindow: "2 weeks" },
      { action: "use_automations", count: 2 },
      { action: "track_metrics", count: 1 },
    ],
    reasoning: "Completing a full development cycle demonstrates core value realization",
    confidence: 0.8,
    evidence: [
      { url: "https://linear.app/docs/cycles", excerpt: "Track progress through cycles" },
    ],
  },
  {
    level: 4,
    name: "product_workflow_master",
    signalStrength: "very_strong",
    criteria: [
      { action: "integrate_github", count: 1 },
      { action: "team_active_users", count: 5 },
      { action: "use_roadmap", count: 1 },
    ],
    reasoning: "Full team adoption with integrations and roadmap planning",
    confidence: 0.75,
    evidence: [
      { url: "https://linear.app/docs/integrations", excerpt: "Connect your GitHub repos" },
    ],
  },
];

const linearValueMoments: ValueMoment[] = [
  {
    id: "vm-1",
    name: "Quick issue creation",
    description: "Create and track issues in seconds",
    tier: 3,
    lenses: ["jtbd"],
    lens_count: 1,
    roles: ["developer"],
    product_surfaces: ["issue_tracker"],
    contributing_candidates: ["c-1"],
  },
  {
    id: "vm-2",
    name: "Workflow automation",
    description: "Automate repetitive status updates and assignments",
    tier: 2,
    lenses: ["jtbd", "workflows"],
    lens_count: 2,
    roles: ["team_lead", "developer"],
    product_surfaces: ["automations", "workflows"],
    contributing_candidates: ["c-2", "c-3"],
  },
  {
    id: "vm-3",
    name: "Cycle completion visibility",
    description: "See team progress through development cycles",
    tier: 1,
    lenses: ["jtbd", "outcomes", "workflows"],
    lens_count: 3,
    roles: ["team_lead", "product_manager"],
    product_surfaces: ["cycles", "metrics"],
    contributing_candidates: ["c-4", "c-5", "c-6"],
  },
  {
    id: "vm-4",
    name: "Cross-tool integration",
    description: "Seamless connection between Linear and development tools",
    tier: 2,
    lenses: ["workflows", "gains"],
    lens_count: 2,
    roles: ["developer", "team_lead"],
    product_surfaces: ["integrations"],
    contributing_candidates: ["c-7", "c-8"],
  },
  {
    id: "vm-5",
    name: "Team velocity tracking",
    description: "Measure and improve team delivery speed over time",
    tier: 1,
    lenses: ["jtbd", "outcomes", "gains"],
    lens_count: 3,
    roles: ["product_manager", "engineering_manager"],
    product_surfaces: ["analytics", "cycles"],
    contributing_candidates: ["c-9", "c-10", "c-11"],
  },
];

// --- Linear Fixture LLM Response (4 stages) ---

const linearFixtureResponse = JSON.stringify({
  stages: [
    {
      level: 1,
      name: "explorer",
      signal_strength: "weak",
      trigger_events: ["create_issue", "browse_projects"],
      value_moments_unlocked: ["Quick issue creation"],
      drop_off_risk: {
        level: "medium",
        reason: "Users may not see value beyond basic issue tracking without team context",
      },
    },
    {
      level: 2,
      name: "workflow_learner",
      signal_strength: "medium",
      trigger_events: ["create_project", "assign_issue", "use_status_workflow"],
      value_moments_unlocked: ["Workflow automation"],
      drop_off_risk: {
        level: "high",
        reason:
          "Transition from individual to team adoption requires behavior change from entire team",
      },
    },
    {
      level: 3,
      name: "workflow_optimizer",
      signal_strength: "strong",
      trigger_events: ["complete_cycle", "use_automations", "track_metrics"],
      value_moments_unlocked: ["Cycle completion visibility"],
      drop_off_risk: {
        level: "low",
        reason: "Users at this stage have realized core value and are unlikely to churn",
      },
    },
    {
      level: 4,
      name: "product_workflow_master",
      signal_strength: "very_strong",
      trigger_events: ["integrate_github", "team_active_users", "use_roadmap"],
      value_moments_unlocked: ["Cross-tool integration", "Team velocity tracking"],
      drop_off_risk: {
        level: "low",
        reason: "Deep integration and team dependency make switching costly",
      },
    },
  ],
  transitions: [
    {
      from_level: 1,
      to_level: 2,
      trigger_events: ["create_project", "invite_team_member"],
      typical_timeframe: "1-3 days",
    },
    {
      from_level: 2,
      to_level: 3,
      trigger_events: ["complete_first_cycle", "configure_automations"],
      typical_timeframe: "1-2 weeks",
    },
    {
      from_level: 3,
      to_level: 4,
      trigger_events: ["connect_github", "onboard_5_users"],
      typical_timeframe: "2-4 weeks",
    },
  ],
  primary_activation_level: 3,
  confidence: "medium",
  sources: ["activation_levels", "value_moments"],
});

// --- Tests ---

describe("ActivationMap types", () => {
  it("ActivationMapStage has required fields", () => {
    const stage: ActivationMapStage = {
      level: 1,
      name: "explorer",
      signal_strength: "weak",
      trigger_events: ["create_issue"],
      value_moments_unlocked: ["Quick issue creation"],
      drop_off_risk: { level: "low", reason: "Expected early churn" },
    };
    expect(stage.level).toBe(1);
    expect(stage.name).toBe("explorer");
    expect(stage.signal_strength).toBe("weak");
    expect(stage.trigger_events).toHaveLength(1);
    expect(stage.value_moments_unlocked).toHaveLength(1);
    expect(stage.drop_off_risk.level).toBe("low");
    expect(stage.drop_off_risk.reason).toBeTruthy();
  });

  it("ActivationMapTransition has required fields", () => {
    const transition: ActivationMapTransition = {
      from_level: 1,
      to_level: 2,
      trigger_events: ["invite_team"],
      typical_timeframe: "1-3 days",
    };
    expect(transition.from_level).toBe(1);
    expect(transition.to_level).toBe(2);
    expect(transition.trigger_events).toHaveLength(1);
    expect(transition.typical_timeframe).toBe("1-3 days");
  });

  it("ActivationMapTransition typical_timeframe is optional", () => {
    const transition: ActivationMapTransition = {
      from_level: 1,
      to_level: 2,
      trigger_events: ["invite_team"],
    };
    expect(transition.typical_timeframe).toBeUndefined();
  });

  it("ActivationMap has required fields", () => {
    const map: ActivationMap = {
      stages: [],
      transitions: [],
      primary_activation_level: 2,
      confidence: "medium",
      sources: ["activation_levels"],
    };
    expect(map.stages).toEqual([]);
    expect(map.transitions).toEqual([]);
    expect(map.primary_activation_level).toBe(2);
    expect(map.confidence).toBe("medium");
    expect(map.sources).toEqual(["activation_levels"]);
  });
});

describe("ACTIVATION_MAP_SYSTEM_PROMPT", () => {
  it("contains 'activation levels'", () => {
    expect(ACTIVATION_MAP_SYSTEM_PROMPT).toContain("activation levels");
  });

  it("contains 'value moments'", () => {
    expect(ACTIVATION_MAP_SYSTEM_PROMPT).toContain("value moments");
  });

  it("contains 'trigger_events'", () => {
    expect(ACTIVATION_MAP_SYSTEM_PROMPT).toContain("trigger_events");
  });

  it("contains 'drop_off_risk'", () => {
    expect(ACTIVATION_MAP_SYSTEM_PROMPT).toContain("drop_off_risk");
  });

  it("contains 'stages'", () => {
    expect(ACTIVATION_MAP_SYSTEM_PROMPT).toContain("stages");
  });
});

describe("buildActivationMapUserPrompt", () => {
  it("formats activation levels with criteria", () => {
    const prompt = buildActivationMapUserPrompt(
      linearActivationLevels,
      linearValueMoments,
      3,
    );

    expect(prompt).toContain("## Activation Levels");
    expect(prompt).toContain("Level 1: explorer");
    expect(prompt).toContain("Level 2: workflow_learner");
    expect(prompt).toContain("Level 3: workflow_optimizer");
    expect(prompt).toContain("Level 4: product_workflow_master");
    expect(prompt).toContain("Signal Strength: weak");
    expect(prompt).toContain("Signal Strength: strong");
    expect(prompt).toContain("create_issue (count: 1)");
    expect(prompt).toContain("complete_cycle (count: 1 within 2 weeks)");
  });

  it("formats value moments with tiers and roles", () => {
    const prompt = buildActivationMapUserPrompt(
      linearActivationLevels,
      linearValueMoments,
      3,
    );

    expect(prompt).toContain("## Value Moments");
    expect(prompt).toContain("Quick issue creation (Tier 3)");
    expect(prompt).toContain("Cycle completion visibility (Tier 1)");
    expect(prompt).toContain("Roles: developer");
    expect(prompt).toContain("Roles: team_lead, product_manager");
  });

  it("includes primary activation level", () => {
    const prompt = buildActivationMapUserPrompt(
      linearActivationLevels,
      linearValueMoments,
      3,
    );

    expect(prompt).toContain("## Primary Activation Level: 3");
    expect(prompt).toContain("aha moment");
  });
});

describe("parseActivationMapResponse", () => {
  describe("successful parsing", () => {
    it("parses raw JSON response", () => {
      const result = parseActivationMapResponse(linearFixtureResponse);
      expect(result.stages).toHaveLength(4);
      expect(result.transitions).toHaveLength(3);
      expect(result.primary_activation_level).toBe(3);
      expect(result.confidence).toBe("medium");
      expect(result.sources).toEqual(["activation_levels", "value_moments"]);
    });

    it("parses code-fenced JSON response", () => {
      const fenced = "```json\n" + linearFixtureResponse + "\n```";
      const result = parseActivationMapResponse(fenced);
      expect(result.stages).toHaveLength(4);
      expect(result.primary_activation_level).toBe(3);
    });

    it("parses code-fenced JSON without language tag", () => {
      const fenced = "```\n" + linearFixtureResponse + "\n```";
      const result = parseActivationMapResponse(fenced);
      expect(result.stages).toHaveLength(4);
    });

    it("returns 4 stages matching activation levels count (Linear fixture)", () => {
      const result = parseActivationMapResponse(linearFixtureResponse);
      expect(result.stages.length).toBe(4);
    });

    it("each stage has non-empty trigger_events", () => {
      const result = parseActivationMapResponse(linearFixtureResponse);
      for (const stage of result.stages) {
        expect(stage.trigger_events.length).toBeGreaterThan(0);
      }
    });

    it("value moments are distributed across at least 2 stages", () => {
      const result = parseActivationMapResponse(linearFixtureResponse);
      const stagesWithMoments = result.stages.filter(
        (s) => s.value_moments_unlocked.length > 0,
      );
      expect(stagesWithMoments.length).toBeGreaterThanOrEqual(2);
    });

    it("at least one stage has medium or high drop_off_risk", () => {
      const result = parseActivationMapResponse(linearFixtureResponse);
      const hasRisk = result.stages.some((s) =>
        ["medium", "high"].includes(s.drop_off_risk.level),
      );
      expect(hasRisk).toBe(true);
    });

    it("primary_activation_level is 3 (cycle completion)", () => {
      const result = parseActivationMapResponse(linearFixtureResponse);
      expect(result.primary_activation_level).toBe(3);
    });

    it("sorts stages by level ascending", () => {
      // Create a response with stages out of order
      const outOfOrder = JSON.parse(linearFixtureResponse);
      outOfOrder.stages = [
        outOfOrder.stages[2],
        outOfOrder.stages[0],
        outOfOrder.stages[3],
        outOfOrder.stages[1],
      ];
      const result = parseActivationMapResponse(JSON.stringify(outOfOrder));
      expect(result.stages[0].level).toBe(1);
      expect(result.stages[1].level).toBe(2);
      expect(result.stages[2].level).toBe(3);
      expect(result.stages[3].level).toBe(4);
    });

    it("stage names match expected Linear progression", () => {
      const result = parseActivationMapResponse(linearFixtureResponse);
      expect(result.stages[0].name).toBe("explorer");
      expect(result.stages[1].name).toBe("workflow_learner");
      expect(result.stages[2].name).toBe("workflow_optimizer");
      expect(result.stages[3].name).toBe("product_workflow_master");
    });

    it("transitions connect consecutive levels", () => {
      const result = parseActivationMapResponse(linearFixtureResponse);
      expect(result.transitions[0].from_level).toBe(1);
      expect(result.transitions[0].to_level).toBe(2);
      expect(result.transitions[1].from_level).toBe(2);
      expect(result.transitions[1].to_level).toBe(3);
      expect(result.transitions[2].from_level).toBe(3);
      expect(result.transitions[2].to_level).toBe(4);
    });
  });

  describe("validation errors - missing top-level fields", () => {
    it("throws when stages is missing", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.stages;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Missing required field: stages",
      );
    });

    it("throws when transitions is missing", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.transitions;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Missing required field: transitions",
      );
    });

    it("throws when primary_activation_level is missing", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.primary_activation_level;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Missing required field: primary_activation_level",
      );
    });

    it("throws when confidence is missing", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.confidence;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Missing required field: confidence",
      );
    });

    it("throws when sources is missing", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.sources;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Missing required field: sources",
      );
    });
  });

  describe("validation errors - invalid stage fields", () => {
    it("throws when stage is missing level", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.stages[0].level;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Stage 0 missing required field: level",
      );
    });

    it("throws when stage is missing name", () => {
      const data = JSON.parse(linearFixtureResponse);
      data.stages[0].name = "";
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Stage 0 missing required field: name",
      );
    });

    it("throws when stage has empty trigger_events", () => {
      const data = JSON.parse(linearFixtureResponse);
      data.stages[0].trigger_events = [];
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Stage 0 missing required field: trigger_events",
      );
    });

    it("throws when stage is missing signal_strength", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.stages[0].signal_strength;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Stage 0 missing required field: signal_strength",
      );
    });

    it("throws when stage is missing drop_off_risk", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.stages[0].drop_off_risk;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Stage 0 missing required field: drop_off_risk",
      );
    });

    it("throws when drop_off_risk is missing level", () => {
      const data = JSON.parse(linearFixtureResponse);
      data.stages[0].drop_off_risk = { reason: "some reason" };
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Stage 0 drop_off_risk missing required field: level",
      );
    });

    it("throws when drop_off_risk is missing reason", () => {
      const data = JSON.parse(linearFixtureResponse);
      data.stages[0].drop_off_risk = { level: "high" };
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Stage 0 drop_off_risk missing required field: reason",
      );
    });
  });

  describe("validation errors - primary_activation_level mismatch", () => {
    it("throws when primary_activation_level doesn't match any stage", () => {
      const data = JSON.parse(linearFixtureResponse);
      data.primary_activation_level = 99;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "primary_activation_level 99 does not match any stage level",
      );
    });
  });

  describe("validation errors - invalid transition fields", () => {
    it("throws when transition is missing from_level", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.transitions[0].from_level;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Transition 0 missing required field: from_level",
      );
    });

    it("throws when transition is missing to_level", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.transitions[0].to_level;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Transition 0 missing required field: to_level",
      );
    });

    it("throws when transition is missing trigger_events", () => {
      const data = JSON.parse(linearFixtureResponse);
      delete data.transitions[0].trigger_events;
      expect(() => parseActivationMapResponse(JSON.stringify(data))).toThrow(
        "Transition 0 missing required field: trigger_events",
      );
    });
  });

  describe("edge cases", () => {
    it("throws on invalid JSON", () => {
      expect(() => parseActivationMapResponse("not json")).toThrow();
    });

    it("handles sources with non-string values by converting", () => {
      const data = JSON.parse(linearFixtureResponse);
      data.sources = [123, true, "activation_levels"];
      const result = parseActivationMapResponse(JSON.stringify(data));
      expect(result.sources).toEqual(["123", "true", "activation_levels"]);
    });
  });
});
