import { describe, it, expect } from "vitest";
import type { Evidence, SignalStrength, ConfidenceLevel } from "../common";

describe("Evidence", () => {
  it("has url and excerpt fields", () => {
    const evidence: Evidence = {
      url: "https://example.com/features",
      excerpt: "Get started by creating your first board",
    };
    expect(evidence.url).toBe("https://example.com/features");
    expect(evidence.excerpt).toContain("first board");
  });
});

describe("SignalStrength", () => {
  it("includes all 4 strength levels", () => {
    const strengths: SignalStrength[] = ["weak", "medium", "strong", "very_strong"];
    expect(strengths).toHaveLength(4);
  });
});

describe("ConfidenceLevel", () => {
  it("includes high, medium, low", () => {
    const levels: ConfidenceLevel[] = ["high", "medium", "low"];
    expect(levels).toHaveLength(3);
  });
});
