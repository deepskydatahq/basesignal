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
