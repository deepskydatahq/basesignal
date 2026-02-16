import { describe, it, expect, vi } from "vitest";
import { BaseCrawler, type BaseCrawlerOptions } from "./base";
import type { CrawlResult } from "./types";

// -- Concrete subclass for testing --

class TestCrawler extends BaseCrawler {
  name = "test";
  sourceType = "website" as const;
  canCrawl() {
    return true;
  }
  protected async doCrawl(url: string): Promise<CrawlResult> {
    const response = await this.fetchWithRateLimit(url);
    const content = this.truncateContent(await response.text());
    return {
      pages: [{ url, pageType: "other", content }],
      timing: { startedAt: Date.now(), completedAt: Date.now(), totalMs: 0 },
      errors: [],
    };
  }
}

// -- Mock fetch factory --

function createMockFetch(responses: Record<string, { status: number; body: string }>) {
  const calls: { url: string; timestamp: number }[] = [];

  const mockFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    calls.push({ url: urlStr, timestamp: Date.now() });

    const response = responses[urlStr];
    if (response) {
      return new Response(response.body, { status: response.status });
    }
    return new Response("Not Found", { status: 404 });
  }) as unknown as typeof fetch;

  return { mockFetch, calls };
}

// -- Rate limiting tests --

describe("BaseCrawler rate limiting", () => {
  it("second request to same domain is delayed by delayMs", async () => {
    const delayMs = 100;
    const { mockFetch, calls } = createMockFetch({
      "https://example.com/robots.txt": { status: 404, body: "" },
      "https://example.com/page1": { status: 200, body: "Page 1" },
      "https://example.com/page2": { status: 200, body: "Page 2" },
    });

    const crawler = new TestCrawler({ delayMs, fetchFn: mockFetch });

    await crawler.crawl("https://example.com/page1");
    await crawler.crawl("https://example.com/page2");

    // Find the two content fetch calls (not robots.txt)
    const contentCalls = calls.filter((c) => !c.url.includes("robots.txt"));
    expect(contentCalls).toHaveLength(2);

    const elapsed = contentCalls[1].timestamp - contentCalls[0].timestamp;
    // Should be at least delayMs apart (with some tolerance for test timing)
    expect(elapsed).toBeGreaterThanOrEqual(delayMs - 20);
  });

  it("requests to different domains are not delayed", async () => {
    const delayMs = 200;
    const { mockFetch, calls } = createMockFetch({
      "https://alpha.com/robots.txt": { status: 404, body: "" },
      "https://beta.com/robots.txt": { status: 404, body: "" },
      "https://alpha.com/page": { status: 200, body: "Alpha" },
      "https://beta.com/page": { status: 200, body: "Beta" },
    });

    const crawler = new TestCrawler({ delayMs, fetchFn: mockFetch });

    const startTime = Date.now();
    await crawler.crawl("https://alpha.com/page");
    await crawler.crawl("https://beta.com/page");
    const totalTime = Date.now() - startTime;

    // Should not need two full delays since they are different domains
    // (only the internal delay within each crawl matters)
    expect(totalTime).toBeLessThan(delayMs * 2);
  });

  it("custom delayMs is respected", async () => {
    const delayMs = 150;
    const { mockFetch, calls } = createMockFetch({
      "https://example.com/robots.txt": { status: 404, body: "" },
      "https://example.com/page1": { status: 200, body: "Page 1" },
      "https://example.com/page2": { status: 200, body: "Page 2" },
    });

    const crawler = new TestCrawler({ delayMs, fetchFn: mockFetch });

    await crawler.crawl("https://example.com/page1");
    await crawler.crawl("https://example.com/page2");

    const contentCalls = calls.filter((c) => !c.url.includes("robots.txt"));
    const elapsed = contentCalls[1].timestamp - contentCalls[0].timestamp;
    expect(elapsed).toBeGreaterThanOrEqual(delayMs - 20);
  });

  it("sets User-Agent header on requests", async () => {
    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      return new Response("OK", { status: 200 });
    }) as unknown as typeof fetch;

    const crawler = new TestCrawler({
      fetchFn: mockFetch,
      userAgent: "CustomBot/2.0",
      delayMs: 0,
    });

    await crawler.crawl("https://example.com/page");

    // Check the content page fetch call (not robots.txt)
    const contentCall = (mockFetch as any).mock.calls.find(
      (c: any[]) => typeof c[0] === "string" && !c[0].includes("robots.txt")
    );
    expect(contentCall).toBeDefined();
    expect(contentCall[1]?.headers?.["User-Agent"]).toBe("CustomBot/2.0");
  });
});

// -- robots.txt compliance tests --

