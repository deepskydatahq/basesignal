import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { WebsiteCrawler } from "./index";
import type { Fetcher } from "./index";
import { classifyPageType, shouldCrawlUrl } from "./classify";
import { extractContent, extractMetadata } from "./extract";
import { discoverLinks } from "./discover";

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

/** Create a fetcher that serves from a map of URL -> HTML content. */
function createFixtureFetcher(fixtures: Record<string, string>): Fetcher {
  return async (url: string) => {
    // Try exact match, then try with/without trailing slash
    const html = fixtures[url] ?? fixtures[url.replace(/\/$/, "")];
    if (!html) {
      return new Response("Not Found", { status: 404 });
    }
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  };
}

/** Load HTML fixture from __fixtures__ directory. */
function loadFixture(...pathSegments: string[]): string {
  return readFileSync(
    join(__dirname, "../__fixtures__", ...pathSegments),
    "utf-8"
  );
}

// ---------------------------------------------------------------------------
// AC1: WebsiteCrawler implements the Crawler interface
// ---------------------------------------------------------------------------

describe("WebsiteCrawler", () => {
  describe("interface compliance", () => {
    it("has name 'website' and sourceType 'website'", () => {
      const crawler = new WebsiteCrawler();
      expect(crawler.name).toBe("website");
      expect(crawler.sourceType).toBe("website");
    });

    it("exposes canCrawl and crawl methods", () => {
      const crawler = new WebsiteCrawler();
      expect(typeof crawler.canCrawl).toBe("function");
      expect(typeof crawler.crawl).toBe("function");
    });
  });

  // -------------------------------------------------------------------------
  // AC2: canCrawl() returns true for any HTTP/HTTPS URL
  // -------------------------------------------------------------------------

  describe("canCrawl", () => {
    it("returns true for HTTPS URLs", () => {
      const crawler = new WebsiteCrawler();
      expect(crawler.canCrawl("https://linear.app")).toBe(true);
      expect(crawler.canCrawl("https://example.com/path")).toBe(true);
    });

    it("returns true for HTTP URLs", () => {
      const crawler = new WebsiteCrawler();
      expect(crawler.canCrawl("http://example.com")).toBe(true);
    });

    it("returns false for non-HTTP protocols", () => {
      const crawler = new WebsiteCrawler();
      expect(crawler.canCrawl("ftp://example.com")).toBe(false);
      expect(crawler.canCrawl("ssh://example.com")).toBe(false);
      expect(crawler.canCrawl("file:///etc/passwd")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      const crawler = new WebsiteCrawler();
      expect(crawler.canCrawl("not-a-url")).toBe(false);
      expect(crawler.canCrawl("")).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // AC3: Crawls homepage and discovers linked pages
  // -------------------------------------------------------------------------

  describe("crawl - link discovery", () => {
    it("crawls homepage and discovers linked pages", async () => {
      const fixtures: Record<string, string> = {
        "https://acme.io": loadFixture("simple-site", "index.html"),
        "https://acme.io/pricing": loadFixture("simple-site", "pricing.html"),
        "https://acme.io/features": loadFixture("simple-site", "features.html"),
        "https://acme.io/about": loadFixture("simple-site", "about.html"),
      };

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher(fixtures),
      });

      const result = await crawler.crawl("https://acme.io");

      expect(result.pages.length).toBeGreaterThanOrEqual(4);
      const pageTypes = result.pages.map((p) => p.pageType);
      expect(pageTypes).toContain("homepage");
      expect(pageTypes).toContain("pricing");
      expect(pageTypes).toContain("features");
      expect(pageTypes).toContain("about");
    });

    it("does not crawl external links", async () => {
      const fixtures: Record<string, string> = {
        "https://acme.io": loadFixture("simple-site", "index.html"),
      };

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher(fixtures),
      });

      const result = await crawler.crawl("https://acme.io");

      // Homepage links to https://other-site.com -- it should not be crawled
      const urls = result.pages.map((p) => p.url);
      expect(urls.every((u) => u.includes("acme.io"))).toBe(true);
    });

    it("skips blog and legal links from nav/footer", async () => {
      const fixtures: Record<string, string> = {
        "https://acme.io": loadFixture("simple-site", "index.html"),
        "https://acme.io/pricing": loadFixture("simple-site", "pricing.html"),
        "https://acme.io/features": loadFixture("simple-site", "features.html"),
        "https://acme.io/about": loadFixture("simple-site", "about.html"),
      };

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher(fixtures),
      });

      const result = await crawler.crawl("https://acme.io");
      const urls = result.pages.map((p) => p.url);

      // /blog, /legal, /privacy should not be in crawled pages
      expect(urls.some((u) => u.includes("/blog"))).toBe(false);
      expect(urls.some((u) => u.includes("/legal"))).toBe(false);
      expect(urls.some((u) => u.includes("/privacy"))).toBe(false);
    });

    it("returns timing information", async () => {
      const fixtures: Record<string, string> = {
        "https://acme.io": "<html><body><p>Hello</p></body></html>",
      };

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher(fixtures),
      });

      const result = await crawler.crawl("https://acme.io");
      expect(result.timing.startedAt).toBeGreaterThan(0);
      expect(result.timing.completedAt).toBeGreaterThanOrEqual(
        result.timing.startedAt
      );
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    });

    it("records errors for failed pages", async () => {
      const fetcher: Fetcher = async (url: string) => {
        if (url.includes("/broken")) {
          return new Response("Server Error", { status: 500 });
        }
        return new Response(
          `<html><body><a href="/broken">Link</a><p>Home</p></body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          }
        );
      };

      const crawler = new WebsiteCrawler({ fetcher });
      const result = await crawler.crawl("https://acme.io");

      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0].error).toContain("500");
    });
  });

  // -------------------------------------------------------------------------
  // AC4: Classifies pages by type based on URL patterns
  // -------------------------------------------------------------------------

  describe("classifyPageType", () => {
    it("classifies root path as homepage", () => {
      expect(classifyPageType("https://acme.io/", "acme.io")).toBe("homepage");
      expect(classifyPageType("https://www.acme.io/", "acme.io")).toBe(
        "homepage"
      );
    });

    it("classifies /pricing and /plans as pricing", () => {
      expect(classifyPageType("https://acme.io/pricing", "acme.io")).toBe(
        "pricing"
      );
      expect(classifyPageType("https://acme.io/plans", "acme.io")).toBe(
        "pricing"
      );
    });

    it("classifies /features and /product as features", () => {
      expect(classifyPageType("https://acme.io/features", "acme.io")).toBe(
        "features"
      );
      expect(classifyPageType("https://acme.io/product", "acme.io")).toBe(
        "features"
      );
    });

    it("classifies /about and /company as about", () => {
      expect(classifyPageType("https://acme.io/about", "acme.io")).toBe(
        "about"
      );
      expect(classifyPageType("https://acme.io/company", "acme.io")).toBe(
        "about"
      );
    });

    it("excludes careers/jobs from about classification", () => {
      expect(
        classifyPageType("https://acme.io/about/careers", "acme.io")
      ).toBe("other");
      expect(classifyPageType("https://acme.io/company/jobs", "acme.io")).toBe(
        "other"
      );
    });

    it("classifies customer pages", () => {
      expect(classifyPageType("https://acme.io/customers", "acme.io")).toBe(
        "customers"
      );
      expect(classifyPageType("https://acme.io/case-studies", "acme.io")).toBe(
        "customers"
      );
    });

    it("classifies enterprise, integrations, security, solutions", () => {
      expect(classifyPageType("https://acme.io/enterprise", "acme.io")).toBe(
        "enterprise"
      );
      expect(classifyPageType("https://acme.io/integrations", "acme.io")).toBe(
        "integrations"
      );
      expect(classifyPageType("https://acme.io/security", "acme.io")).toBe(
        "security"
      );
      expect(classifyPageType("https://acme.io/solutions", "acme.io")).toBe(
        "solutions"
      );
    });

    it("classifies docs/help/support paths", () => {
      expect(classifyPageType("https://acme.io/docs", "acme.io")).toBe("docs");
      expect(classifyPageType("https://acme.io/help", "acme.io")).toBe("docs");
    });

    it("classifies docs/help subdomains", () => {
      expect(classifyPageType("https://help.acme.io/", "acme.io")).toBe("help");
      expect(classifyPageType("https://docs.acme.io/", "acme.io")).toBe("docs");
      expect(classifyPageType("https://support.acme.io/", "acme.io")).toBe(
        "support"
      );
    });

    it("returns 'other' for unrecognized paths", () => {
      expect(classifyPageType("https://acme.io/random-page", "acme.io")).toBe(
        "other"
      );
    });

    it("returns 'other' for invalid URLs", () => {
      expect(classifyPageType("not-a-url")).toBe("other");
    });
  });

  describe("shouldCrawlUrl", () => {
    it("allows same-domain marketing pages", () => {
      expect(shouldCrawlUrl("https://acme.io/features", "acme.io")).toBe(true);
      expect(shouldCrawlUrl("https://acme.io/pricing", "acme.io")).toBe(true);
    });

    it("rejects off-domain URLs", () => {
      expect(shouldCrawlUrl("https://other.com/features", "acme.io")).toBe(
        false
      );
    });

    it("rejects blog, legal, auth, asset URLs", () => {
      expect(shouldCrawlUrl("https://acme.io/blog/post-1", "acme.io")).toBe(
        false
      );
      expect(shouldCrawlUrl("https://acme.io/legal", "acme.io")).toBe(false);
      expect(shouldCrawlUrl("https://acme.io/login", "acme.io")).toBe(false);
      expect(shouldCrawlUrl("https://acme.io/image.png", "acme.io")).toBe(
        false
      );
    });

    it("rejects localized paths", () => {
      expect(shouldCrawlUrl("https://acme.io/fr/pricing", "acme.io")).toBe(
        false
      );
      expect(shouldCrawlUrl("https://acme.io/de/about", "acme.io")).toBe(
        false
      );
    });

    it("rejects help/docs/support subdomains", () => {
      expect(shouldCrawlUrl("https://help.acme.io/", "acme.io")).toBe(false);
      expect(shouldCrawlUrl("https://docs.acme.io/getting-started", "acme.io")).toBe(
        false
      );
    });
  });

  // -------------------------------------------------------------------------
  // AC5: Extracts clean text content from HTML (strips nav, footer, scripts)
  // -------------------------------------------------------------------------

  describe("extractContent", () => {
    it("extracts headings and paragraphs from main content", () => {
      const html = loadFixture("content-extraction.html");
      const content = extractContent(html);

      expect(content).toContain("# Main Heading");
      expect(content).toContain("This is the real content that should be extracted.");
      expect(content).toContain("## Subheading");
      expect(content).toContain("More important content here.");
    });

    it("extracts list items", () => {
      const html = loadFixture("content-extraction.html");
      const content = extractContent(html);

      expect(content).toContain("- Feature one");
      expect(content).toContain("- Feature two");
      expect(content).toContain("- Feature three");
    });

    it("extracts blockquotes", () => {
      const html = loadFixture("content-extraction.html");
      const content = extractContent(html);

      expect(content).toContain("A customer testimonial that matters.");
    });

    it("strips navigation content", () => {
      const html = loadFixture("content-extraction.html");
      const content = extractContent(html);

      // Nav links should not appear in content
      expect(content).not.toContain("Login");
    });

    it("strips footer content", () => {
      const html = loadFixture("content-extraction.html");
      const content = extractContent(html);

      expect(content).not.toContain("Copyright 2026. All rights reserved.");
      expect(content).not.toContain("Terms");
    });

    it("strips script content", () => {
      const html = loadFixture("content-extraction.html");
      const content = extractContent(html);

      expect(content).not.toContain("analytics.track");
      expect(content).not.toContain("console.log");
    });

    it("strips header/banner and aria-hidden elements", () => {
      const html = loadFixture("content-extraction.html");
      const content = extractContent(html);

      expect(content).not.toContain("Banner content that should be removed");
      expect(content).not.toContain("Hidden accessibility content");
    });

    it("strips noscript and iframe content", () => {
      const html = loadFixture("content-extraction.html");
      const content = extractContent(html);

      expect(content).not.toContain("Enable JavaScript");
    });

    it("falls back to body when no main/article element exists", () => {
      const html = `
        <html><body>
          <h1>Title</h1>
          <p>Body content without main tag.</p>
        </body></html>`;
      const content = extractContent(html);

      expect(content).toContain("# Title");
      expect(content).toContain("Body content without main tag.");
    });

    it("prefers article over body when no main exists", () => {
      const html = `
        <html><body>
          <div><p>Outside article</p></div>
          <article>
            <h1>Article Title</h1>
            <p>Article content.</p>
          </article>
        </body></html>`;
      const content = extractContent(html);

      expect(content).toContain("Article Title");
      expect(content).toContain("Article content.");
    });
  });

  describe("extractMetadata", () => {
    it("extracts og:title over <title>", () => {
      const html = loadFixture("content-extraction.html");
      const meta = extractMetadata(html);
      expect(meta.title).toBe("OG Title Override");
    });

    it("falls back to <title> when no og:title", () => {
      const html = `<html><head><title>Fallback Title</title></head><body></body></html>`;
      const meta = extractMetadata(html);
      expect(meta.title).toBe("Fallback Title");
    });

    it("extracts og:description over meta description", () => {
      const html = loadFixture("content-extraction.html");
      const meta = extractMetadata(html);
      expect(meta.description).toBe("OG description text");
    });

    it("extracts meta description when no og:description", () => {
      const html = `<html><head><meta name="description" content="Meta desc"></head><body></body></html>`;
      const meta = extractMetadata(html);
      expect(meta.description).toBe("Meta desc");
    });

    it("extracts og:image", () => {
      const html = loadFixture("simple-site", "index.html");
      const meta = extractMetadata(html);
      expect(meta.ogImage).toBe("https://acme.io/og.png");
    });

    it("returns undefined for missing metadata", () => {
      const html = `<html><head></head><body></body></html>`;
      const meta = extractMetadata(html);
      expect(meta.title).toBeUndefined();
      expect(meta.description).toBeUndefined();
      expect(meta.ogImage).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // AC6: Respects CrawlOptions: maxPages, maxDepth, timeout
  // -------------------------------------------------------------------------

  describe("crawl - options enforcement", () => {
    it("respects maxPages option", async () => {
      const fixtures: Record<string, string> = {
        "https://acme.io": loadFixture("simple-site", "index.html"),
        "https://acme.io/pricing": loadFixture("simple-site", "pricing.html"),
        "https://acme.io/features": loadFixture("simple-site", "features.html"),
        "https://acme.io/about": loadFixture("simple-site", "about.html"),
      };

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher(fixtures),
      });

      const result = await crawler.crawl("https://acme.io", { maxPages: 2 });
      expect(result.pages.length).toBeLessThanOrEqual(2);
    });

    it("respects maxDepth option", async () => {
      // Build a chain: homepage -> /features -> /features/integrations
      const fixtures: Record<string, string> = {
        "https://acme.io": `<html><head><title>Home</title></head><body>
          <main><h1>Home</h1><a href="/features">Features</a></main>
        </body></html>`,
        "https://acme.io/features": `<html><head><title>Features</title></head><body>
          <main><h1>Features</h1><a href="/features/detail">Detail</a></main>
        </body></html>`,
        "https://acme.io/features/detail": `<html><head><title>Detail</title></head><body>
          <main><h1>Detail</h1><p>Deep page</p></main>
        </body></html>`,
      };

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher(fixtures),
      });

      // maxDepth: 0 = only the root URL, no link following
      const result = await crawler.crawl("https://acme.io", { maxDepth: 0 });
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].pageType).toBe("homepage");
    });

    it("maxDepth 1 crawls homepage and directly linked pages", async () => {
      const fixtures: Record<string, string> = {
        "https://acme.io": `<html><head><title>Home</title></head><body>
          <main><h1>Home</h1><a href="/features">Features</a></main>
        </body></html>`,
        "https://acme.io/features": `<html><head><title>Features</title></head><body>
          <main><h1>Features</h1><a href="/features/detail">Detail</a></main>
        </body></html>`,
        "https://acme.io/features/detail": `<html><head><title>Detail</title></head><body>
          <main><h1>Detail</h1><p>Deep page</p></main>
        </body></html>`,
      };

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher(fixtures),
      });

      const result = await crawler.crawl("https://acme.io", { maxDepth: 1 });
      const urls = result.pages.map((p) => p.url);
      expect(urls).toContain("https://acme.io/");
      expect(urls).toContain("https://acme.io/features");
      // Depth 2 page should NOT be crawled
      expect(urls).not.toContain("https://acme.io/features/detail");
    });

    it("respects timeout via AbortSignal", async () => {
      // Create a slow fetcher that delays 200ms per request
      const slowFetcher: Fetcher = async (url: string, init?: RequestInit) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (init?.signal?.aborted) {
          throw new DOMException("The operation was aborted.", "AbortError");
        }
        return new Response(
          `<html><head><title>Page</title></head><body>
            <main><p>Content</p><a href="/page2">Next</a></main>
          </body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          }
        );
      };

      const crawler = new WebsiteCrawler({ fetcher: slowFetcher });

      // Abort after 50ms -- should get fewer pages than without timeout
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 50);

      const result = await crawler.crawl("https://acme.io", {
        signal: controller.signal,
        maxPages: 100,
      });

      // With 200ms per request and 50ms timeout, should get 0-1 pages
      expect(result.pages.length).toBeLessThanOrEqual(1);
    });
  });

  // -------------------------------------------------------------------------
  // AC7: Tests use saved HTML fixtures, not live HTTP requests
  // -------------------------------------------------------------------------
  // (This is demonstrated by every test above using createFixtureFetcher
  //  and loadFixture -- no real HTTP calls are made.)

  describe("discoverLinks", () => {
    it("discovers absolute URLs from anchor tags", () => {
      const html = `<html><body>
        <a href="/pricing">Pricing</a>
        <a href="https://acme.io/about">About</a>
        <a href="/features">Features</a>
      </body></html>`;

      const links = discoverLinks(html, "https://acme.io");
      expect(links).toContain("https://acme.io/pricing");
      expect(links).toContain("https://acme.io/about");
      expect(links).toContain("https://acme.io/features");
    });

    it("resolves relative URLs against base URL", () => {
      const html = `<html><body>
        <a href="../about">About</a>
        <a href="pricing">Pricing</a>
      </body></html>`;

      const links = discoverLinks(html, "https://acme.io/features/");
      expect(links).toContain("https://acme.io/about");
      expect(links).toContain("https://acme.io/features/pricing");
    });

    it("skips fragment-only, javascript:, mailto:, tel: links", () => {
      const html = `<html><body>
        <a href="#section">Anchor</a>
        <a href="javascript:void(0)">JS</a>
        <a href="mailto:hi@acme.io">Email</a>
        <a href="tel:+1234567890">Phone</a>
        <a href="/real-page">Real</a>
      </body></html>`;

      const links = discoverLinks(html, "https://acme.io");
      expect(links).toHaveLength(1);
      expect(links[0]).toContain("/real-page");
    });

    it("deduplicates URLs", () => {
      const html = `<html><body>
        <a href="/pricing">Pricing</a>
        <a href="/pricing">Pricing again</a>
        <a href="/pricing#tier">Pricing with fragment</a>
      </body></html>`;

      const links = discoverLinks(html, "https://acme.io");
      // All three should resolve to the same URL after fragment stripping
      expect(links).toHaveLength(1);
    });

    it("includes external links (caller handles filtering)", () => {
      const html = `<html><body>
        <a href="https://external.com/page">External</a>
        <a href="/local">Local</a>
      </body></html>`;

      const links = discoverLinks(html, "https://acme.io");
      expect(links).toContain("https://external.com/page");
      expect(links).toContain("https://acme.io/local");
    });
  });
});
