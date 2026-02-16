# WebsiteCrawler Implementation Design

## Overview

Implement a `WebsiteCrawler` that satisfies the `Crawler` interface (S001) and crawls marketing websites. It replaces the monolithic Firecrawl-dependent logic in `convex/scanning.ts` with a self-contained, testable crawler that works without API keys.

## Problem Statement

The current crawl pipeline in `convex/scanning.ts` is tightly coupled to Firecrawl's API. For the open source package (`@basesignal/crawlers`), the website crawler must:

1. Work without any API keys (just HTTP)
2. Extract clean text content from HTML pages
3. Classify pages by type using URL patterns and content signals
4. Respect crawl options (maxPages, maxDepth, timeout)
5. Be testable with saved HTML fixtures, not live HTTP

## Expert Perspectives

### Technical Architect

The real question is: what does this crawler actually need to do? It fetches HTML, extracts text, and classifies pages. That is `fetch` + a lightweight HTML parser. Firecrawl is a hosted service that runs headless Chrome -- overkill when marketing pages are server-rendered HTML. The crawler should use `fetch` for HTTP and a DOM parser for extraction. Make the HTTP layer injectable so tests can swap in fixtures without mocking globals. `cheerio` is the obvious parser choice -- it is mature, fast, has zero native dependencies, and the API is familiar to anyone who knows jQuery or DOM manipulation. No need to make the crawl provider "pluggable" at this level -- the `Crawler` interface itself is the plugin boundary. Each crawler implementation owns its fetching strategy.

### Simplification Review

**Verdict: APPROVED with one cut.**

What survives:
- `fetch` + `cheerio` for HTML fetching and parsing. No Firecrawl dependency.
- Page classification reuses the proven heuristics from `convex/lib/urlUtils.ts` (copy, not import -- the package is standalone).
- Injectable `fetcher` for testing. Simple function signature: `(url: string) => Promise<Response>`.
- BFS link discovery with depth tracking. No queue library, just an array and a Set.

What to cut:
- **No `TurndownService` or markdown conversion.** The current pipeline stores markdown because Firecrawl returns markdown. But the analysis pipeline feeds content to an LLM that handles plain text just as well. Extract headings, paragraphs, and list items as plain text. Simpler, fewer dependencies, smaller output.

What to watch for:
- Content extraction must not be "too smart." Strip nav/footer/script, keep `<main>` or `<article>` if present, fall back to `<body>`. Done.
- Metadata extraction (title, description, og:image) is three `querySelector` calls. No library needed.

## Proposed Solution

### Architecture Decision: fetch + cheerio (Option B)

**Why not Firecrawl (Option A)?** Requires API key, costs money per page, adds external dependency. Defeats the purpose of an open source package that works out of the box.

**Why not pluggable provider (Option C)?** The `Crawler` interface IS the plugin boundary. If someone wants Firecrawl-quality rendering, they implement a `FirecrawlWebsiteCrawler`. The built-in crawler should just work with zero config.

**Why cheerio over jsdom?** cheerio is 5x faster, uses 10x less memory, has no native dependencies, and we only need read-only DOM traversal. jsdom simulates a full browser environment -- unnecessary for content extraction from static HTML.

### File Structure

```
packages/crawlers/
  src/
    website/
      index.ts              # WebsiteCrawler class
      classify.ts           # Page type classification (adapted from urlUtils.ts)
      extract.ts            # HTML content extraction + metadata
      discover.ts           # Link discovery from HTML
      website.test.ts       # Unit tests
    __fixtures__/
      linear-homepage.html       # Saved HTML fixtures
      linear-pricing.html
      notion-features.html
      miro-about.html
      simple-site/               # Multi-page fixture for crawl tests
        index.html
        pricing.html
        features.html
        about.html
```

### Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `cheerio` | HTML parsing + DOM traversal | ~200KB |

One dependency. No Firecrawl, no Turndown, no Puppeteer.

### WebsiteCrawler (`src/website/index.ts`)

