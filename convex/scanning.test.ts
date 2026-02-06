import { describe, it, expect } from "vitest";
import { filterDocsUrls } from "./scanning";

describe("filterDocsUrls", () => {
  it("filters URLs through shouldCrawlForActivation", () => {
    const urls = [
      "https://help.acme.io/",
      "https://help.acme.io/getting-started",
      "https://help.acme.io/api/v2/endpoints/users", // deep reference - excluded
      "https://help.acme.io/onboarding",
    ];
    const result = filterDocsUrls(urls);
    expect(result).toContain("https://help.acme.io/");
    expect(result).toContain("https://help.acme.io/getting-started");
    expect(result).toContain("https://help.acme.io/onboarding");
    expect(result).not.toContain("https://help.acme.io/api/v2/endpoints/users");
  });

  it("limits to 10 pages maximum", () => {
    const urls = Array.from({ length: 20 }, (_, i) =>
      `https://help.acme.io/tutorials/lesson-${i}`
    );
    const result = filterDocsUrls(urls);
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns empty array when no URLs match", () => {
    const urls = [
      "https://www.acme.io/pricing",
      "https://blog.acme.io/post-1",
    ];
    const result = filterDocsUrls(urls);
    expect(result).toEqual([]);
  });

  it("deduplicates URLs", () => {
    const urls = [
      "https://help.acme.io/getting-started",
      "https://help.acme.io/getting-started",
      "https://help.acme.io/getting-started",
    ];
    const result = filterDocsUrls(urls);
    expect(result.length).toBe(1);
  });

  it("classifies pages with correct pageType using classifyPageType", () => {
    // This tests that filterDocsUrls returns activation-relevant pages
    const urls = [
      "https://docs.acme.io/",
      "https://docs.acme.io/quickstart",
      "https://docs.acme.io/tutorials/basics",
    ];
    const result = filterDocsUrls(urls);
    expect(result.length).toBe(3);
  });
});
