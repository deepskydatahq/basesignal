import { describe, it, expect } from "vitest";
import {
  truncateContent,
  buildPageContext,
  extractJson,
  parseLensResponse,
  MAX_CONTENT_PER_PAGE,
  MAX_TOTAL_CONTENT,
} from "./shared";

describe("truncateContent", () => {
  it("returns content unchanged when shorter than max", () => {
    const content = "short content";
    expect(truncateContent(content, 100)).toBe("short content");
  });

  it("truncates at last newline before max length", () => {
    const content = "line one\nline two\nline three\nline four";
    const result = truncateContent(content, 20);
    expect(result).toBe("line one\nline two\n\n[Content truncated]");
  });

  it("appends truncation marker", () => {
    const content = "a".repeat(100);
    const result = truncateContent(content, 50);
    expect(result).toContain("[Content truncated]");
  });

  it("handles content with no newlines", () => {
    const content = "a".repeat(100);
    const result = truncateContent(content, 50);
    expect(result.length).toBeLessThan(100);
    expect(result).toContain("[Content truncated]");
  });

  it("handles exact length content", () => {
    const content = "exact";
    expect(truncateContent(content, 5)).toBe("exact");
  });
});

describe("buildPageContext", () => {
  it("formats pages with headers and content", () => {
    const pages = [
      { pageType: "features", content: "Feature list", url: "https://x.io/features", title: "Features" },
    ];

    const result = buildPageContext(pages);
    expect(result).toContain("--- PAGE: Features (features) ---");
    expect(result).toContain("URL: https://x.io/features");
    expect(result).toContain("Feature list");
  });

  it("respects MAX_CONTENT_PER_PAGE", () => {
    const longContent = "x".repeat(20_000);
    const pages = [
      { pageType: "homepage", content: longContent, url: "https://x.io" },
    ];

    const result = buildPageContext(pages, MAX_CONTENT_PER_PAGE, MAX_TOTAL_CONTENT);
    expect(result.length).toBeLessThan(20_000);
  });

  it("stops when MAX_TOTAL_CONTENT reached", () => {
    const content = "x".repeat(30_000);
    const pages = [
      { pageType: "homepage", content, url: "https://x.io", title: "Home" },
      { pageType: "features", content, url: "https://x.io/features", title: "Features" },
      { pageType: "help", content, url: "https://x.io/help", title: "Help" },
    ];

    const result = buildPageContext(pages);
    expect(result.length).toBeLessThan(50_000);
  });

  it("handles empty pages array", () => {
    expect(buildPageContext([])).toBe("");
  });

  it("falls back to URL when title is missing", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://x.io" },
    ];
    const result = buildPageContext(pages);
    expect(result).toContain("--- PAGE: https://x.io (homepage) ---");
  });
});