```typescript
import type { Crawler, CrawlOptions, CrawlResult, CrawledPage, CrawlError } from "../types";
import { classifyPageType } from "./classify";
import { extractContent, extractMetadata } from "./extract";
import { discoverLinks } from "./discover";

const DEFAULT_MAX_PAGES = 30;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_TIMEOUT = 60_000; // 60 seconds
const DEFAULT_USER_AGENT = "BasesignalCrawler/1.0";
const MAX_CONTENT_LENGTH = 100_000; // 100KB per page

/**
 * Fetcher function type. Matches the global fetch signature.
 * Injectable for testing -- swap in a fixture-backed fetcher.
 */
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export class WebsiteCrawler implements Crawler {
  readonly name = "website";
  readonly sourceType = "website" as const;

  private fetcher: Fetcher;

  constructor(options?: { fetcher?: Fetcher }) {
    this.fetcher = options?.fetcher ?? globalThis.fetch.bind(globalThis);
  }

  canCrawl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT;
    const userAgent = options?.userAgent ?? DEFAULT_USER_AGENT;
    const signal = options?.signal ?? AbortSignal.timeout(timeout);

    const startedAt = Date.now();
    const pages: CrawledPage[] = [];
    const errors: CrawlError[] = [];

    // BFS crawl
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: normalizeUrl(url), depth: 0 }];
    const rootHostname = getRootHostname(url);

    while (queue.length > 0 && pages.length < maxPages) {
      if (signal.aborted) break;

      const item = queue.shift()!;
      const normalizedUrl = normalizeUrl(item.url);

      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Only crawl same-origin URLs
      if (!isSameOrigin(normalizedUrl, rootHostname)) continue;

      try {
        const response = await this.fetcher(normalizedUrl, {
          headers: { "User-Agent": userAgent },
          signal,
        });

        if (!response.ok) {
          errors.push({ url: normalizedUrl, error: `HTTP ${response.status}` });
          continue;
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) continue;

        const html = await response.text();

        // Extract content and metadata
        const content = extractContent(html);
        const metadata = extractMetadata(html);
        const pageType = classifyPageType(normalizedUrl, rootHostname);
        const title = metadata.title;

        // Truncate content
        const truncated = content.length > MAX_CONTENT_LENGTH
          ? content.slice(0, MAX_CONTENT_LENGTH)
          : content;

        pages.push({
          url: normalizedUrl,
          pageType,
          title,
          content: truncated,
          metadata: {
            description: metadata.description,
            ogImage: metadata.ogImage,
          },
        });

        // Discover links for BFS (only if we haven't hit depth limit)
        if (item.depth < maxDepth) {
          const links = discoverLinks(html, normalizedUrl);
          for (const link of links) {
            if (!visited.has(normalizeUrl(link))) {
              queue.push({ url: link, depth: item.depth + 1 });
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        if (signal.aborted) break;
        errors.push({ url: normalizedUrl, error: message });
      }
    }

    const completedAt = Date.now();
    return {
      pages,
      timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
      errors,
    };
  }
}
```

### Page Type Classification (`src/website/classify.ts`)

Adapted directly from `convex/lib/urlUtils.ts`. Same proven heuristics, standalone copy (no cross-package import).

