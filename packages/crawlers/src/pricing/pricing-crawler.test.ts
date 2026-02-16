import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pricingCrawler } from "./index";
import type { PricingMetadata } from "./types";

describe("pricingCrawler", () => {
  describe("canCrawl", () => {
    it("returns true for /pricing URLs", () => {
      expect(pricingCrawler.canCrawl("https://linear.app/pricing")).toBe(true);
      expect(pricingCrawler.canCrawl("https://example.com/pricing/")).toBe(
        true
      );
      expect(
        pricingCrawler.canCrawl("https://example.com/pricing/enterprise")
      ).toBe(true);
    });

    it("returns true for /plans URLs", () => {
      expect(pricingCrawler.canCrawl("https://example.com/plans")).toBe(true);
      expect(pricingCrawler.canCrawl("https://example.com/plans/")).toBe(true);
    });

    it("returns true for /price URLs", () => {
      expect(pricingCrawler.canCrawl("https://example.com/price")).toBe(true);
    });

    it("returns false for non-pricing URLs", () => {
      expect(pricingCrawler.canCrawl("https://example.com/features")).toBe(
        false
      );
      expect(pricingCrawler.canCrawl("https://example.com/about")).toBe(false);
      expect(pricingCrawler.canCrawl("https://example.com/")).toBe(false);
      expect(
        pricingCrawler.canCrawl("https://example.com/blog/pricing-strategy")
      ).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(pricingCrawler.canCrawl("not-a-url")).toBe(false);
      expect(pricingCrawler.canCrawl("")).toBe(false);
    });
  });

  describe("interface compliance", () => {
    it("has name 'pricing'", () => {
      expect(pricingCrawler.name).toBe("pricing");
    });

    it("has sourceType 'pricing'", () => {
      expect(pricingCrawler.sourceType).toBe("pricing");
    });

    it("has canCrawl function", () => {
      expect(typeof pricingCrawler.canCrawl).toBe("function");
    });

    it("has crawl function", () => {
      expect(typeof pricingCrawler.crawl).toBe("function");
    });
  });

  describe("crawl", () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("returns structured metadata alongside raw content", async () => {
      const mockHtml = `
        <html>
          <head><title>Pricing - Acme</title>
          <meta name="description" content="Choose your plan"></head>
          <body>
            <h2>Free</h2><p>Free</p><ul><li>5 users</li><li>Basic features</li></ul>
            <h2>Pro</h2><p>$29/mo</p><ul><li>Unlimited users</li><li>API access</li></ul>
            <h2>Enterprise</h2><p>Contact Sales</p><ul><li>SSO</li><li>Custom SLA</li></ul>
          </body>
        </html>
      `;

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockHtml),
      });

      const result = await pricingCrawler.crawl("https://example.com/pricing");

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].pageType).toBe("pricing");
      expect(result.pages[0].title).toBe("Pricing - Acme");
      expect(result.pages[0].content).toBeTruthy();
      expect(result.pages[0].url).toBe("https://example.com/pricing");

      // Check structured metadata
      const metadata = result.pages[0].metadata;
      expect(metadata).toBeDefined();
      expect(metadata!.description).toBe("Choose your plan");

      const structuredData = metadata!.structuredData as {
        pricing: PricingMetadata;
      };
      expect(structuredData.pricing).toBeDefined();
      expect(structuredData.pricing.tiers.length).toBeGreaterThanOrEqual(2);
      expect(structuredData.pricing.hasFreeTier).toBe(true);
      expect(structuredData.pricing.hasEnterpriseTier).toBe(true);
    });

    it("reports errors for failed fetches without crashing", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const result = await pricingCrawler.crawl("https://example.com/pricing");

      expect(result.pages).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].url).toBe("https://example.com/pricing");
      expect(result.errors[0].error).toContain("404");
    });

    it("reports errors for network failures without crashing", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Network error")
      );

      const result = await pricingCrawler.crawl("https://example.com/pricing");

      expect(result.pages).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("Network error");
    });

    it("includes timing information", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve("<html><body><p>Simple page</p></body></html>"),
      });

      const result = await pricingCrawler.crawl("https://example.com/pricing");

      expect(result.timing.startedAt).toBeLessThanOrEqual(
        result.timing.completedAt
      );
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
      expect(result.timing.totalMs).toBe(
        result.timing.completedAt - result.timing.startedAt
      );
    });

    it("uses custom user agent when provided", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () =>
          Promise.resolve("<html><body>Content</body></html>"),
      });

      await pricingCrawler.crawl("https://example.com/pricing", {
        userAgent: "CustomBot/1.0",
      });

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0];
      expect(fetchCall[1].headers["User-Agent"]).toBe("CustomBot/1.0");
    });

    it("supports cancellation via AbortSignal", async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await pricingCrawler.crawl("https://example.com/pricing", {
        signal: controller.signal,
      });

      expect(result.pages).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });
  });
});
