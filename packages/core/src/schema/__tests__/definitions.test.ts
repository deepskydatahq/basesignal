import { describe, it, expect } from "vitest";
import {
  DefinitionsSchema,
  LegacyActivationSchema,
  MultiLevelActivationSchema,
  FirstValueDefinitionSchema,
  SignalStrengthSchema,
  ActivationCriterionSchema,
} from "../definitions";

const legacyActivation = {
  criteria: ["Created first project", "Invited a teammate"],
  timeWindow: "7 days",
  reasoning: "Users who do these actions retain better",
  confidence: 0.8,
  source: "analysis",
  evidence: [{ url: "https://example.com", excerpt: "activation data" }],
};

const multiLevelActivation = {
  levels: [
    {
      level: 1,
      name: "Setup",
      signalStrength: "weak" as const,
      criteria: [{ action: "create_account", count: 1 }],
      reasoning: "Basic setup",
      confidence: 0.6,
      evidence: [{ url: "https://example.com", excerpt: "setup evidence" }],
    },
  ],
  primaryActivation: 1,
  overallConfidence: 0.7,
};

describe("DefinitionsSchema", () => {
  it("accepts legacy activation format", () => {
    const data = { activation: legacyActivation };
    expect(DefinitionsSchema.safeParse(data).success).toBe(true);
  });

  it("accepts multi-level activation format", () => {
    const data = { activation: multiLevelActivation };
    expect(DefinitionsSchema.safeParse(data).success).toBe(true);
  });

  it("rejects data matching neither activation format", () => {
    const data = { activation: { invalid: true } };
    expect(DefinitionsSchema.safeParse(data).success).toBe(false);
  });

  it("accepts firstValue with description", () => {
    const data = {
      firstValue: {
        description: "First value delivered",
        criteria: ["Completed setup"],
        reasoning: "First value reasoning",
        confidence: 0.9,
        source: "analysis",
        evidence: [{ url: "https://example.com", excerpt: "fv evidence" }],
      },
    };
    expect(DefinitionsSchema.safeParse(data).success).toBe(true);
  });

  it("rejects firstValue without description", () => {
    const result = FirstValueDefinitionSchema.safeParse({
      criteria: ["Completed setup"],
      reasoning: "First value reasoning",
      confidence: 0.9,
      source: "analysis",
      evidence: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts active, atRisk, churn with base shape", () => {
    const baseDef = {
      criteria: ["criterion"],
      reasoning: "reason",
      confidence: 0.5,
      source: "manual",
      evidence: [],
    };
    const data = { active: baseDef, atRisk: baseDef, churn: baseDef };
    expect(DefinitionsSchema.safeParse(data).success).toBe(true);
  });

  it("accepts empty object (all sub-definitions optional)", () => {
    expect(DefinitionsSchema.safeParse({}).success).toBe(true);
  });

  it("validates confidence boundary: 0 passes, 1 passes, 1.01 fails", () => {
    const makeDef = (confidence: number) => ({
      criteria: ["c"],
      reasoning: "r",
      confidence,
      source: "s",
      evidence: [],
    });
    expect(DefinitionsSchema.safeParse({ active: makeDef(0) }).success).toBe(true);
    expect(DefinitionsSchema.safeParse({ active: makeDef(1) }).success).toBe(true);
    expect(DefinitionsSchema.safeParse({ active: makeDef(1.01) }).success).toBe(false);
  });
});

describe("SignalStrengthSchema", () => {
  it.each(["weak", "medium", "strong", "very_strong"])("accepts '%s'", (val) => {
    expect(SignalStrengthSchema.safeParse(val).success).toBe(true);
  });

  it("rejects invalid value", () => {
    expect(SignalStrengthSchema.safeParse("invalid").success).toBe(false);
  });
});

describe("ActivationCriterionSchema", () => {
  it("accepts valid criterion", () => {
    expect(ActivationCriterionSchema.safeParse({ action: "login", count: 3 }).success).toBe(true);
  });

  it("rejects count of 0", () => {
    expect(ActivationCriterionSchema.safeParse({ action: "login", count: 0 }).success).toBe(false);
  });

  it("rejects negative count", () => {
    expect(ActivationCriterionSchema.safeParse({ action: "login", count: -1 }).success).toBe(false);
  });

  it("rejects non-integer count", () => {
    expect(ActivationCriterionSchema.safeParse({ action: "login", count: 1.5 }).success).toBe(false);
  });
});
