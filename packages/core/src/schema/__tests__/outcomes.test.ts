import { describe, it, expect } from "vitest";
import { OutcomesSchema } from "../outcomes";

const validOutcomes = {
  items: [{ description: "Increase retention", type: "business", linkedFeatures: ["onboarding"] }],
  confidence: 0.8,
  evidence: [{ url: "https://example.com", excerpt: "outcome data" }],
};

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
});
