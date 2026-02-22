import { describe, it, expect } from "vitest";
import {
  buildLifecycleStatesPrompt,
  parseLifecycleStatesResponse,
  generateLifecycleStates,
  LIFECYCLE_STATES_SYSTEM_PROMPT,
} from "../../outputs/lifecycle-states.js";
import type { ActivationLevel } from "@basesignal/core";
import type { LlmProvider, ValueMoment, IdentityResult, ActivationLevelsResult } from "../../types.js";
import type { ActivationMapResult } from "../../outputs/activation-map.js";

// --- Inline fixtures ---

const sampleIdentity: IdentityResult = {
  productName: "ProjectBoard",
  description: "B2B project management tool for engineering teams",
  targetCustomer: "Engineering managers at mid-size companies",
  businessModel: "B2B SaaS subscription",
  industry: "Project Management",
  confidence: 0.85,
  evidence: [],
};

const sampleValueMoments: ValueMoment[] = [
  {
    id: "vm-1",
    name: "Sprint velocity insight",
    description: "Team sees velocity trends across sprints",
    tier: 1,
    lens_count: 3,
    lenses: ["capability_mapping"],
    roles: ["Engineering Manager"],
    product_surfaces: ["Dashboard"],
    contributing_candidates: [],
    is_coherent: true,
  },
  {
    id: "vm-2",
    name: "Quick task creation",
    description: "Create and assign tasks in seconds",
    tier: 2,
    lens_count: 2,
    lenses: ["workflow_analysis"],
    roles: ["Developer"],
    product_surfaces: ["Board View"],
    contributing_candidates: [],
    is_coherent: true,
  },
];

const sampleActivationLevels: ActivationLevel[] = [
  {
    level: 1,
    name: "explorer",
    signalStrength: "weak",
    criteria: [{ action: "create_project", count: 1 }],
    reasoning: "Initial project setup",
    confidence: 0.7,
    evidence: [],
  },
  {
    level: 2,
    name: "builder",
    signalStrength: "medium",
    criteria: [
      { action: "invite_member", count: 2, timeWindow: "7 days" },
      { action: "create_sprint", count: 1 },
    ],
    reasoning: "Team adoption signals",
    confidence: 0.6,
    evidence: [],
  },
];

const sampleActivationMap: ActivationMapResult = {
  stages: [
    {
      level: 1,
      name: "explorer",
      signal_strength: "weak",
      trigger_events: ["create_project"],
      value_moments_unlocked: ["Quick task creation"],
      drop_off_risk: { level: "medium", reason: "May not invite team" },
    },
    {
      level: 2,
      name: "builder",
      signal_strength: "medium",
      trigger_events: ["invite_member", "create_sprint"],
      value_moments_unlocked: ["Sprint velocity insight"],
      drop_off_risk: { level: "high", reason: "Team adoption hurdle" },
    },
  ],
  transitions: [
    {
      from_level: 1,
      to_level: 2,
      trigger_events: ["invite_member"],
      typical_timeframe: "1-3 days",
    },
  ],
  primary_activation_level: 2,
  confidence: "medium",
  sources: ["activation_levels", "value_moments"],
};

const sampleActivationLevelsResult: ActivationLevelsResult = {
  levels: sampleActivationLevels,
  primaryActivation: 2,
  overallConfidence: 0.7,
};

const sampleInputData = {
  identity: sampleIdentity,
  value_moments: sampleValueMoments,
  activation_levels: sampleActivationLevelsResult,
  activation_map: sampleActivationMap,
};

const validLifecycleStatesJson = JSON.stringify({
  states: [
    {
      name: "new",
      definition: "Users who signed up but haven't created a project",
      entry_criteria: [
        { event_name: "user_signed_up", condition: "account created" },
      ],
      exit_triggers: [
        {
          event_name: "create_project",
          condition: "first project created",
        },
      ],
      time_window: "7 days",
    },
    {
      name: "activated",
      definition:
        "Users who invited team members and created their first sprint",
      entry_criteria: [
        {
          event_name: "invite_member",
          condition: "at least 2 members invited",
          threshold: 2,
        },
        { event_name: "create_sprint", condition: "first sprint created" },
      ],
      exit_triggers: [
        {
          event_name: "sprint_completed",
          condition: "completed first sprint",
        },
      ],
      time_window: "14 days",
    },
    {
      name: "engaged",
      definition: "Users regularly completing sprints and tracking velocity",
      entry_criteria: [
        {
          event_name: "sprint_completed",
          condition: "at least 2 sprints completed",
          threshold: 2,
        },
      ],
      exit_triggers: [
        {
          event_name: "session_gap",
          condition: "no activity for 14 days",
        },
      ],
      time_window: "30 days",
    },
    {
      name: "at_risk",
      definition:
        "Users showing declining sprint activity or reduced team participation",
      entry_criteria: [
        {
          event_name: "session_gap",
          condition: "no activity for 7 days",
        },
      ],
      exit_triggers: [
        {
          event_name: "session_gap",
          condition: "no activity for 30 days",
        },
      ],
      time_window: "14 days",
    },
    {
      name: "dormant",
      definition: "Users who stopped using ProjectBoard for over 2 weeks",
      entry_criteria: [
        {
          event_name: "session_gap",
          condition: "no activity for 14 days",
        },
      ],
      exit_triggers: [
        {
          event_name: "session_gap",
          condition: "no activity for 60 days",
        },
      ],
      time_window: "30 days",
    },
    {
      name: "churned",
      definition:
        "Users who have been inactive for over 60 days with no engagement",
      entry_criteria: [
        {
          event_name: "session_gap",
          condition: "no activity for 60 days",
        },
      ],
      exit_triggers: [
        {
          event_name: "session_started",
          condition: "user returns to app",
        },
      ],
    },
    {
      name: "resurrected",
      definition:
        "Previously churned users who returned and took meaningful action",
      entry_criteria: [
        {
          event_name: "create_sprint",
          condition: "created sprint after churned period",
        },
      ],
      exit_triggers: [
        {
          event_name: "sprint_completed",
          condition: "completed a sprint after returning",
        },
      ],
      time_window: "14 days",
    },
  ],
  transitions: [
    {
      from_state: "new",
      to_state: "activated",
      trigger_conditions: ["User invites 2+ members and creates first sprint"],
      typical_timeframe: "1-7 days",
    },
    {
      from_state: "activated",
      to_state: "engaged",
      trigger_conditions: ["User completes 2+ sprints with team"],
      typical_timeframe: "2-4 weeks",
    },
    {
      from_state: "engaged",
      to_state: "at_risk",
      trigger_conditions: ["No sprint activity for 7+ days"],
      typical_timeframe: "1-2 weeks",
    },
    {
      from_state: "at_risk",
      to_state: "dormant",
      trigger_conditions: ["No activity for 14+ days"],
    },
    {
      from_state: "dormant",
      to_state: "churned",
      trigger_conditions: ["No activity for 60+ days"],
    },
    {
      from_state: "churned",
      to_state: "resurrected",
      trigger_conditions: [
        "User returns and creates a sprint after 60+ day absence",
      ],
    },
  ],
  confidence: 0.75,
  sources: ["activation_levels", "value_moments", "product_identity"],
});

