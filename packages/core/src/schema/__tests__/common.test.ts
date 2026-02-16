import { describe, it, expect } from "vitest";
import { EvidenceSchema, ConfidenceSchema } from "../common";

describe("EvidenceSchema", () => {
  it("accepts a valid evidence object", () => {
    const result = EvidenceSchema.safeParse({
      url: "https://example.com",
      excerpt: "Some excerpt",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing url", () => {
    const result = EvidenceSchema.safeParse({ excerpt: "Some excerpt" });
    expect(result.success).toBe(false);
  });

  it("rejects missing excerpt", () => {
    const result = EvidenceSchema.safeParse({ url: "https://example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string url", () => {
    const result = EvidenceSchema.safeParse({ url: "", excerpt: "Some excerpt" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string excerpt", () => {
    const result = EvidenceSchema.safeParse({ url: "https://example.com", excerpt: "" });
    expect(result.success).toBe(false);
  });
});

describe("ConfidenceSchema", () => {
  it("accepts 0", () => {
    expect(ConfidenceSchema.safeParse(0).success).toBe(true);
  });

  it("accepts 1", () => {
    expect(ConfidenceSchema.safeParse(1).success).toBe(true);
  });

  it("accepts 0.5", () => {
    expect(ConfidenceSchema.safeParse(0.5).success).toBe(true);
  });

  it("rejects 1.01", () => {
    expect(ConfidenceSchema.safeParse(1.01).success).toBe(false);
  });

  it("rejects -0.1", () => {
    expect(ConfidenceSchema.safeParse(-0.1).success).toBe(false);
  });
});
