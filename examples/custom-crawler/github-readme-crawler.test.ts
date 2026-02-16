import { describe, it, expect } from "vitest";
import { githubReadmeCrawler } from "./github-readme-crawler.js";

describe("githubReadmeCrawler", () => {
  describe("canCrawl", () => {
    it("accepts GitHub URLs", () => {
      expect(
        githubReadmeCrawler.canCrawl("https://github.com/facebook/react")
      ).toBe(true);
    });

    it("accepts owner/repo shorthand", () => {
      expect(githubReadmeCrawler.canCrawl("facebook/react")).toBe(true);
    });

    it("rejects non-GitHub URLs", () => {
      expect(githubReadmeCrawler.canCrawl("https://linear.app")).toBe(false);
    });

    it("rejects empty strings", () => {
      expect(githubReadmeCrawler.canCrawl("")).toBe(false);
    });
  });

  describe("crawl", () => {
    it("returns a CrawlResult with timing", async () => {
      const result = await githubReadmeCrawler.crawl("invalid-no-slash");
      expect(result.timing).toHaveProperty("startedAt");
      expect(result.timing).toHaveProperty("completedAt");
      expect(result.timing).toHaveProperty("totalMs");
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    });

    it("returns error for invalid GitHub URL", async () => {
      const result = await githubReadmeCrawler.crawl("not-a-repo");
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("Not a valid GitHub URL");
    });

    it("sets correct page metadata", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response("# Test Repo\n\nA test repository.", {
          status: 200,
          statusText: "OK",
        });

      try {
        const result = await githubReadmeCrawler.crawl(
          "https://github.com/test/repo"
        );
        expect(result.pages).toHaveLength(1);
        expect(result.pages[0].pageType).toBe("docs");
        expect(result.pages[0].title).toBe("test/repo README");
        expect(result.pages[0].content).toContain("# Test Repo");
        expect(result.pages[0].url).toBe("https://github.com/test/repo");
        expect(result.errors).toHaveLength(0);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles HTTP errors gracefully", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () =>
        new Response("Not Found", { status: 404, statusText: "Not Found" });

      try {
        const result = await githubReadmeCrawler.crawl(
          "https://github.com/no/repo"
        );
        expect(result.pages).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain("404");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("handles network errors gracefully", async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        throw new Error("Network unreachable");
      };

      try {
        const result = await githubReadmeCrawler.crawl(
          "https://github.com/test/repo"
        );
        expect(result.pages).toHaveLength(0);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain("Network unreachable");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("interface compliance", () => {
    it("has required properties", () => {
      expect(githubReadmeCrawler.name).toBe("github-readme");
      expect(githubReadmeCrawler.sourceType).toBe("docs");
      expect(typeof githubReadmeCrawler.canCrawl).toBe("function");
      expect(typeof githubReadmeCrawler.crawl).toBe("function");
    });
  });
});
