# Implementation Plan: Website Crawler for Marketing Pages

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Task:** basesignal-07n
**Story:** M008-E003-S002
**Design:** [2026-02-15-website-crawler-design.md](./2026-02-15-website-crawler-design.md)

## Summary

Implement a `WebsiteCrawler` class inside `packages/crawlers/` that satisfies the `Crawler` interface (defined by S001/basesignal-f6k). The crawler fetches HTML with `fetch`, parses with `cheerio`, extracts clean text content, classifies pages by URL patterns, and discovers links via BFS. All tests use saved HTML fixtures with an injectable `Fetcher` -- zero network calls.

**Architecture:** Four source files under `packages/crawlers/src/website/`: the crawler class (`index.ts`), page classification (`classify.ts`), HTML content extraction (`extract.ts`), and link discovery (`discover.ts`). One test file (`website.test.ts`) covers all acceptance criteria. One new runtime dependency: `cheerio`.

**Dependency:** This story depends on M008-E003-S001 (basesignal-f6k) which defines the `Crawler` interface, types, and `CrawlerRegistry` in `packages/crawlers/`. That story is still `open` with the `plan` label. **If S001 has not been implemented when you start, implement it first** using its design doc at `docs/plans/2026-02-15-crawler-interface-design.md`. The package scaffold (`packages/crawlers/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `src/types.ts`, `src/registry.ts`, `src/index.ts`) must exist before starting this plan.

---

## Prerequisite Context

### Dependency: S001 Package Scaffold

Before any task in this plan, verify that `packages/crawlers/` exists with:

| File | Purpose |
|------|---------|
| `packages/crawlers/package.json` | `@basesignal/crawlers` package |
| `packages/crawlers/tsconfig.json` | TypeScript config |
| `packages/crawlers/vitest.config.ts` | Vitest config for the package |
| `packages/crawlers/src/types.ts` | `Crawler`, `CrawlResult`, `CrawlOptions`, `CrawledPage`, `CrawlError`, `SourceType` |
| `packages/crawlers/src/registry.ts` | `CrawlerRegistry` class |
| `packages/crawlers/src/index.ts` | Barrel exports |

If these files do not exist, implement S001 first using the design at `docs/plans/2026-02-15-crawler-interface-design.md`.

### Key Types from S001 (`src/types.ts`)

```typescript
export interface Crawler {
  readonly name: string;
  readonly sourceType: SourceType;
  canCrawl(url: string): boolean;
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  timeout?: number;
  userAgent?: string;
  signal?: AbortSignal;
}

export interface CrawlResult {
  pages: CrawledPage[];
  timing: { startedAt: number; completedAt: number; totalMs: number };
  errors: CrawlError[];
}

export interface CrawledPage {
  url: string;
  pageType: string;
  title?: string;
  content: string;
  metadata?: { description?: string; ogImage?: string; structuredData?: unknown };
}

export interface CrawlError { url: string; error: string; }
```

### Existing Classification Logic Reference

`convex/lib/urlUtils.ts` contains `classifyPageType()`, `shouldCrawl()`, and related helpers. The website crawler adapts this logic as a standalone copy (no cross-package import). The key patterns to carry over:

- Homepage: root path on main domain
- `/pricing`, `/plans` -> "pricing"
- `/features`, `/product` -> "features"
- `/about`, `/company` -> "about" (excluding careers/jobs)
- `/customers`, `/case-studies` -> "customers"
- `/enterprise` -> "enterprise"
- `/integrations` -> "integrations"
- `/security`, `/compliance`, `/trust` -> "security"
- `/solutions`, `/use-cases` -> "solutions"
- `/docs`, `/help`, `/support` -> "docs"
- Skip patterns: blog, press, careers, legal, auth, assets, localized paths
- Subdomain detection: help.*, docs.*, support.*

### New Files This Plan Creates

| File | Purpose |
|------|---------|
| `packages/crawlers/src/website/index.ts` | `WebsiteCrawler` class + helpers |
| `packages/crawlers/src/website/classify.ts` | `classifyPageType()`, `shouldCrawlUrl()` |
| `packages/crawlers/src/website/extract.ts` | `extractContent()`, `extractMetadata()` |
| `packages/crawlers/src/website/discover.ts` | `discoverLinks()` |
| `packages/crawlers/src/website/website.test.ts` | All unit tests |
| `packages/crawlers/src/__fixtures__/simple-site/index.html` | Homepage fixture |
| `packages/crawlers/src/__fixtures__/simple-site/pricing.html` | Pricing fixture |
| `packages/crawlers/src/__fixtures__/simple-site/features.html` | Features fixture |
| `packages/crawlers/src/__fixtures__/simple-site/about.html` | About fixture |
| `packages/crawlers/src/__fixtures__/content-extraction.html` | Noisy HTML for extraction test |

### Files Modified

| File | Change |
|------|--------|
| `packages/crawlers/package.json` | Add `cheerio` dependency |
| `packages/crawlers/src/index.ts` | Re-export `WebsiteCrawler` and `Fetcher` type |

---

## Task 1: Add cheerio dependency and update barrel exports

**Files:**
- Modify: `packages/crawlers/package.json`
- Modify: `packages/crawlers/src/index.ts`

### Step 1: Add cheerio to the crawlers package

Run from `packages/crawlers/`:
```bash
cd packages/crawlers && npm install cheerio
```

Verify `cheerio` appears in `package.json` dependencies.

### Step 2: Update barrel exports

Add website crawler exports to `packages/crawlers/src/index.ts`:

```typescript
// After existing exports from types and registry:
export { WebsiteCrawler, type Fetcher } from "./website/index";
```

**Note:** This will cause a TypeScript error until the website module exists. That is expected -- it resolves in Task 2.

### Step 3: Commit

```bash
git add packages/crawlers/package.json packages/crawlers/package-lock.json packages/crawlers/src/index.ts
git commit -m "chore: add cheerio dependency and barrel exports for website crawler"
```

---

## Task 2: Implement page classification (`classify.ts`)

**Files:**
- Create: `packages/crawlers/src/website/classify.ts`

### Step 1: Write the failing test

Add classification tests to what will become `website.test.ts` (we create the test file in Task 6). For now, create the implementation first since classification is pure logic adapted from the existing `convex/lib/urlUtils.ts`.

### Step 2: Create the implementation

Create `packages/crawlers/src/website/classify.ts`:

```typescript
/**
 * Classify a URL by page type based on URL path patterns.
 * Adapted from convex/lib/urlUtils.ts for standalone use in @basesignal/crawlers.
 */
export function classifyPageType(url: string, rootHostname?: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "other";
  }

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
  if (
    path.match(/^\/(about|company)(\/|$)/) &&
    !path.includes("career") &&
    !path.includes("jobs")
  )
    return "about";
  if (path.match(/^\/(customers?|case-studies?|stories|success-stories)(\/|$)/))
    return "customers";
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
 * URL path patterns to skip during crawl (low-value for product analysis).
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
 * Rejects off-domain, docs subdomains, localized, and low-value paths.
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
    if (
      hostname.startsWith("help.") ||
      hostname.startsWith("support.") ||
      hostname.startsWith("docs.")
    ) {
      return false;
    }

    // Skip localized
    if (LOCALIZED_PREFIXES.some((p) => p.test(path))) return false;

    // Skip low-value patterns
    if (SKIP_PATTERNS.some((p) => p.test(path))) return false;

    return true;
  } catch {
    return false;
  }
}
```

### Step 3: Commit

```bash
git add packages/crawlers/src/website/classify.ts
git commit -m "feat: add page classification for website crawler"
```

---

## Task 3: Implement content extraction (`extract.ts`)

**Files:**
- Create: `packages/crawlers/src/website/extract.ts`

### Step 1: Create the implementation

Create `packages/crawlers/src/website/extract.ts`:

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

  $content
    .find("h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, figcaption")
    .each((_, el) => {
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

### Step 2: Commit

```bash
git add packages/crawlers/src/website/extract.ts
git commit -m "feat: add HTML content and metadata extraction"
```

---

## Task 4: Implement link discovery (`discover.ts`)

**Files:**
- Create: `packages/crawlers/src/website/discover.ts`

### Step 1: Create the implementation

Create `packages/crawlers/src/website/discover.ts`:

```typescript
import * as cheerio from "cheerio";