describe("BaseCrawler robots.txt compliance", () => {
  it("crawl succeeds when robots.txt allows the path", async () => {
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": {
        status: 200,
        body: "User-Agent: *\nDisallow: /private\n",
      },
      "https://example.com/public": { status: 200, body: "Public content" },
    });

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    const result = await crawler.crawl("https://example.com/public");

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].content).toBe("Public content");
    expect(result.errors).toHaveLength(0);
  });

  it("crawl returns error when robots.txt disallows the path", async () => {
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": {
        status: 200,
        body: "User-Agent: *\nDisallow: /private\n",
      },
    });

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    const result = await crawler.crawl("https://example.com/private/secret");

    expect(result.pages).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe("Blocked by robots.txt");
    expect(result.errors[0].url).toBe("https://example.com/private/secret");
  });

  it("robots.txt is fetched only once per domain (caching)", async () => {
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": {
        status: 200,
        body: "User-Agent: *\nDisallow: /blocked\n",
      },
      "https://example.com/page1": { status: 200, body: "Page 1" },
      "https://example.com/page2": { status: 200, body: "Page 2" },
    });

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    await crawler.crawl("https://example.com/page1");
    await crawler.crawl("https://example.com/page2");

    // robots.txt should be fetched only once
    const robotsCalls = (mockFetch as any).mock.calls.filter(
      (c: any[]) => typeof c[0] === "string" && c[0].includes("robots.txt")
    );
    expect(robotsCalls).toHaveLength(1);
  });

  it("robots.txt fetch failure (404) allows crawl", async () => {
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": { status: 404, body: "Not Found" },
      "https://example.com/page": { status: 200, body: "Page content" },
    });

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    const result = await crawler.crawl("https://example.com/page");

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].content).toBe("Page content");
  });

  it("robots.txt network error allows crawl", async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("robots.txt")) {
        throw new Error("Network error");
      }
      return new Response("Page content", { status: 200 });
    }) as unknown as typeof fetch;

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    const result = await crawler.crawl("https://example.com/page");

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].content).toBe("Page content");
  });

  it("uses configured userAgent for robots.txt matching", async () => {
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": {
        status: 200,
        body: [
          "User-Agent: BasesignalBot/1.0",
          "Disallow: /bot-blocked",
          "",
          "User-Agent: *",
          "Disallow: /general-blocked",
        ].join("\n"),
      },
      "https://example.com/general-blocked": { status: 200, body: "Content" },
    });

    // Default userAgent is BasesignalBot/1.0 -- /general-blocked is allowed for it
    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    const result = await crawler.crawl("https://example.com/general-blocked");

    expect(result.pages).toHaveLength(1);
  });
});

// -- Content truncation tests --

describe("BaseCrawler content truncation", () => {
  it("content within limit is unchanged", async () => {
    const content = "Short content";
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": { status: 404, body: "" },
      "https://example.com/page": { status: 200, body: content },
    });

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    const result = await crawler.crawl("https://example.com/page");

    expect(result.pages[0].content).toBe(content);
  });

  it("content exceeding limit is truncated", async () => {
    const maxContentBytes = 50;
    const content = "a".repeat(100);
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": { status: 404, body: "" },
      "https://example.com/page": { status: 200, body: content },
    });

    const crawler = new TestCrawler({
      fetchFn: mockFetch,
      delayMs: 0,
      maxContentBytes,
    });
    const result = await crawler.crawl("https://example.com/page");

    expect(result.pages[0].content.length).toBeLessThanOrEqual(maxContentBytes);
  });

  it("truncation prefers word boundary", async () => {
    const maxContentBytes = 30;
    // Content with words, truncation point should be at a space
    const content = "hello world this is a test string that is too long";
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": { status: 404, body: "" },
      "https://example.com/page": { status: 200, body: content },
    });

    const crawler = new TestCrawler({
      fetchFn: mockFetch,
      delayMs: 0,
      maxContentBytes,
    });
    const result = await crawler.crawl("https://example.com/page");

    const truncated = result.pages[0].content;
    expect(truncated.length).toBeLessThanOrEqual(maxContentBytes);
    // Should end at a word boundary, not mid-word
    // The truncated content should not end with a trailing space
    expect(truncated.endsWith(" ")).toBe(false);
    // The truncated content should be shorter than the raw slice
    // (because it was cut back to a word boundary)
    expect(truncated.length).toBeLessThan(maxContentBytes);
    // Every word in the truncated content should be a complete word from the original
    const words = truncated.split(" ");
    for (const word of words) {
      expect(content).toContain(word);
    }
  });

  it("custom maxContentBytes is respected", async () => {
    const maxContentBytes = 20;
    const content = "a".repeat(100);
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": { status: 404, body: "" },
      "https://example.com/page": { status: 200, body: content },
    });

    const crawler = new TestCrawler({
      fetchFn: mockFetch,
      delayMs: 0,
      maxContentBytes,
    });
    const result = await crawler.crawl("https://example.com/page");

    expect(result.pages[0].content.length).toBeLessThanOrEqual(maxContentBytes);
  });
});

// -- crawl() method integration --

describe("BaseCrawler crawl() integration", () => {
  it("calls checkRobotsTxt before doCrawl", async () => {
    const callOrder: string[] = [];

    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes("robots.txt")) {
        callOrder.push("robots");
        return new Response("User-Agent: *\nAllow: /\n", { status: 200 });
      }
      callOrder.push("content");
      return new Response("Content", { status: 200 });
    }) as unknown as typeof fetch;

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    await crawler.crawl("https://example.com/page");

    expect(callOrder[0]).toBe("robots");
    expect(callOrder[1]).toBe("content");
  });

  it("returns 'Blocked by robots.txt' error for disallowed URLs", async () => {
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": {
        status: 200,
        body: "User-Agent: *\nDisallow: /\n",
      },
    });

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    const result = await crawler.crawl("https://example.com/any-page");

    expect(result.pages).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({
      url: "https://example.com/any-page",
      error: "Blocked by robots.txt",
    });
  });

  it("delegates to doCrawl for allowed URLs", async () => {
    const { mockFetch } = createMockFetch({
      "https://example.com/robots.txt": { status: 404, body: "" },
      "https://example.com/page": { status: 200, body: "Hello World" },
    });

    const crawler = new TestCrawler({ fetchFn: mockFetch, delayMs: 0 });
    const result = await crawler.crawl("https://example.com/page");

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].url).toBe("https://example.com/page");
    expect(result.pages[0].content).toBe("Hello World");
  });
});