describe("extractJson", () => {
  it("extracts from ```json fences", () => {
    const text = '```json\n{"key": "value"}\n```';
    expect(extractJson(text)).toEqual({ key: "value" });
  });

  it("extracts from ``` fences without language tag", () => {
    const text = '```\n{"key": "value"}\n```';
    expect(extractJson(text)).toEqual({ key: "value" });
  });

  it("parses raw JSON", () => {
    expect(extractJson('{"key": "value"}')).toEqual({ key: "value" });
  });

  it("parses raw JSON array", () => {
    expect(extractJson('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it("throws on invalid JSON", () => {
    expect(() => extractJson("not json")).toThrow();
  });

  it("handles whitespace around JSON", () => {
    expect(extractJson('  {"key": "value"}  ')).toEqual({ key: "value" });
  });
});

describe("parseLensResponse", () => {
  function makeValidResponse(overrides: Record<string, unknown>[] = []): string {
    const defaults = [
      {
        name: "Pipeline Visibility",
        description: "See which deals are at risk",
        role: "Sales Manager",
        information_gained: "Real-time deal risk signals",
        confidence: "high",
        source_urls: ["https://x.io/features"],
      },
      {
        name: "Team Capacity",
        description: "View team workload distribution",
        role: "Engineering Manager",
        information_gained: "Cross-team capacity insights",
        confidence: "medium",
        source_urls: ["https://x.io/features/teams"],
      },
    ];
    const candidates = overrides.length > 0 ? overrides : defaults;
    return JSON.stringify(candidates);
  }

  it("parses valid response with all fields", () => {
    const result = parseLensResponse(
      makeValidResponse(),
      "info_asymmetry",
      "information_gained",
    );
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Pipeline Visibility");
    expect(result[0].information_gained).toBe("Real-time deal risk signals");
  });

  it("assigns UUIDs to each candidate", () => {
    const result = parseLensResponse(
      makeValidResponse(),
      "info_asymmetry",
      "information_gained",
    );
    expect(result[0].id).toBeTruthy();
    expect(result[1].id).toBeTruthy();
    expect(result[0].id).not.toBe(result[1].id);
    // UUID format check
    expect(result[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("validates lens-specific field exists", () => {
    const missing = JSON.stringify([
      {
        name: "Test",
        description: "Test desc",
        role: "Tester",
        confidence: "high",
        source_urls: ["https://x.io"],
        // missing information_gained
      },
    ]);
    expect(() =>
      parseLensResponse(missing, "info_asymmetry", "information_gained"),
    ).toThrow("missing required lens field: information_gained");
  });

  it("handles missing shared fields", () => {
    const missingName = JSON.stringify([
      {
        description: "desc",
        role: "role",
        information_gained: "info",
        confidence: "high",
        source_urls: [],
      },
    ]);
    expect(() =>
      parseLensResponse(missingName, "info_asymmetry", "information_gained"),
    ).toThrow("missing required field: name");
  });

  it("normalizes confidence strings to ConfidenceLevel", () => {
    const result = parseLensResponse(
      makeValidResponse(),
      "info_asymmetry",
      "information_gained",
    );
    expect(["low", "medium", "high"]).toContain(result[0].confidence);
  });

  it("normalizes numeric confidence to ConfidenceLevel", () => {
    const withNumeric = JSON.stringify([
      {
        name: "Test",
        description: "desc",
        role: "Tester",
        information_gained: "info",
        confidence: 0.8,
        source_urls: ["https://x.io"],
      },
    ]);
    const result = parseLensResponse(
      withNumeric,
      "info_asymmetry",
      "information_gained",
    );
    expect(result[0].confidence).toBe("high");
  });

  it("normalizes low numeric confidence", () => {
    const withLow = JSON.stringify([
      {
        name: "Test",
        description: "desc",
        role: "Tester",
        information_gained: "info",
        confidence: 0.2,
        source_urls: ["https://x.io"],
      },
    ]);
    const result = parseLensResponse(
      withLow,
      "info_asymmetry",
      "information_gained",
    );
    expect(result[0].confidence).toBe("low");
  });

  it("throws when response is not an array", () => {
    expect(() =>
      parseLensResponse('{"not": "array"}', "info_asymmetry", "information_gained"),
    ).toThrow("Expected array of candidates");
  });

  it("parses JSON from code fences", () => {
    const fenced = "```json\n" + makeValidResponse() + "\n```";
    const result = parseLensResponse(
      fenced,
      "info_asymmetry",
      "information_gained",
    );
    expect(result).toHaveLength(2);
  });

  it("converts source_urls to strings", () => {
    const withNonString = JSON.stringify([
      {
        name: "Test",
        description: "desc",
        role: "Tester",
        information_gained: "info",
        confidence: "high",
        source_urls: ["https://x.io", 123],
      },
    ]);
    const result = parseLensResponse(
      withNonString,
      "info_asymmetry",
      "information_gained",
    );
    expect(result[0].source_urls).toEqual(["https://x.io", "123"]);
  });
});
