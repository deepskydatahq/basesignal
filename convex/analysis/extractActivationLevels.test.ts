import { describe, expect, test } from "vitest";
import {
  SIGNAL_STRENGTHS,
  type SignalStrength,
  type ActivationCriterion,
  type ActivationLevel,
  type ActivationLevelsResult,
} from "./extractActivationLevels";

describe("ActivationCriterion", () => {
  test("has action, count, and optional timeWindow", () => {
    const criterion: ActivationCriterion = {
      action: "complete_onboarding",
      count: 1,
    };
    expect(criterion.action).toBe("complete_onboarding");
    expect(criterion.count).toBe(1);
    expect(criterion.timeWindow).toBeUndefined();

    const withWindow: ActivationCriterion = {
      action: "invite_teammate",
      count: 2,
      timeWindow: "within 7 days",
    };
    expect(withWindow.timeWindow).toBe("within 7 days");
  });
});

describe("ActivationLevel", () => {
  test("has level, name, signalStrength, criteria[], reasoning, confidence, evidence[]", () => {
    const level: ActivationLevel = {
      level: 1,
      name: "Basic Setup",
      signalStrength: "weak",
      criteria: [{ action: "create_account", count: 1 }],
      reasoning: "Account creation is the first signal",
      confidence: 0.8,
      evidence: [{ url: "https://example.com", excerpt: "Sign up for free" }],
    };

    expect(level.level).toBe(1);
    expect(level.name).toBe("Basic Setup");
    expect(level.signalStrength).toBe("weak");
    expect(level.criteria).toHaveLength(1);
    expect(level.criteria[0].action).toBe("create_account");
    expect(level.reasoning).toBe("Account creation is the first signal");
    expect(level.confidence).toBe(0.8);
    expect(level.evidence).toHaveLength(1);
    expect(level.evidence[0].url).toBe("https://example.com");
    expect(level.evidence[0].excerpt).toBe("Sign up for free");
  });
});

describe("SignalStrength", () => {
  test("is typed as union: weak | medium | strong | very_strong", () => {
    const values: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];
    expect(values).toEqual(["weak", "medium", "strong", "very_strong"]);
  });

  test("SIGNAL_STRENGTHS constant contains all valid values", () => {
    expect(SIGNAL_STRENGTHS).toEqual(["weak", "medium", "strong", "very_strong"]);
  });
});

describe("ActivationLevelsResult", () => {
  test("has levels[], primaryActivation, overallConfidence", () => {
    const result: ActivationLevelsResult = {
      levels: [
        {
          level: 1,
          name: "Basic",
          signalStrength: "weak",
          criteria: [{ action: "signup", count: 1 }],
          reasoning: "First step",
          confidence: 0.7,
          evidence: [],
        },
        {
          level: 2,
          name: "Engaged",
          signalStrength: "strong",
          criteria: [
            { action: "create_project", count: 1 },
            { action: "invite_team", count: 1, timeWindow: "within 14 days" },
          ],
          reasoning: "Shows real engagement",
          confidence: 0.6,
          evidence: [{ url: "https://example.com/docs", excerpt: "collaborate with your team" }],
        },
      ],
      primaryActivation: 2,
      overallConfidence: 0.65,
    };

    expect(result.levels).toHaveLength(2);
    expect(result.primaryActivation).toBe(2);
    expect(result.overallConfidence).toBe(0.65);
  });
});
