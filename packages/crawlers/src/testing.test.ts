import { describe, it, expect } from "vitest";
import { createFixtureCrawler, type FixtureMap } from "./testing";
import type { CrawledPage } from "./types";

const fixtures: FixtureMap = {
  "https://acme.io/": "<html><head><title>Acme Home</title></head><body>Homepage</body></html>",
  "https://acme.io/pricing": "<html><head><title>Acme Pricing</title></head><body>$29/mo</body></html>",
  "https://acme.io/about": "<html><head><title>About Acme</title></head><body>About us</body></html>",
};

describe("createFixtureCrawler", () => {
  it("returns all fixture pages when crawled", async () => {
    const crawler = createFixtureCrawler(fixtures);
    const result = await crawler.crawl("https://acme.io/");

    expect(result.pages).toHaveLength(3);
    expect(result.pages.map((p) => p.url)).toEqual([
      "https://acme.io/",
      "https://acme.io/pricing",
      "https://acme.io/about",
    ]);
  });

  it("extracts <title> from HTML fixtures", async () => {
    const crawler = createFixtureCrawler(fixtures);
    const result = await crawler.crawl("https://acme.io/");

    expect(result.pages[0].title).toBe("Acme Home");
    expect(result.pages[1].title).toBe("Acme Pricing");
    expect(result.pages[2].title).toBe("About Acme");
  });

  it("returns undefined title when no <title> tag present", async () => {
    const crawler = createFixtureCrawler({
      "https://acme.io/": "<html><body>No title here</body></html>",
    });
    const result = await crawler.crawl("https://acme.io/");

    expect(result.pages[0].title).toBeUndefined();
  });

  it("canCrawl() returns true for matching origins", () => {
    const crawler = createFixtureCrawler(fixtures);

    expect(crawler.canCrawl("https://acme.io/")).toBe(true);
    expect(crawler.canCrawl("https://acme.io/any-path")).toBe(true);
  });

  it("canCrawl() returns false for non-matching origins", () => {
    const crawler = createFixtureCrawler(fixtures);

    expect(crawler.canCrawl("https://other.com/")).toBe(false);
    expect(crawler.canCrawl("https://different.io/page")).toBe(false);
  });

  it("canCrawl() returns false for invalid URLs", () => {
    const crawler = createFixtureCrawler(fixtures);

    expect(crawler.canCrawl("not-a-url")).toBe(false);
    expect(crawler.canCrawl("")).toBe(false);
  });

  it("respects maxPages option from CrawlOptions", async () => {
    const crawler = createFixtureCrawler(fixtures);
    const result = await crawler.crawl("https://acme.io/", { maxPages: 2 });

    expect(result.pages).toHaveLength(2);
    expect(result.pages.map((p) => p.url)).toEqual([
      "https://acme.io/",
      "https://acme.io/pricing",
    ]);
  });

  it("custom processPage function is used when provided", async () => {
    const customProcess = (url: string, html: string): CrawledPage => ({
      url,
      pageType: "custom",
      title: "Custom Title",
      content: `Processed: ${html.length} chars`,
    });

    const crawler = createFixtureCrawler(fixtures, { processPage: customProcess });
    const result = await crawler.crawl("https://acme.io/");

    expect(result.pages[0].pageType).toBe("custom");
    expect(result.pages[0].title).toBe("Custom Title");
    expect(result.pages[0].content).toMatch(/^Processed: \d+ chars$/);
  });

  it("errors from processPage are caught and reported in errors[]", async () => {
    const failingProcess = (url: string, _html: string): CrawledPage => {
      if (url.includes("pricing")) {
        throw new Error("Parse failed for pricing");
      }
      return { url, pageType: "other", content: _html };
    };

    const crawler = createFixtureCrawler(fixtures, { processPage: failingProcess });
    const result = await crawler.crawl("https://acme.io/");

    // 2 pages succeed, 1 fails
    expect(result.pages).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].url).toBe("https://acme.io/pricing");
    expect(result.errors[0].error).toBe("Parse failed for pricing");
  });

  it("custom name and sourceType options are applied", () => {
    const crawler = createFixtureCrawler(fixtures, {
      name: "my-fixture",
      sourceType: "pricing",
    });

    expect(crawler.name).toBe("my-fixture");
    expect(crawler.sourceType).toBe("pricing");
  });

  it("returns timing information in the result", async () => {
    const crawler = createFixtureCrawler(fixtures);
    const before = Date.now();
    const result = await crawler.crawl("https://acme.io/");
    const after = Date.now();

    expect(result.timing.startedAt).toBeGreaterThanOrEqual(before);
    expect(result.timing.completedAt).toBeLessThanOrEqual(after);
    expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.totalMs).toBe(result.timing.completedAt - result.timing.startedAt);
  });

  it("uses default name and sourceType when not specified", () => {
    const crawler = createFixtureCrawler(fixtures);

    expect(crawler.name).toBe("fixture");
    expect(crawler.sourceType).toBe("website");
  });

  it("sets pageType to 'other' by default", async () => {
    const crawler = createFixtureCrawler(fixtures);
    const result = await crawler.crawl("https://acme.io/");

    for (const page of result.pages) {
      expect(page.pageType).toBe("other");
    }
  });

  it("content is the raw HTML by default", async () => {
    const crawler = createFixtureCrawler(fixtures);
    const result = await crawler.crawl("https://acme.io/");

    expect(result.pages[0].content).toBe(fixtures["https://acme.io/"]);
  });

  it("works with a single fixture", async () => {
    const singleFixture: FixtureMap = {
      "https://single.com/": "<html><title>Single</title><body>Only page</body></html>",
    };

    const crawler = createFixtureCrawler(singleFixture);
    const result = await crawler.crawl("https://single.com/");

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].title).toBe("Single");
  });
});
