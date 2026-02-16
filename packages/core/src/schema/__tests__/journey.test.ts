import { describe, it, expect } from "vitest";
import { JourneyStagesSchema } from "../journey";

const validJourney = {
  stages: [{ name: "Onboarding", description: "First-time setup", order: 1 }],
  confidence: 0.75,
  evidence: [{ url: "https://example.com", excerpt: "Journey info" }],
};

describe("JourneyStagesSchema", () => {
  it("accepts valid journey with stages", () => {
    expect(JourneyStagesSchema.safeParse(validJourney).success).toBe(true);
  });

  it("rejects stage missing description", () => {
    const data = {
      ...validJourney,
      stages: [{ name: "Onboarding", order: 1 }],
    };
    expect(JourneyStagesSchema.safeParse(data).success).toBe(false);
  });

  it("rejects order as non-number", () => {
    const data = {
      ...validJourney,
      stages: [{ name: "Onboarding", description: "Setup", order: "first" }],
    };
    expect(JourneyStagesSchema.safeParse(data).success).toBe(false);
  });
});
