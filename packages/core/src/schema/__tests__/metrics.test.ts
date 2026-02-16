import { describe, it, expect } from "vitest";
import { MetricsSectionSchema } from "../metrics";

const validMetrics = {
  items: [{ name: "MAU", category: "engagement", linkedTo: ["active"] }],
  confidence: 0.7,
  evidence: [{ url: "https://example.com", excerpt: "metrics data" }],
};

describe("MetricsSectionSchema", () => {
  it("accepts valid metrics", () => {
    expect(MetricsSectionSchema.safeParse(validMetrics).success).toBe(true);
  });

  it("rejects missing name on item", () => {
    const data = {
      ...validMetrics,
      items: [{ category: "engagement", linkedTo: [] }],
    };
    expect(MetricsSectionSchema.safeParse(data).success).toBe(false);
  });

  it("accepts optional formula absent", () => {
    expect(MetricsSectionSchema.safeParse(validMetrics).success).toBe(true);
  });

  it("accepts optional formula present", () => {
    const data = {
      ...validMetrics,
      items: [{ name: "MAU", category: "engagement", formula: "count(active)", linkedTo: [] }],
    };
    expect(MetricsSectionSchema.safeParse(data).success).toBe(true);
  });
});