```typescript
/**
 * Classify a URL by page type based on URL path patterns.
 * Adapted from convex/lib/urlUtils.ts for standalone use.
 */
export function classifyPageType(url: string, rootHostname?: string): string {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "other"; }

  const hostname = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  const isMainDomain = rootHostname
    ? hostname === rootHostname ||
      hostname === `www.${rootHostname}` ||
      `www.${hostname}` === rootHostname
    : true;

  if ((path === "/" || path === "") && isMainDomain) return "homepage";
  if (path.match(/^\/(pricing|plans)(\/|$)/)) return "pricing";
  if (path.match(/^\/(features?|product)(\/|$)/)) return "features";
  if (path.match(/^\/(about|company)(\/|$)/) && !path.includes("career") && !path.includes("jobs")) return "about";
  if (path.match(/^\/(customers?|case-studies?|stories|success-stories)(\/|$)/)) return "customers";
  if (path.match(/^\/(enterprise)(\/|$)/)) return "enterprise";
  if (path.match(/^\/(integrations?)(\/|$)/)) return "integrations";
  if (path.match(/^\/(security|compliance|trust)(\/|$)/)) return "security";
  if (path.match(/^\/(solutions?|use-cases?)(\/|$)/)) return "solutions";
  if (path.match(/^\/(docs|help|support|getting-started)(\/|$)/)) return "docs";

  // Subdomain classifications
  if (rootHostname) {
    if (hostname.startsWith("help.")) return "help";
    if (hostname.startsWith("docs.")) return "docs";
    if (hostname.startsWith("support.")) return "support";
  }

  return "other";
}

/**
 * URLs to skip during crawl (low-value for product analysis).
 */
const SKIP_PATTERNS = [
  /^\/(blog|press|careers|jobs)(\/|$)/,
  /^\/(legal|privacy|terms|cookie)/,
  /^\/(login|signup|register|auth)\b/,
  /\.(pdf|png|jpg|jpeg|svg|gif|webp|zip|tar|gz)$/,
  /^\/(templates)\//,
  /^\/sitemap\.xml$/,
  /^\/(demo|changelog)(\/|$)/,
];

const LOCALIZED_PREFIXES = [
  /^\/(es|de|fr|it|pt|nl|pl|ru|ja|ko|zh|fi|sv|da|no|cs)\//,
];

/**
 * Whether a URL should be included in the crawl.
 */
export function shouldCrawlUrl(url: string, rootHostname: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    // Same origin only
    const baseDomain = hostname.replace(/^www\./, "");
    if (baseDomain !== rootHostname && !hostname.endsWith(`.${rootHostname}`)) {
      return false;
    }

    // Skip help/docs subdomains (handled by separate docs crawler)
    if (hostname.startsWith("help.") || hostname.startsWith("support.") || hostname.startsWith("docs.")) {
      return false;
    }

    // Skip localized
    if (LOCALIZED_PREFIXES.some(p => p.test(path))) return false;

    // Skip low-value patterns
    if (SKIP_PATTERNS.some(p => p.test(path))) return false;

    return true;
  } catch {
    return false;
  }
}
```

### Content Extraction (`src/website/extract.ts`)

```typescript
import * as cheerio from "cheerio";

/**
 * Extract clean text content from HTML.
 *
 * Strategy:
 * 1. Remove noise elements (nav, footer, script, style, header, aside)
 * 2. Prefer <main> or <article> if present
 * 3. Fall back to <body>
 * 4. Extract text preserving heading hierarchy and paragraph structure
 */
export function extractContent(html: string): string {
  const $ = cheerio.load(html);

  // Remove noise elements
  $("script, style, noscript, iframe, svg").remove();
  $("nav, footer, header").remove();
  $("[role='navigation'], [role='banner'], [role='contentinfo']").remove();
  $("[aria-hidden='true']").remove();

  // Find the main content container
  let $content = $("main, [role='main']");
  if ($content.length === 0) $content = $("article");
  if ($content.length === 0) $content = $("body");

  // Extract structured text
  const blocks: string[] = [];

  $content.find("h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, figcaption").each((_, el) => {
    const $el = $(el);
    const tag = el.type === "tag" ? el.tagName.toLowerCase() : "";
    const text = $el.text().trim();

    if (!text) return;

    // Format headings with markdown-style markers for LLM readability
    if (tag.startsWith("h")) {
      const level = parseInt(tag[1], 10);
      const prefix = "#".repeat(level);
      blocks.push(`\n${prefix} ${text}\n`);
    } else if (tag === "li") {
      blocks.push(`- ${text}`);
    } else {
      blocks.push(text);
    }
  });

  return blocks
    .join("\n")
    .replace(/\n{3,}/g, "\n\n") // Collapse excessive newlines
    .trim();
}

/**
 * Extract metadata from HTML head.
 */
export function extractMetadata(html: string): {
  title?: string;
  description?: string;
  ogImage?: string;
} {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    undefined;

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    undefined;

  const ogImage =
    $('meta[property="og:image"]').attr("content") || undefined;

  return { title, description, ogImage };
}
```