// --- Mock LLM ---

function createMockLlm(response: string): LlmProvider {
  return {
    complete: async () => response,
  } as LlmProvider;
}

// --- Tests ---

describe("buildLifecycleStatesPrompt", () => {
  it("includes product context for time window calibration", () => {
    const { user } = buildLifecycleStatesPrompt(sampleInputData);
    expect(user).toContain("ProjectBoard");
    expect(user).toContain("Engineering managers");
  });

  it("includes activation levels and value moments", () => {
    const { user } = buildLifecycleStatesPrompt(sampleInputData);
    expect(user).toContain("Level 1: explorer");
    expect(user).toContain("Level 2: builder");
    expect(user).toContain("Sprint velocity insight");
    expect(user).toContain("Quick task creation");
  });

  it("includes activation criteria with time windows", () => {
    const { user } = buildLifecycleStatesPrompt(sampleInputData);
    expect(user).toContain("explorer");
    expect(user).toContain("builder");
  });
});

describe("parseLifecycleStatesResponse", () => {
  it("parses valid lifecycle states JSON via Zod", () => {
    const result = parseLifecycleStatesResponse(validLifecycleStatesJson);
    expect(result.states).toHaveLength(7);
    expect(result.transitions).toHaveLength(6);
    expect(result.confidence).toBe(0.75);
    expect(result.sources).toContain("activation_levels");
  });

  it("rejects response missing required fields", () => {
    const invalid = JSON.stringify({ transitions: [], confidence: 0.5 });
    expect(() => parseLifecycleStatesResponse(invalid)).toThrow();
  });

  it("passes through states without deep validation (uses type assertion)", () => {
    // The parser does minimal validation (checks arrays exist, confidence is number)
    // but does not validate individual state entries — uses `as` casts
    const minimal = JSON.stringify({
      states: [{ name: "new", definition: "new users" }],
      transitions: [],
      confidence: 0.5,
    });
    const result = parseLifecycleStatesResponse(minimal);
    expect(result.states).toHaveLength(1);
    expect(result.confidence).toBe(0.5);
  });
});

describe("generateLifecycleStates", () => {
  it("calls LLM and returns parsed result", async () => {
    const llm = createMockLlm(validLifecycleStatesJson);
    const result = await generateLifecycleStates(sampleInputData, llm);

    expect(result.states).toHaveLength(7);
    expect(result.states[0].name).toBe("new");
    expect(result.transitions).toHaveLength(6);
    expect(result.confidence).toBe(0.75);
  });

  it("throws on empty LLM response", async () => {
    const llm = createMockLlm("");
    await expect(
      generateLifecycleStates(sampleInputData, llm),
    ).rejects.toThrow();
  });

  it("throws on whitespace-only LLM response", async () => {
    const llm = createMockLlm("   \n  ");
    await expect(
      generateLifecycleStates(sampleInputData, llm),
    ).rejects.toThrow();
  });

  it("throws on invalid LLM response (Zod validation failure)", async () => {
    const llm = createMockLlm(JSON.stringify({ not: "valid" }));
    await expect(
      generateLifecycleStates(sampleInputData, llm),
    ).rejects.toThrow();
  });

  it("passes system prompt and user prompt to LLM", async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];
    const llm: LlmProvider = {
      complete: async (messages) => {
        capturedMessages = messages as Array<{
          role: string;
          content: string;
        }>;
        return validLifecycleStatesJson;
      },
    } as LlmProvider;

    await generateLifecycleStates(sampleInputData, llm);

    expect(capturedMessages).toHaveLength(2);
    expect(capturedMessages[0].role).toBe("system");
    expect(capturedMessages[0].content).toBe(LIFECYCLE_STATES_SYSTEM_PROMPT);
    expect(capturedMessages[1].role).toBe("user");
    expect(capturedMessages[1].content).toContain("ProjectBoard");
  });
});
