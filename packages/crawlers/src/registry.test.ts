import { describe, it, expect } from "vitest";
import { CrawlerRegistry } from "./registry";
import type { Crawler, CrawlResult, CrawlOptions, CrawledPage, CrawlError, SourceType } from "./types";

// -- Test helper: create a mock crawler satisfying the interface --

function makeCrawler(overrides: Partial<Crawler> & { name: string }): Crawler {
  return {
    sourceType: "website",
    canCrawl: () => true,
    crawl: async (): Promise<CrawlResult> => ({
      pages: [],
      timing: { startedAt: 0, completedAt: 0, totalMs: 0 },
      errors: [],
    }),
    ...overrides,
  };
}

// -- AC1: Crawler interface exports: name, sourceType, canCrawl(url), crawl(url, options) --

describe("Crawler interface", () => {
  it("can be implemented as a plain object with all four members", () => {
    const crawler: Crawler = {
      name: "test",
      sourceType: "website",
      canCrawl: (url: string) => url.includes("example.com"),
      crawl: async (_url: string, _options?: CrawlOptions): Promise<CrawlResult> => ({
        pages: [],
        timing: { startedAt: 0, completedAt: 0, totalMs: 0 },
        errors: [],
      }),
    };

    expect(crawler.name).toBe("test");
    expect(crawler.sourceType).toBe("website");
    expect(crawler.canCrawl("https://example.com")).toBe(true);
    expect(crawler.canCrawl("https://other.com")).toBe(false);
  });

  it("crawl() returns a Promise<CrawlResult>", async () => {
    const crawler = makeCrawler({ name: "async-test" });
    const result = await crawler.crawl("https://example.com");

    expect(result).toHaveProperty("pages");
    expect(result).toHaveProperty("timing");
    expect(result).toHaveProperty("errors");
    expect(Array.isArray(result.pages)).toBe(true);
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it("crawl() accepts optional CrawlOptions", async () => {
    const receivedOptions: CrawlOptions[] = [];
    const crawler: Crawler = {
      name: "options-test",
      sourceType: "website",
      canCrawl: () => true,
      crawl: async (_url: string, options?: CrawlOptions) => {
        if (options) receivedOptions.push(options);
        return { pages: [], timing: { startedAt: 0, completedAt: 0, totalMs: 0 }, errors: [] };
      },
    };

    await crawler.crawl("https://example.com", {
      maxPages: 10,
      maxDepth: 2,
      timeout: 30000,
      userAgent: "TestBot/1.0",
    });

    expect(receivedOptions[0]).toEqual({
      maxPages: 10,
      maxDepth: 2,
      timeout: 30000,
      userAgent: "TestBot/1.0",
    });
  });
});

// -- AC2: CrawlResult type includes pages (url, content, pageType, metadata), timing, errors --

describe("CrawlResult type", () => {
  it("includes pages with url, content, pageType, and optional metadata", () => {
    const page: CrawledPage = {
      url: "https://example.com/pricing",
      pageType: "pricing",
      title: "Pricing - Example",
      content: "# Pricing\n\nFree tier available.",
      metadata: {
        description: "Example pricing page",
        ogImage: "https://example.com/og.png",
        structuredData: { "@type": "WebPage" },
      },
    };

    expect(page.url).toBe("https://example.com/pricing");
    expect(page.pageType).toBe("pricing");
    expect(page.content).toContain("Pricing");
    expect(page.metadata?.description).toBe("Example pricing page");
    expect(page.metadata?.structuredData).toEqual({ "@type": "WebPage" });
  });

  it("includes timing with startedAt, completedAt, totalMs", () => {
    const result: CrawlResult = {
      pages: [],
      timing: { startedAt: 1000, completedAt: 5000, totalMs: 4000 },
      errors: [],
    };

    expect(result.timing.startedAt).toBe(1000);
    expect(result.timing.completedAt).toBe(5000);
    expect(result.timing.totalMs).toBe(4000);
  });

  it("includes errors with url and error string", () => {
    const error: CrawlError = {
      url: "https://example.com/broken",
      error: "404 Not Found",
    };

    const result: CrawlResult = {
      pages: [],
      timing: { startedAt: 0, completedAt: 0, totalMs: 0 },
      errors: [error],
    };

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].url).toBe("https://example.com/broken");
    expect(result.errors[0].error).toBe("404 Not Found");
  });
});

// -- AC3: CrawlOptions type includes maxPages, maxDepth, timeout, userAgent --

describe("CrawlOptions type", () => {
  it("all fields are optional", () => {
    const empty: CrawlOptions = {};
    expect(empty.maxPages).toBeUndefined();
    expect(empty.maxDepth).toBeUndefined();
    expect(empty.timeout).toBeUndefined();
    expect(empty.userAgent).toBeUndefined();
  });

  it("includes maxPages, maxDepth, timeout, userAgent", () => {
    const options: CrawlOptions = {
      maxPages: 50,
      maxDepth: 3,
      timeout: 60000,
      userAgent: "Basesignal/1.0",
    };

    expect(options.maxPages).toBe(50);
    expect(options.maxDepth).toBe(3);
    expect(options.timeout).toBe(60000);
    expect(options.userAgent).toBe("Basesignal/1.0");
  });

  it("supports AbortSignal for cancellation", () => {
    const controller = new AbortController();
    const options: CrawlOptions = { signal: controller.signal };

    expect(options.signal).toBe(controller.signal);
    expect(options.signal?.aborted).toBe(false);

    controller.abort();
    expect(options.signal?.aborted).toBe(true);
  });
});