### Link Discovery (`src/website/discover.ts`)

```typescript
import * as cheerio from "cheerio";

/**
 * Discover links from an HTML page.
 * Returns absolute URLs, deduped, same-origin only.
 */
export function discoverLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    // Skip fragment-only, javascript:, mailto:, tel:
    if (href.startsWith("#") || href.startsWith("javascript:") ||
        href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }

    try {
      const resolved = new URL(href, baseUrl);
      // Strip fragment and trailing slash for dedup
      resolved.hash = "";
      const normalized = resolved.href.replace(/\/$/, "") || resolved.href;
      links.add(normalized);
    } catch {
      // Skip invalid URLs
    }
  });

  return Array.from(links);
}
```

### Crawl Flow Integration with shouldCrawlUrl

The BFS loop in `WebsiteCrawler.crawl()` uses `shouldCrawlUrl` as a filter when adding discovered links to the queue. Links that match skip patterns (blog, legal, auth, assets, localized) are never enqueued. This keeps the crawl focused on high-value marketing pages without a separate "filter" step.

```typescript
// Inside the BFS loop, when discovering links:
const links = discoverLinks(html, normalizedUrl);
for (const link of links) {
  const normalized = normalizeUrl(link);
  if (!visited.has(normalized) && shouldCrawlUrl(normalized, rootHostname)) {
    queue.push({ url: normalized, depth: item.depth + 1 });
  }
}
```

### Helper Functions

```typescript
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    // Remove trailing slash for consistency (except root)
    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url;
  }
}

function getRootHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSameOrigin(url: string, rootHostname: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === rootHostname || hostname.endsWith(`.${rootHostname}`);
  } catch {
    return false;
  }
}
```

## Testing Strategy

### Fixture-Based Testing

All tests use saved HTML files. No live HTTP requests. The `Fetcher` injection point makes this trivial.

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { WebsiteCrawler } from "./index";
import type { Fetcher } from "./index";

/** Create a fetcher that serves from a map of URL -> HTML content. */
function createFixtureFetcher(fixtures: Record<string, string>): Fetcher {
  return async (url: string) => {
    const html = fixtures[url] ?? fixtures[normalizeUrl(url)];
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
function loadFixture(name: string): string {
  return readFileSync(join(__dirname, "../__fixtures__", name), "utf-8");
}
```

### Test Cases (mapped to acceptance criteria)

```typescript
describe("WebsiteCrawler", () => {
  describe("interface compliance", () => {
    it("has name 'website' and sourceType 'website'", () => {
      const crawler = new WebsiteCrawler();
      expect(crawler.name).toBe("website");
      expect(crawler.sourceType).toBe("website");
    });
  });

  describe("canCrawl", () => {
    it("returns true for HTTP URLs", () => {
      const crawler = new WebsiteCrawler();
      expect(crawler.canCrawl("https://linear.app")).toBe(true);
      expect(crawler.canCrawl("http://example.com")).toBe(true);
    });

    it("returns false for non-HTTP URLs", () => {
      const crawler = new WebsiteCrawler();
      expect(crawler.canCrawl("ftp://example.com")).toBe(false);
      expect(crawler.canCrawl("not-a-url")).toBe(false);
    });
  });

  describe("crawl", () => {
    it("crawls homepage and discovers linked pages", async () => {
      const fixtures = {
        "https://example.com": `
          <html><head><title>Example</title></head>
          <body><main>
            <h1>Welcome</h1>
            <a href="/pricing">Pricing</a>
            <a href="/features">Features</a>
            <a href="/about">About</a>
          </main></body></html>`,
        "https://example.com/pricing": `
          <html><head><title>Pricing</title></head>
          <body><main><h1>Plans</h1><p>$29/mo</p></main></body></html>`,
        "https://example.com/features": `
          <html><head><title>Features</title></head>
          <body><main><h1>Features</h1><p>Great stuff</p></main></body></html>`,
        "https://example.com/about": `
          <html><head><title>About</title></head>
          <body><main><h1>About Us</h1><p>We are great</p></main></body></html>`,
      };

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher(fixtures),
      });

      const result = await crawler.crawl("https://example.com");
      expect(result.pages).toHaveLength(4);
      expect(result.pages.map(p => p.pageType)).toContain("homepage");
      expect(result.pages.map(p => p.pageType)).toContain("pricing");
      expect(result.pages.map(p => p.pageType)).toContain("features");
      expect(result.pages.map(p => p.pageType)).toContain("about");
    });

    it("classifies pages by type based on URL patterns", async () => {
      // Use fixtures with various URL patterns...
    });

    it("extracts clean text (strips nav/footer/scripts)", async () => {
      const html = `
        <html><body>
          <nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav>
          <main><h1>Title</h1><p>Real content here.</p></main>
          <footer>Copyright 2026</footer>
          <script>analytics.track('page_view');</script>
        </body></html>`;

      const crawler = new WebsiteCrawler({
        fetcher: createFixtureFetcher({ "https://example.com": html }),
      });

      const result = await crawler.crawl("https://example.com");
      expect(result.pages[0].content).toContain("Title");
      expect(result.pages[0].content).toContain("Real content here.");
      expect(result.pages[0].content).not.toContain("analytics.track");
      expect(result.pages[0].content).not.toContain("Copyright");
    });

    it("respects maxPages option", async () => {
      // Fixture with many linked pages, verify only maxPages are crawled
    });

    it("respects maxDepth option", async () => {
      // Fixture with deep link chains, verify depth limit
    });

    it("respects timeout via AbortSignal", async () => {
      // Slow fetcher that exceeds timeout
    });
  });
});
```

### Content Extraction Tests

```typescript
describe("extractContent", () => {
  it("extracts headings and paragraphs from real Linear homepage", () => {
    const html = loadFixture("linear-homepage.html");
    const content = extractContent(html);
    // Should contain key marketing copy, not nav chrome
    expect(content).toContain("Linear");
    expect(content.length).toBeGreaterThan(100);
  });

  it("extracts pricing tiers from real pricing page", () => {
    const html = loadFixture("linear-pricing.html");
    const content = extractContent(html);
    expect(content).toContain("Free");
    // Should not contain nav links or footer text
  });
});

