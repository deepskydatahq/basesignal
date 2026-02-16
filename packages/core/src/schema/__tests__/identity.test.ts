import { describe, it, expect } from "vitest";
import { CoreIdentitySchema } from "../identity";

const validIdentity = {
  productName: "Basesignal",
  description: "Product P&L measurement",
  targetCustomer: "Product leaders",
  businessModel: "SaaS",
  industry: "Tech",
  companyStage: "Growth",
  confidence: 0.85,
  evidence: [{ url: "https://example.com", excerpt: "Evidence text" }],
};

describe("CoreIdentitySchema", () => {
  it("accepts valid identity with all fields", () => {
    const result = CoreIdentitySchema.safeParse(validIdentity);
    expect(result.success).toBe(true);
  });

  it("accepts valid identity with only required fields", () => {
    const { industry, companyStage, ...required } = validIdentity;
    const result = CoreIdentitySchema.safeParse(required);
    expect(result.success).toBe(true);
  });

  it("rejects missing productName", () => {
    const { productName, ...rest } = validIdentity;
    const result = CoreIdentitySchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("productName"))).toBe(true);
    }
  });

  it("rejects empty productName", () => {
    const result = CoreIdentitySchema.safeParse({ ...validIdentity, productName: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid confidence", () => {
    const result = CoreIdentitySchema.safeParse({ ...validIdentity, confidence: 1.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("confidence"))).toBe(true);
    }
  });

  it("rejects invalid evidence entry (missing excerpt)", () => {
    const result = CoreIdentitySchema.safeParse({
      ...validIdentity,
      evidence: [{ url: "https://example.com" }],
    });
    expect(result.success).toBe(false);
  });
});