/**
 * Discover links from an HTML page.
 * Returns absolute URLs, deduped. Does NOT filter by domain --
 * the caller (WebsiteCrawler BFS loop) handles same-origin filtering.
 */
export function discoverLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    // Skip fragment-only, javascript:, mailto:, tel:
    if (
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
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

### Step 2: Commit

```bash
git add packages/crawlers/src/website/discover.ts
git commit -m "feat: add link discovery for website crawler"
```

---

## Task 5: Implement WebsiteCrawler class (`index.ts`)

**Files:**
- Create: `packages/crawlers/src/website/index.ts`

### Step 1: Create the implementation

Create `packages/crawlers/src/website/index.ts`:

```typescript
import type {
  Crawler,
  CrawlOptions,
  CrawlResult,
  CrawledPage,
  CrawlError,
} from "../types";
import { classifyPageType, shouldCrawlUrl } from "./classify";
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
    const queue: Array<{ url: string; depth: number }> = [
      { url: normalizeUrl(url), depth: 0 },
    ];
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
        const truncated =
          content.length > MAX_CONTENT_LENGTH
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
            const normalized = normalizeUrl(link);
            if (
              !visited.has(normalized) &&
              shouldCrawlUrl(normalized, rootHostname)
            ) {
              queue.push({ url: normalized, depth: item.depth + 1 });
            }
          }
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
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

### Step 2: Verify TypeScript compilation

Run: `cd packages/crawlers && npx tsc --noEmit`
Expected: Zero errors (WebsiteCrawler satisfies the Crawler interface)

### Step 3: Commit

```bash
git add packages/crawlers/src/website/index.ts
git commit -m "feat: implement WebsiteCrawler with BFS crawl, classification, and extraction"
```

---

## Task 6: Create HTML fixtures for tests

**Files:**
- Create: `packages/crawlers/src/__fixtures__/simple-site/index.html`
- Create: `packages/crawlers/src/__fixtures__/simple-site/pricing.html`
- Create: `packages/crawlers/src/__fixtures__/simple-site/features.html`
- Create: `packages/crawlers/src/__fixtures__/simple-site/about.html`
- Create: `packages/crawlers/src/__fixtures__/content-extraction.html`

### Step 1: Create multi-page fixture site

These are small, hand-crafted HTML files with predictable structure for crawl-level tests (link discovery, depth limits, maxPages).

**`simple-site/index.html`** -- Homepage with links to subpages:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Acme - Project Management for Teams</title>
  <meta property="og:title" content="Acme - Build Better Software">
  <meta name="description" content="The project management platform for engineering teams.">
  <meta property="og:image" content="https://acme.io/og.png">
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/pricing">Pricing</a>
    <a href="/features">Features</a>
    <a href="/about">About</a>
    <a href="/blog">Blog</a>
    <a href="https://other-site.com">Partner</a>
  </nav>
  <main>
    <h1>Ship software faster</h1>
    <p>Acme helps engineering teams plan, track, and deliver software projects.</p>
    <h2>Trusted by 500+ teams</h2>
    <p>From startups to enterprise, teams rely on Acme.</p>
  </main>
  <footer>
    <p>Copyright 2026 Acme Inc.</p>
    <a href="/legal">Legal</a>
    <a href="/privacy">Privacy</a>
  </footer>
  <script>analytics.track('page_view');</script>
</body>
</html>
```

**`simple-site/pricing.html`**:

```html
<!DOCTYPE html>
<html>
<head><title>Pricing - Acme</title></head>
<body>
  <nav><a href="/">Home</a></nav>
  <main>
    <h1>Simple, transparent pricing</h1>
    <h2>Free</h2>
    <p>$0/month. Up to 5 users.</p>
    <h2>Pro</h2>
    <p>$29/month per user. Unlimited projects.</p>
    <h2>Enterprise</h2>
    <p>Custom pricing. SSO, audit logs, dedicated support.</p>
  </main>
  <footer><p>Copyright 2026</p></footer>
</body>
</html>
```

**`simple-site/features.html`**:

```html
<!DOCTYPE html>
<html>
<head><title>Features - Acme</title></head>
<body>
  <nav><a href="/">Home</a></nav>
  <main>
    <h1>Everything you need to ship</h1>
    <h2>Sprint Planning</h2>
    <p>Drag-and-drop sprint boards with automatic capacity tracking.</p>
    <h2>Code Review</h2>
    <p>Link PRs to tasks. Track review status in real-time.</p>
    <a href="/features/integrations">See integrations</a>
  </main>
  <footer><p>Copyright 2026</p></footer>
</body>
</html>
```

**`simple-site/about.html`**:

```html
<!DOCTYPE html>
<html>
<head><title>About - Acme</title></head>
<body>
  <nav><a href="/">Home</a></nav>
  <main>
    <h1>About Acme</h1>
    <p>Founded in 2022, Acme is a B2B SaaS company building tools for engineering teams.</p>
    <p>We are a Series A startup based in San Francisco.</p>
  </main>
  <footer><p>Copyright 2026</p></footer>
</body>
</html>
```

### Step 2: Create content extraction test fixture

**`content-extraction.html`** -- Noisy page with nav, footer, scripts, aria-hidden, and a `<main>` block:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Noisy Page</title>
  <meta property="og:title" content="OG Title Override">
  <meta property="og:description" content="OG description text">
  <style>body { font-family: sans-serif; }</style>
</head>
<body>
  <nav role="navigation">
    <a href="/">Home</a>
    <a href="/pricing">Pricing</a>
    <a href="/login">Login</a>
  </nav>
  <header role="banner">
    <div>Banner content that should be removed</div>
  </header>
  <div aria-hidden="true">Hidden accessibility content</div>
  <main>
    <h1>Main Heading</h1>
    <p>This is the real content that should be extracted.</p>
    <h2>Subheading</h2>
    <p>More important content here.</p>
    <ul>
      <li>Feature one</li>
      <li>Feature two</li>
      <li>Feature three</li>
    </ul>
    <blockquote>A customer testimonial that matters.</blockquote>
  </main>
  <aside>Sidebar content</aside>
  <footer role="contentinfo">
    <p>Copyright 2026. All rights reserved.</p>
    <a href="/terms">Terms</a>
  </footer>
  <script>
    window.analytics.track('page_view');
    console.log('this should not appear in content');
  </script>
  <noscript>Enable JavaScript</noscript>
  <iframe src="https://ads.example.com"></iframe>
</body>
</html>
```

### Step 3: Commit

```bash
git add packages/crawlers/src/__fixtures__/
git commit -m "test: add HTML fixtures for website crawler tests"
```

---

## Task 7: Write all tests (`website.test.ts`)

**Files:**
- Create: `packages/crawlers/src/website/website.test.ts`

This is the main test file covering all 7 acceptance criteria.

### Step 1: Create the test file

Create `packages/crawlers/src/website/website.test.ts`:

```typescript
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
      expect(urls).toContain("https://acme.io");
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
```

### Step 2: Run tests

Run from `packages/crawlers/`:
```bash
cd packages/crawlers && npx vitest run src/website/website.test.ts
```

Expected: All tests PASS

### Step 3: Fix any failures

If tests fail, fix the implementation code. Common issues to watch for:
- URL normalization differences (trailing slashes)
- cheerio API differences between versions
- Fixture file path resolution (ensure `__dirname` resolves correctly with vitest)

### Step 4: Commit

```bash
git add packages/crawlers/src/website/website.test.ts
git commit -m "test: add comprehensive tests for website crawler with HTML fixtures"
```

---

## Task 8: Run full test suite and verify

**Files:** None (verification only)

### Step 1: Run crawlers package tests

```bash
cd packages/crawlers && npx vitest run
```

Expected: All tests pass (registry tests from S001 + website crawler tests)

### Step 2: Verify TypeScript compilation

```bash
cd packages/crawlers && npx tsc --noEmit
```

Expected: Zero type errors. WebsiteCrawler satisfies the Crawler interface.

### Step 3: Run root project tests (regression check)

```bash
npm test -- --run
```

Expected: No regressions in existing tests. The new package is isolated.

### Step 4: Commit if any fixes were needed

If you needed to fix anything, commit those fixes now.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add cheerio dependency, update barrel exports | `packages/crawlers/package.json`, `packages/crawlers/src/index.ts` |
| 2 | Page classification (standalone copy of urlUtils logic) | `packages/crawlers/src/website/classify.ts` |
| 3 | HTML content and metadata extraction with cheerio | `packages/crawlers/src/website/extract.ts` |
| 4 | Link discovery from HTML | `packages/crawlers/src/website/discover.ts` |
| 5 | WebsiteCrawler class with BFS crawl | `packages/crawlers/src/website/index.ts` |
| 6 | HTML test fixtures (multi-page site + noisy page) | `packages/crawlers/src/__fixtures__/` |
| 7 | All tests covering 7 acceptance criteria | `packages/crawlers/src/website/website.test.ts` |
| 8 | Full test suite verification | None |

### Acceptance Criteria Mapping

| AC | Test Coverage |
|----|---------------|
| WebsiteCrawler implements the Crawler interface | `interface compliance` describe block + TypeScript compilation |
| canCrawl() returns true for any HTTP/HTTPS URL | `canCrawl` describe block (HTTP, HTTPS, non-HTTP, invalid) |
| Crawls homepage and discovers linked pages | `crawl - link discovery` describe block (multi-page fixture crawl) |
| Classifies pages by type based on URL patterns | `classifyPageType` + `shouldCrawlUrl` describe blocks |
| Extracts clean text content from HTML | `extractContent` + `extractMetadata` describe blocks |
| Respects CrawlOptions: maxPages, maxDepth, timeout | `crawl - options enforcement` describe block |
| Tests use saved HTML fixtures, not live HTTP requests | Every test uses `createFixtureFetcher` + `loadFixture` |

### What Does NOT Change

- `convex/scanning.ts` (existing Firecrawl pipeline untouched)
- `convex/lib/urlUtils.ts` (existing classification stays; crawler has standalone copy)
- Root `package.json` (no new dependencies at root level)
- Any existing test files

### Key Design Decisions Carried from Design Doc

1. `fetch` + `cheerio`, no Firecrawl -- zero API keys required
2. Plain text output with heading markers, not markdown -- no Turndown dependency
3. Injectable `Fetcher` for testing -- no mock/spy frameworks needed
4. Standalone classification copy -- no import from `convex/lib/`
5. BFS with depth tracking -- homepage first, then linked pages, then deeper
6. One runtime dependency: `cheerio`
