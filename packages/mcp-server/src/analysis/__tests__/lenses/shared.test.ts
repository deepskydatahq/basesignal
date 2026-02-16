import { describe, it, expect } from "vitest";
import {
  truncateContent,
  buildPageContext,
  filterPages,
  buildProductContextString,
  normalizeConfidence,
  parseLensResponse,
  extractJson,
} from "../../lenses/shared.js";

describe("truncateContent", () => {
  it("returns content unchanged if under limit", () => {
    expect(truncateContent("short", 100)).toBe("short");
  });

  it("truncates at last newline before limit", () => {
    const content = "line1\nline2\nline3\nline4";
    const result = truncateContent(content, 12);
    expect(result).toBe("line1\nline2\n\n[Content truncated]");
  });

  it("truncates at limit if no newline found", () => {
    const content = "a".repeat(200);
    const result = truncateContent(content, 100);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result).toContain("[Content truncated]");
  });
});

describe("buildPageContext", () => {
  it("builds context from multiple pages", () => {
    const pages = [
      { url: "https://a.com", title: "Page A", pageType: "homepage", content: "Content A" },
      { url: "https://b.com", title: "Page B", pageType: "features", content: "Content B" },
    ];
    const result = buildPageContext(pages);
    expect(result).toContain("Page A");
    expect(result).toContain("Content A");
    expect(result).toContain("Page B");
    expect(result).toContain("Content B");
  });

  it("respects max total content limit", () => {
    const pages = [
      { url: "https://a.com", pageType: "homepage", content: "x".repeat(50_000) },
      { url: "https://b.com", pageType: "features", content: "y".repeat(50_000) },
    ];
    const result = buildPageContext(pages, 15_000, 40_000);
    // Total content should not exceed 40_000 characters of page content
    expect(result.length).toBeLessThan(60_000); // total with headers
  });

  it("uses url as fallback when title is missing", () => {
    const pages = [{ url: "https://a.com", pageType: "homepage", content: "test" }];
    const result = buildPageContext(pages);
    expect(result).toContain("https://a.com");
  });
});

describe("filterPages", () => {
  it("filters and sorts by priority", () => {
    const pages = [
      { url: "https://a.com", pageType: "about", content: "a" },
      { url: "https://b.com", pageType: "features", content: "b" },
      { url: "https://c.com", pageType: "blog", content: "c" },
      { url: "https://d.com", pageType: "homepage", content: "d" },
    ];
    const result = filterPages(
      pages,
      ["features", "homepage", "about"],
      { features: 0, homepage: 1, about: 2 },
    );
    expect(result).toHaveLength(3);
    expect(result[0].pageType).toBe("features");
    expect(result[1].pageType).toBe("homepage");
    expect(result[2].pageType).toBe("about");
  });

  it("returns empty array when no matching types", () => {
    const pages = [{ url: "https://a.com", pageType: "blog", content: "a" }];
    const result = filterPages(pages, ["features", "homepage"], {});
    expect(result).toHaveLength(0);
  });
});

describe("buildProductContextString", () => {
  it("builds full context from all fields", () => {
    const result = buildProductContextString({
      name: "TestApp",
      description: "A great app",
      targetCustomer: "Developers",
    });
    expect(result).toContain("Product: TestApp");
    expect(result).toContain("Description: A great app");
    expect(result).toContain("Target: Developers");
  });

  it("returns empty string for undefined context", () => {
    expect(buildProductContextString(undefined)).toBe("");
  });

  it("handles missing fields", () => {
    const result = buildProductContextString({ name: "App" });
    expect(result).toBe("Product: App");
  });
});

describe("normalizeConfidence", () => {
  it("passes through valid string levels", () => {
    expect(normalizeConfidence("high")).toBe("high");
    expect(normalizeConfidence("medium")).toBe("medium");
    expect(normalizeConfidence("low")).toBe("low");
  });

  it("converts numeric values", () => {
    expect(normalizeConfidence(0.9)).toBe("high");
    expect(normalizeConfidence(0.5)).toBe("medium");
    expect(normalizeConfidence(0.2)).toBe("low");
  });

  it("defaults to medium for unknown values", () => {
    expect(normalizeConfidence("unknown")).toBe("medium");
    expect(normalizeConfidence(null)).toBe("medium");
  });
});

describe("parseLensResponse", () => {
  it("parses valid JSON array of candidates", () => {
    const input = JSON.stringify([
      {
        name: "Test",
        description: "A test candidate",
        role: "Developer",
        source_urls: ["https://example.com"],
        confidence: "high",
        information_gained: "Dashboard shows real-time data",
      },
    ]);
    const result = parseLensResponse(input, "info_asymmetry", "information_gained");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Test");
    expect(result[0].lens).toBe("info_asymmetry");
    expect(result[0].id).toBeDefined();
  });

  it("handles code fences around JSON", () => {
    const input = "```json\n" + JSON.stringify([
      {
        name: "Test",
        description: "A test",
        role: "User",
        source_urls: ["https://example.com"],
        decision_enabled: "Select option",
      },
    ]) + "\n```";
    const result = parseLensResponse(input, "decision_enablement", "decision_enabled");
    expect(result).toHaveLength(1);
  });

  it("rejects non-array responses", () => {
    expect(() => parseLensResponse("{}", "info_asymmetry", "information_gained"))
      .toThrow("Expected array");
  });

  it("rejects candidates missing required fields", () => {
    const input = JSON.stringify([{ name: "Test" }]);
    expect(() => parseLensResponse(input, "info_asymmetry", "information_gained"))
      .toThrow("missing required field: description");
  });

  it("rejects candidates missing lens-specific field", () => {
    const input = JSON.stringify([
      {
        name: "Test",
        description: "A test",
        role: "User",
        source_urls: ["url"],
      },
    ]);
    expect(() => parseLensResponse(input, "info_asymmetry", "information_gained"))
      .toThrow("missing required lens field: information_gained");
  });
});

describe("extractJson", () => {
  it("parses raw JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("extracts JSON from code fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
