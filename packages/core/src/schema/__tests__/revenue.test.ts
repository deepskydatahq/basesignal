import { describe, it, expect } from "vitest";
import { RevenueArchitectureSchema } from "../revenue";

const validRevenue = {
  model: "Subscription",
  billingUnit: "per seat",
  hasFreeTier: true,
  tiers: [{ name: "Free", price: "$0", features: ["Basic"] }],
  expansionPaths: ["Upsell to Pro"],
  contractionRisks: ["Downgrades"],
  confidence: 0.9,
  evidence: [{ url: "https://pricing.example.com", excerpt: "Pricing details" }],
};

describe("RevenueArchitectureSchema", () => {
  it("accepts valid revenue with all fields", () => {
    expect(RevenueArchitectureSchema.safeParse(validRevenue).success).toBe(true);
  });

  it("rejects missing hasFreeTier", () => {
    const { hasFreeTier, ...rest } = validRevenue;
    expect(RevenueArchitectureSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects tier with empty name", () => {
    const data = { ...validRevenue, tiers: [{ name: "", price: "$0", features: [] }] };
    expect(RevenueArchitectureSchema.safeParse(data).success).toBe(false);
  });

  it("accepts empty tiers array", () => {
    const data = { ...validRevenue, tiers: [] };
    expect(RevenueArchitectureSchema.safeParse(data).success).toBe(true);
  });

  it("accepts without optional billingUnit", () => {
    const { billingUnit, ...rest } = validRevenue;
    expect(RevenueArchitectureSchema.safeParse(rest).success).toBe(true);
  });
});
