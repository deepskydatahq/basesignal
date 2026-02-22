import { describe, it, expect } from "vitest";
import {
  buildLifecycleStatesPrompt,
  parseLifecycleStatesResponse,
  generateLifecycleStates,
} from "../../outputs/lifecycle-states.js";
import type { ActivationLevel } from "@basesignal/core";
import type { LlmProvider, ValueMoment, IdentityResult } from "../../types.js";
import type { ActivationMapResult } from "../../outputs/activation-map.js";

// --- Inline Fixtures ---

const sampleIdentity: IdentityResult = {
  productName: "ProjectBoard",
  description: "Project management for engineering teams",
  targetCustomer: "Engineering managers at mid-size SaaS companies",
  businessModel: "B2B SaaS",
  confidence: 0.85,
  evidence: [],
};

const sampleActivationLevels: ActivationLevel[] = [
  {
    level: 1,
    name: "explorer",
    signalStrength: "weak",
    criteria: [{ action: "create_board", count: 1 }],
    reasoning: "Initial interest",
    confidence: 0.7,
    evidence: [],
  },
  {
    level: 2,
    name: "builder",
    signalStrength: "medium",
    criteria: [{ action: "invite_member", count: 2 }],
    reasoning: "Team adoption",
    confidence: 0.6,
    evidence: [],
  },
];

const sampleValueMoments: ValueMoment[] = [
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
];

const sampleActivationMap: ActivationMapResult = {
  stages: [
    {
      level: 1,
      name: "explorer",
      signal_strength: "weak",
      trigger_events: ["create_board"],
      value_moments_unlocked: ["Board creation"],
      drop_off_risk: { level: "medium", reason: "May not invite team" },
    },
    {
      level: 2,
      name: "builder",
      signal_strength: "medium",
      trigger_events: ["invite_member"],
      value_moments_unlocked: ["Sprint planning"],
      drop_off_risk: { level: "high", reason: "Team adoption hurdle" },
    },
  ],
  transitions: [
    { from_level: 1, to_level: 2, trigger_events: ["invite_member"], typical_timeframe: "1-3 days" },
  ],
  primary_activation_level: 2,
  confidence: "medium",
  sources: ["activation_levels"],
};

const VALID_LIFECYCLE_RESPONSE = {
  states: [
    {
      name: "new",
      definition: "Users who just signed up but haven't taken key actions",
      entry_criteria: [{ event_name: "user_signed_up", condition: "account created" }],
      exit_triggers: ["create_board"],
      time_window: "0-7 days",
    },
    {
      name: "activated",
      definition: "Users who completed initial activation criteria",
      entry_criteria: [{ event_name: "create_board", condition: "at least 1 board created" }],
      exit_triggers: ["invite_member", "create_sprint"],
      time_window: "1-14 days",
    },
    {
      name: "engaged",
      definition: "Users actively using the product on a regular basis",
      entry_criteria: [{ event_name: "sprint_completed", condition: "2+ sprints completed" }],
      exit_triggers: ["no_activity_7d"],
    },
    {
      name: "at_risk",
      definition: "Users showing declining engagement patterns",
      entry_criteria: [{ event_name: "activity_decline", condition: "50% drop in weekly actions" }],
      exit_triggers: ["re_engage", "no_activity_30d"],
      time_window: "7-30 days",
    },
    {
      name: "dormant",
      definition: "Users who have stopped engaging entirely",
      entry_criteria: [{ event_name: "no_activity", condition: "no actions in 30 days" }],
      exit_triggers: ["login"],
      time_window: "30+ days",
    },
    {
      name: "churned",
      definition: "Users who have cancelled or abandoned the product",
      entry_criteria: [{ event_name: "subscription_cancelled", condition: "account cancelled or 90 days inactive" }],
      exit_triggers: ["reactivate"],
    },
    {
      name: "resurrected",
      definition: "Users who returned after being dormant or churned",
      entry_criteria: [{ event_name: "login_after_dormant", condition: "login after 30+ days of inactivity" }],
      exit_triggers: ["complete_action"],
    },
  ],
  transitions: [
    { from: "new", to: "activated", trigger: "create_board" },
    { from: "activated", to: "engaged", trigger: "sprint_completed" },
    { from: "engaged", to: "at_risk", trigger: "activity_decline" },
    { from: "at_risk", to: "dormant", trigger: "no_activity_30d" },
    { from: "dormant", to: "churned", trigger: "subscription_cancelled" },
    { from: "dormant", to: "resurrected", trigger: "login_after_dormant" },
    { from: "at_risk", to: "engaged", trigger: "re_engage" },
  ],
  confidence: 0.75,
  sources: ["activation_levels", "activation_map", "value_moments"],
};

// --- Tests ---

describe("buildLifecycleStatesPrompt", () => {
  it("includes product name and business model", () => {
    const prompt = buildLifecycleStatesPrompt(
      sampleIdentity,
      sampleValueMoments,
      sampleActivationLevels,
      sampleActivationMap,
    );
    expect(prompt).toContain("ProjectBoard");
    expect(prompt).toContain("B2B SaaS");
  });

  it("includes value moment names and activation level names", () => {
    const prompt = buildLifecycleStatesPrompt(
      sampleIdentity,
      sampleValueMoments,
      sampleActivationLevels,
      sampleActivationMap,
    );
    expect(prompt).toContain("Sprint planning");
    expect(prompt).toContain("explorer");
    expect(prompt).toContain("builder");
  });
});

describe("parseLifecycleStatesResponse", () => {
  it("parses valid 7-state JSON", () => {
    const result = parseLifecycleStatesResponse(
      JSON.stringify(VALID_LIFECYCLE_RESPONSE),
    );
    expect(result.states).toHaveLength(7);
    expect(result.states[0].name).toBe("new");
    expect(result.states[0].entry_criteria).toHaveLength(1);
    expect(result.transitions).toHaveLength(7);
    expect(result.confidence).toBe(0.75);
    expect(result.sources).toContain("activation_levels");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLifecycleStatesResponse("not json")).toThrow();
  });
});

describe("generateLifecycleStates", () => {
  it("returns valid result with 7+ states and transitions", async () => {
    const result = await generateLifecycleStates(
      {
        identity: sampleIdentity,
        valueMoments: sampleValueMoments,
        activationLevels: sampleActivationLevels,
        activationMap: sampleActivationMap,
      },
      { complete: async () => JSON.stringify(VALID_LIFECYCLE_RESPONSE) } as LlmProvider,
    );

    expect(result.states.length).toBeGreaterThanOrEqual(7);
    expect(result.transitions.length).toBeGreaterThan(0);
    expect(result.states.map((s) => s.name)).toContain("new");
    expect(result.states.map((s) => s.name)).toContain("activated");
    expect(result.states.map((s) => s.name)).toContain("churned");
    expect(result.confidence).toBe(0.75);
  });
});
