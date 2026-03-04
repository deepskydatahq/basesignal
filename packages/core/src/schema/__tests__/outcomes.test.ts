import { describe, it, expect } from "vitest";
import { OutcomeItemSchema, OutcomesSchema } from "../outcomes";

const validOutcome = {
  description: "Increase retention",
  type: "business",
  linkedFeatures: ["onboarding"],
};

const validOutcomes = {
  items: [validOutcome],
  confidence: 0.8,
  evidence: [{ url: "https://example.com", excerpt: "outcome data" }],
};

describe("OutcomeItemSchema", () => {
  it("accepts objects with measurement_references array of {entity, activity} pairs", () => {
    const enriched = {
      ...validOutcome,
      measurement_references: [
        { entity: "sprint", activity: "completed" },
        { entity: "task", activity: "closed" },
      ],
    };
    expect(OutcomeItemSchema.safeParse(enriched).success).toBe(true);
  });

  it("accepts objects with suggested_metrics array of strings", () => {
    const enriched = {
      ...validOutcome,
      suggested_metrics: ["velocity_per_sprint", "tasks_completed_per_week"],
    };
    expect(OutcomeItemSchema.safeParse(enriched).success).toBe(true);
  });

  it("still validates objects without enrichment fields (backward compatible)", () => {
    const result = OutcomeItemSchema.safeParse(validOutcome);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.measurement_references).toBeUndefined();
      expect(result.data.suggested_metrics).toBeUndefined();
    }
  });

  it("accepts empty enrichment arrays", () => {
    const enriched = {
      ...validOutcome,
      measurement_references: [],
      suggested_metrics: [],
    };
    expect(OutcomeItemSchema.safeParse(enriched).success).toBe(true);
  });

  it("rejects measurement_references with missing activity field", () => {
    const bad = {
      ...validOutcome,
      measurement_references: [{ entity: "sprint" }],
    };
    expect(OutcomeItemSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects suggested_metrics with non-string entries", () => {
    const bad = {
      ...validOutcome,
      suggested_metrics: [42],
    };
    expect(OutcomeItemSchema.safeParse(bad).success).toBe(false);
  });
});

describe("OutcomesSchema", () => {
  it("accepts valid outcomes", () => {
    expect(OutcomesSchema.safeParse(validOutcomes).success).toBe(true);
  });

  it("rejects missing description on item", () => {
    const data = {
      ...validOutcomes,
      items: [{ type: "business", linkedFeatures: [] }],
    };
    expect(OutcomesSchema.safeParse(data).success).toBe(false);
  });

  it("accepts empty linkedFeatures array", () => {
    const data = {
      ...validOutcomes,
      items: [{ description: "Outcome", type: "business", linkedFeatures: [] }],
    };
    expect(OutcomesSchema.safeParse(data).success).toBe(true);
  });

  it("accepts outcomes with enriched items", () => {
    const data = {
      ...validOutcomes,
      items: [
        {
          ...validOutcome,
          measurement_references: [{ entity: "sprint", activity: "completed" }],
          suggested_metrics: ["velocity_per_sprint"],
        },
      ],
    };
    expect(OutcomesSchema.safeParse(data).success).toBe(true);
  });
});
