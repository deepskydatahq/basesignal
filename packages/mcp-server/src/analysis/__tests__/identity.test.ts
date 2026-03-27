import { describe, it, expect } from "vitest";
import { parseIdentityResponse, filterIdentityPages } from "../identity.js";
import type { CrawledPage } from "../types.js";

describe("parseIdentityResponse", () => {
  it("parses valid identity JSON", () => {
    const input = JSON.stringify({
      productName: "TestApp",
      description: "A test product",
      targetCustomer: "Developers",
      businessModel: "B2B SaaS",
      confidence: 0.85,
      evidence: [{ url: "https://example.com", excerpt: "A test product" }],
    });
    const result = parseIdentityResponse(input);
    expect(result.productName).toBe("TestApp");
    expect(result.confidence).toBe(0.85);
    expect(result.evidence).toHaveLength(1);
  });

  it("handles code fences", () => {
    const json = JSON.stringify({
      productName: "App",
      description: "Desc",
      targetCustomer: "Users",
      businessModel: "SaaS",
      confidence: 0.7,
      evidence: [],
    });
    const result = parseIdentityResponse("```json\n" + json + "\n```");
    expect(result.productName).toBe("App");
  });

  it("clamps confidence to [0, 1]", () => {
    const input = JSON.stringify({
      productName: "App",
      description: "Desc",
      targetCustomer: "Users",
      businessModel: "SaaS",
      confidence: 1.5,
      evidence: [],
    });
    expect(parseIdentityResponse(input).confidence).toBe(1);
  });

  it("rejects missing required fields", () => {
    expect(() => parseIdentityResponse(JSON.stringify({ productName: "App" })))
      .toThrow("Missing required field");
  });

  it("parses positioning fields when present", () => {
    const input = JSON.stringify({
      productName: "TestApp",
      description: "A test product",
      targetCustomer: "Developers",
      businessModel: "B2B SaaS",
      teams: ["engineering", "product"],
      companies: ["startups", "scale-ups"],
      use_cases: ["ci/cd automation", "code review"],
      revenue_model: ["subscription", "per-seat"],
      confidence: 0.9,
      evidence: [{ url: "https://example.com", excerpt: "A test product" }],
    });
    const result = parseIdentityResponse(input);
    expect(result.teams).toEqual(["engineering", "product"]);
    expect(result.companies).toEqual(["startups", "scale-ups"]);
    expect(result.use_cases).toEqual(["ci/cd automation", "code review"]);
    expect(result.revenue_model).toEqual(["subscription", "per-seat"]);
  });

  it("parses successfully without positioning fields (all optional)", () => {
    const input = JSON.stringify({
      productName: "TestApp",
      description: "A test product",
      targetCustomer: "Developers",
      businessModel: "B2B SaaS",
      confidence: 0.85,
      evidence: [],
    });
    const result = parseIdentityResponse(input);
    expect(result.productName).toBe("TestApp");
    expect(result.teams).toBeUndefined();
    expect(result.companies).toBeUndefined();
    expect(result.use_cases).toBeUndefined();
    expect(result.revenue_model).toBeUndefined();
  });

  it("parses with some positioning fields and not others", () => {
    const input = JSON.stringify({
      productName: "TestApp",
      description: "A test product",
      targetCustomer: "Developers",
      businessModel: "B2B SaaS",
      use_cases: ["deployment automation"],
      confidence: 0.8,
      evidence: [],
    });
    const result = parseIdentityResponse(input);
    expect(result.use_cases).toEqual(["deployment automation"]);
    expect(result.teams).toBeUndefined();
    expect(result.revenue_model).toBeUndefined();
  });
});

describe("filterIdentityPages", () => {
  it("filters to homepage, about, and features pages", () => {
    const pages: CrawledPage[] = [
      { url: "a", pageType: "homepage", content: "a" },
      { url: "b", pageType: "blog", content: "b" },
      { url: "c", pageType: "features", content: "c" },
      { url: "d", pageType: "about", content: "d" },
    ];
    const result = filterIdentityPages(pages);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.pageType)).toEqual(["homepage", "features", "about"]);
  });
});