// -- AC4: CrawlerRegistry.register() and CrawlerRegistry.getCrawlersFor() work --

describe("CrawlerRegistry", () => {
  describe("register()", () => {
    it("registers a crawler", () => {
      const registry = new CrawlerRegistry();
      const crawler = makeCrawler({ name: "test" });

      registry.register(crawler);

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getAll()[0].name).toBe("test");
    });

    it("throws on duplicate name", () => {
      const registry = new CrawlerRegistry();
      const crawler = makeCrawler({ name: "website" });

      registry.register(crawler);

      expect(() => registry.register(makeCrawler({ name: "website" }))).toThrow(
        'Crawler "website" is already registered'
      );
    });

    it("allows different names", () => {
      const registry = new CrawlerRegistry();

      registry.register(makeCrawler({ name: "website" }));
      registry.register(makeCrawler({ name: "pricing" }));
      registry.register(makeCrawler({ name: "g2-reviews" }));

      expect(registry.getAll()).toHaveLength(3);
    });
  });

  describe("getCrawlersFor()", () => {
    it("returns crawlers where canCrawl() returns true", () => {
      const registry = new CrawlerRegistry();

      const website = makeCrawler({
        name: "website",
        canCrawl: (url) => url.startsWith("https://"),
      });
      const g2 = makeCrawler({
        name: "g2-reviews",
        canCrawl: (url) => url.includes("g2.com"),
      });

      registry.register(website);
      registry.register(g2);

      // g2.com URL matches both
      const g2Matches = registry.getCrawlersFor("https://www.g2.com/products/linear");
      expect(g2Matches).toHaveLength(2);
      expect(g2Matches.map((c) => c.name)).toEqual(["website", "g2-reviews"]);

      // Non-g2 URL matches only website
      const webMatches = registry.getCrawlersFor("https://linear.app");
      expect(webMatches).toHaveLength(1);
      expect(webMatches[0].name).toBe("website");
    });

    it("returns empty array when no crawlers match", () => {
      const registry = new CrawlerRegistry();
      registry.register(makeCrawler({
        name: "website",
        canCrawl: () => false,
      }));

      expect(registry.getCrawlersFor("https://example.com")).toEqual([]);
    });

    it("returns crawlers in registration order", () => {
      const registry = new CrawlerRegistry();

      registry.register(makeCrawler({ name: "alpha" }));
      registry.register(makeCrawler({ name: "beta" }));
      registry.register(makeCrawler({ name: "gamma" }));

      const all = registry.getCrawlersFor("https://example.com");
      expect(all.map((c) => c.name)).toEqual(["alpha", "beta", "gamma"]);
    });

    it("returns empty array with no registered crawlers", () => {
      const registry = new CrawlerRegistry();
      expect(registry.getCrawlersFor("https://example.com")).toEqual([]);
    });
  });

  describe("getAll()", () => {
    it("returns all registered crawlers", () => {
      const registry = new CrawlerRegistry();

      registry.register(makeCrawler({ name: "a", sourceType: "website" }));
      registry.register(makeCrawler({ name: "b", sourceType: "reviews" }));

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map((c) => c.name)).toEqual(["a", "b"]);
    });

    it("returns empty array when no crawlers registered", () => {
      const registry = new CrawlerRegistry();
      expect(registry.getAll()).toEqual([]);
    });
  });
});

// -- AC5: sourceType enum covers all required values --

describe("SourceType", () => {
  it("covers website, social, reviews, docs, video, pricing", () => {
    const types: SourceType[] = ["website", "social", "reviews", "docs", "video", "pricing"];

    // Verify each type can be assigned and used with a crawler
    for (const type of types) {
      const crawler = makeCrawler({ name: `${type}-crawler`, sourceType: type });
      expect(crawler.sourceType).toBe(type);
    }

    expect(types).toHaveLength(6);
  });
});

// -- AC6: covered by the package.json file existing with correct name --
// (verified by build/install, not a runtime test)

// -- Integration: full workflow from design doc verification steps --

describe("end-to-end workflow", () => {
  it("mock crawler can be registered and discovered", () => {
    const mock: Crawler = {
      name: "test",
      sourceType: "website",
      canCrawl: (url) => url.includes("example.com"),
      crawl: async () => ({
        pages: [],
        timing: { startedAt: 0, completedAt: 0, totalMs: 0 },
        errors: [],
      }),
    };

    const registry = new CrawlerRegistry();
    registry.register(mock);

    expect(registry.getCrawlersFor("https://example.com")).toEqual([mock]);
    expect(registry.getCrawlersFor("https://other.com")).toEqual([]);
  });

  it("crawl returns structured pages with all fields", async () => {
    const crawler: Crawler = {
      name: "full-test",
      sourceType: "website",
      canCrawl: () => true,
      crawl: async (url) => ({
        pages: [
          {
            url,
            pageType: "homepage",
            title: "Example",
            content: "# Welcome to Example",
            metadata: {
              description: "Example homepage",
              ogImage: "https://example.com/og.png",
            },
          },
        ],
        timing: { startedAt: 1000, completedAt: 2000, totalMs: 1000 },
        errors: [],
      }),
    };

    const result = await crawler.crawl("https://example.com");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].url).toBe("https://example.com");
    expect(result.pages[0].pageType).toBe("homepage");
    expect(result.pages[0].content).toContain("Welcome");
    expect(result.timing.totalMs).toBe(1000);
  });
});
