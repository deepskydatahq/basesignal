import { describe, it, expect } from "vitest";
import type {
  SignalStrength,
  ActivationCriterion,
  ActivationLevel,
  ActivationLevelsResult,
} from "./extractActivationLevels";
import { parseActivationLevelsResponse } from "./extractActivationLevels";

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

function makeValidResult() {
  return {
    levels: [
      {
        level: 1,
        name: "explorer",
        signalStrength: "weak",
        criteria: [{ action: "view_page", count: 1 }],
        reasoning: "Basic exploration behavior",
        confidence: 0.7,
        evidence: [{ url: "https://example.com", excerpt: "view pages" }],
      },
      {
        level: 2,
        name: "creator",
        signalStrength: "medium",
        criteria: [{ action: "create_board", count: 1 }],
        reasoning: "Creating content signals intent",
        confidence: 0.85,
        evidence: [{ url: "https://example.com/features", excerpt: "create boards" }],
      },
    ],
    primaryActivation: 2,
    overallConfidence: 0.8,
  };
}

describe("parseActivationLevelsResponse", () => {
  it("parses raw JSON response", () => {
    const json = JSON.stringify(makeValidResult());
    const result = parseActivationLevelsResponse(json);
    expect(result.levels).toHaveLength(2);
    expect(result.primaryActivation).toBe(2);
    expect(result.overallConfidence).toBe(0.8);
  });

  it("extracts JSON from code fences with json tag", () => {
    const json = JSON.stringify(makeValidResult());
    const wrapped = "```json\n" + json + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(2);
  });

  it("extracts JSON from code fences without language tag", () => {
    const json = JSON.stringify(makeValidResult());
    const wrapped = "```\n" + json + "\n```";
    const result = parseActivationLevelsResponse(wrapped);
    expect(result.levels).toHaveLength(2);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseActivationLevelsResponse("not json")).toThrow();
  });

  // Top-level required fields
  it("throws when levels is missing", () => {
    const data = makeValidResult();
    const { levels: _, ...noLevels } = data;
    expect(() => parseActivationLevelsResponse(JSON.stringify(noLevels))).toThrow(
      "Missing required field: levels"
    );
  });

  it("throws when levels is not an array", () => {
    const data = { ...makeValidResult(), levels: "not-array" };
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Missing required field: levels"
    );
  });

  it("throws when primaryActivation is missing", () => {
    const data = makeValidResult();
    const { primaryActivation: _, ...noPrimary } = data;
    expect(() => parseActivationLevelsResponse(JSON.stringify(noPrimary))).toThrow(
      "Missing required field: primaryActivation"
    );
  });

  it("throws when overallConfidence is missing", () => {
    const data = makeValidResult();
    const { overallConfidence: _, ...noConf } = data;
    expect(() => parseActivationLevelsResponse(JSON.stringify(noConf))).toThrow(
      "Missing required field: overallConfidence"
    );
  });

  // Per-level required fields
  it("throws when level is missing level number", () => {
    const data = makeValidResult();
    const { level: _, ...noLevel } = data.levels[0];
    data.levels[0] = noLevel as typeof data.levels[0];
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Level missing: level number"
    );
  });

  it("throws when level is missing name", () => {
    const data = makeValidResult();
    const { name: _, ...noName } = data.levels[0];
    data.levels[0] = noName as typeof data.levels[0];
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Level missing: name"
    );
  });

  it("throws when level is missing signalStrength", () => {
    const data = makeValidResult();
    const { signalStrength: _, ...noSignal } = data.levels[0];
    data.levels[0] = noSignal as typeof data.levels[0];
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Invalid signalStrength"
    );
  });

  it("throws when level is missing criteria", () => {
    const data = makeValidResult();
    const { criteria: _, ...noCriteria } = data.levels[0];
    data.levels[0] = noCriteria as typeof data.levels[0];
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Level missing: criteria"
    );
  });

  it("throws when level is missing confidence", () => {
    const data = makeValidResult();
    const { confidence: _, ...noConf } = data.levels[0];
    data.levels[0] = noConf as typeof data.levels[0];
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Level missing: confidence"
    );
  });

  // signalStrength validation
  it("throws on invalid signalStrength value", () => {
    const data = makeValidResult();
    (data.levels[0] as Record<string, unknown>).signalStrength = "invalid";
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Invalid signalStrength: invalid"
    );
  });

  it("accepts all valid signalStrength values", () => {
    for (const strength of ["weak", "medium", "strong", "very_strong"]) {
      const data = makeValidResult();
      (data.levels[0] as Record<string, unknown>).signalStrength = strength;
      const result = parseActivationLevelsResponse(JSON.stringify(data));
      expect(result.levels[0].signalStrength).toBe(strength);
    }
  });

  // Criteria shape validation
  it("throws when criterion is missing action", () => {
    const data = makeValidResult();
    data.levels[0].criteria = [{ count: 1 } as { action: string; count: number }];
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Criterion missing: action"
    );
  });

  it("throws when criterion is missing count", () => {
    const data = makeValidResult();
    data.levels[0].criteria = [{ action: "view" } as { action: string; count: number }];
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "Criterion missing: count"
    );
  });

  it("allows optional timeWindow in criterion", () => {
    const data = makeValidResult();
    data.levels[0].criteria = [{ action: "view", count: 1, timeWindow: "first_7d" }];
    const result = parseActivationLevelsResponse(JSON.stringify(data));
    expect(result.levels[0].criteria[0].timeWindow).toBe("first_7d");
  });

  // Confidence clamping
  it("clamps overallConfidence above 1.0 to 1.0", () => {
    const data = makeValidResult();
    data.overallConfidence = 1.5;
    const result = parseActivationLevelsResponse(JSON.stringify(data));
    expect(result.overallConfidence).toBe(1.0);
  });

  it("clamps overallConfidence below 0 to 0", () => {
    const data = makeValidResult();
    data.overallConfidence = -0.3;
    const result = parseActivationLevelsResponse(JSON.stringify(data));
    expect(result.overallConfidence).toBe(0);
  });

  it("clamps per-level confidence above 1.0 to 1.0", () => {
    const data = makeValidResult();
    data.levels[0].confidence = 2.0;
    const result = parseActivationLevelsResponse(JSON.stringify(data));
    expect(result.levels[0].confidence).toBe(1.0);
  });

  it("clamps per-level confidence below 0 to 0", () => {
    const data = makeValidResult();
    data.levels[0].confidence = -1;
    const result = parseActivationLevelsResponse(JSON.stringify(data));
    expect(result.levels[0].confidence).toBe(0);
  });

  // Sorting
  it("sorts levels by level number ascending", () => {
    const data = makeValidResult();
    // Reverse the levels so level 2 comes first
    data.levels = [data.levels[1], data.levels[0]];
    const result = parseActivationLevelsResponse(JSON.stringify(data));
    expect(result.levels[0].level).toBe(1);
    expect(result.levels[1].level).toBe(2);
  });

  // primaryActivation validation
  it("throws when primaryActivation references non-existent level", () => {
    const data = makeValidResult();
    data.primaryActivation = 99;
    expect(() => parseActivationLevelsResponse(JSON.stringify(data))).toThrow(
      "primaryActivation 99 does not match any level"
    );
  });

  it("accepts primaryActivation that references an existing level", () => {
    const data = makeValidResult();
    data.primaryActivation = 1;
    const result = parseActivationLevelsResponse(JSON.stringify(data));
    expect(result.primaryActivation).toBe(1);
  });
});
