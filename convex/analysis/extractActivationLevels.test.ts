import { describe, it, expect } from "vitest";
import type {
  SignalStrength,
  ActivationCriterion,
  ActivationLevel,
  ActivationLevelsResult,
} from "./extractActivationLevels";

describe("activation level types", () => {
  it("ActivationCriterion has action, count, and optional timeWindow", () => {
    const criterion: ActivationCriterion = {
      action: "create_board",
      count: 1,
    };
    expect(criterion.action).toBe("create_board");
    expect(criterion.count).toBe(1);
    expect(criterion.timeWindow).toBeUndefined();

    const withWindow: ActivationCriterion = {
      action: "invite_member",
      count: 3,
      timeWindow: "first_7d",
    };
    expect(withWindow.timeWindow).toBe("first_7d");
  });

  it("SignalStrength is a union of weak, medium, strong, very_strong", () => {
    const values: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];
    expect(values).toHaveLength(4);
  });

  it("ActivationLevel has required fields", () => {
    const level: ActivationLevel = {
      level: 1,
      name: "explorer",
      signalStrength: "weak",
      criteria: [{ action: "view_page", count: 1 }],
      reasoning: "Users who view a page show initial interest",
      confidence: 0.7,
      evidence: [{ url: "https://example.com", excerpt: "view page" }],
    };
    expect(level.level).toBe(1);
    expect(level.name).toBe("explorer");
    expect(level.signalStrength).toBe("weak");
    expect(level.criteria).toHaveLength(1);
    expect(level.reasoning).toBe("Users who view a page show initial interest");
    expect(level.confidence).toBe(0.7);
    expect(level.evidence).toHaveLength(1);
  });

  it("ActivationLevelsResult has levels, primaryActivation, overallConfidence", () => {
    const result: ActivationLevelsResult = {
      levels: [],
      primaryActivation: 2,
      overallConfidence: 0.8,
    };
    expect(result.levels).toEqual([]);
    expect(result.primaryActivation).toBe(2);
    expect(result.overallConfidence).toBe(0.8);
  });
});
