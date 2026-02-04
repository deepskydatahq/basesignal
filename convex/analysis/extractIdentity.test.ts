import { describe, it, expect } from "vitest";
import {
  filterIdentityPages,
  truncateContent,
  buildPageContext,
  parseIdentityResponse,
} from "./extractIdentity";

describe("filterIdentityPages", () => {
  it("keeps homepage, about, and features pages", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://x.io", title: "Home" },
      { pageType: "about", content: "About", url: "https://x.io/about", title: "About" },
      { pageType: "features", content: "Features", url: "https://x.io/features", title: "Features" },
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing", title: "Pricing" },
      { pageType: "customers", content: "Customers", url: "https://x.io/customers", title: "Customers" },
    ];

    const result = filterIdentityPages(pages);
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.pageType)).toEqual(["homepage", "about", "features"]);
  });

  it("returns empty array when no matching pages", () => {
    const pages = [
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
      { pageType: "other", content: "Other", url: "https://x.io/other" },
    ];

    expect(filterIdentityPages(pages)).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(filterIdentityPages([])).toHaveLength(0);
  });
});

describe("truncateContent", () => {
  it("returns content unchanged if under limit", () => {
    expect(truncateContent("short text", 100)).toBe("short text");
  });

  it("truncates at last newline before limit", () => {
    const content = "line 1\nline 2\nline 3\nline 4";
    // Limit at 20 chars - "line 1\nline 2\nline 3" is 20 chars
    const result = truncateContent(content, 15);
    expect(result).toBe("line 1\nline 2\n\n[Content truncated]");
  });

  it("truncates at exact limit if no newline found", () => {
    const content = "abcdefghijklmnopqrstuvwxyz";
    const result = truncateContent(content, 10);
    expect(result).toBe("abcdefghij\n\n[Content truncated]");
  });

  it("handles exact length match", () => {
    const content = "exactly10!";
    expect(truncateContent(content, 10)).toBe("exactly10!");
  });
});

describe("buildPageContext", () => {
  it("formats pages with headers and content", () => {
    const pages = [
      { pageType: "homepage", content: "Welcome to Acme", url: "https://acme.io", title: "Acme" },
    ];

    const result = buildPageContext(pages);
    expect(result).toContain("--- PAGE: Acme (homepage) ---");
    expect(result).toContain("URL: https://acme.io");
    expect(result).toContain("Welcome to Acme");
  });

  it("falls back to URL when title is missing", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://acme.io" },
    ];

    const result = buildPageContext(pages);
    expect(result).toContain("--- PAGE: https://acme.io (homepage) ---");
  });

  it("joins multiple pages with spacing", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://acme.io", title: "Home" },
      { pageType: "about", content: "About us", url: "https://acme.io/about", title: "About" },
    ];

    const result = buildPageContext(pages);
    expect(result).toContain("--- PAGE: Home (homepage) ---");
    expect(result).toContain("--- PAGE: About (about) ---");
  });

  it("respects total content limit across pages", () => {
    const longContent = "x".repeat(30_000);
    const pages = [
      { pageType: "homepage", content: longContent, url: "https://acme.io", title: "Home" },
      { pageType: "about", content: longContent, url: "https://acme.io/about", title: "About" },
    ];

    const result = buildPageContext(pages);
    // Total should be capped around MAX_TOTAL_CONTENT (40000)
    // The second page should be truncated or excluded
    expect(result.length).toBeLessThan(50_000);
  });
});

describe("parseIdentityResponse", () => {
  const validJson = JSON.stringify({
    productName: "Acme",
    description: "A project management tool for teams",
    targetCustomer: "Engineering teams at mid-size companies",
    businessModel: "B2B SaaS subscription",
    industry: "Project Management",
    companyStage: "Growth",
    confidence: 0.85,
    evidence: [
      { url: "https://acme.io", excerpt: "Built for engineering teams" },
    ],
  });

  it("parses raw JSON response", () => {
    const result = parseIdentityResponse(validJson);
    expect(result.productName).toBe("Acme");
    expect(result.description).toBe("A project management tool for teams");
    expect(result.targetCustomer).toBe("Engineering teams at mid-size companies");
    expect(result.businessModel).toBe("B2B SaaS subscription");
    expect(result.confidence).toBe(0.85);
    expect(result.evidence).toHaveLength(1);
  });

  it("parses JSON wrapped in code fences", () => {
    const wrapped = "```json\n" + validJson + "\n```";
    const result = parseIdentityResponse(wrapped);
    expect(result.productName).toBe("Acme");
  });

  it("parses JSON wrapped in code fences without language tag", () => {
    const wrapped = "```\n" + validJson + "\n```";
    const result = parseIdentityResponse(wrapped);
    expect(result.productName).toBe("Acme");
  });

  it("throws on missing required fields", () => {
    const incomplete = JSON.stringify({
      productName: "Acme",
      description: "Tool",
      // Missing targetCustomer, businessModel, confidence, evidence
    });

    expect(() => parseIdentityResponse(incomplete)).toThrow("Missing required field");
  });

  it("clamps confidence above 1.0 to 1.0", () => {
    const json = JSON.stringify({
      productName: "Acme",
      description: "Tool",
      targetCustomer: "Devs",
      businessModel: "SaaS",
      confidence: 1.5,
      evidence: [],
    });

    const result = parseIdentityResponse(json);
    expect(result.confidence).toBe(1.0);
  });

  it("clamps negative confidence to 0", () => {
    const json = JSON.stringify({
      productName: "Acme",
      description: "Tool",
      targetCustomer: "Devs",
      businessModel: "SaaS",
      confidence: -0.5,
      evidence: [],
    });

    const result = parseIdentityResponse(json);
    expect(result.confidence).toBe(0);
  });

  it("strips evidence to only url and excerpt", () => {
    const json = JSON.stringify({
      productName: "Acme",
      description: "Tool",
      targetCustomer: "Devs",
      businessModel: "SaaS",
      confidence: 0.8,
      evidence: [
        { url: "https://acme.io", excerpt: "Quote", extra: "should be stripped" },
      ],
    });

    const result = parseIdentityResponse(json);
    expect(result.evidence[0]).toEqual({ url: "https://acme.io", excerpt: "Quote" });
    expect("extra" in result.evidence[0]).toBe(false);
  });

  it("throws on invalid JSON", () => {
    expect(() => parseIdentityResponse("not json at all")).toThrow();
  });
});