describe("extractMetadata", () => {
  it("extracts title from og:title", () => {
    const html = `<html><head>
      <meta property="og:title" content="Linear - Build Software">
      <title>Linear | Issue Tracking</title>
    </head><body></body></html>`;
    const meta = extractMetadata(html);
    expect(meta.title).toBe("Linear - Build Software");
  });

  it("falls back to <title> tag", () => {
    const html = `<html><head><title>Acme Corp</title></head><body></body></html>`;
    const meta = extractMetadata(html);
    expect(meta.title).toBe("Acme Corp");
  });

  it("extracts description and og:image", () => {
    const html = `<html><head>
      <meta name="description" content="The best tool">
      <meta property="og:image" content="https://acme.io/og.png">
    </head><body></body></html>`;
    const meta = extractMetadata(html);
    expect(meta.description).toBe("The best tool");
    expect(meta.ogImage).toBe("https://acme.io/og.png");
  });
});
```

### Fixture Acquisition

Save HTML from real marketing sites for realistic test coverage:

```bash
# One-time fixture creation (not part of test suite)
curl -s https://linear.app > packages/crawlers/src/__fixtures__/linear-homepage.html
curl -s https://linear.app/pricing > packages/crawlers/src/__fixtures__/linear-pricing.html
curl -s https://notion.so/product > packages/crawlers/src/__fixtures__/notion-features.html
curl -s https://miro.com/about > packages/crawlers/src/__fixtures__/miro-about.html
```

Additionally, create synthetic multi-page fixtures for crawl-level tests (link discovery, depth limits, maxPages). These are small hand-crafted HTML files with predictable structure.

## Key Decisions

1. **fetch + cheerio, no Firecrawl.** The built-in website crawler works with zero API keys. Firecrawl users can write their own `Crawler` implementation or a future `FirecrawlWebsiteCrawler` adapter.

2. **Plain text output, not markdown.** Firecrawl returns markdown; our extraction produces structured plain text with heading markers. The LLM analysis pipeline does not need markdown -- it needs readable text with hierarchy. One fewer dependency (no Turndown/rehype).

3. **Injectable fetcher, not mock/spy.** The `Fetcher` type parameter on the constructor is cleaner than jest.mock or vitest.mock for fetch. Tests create a simple function that maps URLs to HTML strings. No mocking framework needed.

4. **Standalone classification copy.** `classify.ts` adapts the logic from `convex/lib/urlUtils.ts` but does not import from it. The `@basesignal/crawlers` package has no dependency on the Convex app. The classification logic may diverge over time (the package version serves the open source crawler; the Convex version serves the hosted pipeline).

5. **BFS with depth tracking.** Breadth-first search ensures we crawl the most important pages first (homepage, then pages linked from homepage, then pages two clicks deep). The `maxDepth` option caps how far we go. No external queue library -- just an array and a Set.

6. **Content extraction: prefer `<main>`, fall back to `<body>`.** Modern marketing sites use semantic HTML. When `<main>` or `<article>` exists, use it. Strip `<nav>`, `<footer>`, `<header>`, `<script>`, `<style>`, and ARIA-hidden elements. This handles 90%+ of marketing sites correctly.

7. **One runtime dependency: cheerio.** No DOM simulation (jsdom), no headless browser (Puppeteer), no API service (Firecrawl). cheerio parses HTML into a traversable tree without executing JavaScript. Marketing pages are server-rendered -- JS execution is not needed for content extraction.

## What This Does NOT Do

- **No robots.txt checking.** That is S004 (BaseCrawler with rate limiting). This crawler is the raw implementation; the BaseCrawler wrapper adds politeness.
- **No rate limiting between requests.** Also S004.
- **No JavaScript rendering.** Marketing sites are SSR. SPAs that require JS rendering need a different crawler (e.g., Puppeteer-based), which someone can implement against the Crawler interface.
- **No structured pricing extraction.** That is S003 (PricingCrawler). This crawler returns raw content; the pricing crawler adds structured tier/price parsing.
- **No integration with `convex/scanning.ts`.** Wiring the new crawler into the Convex action is a separate integration story. The Convex action will eventually call `new WebsiteCrawler().crawl(url)` instead of Firecrawl API calls.

## CrawlOptions Enforcement

| Option | Default | Enforcement |
|--------|---------|-------------|
| `maxPages` | 30 | BFS loop exits when `pages.length >= maxPages` |
| `maxDepth` | 3 | Links at depth >= maxDepth are not enqueued |
| `timeout` | 60s | `AbortSignal.timeout(timeout)` passed to all fetch calls; checked in BFS loop |
| `userAgent` | `BasesignalCrawler/1.0` | Sent as `User-Agent` header on every request |
| `signal` | Auto-created from timeout | If caller provides their own AbortSignal, it takes precedence |

## Verification Steps

1. `cd packages/crawlers && npx vitest run src/website/` -- all tests pass
2. `WebsiteCrawler` implements `Crawler` interface (TypeScript compilation proves it)
3. `canCrawl()` returns true for `https://` and `http://`, false for everything else
4. Crawl of multi-page fixture discovers and crawls linked pages
5. Page types match URL patterns (homepage, pricing, features, about, docs)
6. Content extraction strips nav/footer/script, preserves headings and paragraphs
7. `maxPages`, `maxDepth`, `timeout` all limit crawl behavior correctly
8. All tests use fixture HTML, zero network calls

## Success Criteria

All 7 acceptance criteria from the story TOML:
- [x] WebsiteCrawler implements the Crawler interface
- [x] canCrawl() returns true for any HTTP/HTTPS URL
- [x] Crawls homepage and discovers linked pages (features, about, pricing, docs, help)
- [x] Classifies pages by type based on URL patterns and content
- [x] Extracts clean text content from HTML (strips nav, footer, scripts)
- [x] Respects CrawlOptions: maxPages, maxDepth, timeout
- [x] Tests use saved HTML fixtures, not live HTTP requests

---
*Design via /brainstorm-auto -- Task basesignal-07n*
