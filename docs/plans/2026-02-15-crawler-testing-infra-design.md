# Crawler Testing Infrastructure, Rate Limiting, and robots.txt Design

## Overview

Provide a `BaseCrawler` abstract class with built-in rate limiting, robots.txt compliance, and content truncation. Add a `createFixtureCrawler()` test helper that lets developers test crawlers without HTTP. Write `docs/crawlers.md` explaining the Crawler interface and how to contribute.

## Problem Statement

The Crawler interface (S001) and built-in crawlers (S002, S003) need shared infrastructure that every crawler benefits from:

1. **Rate limiting** -- crawlers must not hammer target servers. Every crawler needs per-domain delay, but implementing it individually is error-prone and duplicative.
2. **robots.txt** -- ethical crawling requires checking robots.txt before requesting pages. This is boilerplate that belongs in shared infrastructure.
3. **Content truncation** -- the existing pipeline truncates at 100KB (see `convex/crawledPages.ts`). Crawlers should do this at the source to avoid wasting bandwidth and memory.
4. **Error resilience** -- a single page failure must not crash the entire crawl. This is a cross-cutting concern.
5. **Test infrastructure** -- S002 and S003 both need to test against saved HTML without HTTP. A shared fixture helper eliminates duplication and establishes the pattern.

Without this story, every crawler would re-implement delay loops, robots.txt fetching, and error handling. That is the opposite of a pluggable architecture.

## Expert Perspectives

### Technical Architect

The `BaseCrawler` is a convenience, not a requirement -- the `Crawler` interface (S001) is the contract. `BaseCrawler` provides reusable plumbing that most crawlers want (rate limiting, robots.txt, truncation) but any object satisfying the interface works without it. The key design tension: abstract class vs. composable functions. An abstract class is simpler for the 90% case (inherit and implement `doCrawl`), and the escape hatch is always there: just implement `Crawler` directly. For robots.txt, parse it ourselves with a tiny parser rather than pulling in a dependency -- the spec is 30 lines of logic for the features we actually need (User-Agent matching and Disallow paths). For rate limiting, a per-domain delay map with configurable milliseconds is sufficient -- no token buckets, no sliding windows, no distributed coordination.

### Simplification Review

**Verdict: APPROVED with one cut.**

What survives:
- `BaseCrawler` abstract class with three protected methods: `fetchWithRateLimit`, `checkRobotsTxt`, `truncateContent`
- `createFixtureCrawler()` test helper -- one function, takes a URL-to-HTML map, returns a `Crawler`
- `parseRobotsTxt()` -- minimal parser, no dependency
- `docs/crawlers.md` -- one doc explaining interface + contribution guide

What to cut:
- **No `saveFixtures()` or fixture recording.** Developers copy HTML manually or use curl. A recording utility is premature tooling that adds code without adding insight. If someone wants it later, it is a 10-line script.

What to watch:
- `BaseCrawler` must NOT accumulate options. Three protected methods, one abstract method (`doCrawl`). If it grows beyond that, it is a framework.
- The robots.txt parser must NOT try to handle Crawl-delay, Sitemap, or wildcard patterns. Disallow paths and User-Agent grouping are sufficient.

## Proposed Solution

### File Structure (within `packages/crawlers/`)

```
packages/crawlers/src/
  base.ts              # BaseCrawler abstract class
  base.test.ts         # BaseCrawler unit tests
  robots.ts            # parseRobotsTxt() pure function
  robots.test.ts       # robots.txt parser tests
  testing.ts           # createFixtureCrawler() helper
  testing.test.ts      # Fixture crawler tests
  index.ts             # Updated barrel export (add BaseCrawler, createFixtureCrawler)
```

Also created at repo root:
```
docs/crawlers.md       # Crawler interface guide + contribution howto
```

### robots.txt Parser (`src/robots.ts`)

A minimal, zero-dependency parser that handles the subset of robots.txt we need.

```typescript
/**
 * Parsed robots.txt rules for a single user agent.
 */
export interface RobotsTxtRules {
  /** Disallowed path prefixes. */
  disallowed: string[];
  /** Explicitly allowed path prefixes (overrides disallow). */
  allowed: string[];
}

/**
 * Parse a robots.txt file and extract rules for the given user agent.
 *
 * Follows the standard precedence:
 * 1. Look for a section matching the given userAgent
 * 2. Fall back to the "*" section
 * 3. If no rules found, everything is allowed
 *
 * Does NOT handle: Crawl-delay, Sitemap, wildcard patterns (*, $).
 * These are non-standard extensions that most sites don't rely on for access control.
 */
export function parseRobotsTxt(
  robotsTxt: string,
  userAgent: string
): RobotsTxtRules {
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  const sections = new Map<string, RobotsTxtRules>();

  let currentAgents: string[] = [];

  for (const line of lines) {
    // Skip comments and empty lines
    if (line.startsWith("#") || line === "") {
      // A blank line resets the current agent group
      if (line === "" && currentAgents.length > 0) {
        currentAgents = [];
      }
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const directive = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();

    if (directive === "user-agent") {
      const agent = value.toLowerCase();
      currentAgents.push(agent);
      if (!sections.has(agent)) {
        sections.set(agent, { disallowed: [], allowed: [] });
      }
    } else if (directive === "disallow" && value && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        sections.get(agent)!.disallowed.push(value);
      }
    } else if (directive === "allow" && value && currentAgents.length > 0) {
      for (const agent of currentAgents) {
        sections.get(agent)!.allowed.push(value);
      }
    }
  }

  // Prefer specific agent, fall back to wildcard
  const agentLower = userAgent.toLowerCase();
  return (
    sections.get(agentLower) ??
    sections.get("*") ??
    { disallowed: [], allowed: [] }
  );
}

/**
 * Check if a URL path is allowed by the given robots.txt rules.
 *
 * Allow rules take precedence over Disallow rules when both match.
 * Longer path matches take precedence (more specific wins).
 */
export function isPathAllowed(path: string, rules: RobotsTxtRules): boolean {
  // If no rules, everything is allowed
  if (rules.disallowed.length === 0 && rules.allowed.length === 0) {
    return true;
  }

  // Find the most specific matching rule
  let bestMatch = "";
  let bestIsAllow = true;

  for (const prefix of rules.disallowed) {
    if (path.startsWith(prefix) && prefix.length >= bestMatch.length) {
      bestMatch = prefix;
      bestIsAllow = false;
    }
  }

  for (const prefix of rules.allowed) {
    if (path.startsWith(prefix) && prefix.length >= bestMatch.length) {
      bestMatch = prefix;
      bestIsAllow = true;
    }
  }

  return bestIsAllow;
}
```

**Why no dependency?** The full robots.txt spec (RFC 9309) is complex, but the features we need -- User-Agent matching and Disallow/Allow path prefixes -- are ~50 lines of logic. Libraries like `robots-parser` add 15KB+ and handle wildcards and Crawl-delay that we will never use. The parser above is testable, auditable, and zero-dependency.

### BaseCrawler (`src/base.ts`)

```typescript
import type { Crawler, CrawlOptions, CrawlResult } from "./types";
import { parseRobotsTxt, isPathAllowed, type RobotsTxtRules } from "./robots";

export interface BaseCrawlerOptions {
  /** Delay between requests to the same domain, in milliseconds. Default: 1000. */
  delayMs?: number;
  /** Maximum content size per page in bytes. Default: 102400 (100KB). */
  maxContentBytes?: number;
  /** User-Agent string for HTTP requests and robots.txt matching. */
  userAgent?: string;
  /** Custom fetch implementation (for testing). Defaults to global fetch. */
  fetchFn?: typeof fetch;
}

const DEFAULT_DELAY_MS = 1000;
const DEFAULT_MAX_CONTENT_BYTES = 102_400; // 100KB
const DEFAULT_USER_AGENT = "BasesignalBot/1.0";

/**
 * Abstract base class providing rate limiting, robots.txt compliance,
 * and content truncation for crawlers.
 *
 * Extend this class and implement `doCrawl()` for the simplest path
 * to a working crawler. Or implement the `Crawler` interface directly
 * if you don't need these features.
 *
 * Usage:
 *   class MyCrawler extends BaseCrawler {
 *     name = "my-crawler";
 *     sourceType = "website" as const;
 *     canCrawl(url: string) { return url.includes("mysite.com"); }
 *     protected async doCrawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
 *       const html = await this.fetchWithRateLimit(url);
 *       // ... parse and return
 *     }
 *   }
 */
export abstract class BaseCrawler implements Crawler {
  abstract readonly name: string;
  abstract readonly sourceType: string;
  abstract canCrawl(url: string): boolean;

  protected abstract doCrawl(
    url: string,
    options?: CrawlOptions
  ): Promise<CrawlResult>;

  private readonly delayMs: number;
  private readonly maxContentBytes: number;
  protected readonly userAgent: string;
  private readonly fetchFn: typeof fetch;

  /**
   * Per-domain timestamp of last request. Used to enforce rate limiting.
   * Keyed by hostname (e.g., "example.com").
   */
  private lastRequestTime = new Map<string, number>();

  /**
   * Per-domain robots.txt rules cache. Fetched once per domain per crawl session.
   * `null` means we tried to fetch but it failed (treat as "allow all").
   */
  private robotsCache = new Map<string, RobotsTxtRules | null>();

  constructor(options: BaseCrawlerOptions = {}) {
    this.delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
    this.maxContentBytes = options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES;
    this.userAgent = options.userAgent ?? DEFAULT_USER_AGENT;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  /**
   * Public crawl method. Checks robots.txt before delegating to doCrawl().
   */
  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const allowed = await this.checkRobotsTxt(url);
    if (!allowed) {
      return {
        pages: [],
        timing: { startedAt: Date.now(), completedAt: Date.now(), totalMs: 0 },
        errors: [{ url, error: "Blocked by robots.txt" }],
      };
    }
    return this.doCrawl(url, options);
  }

  /**
   * Fetch a URL with rate limiting applied.
   * Waits until enough time has passed since the last request to the same domain.
   * Returns the Response object for the subclass to handle.
   */
  protected async fetchWithRateLimit(
    url: string,
    init?: RequestInit
  ): Promise<Response> {
    const hostname = new URL(url).hostname;
    const lastTime = this.lastRequestTime.get(hostname) ?? 0;
    const elapsed = Date.now() - lastTime;

    if (elapsed < this.delayMs) {
      await delay(this.delayMs - elapsed);
    }

    this.lastRequestTime.set(hostname, Date.now());

    return this.fetchFn(url, {
      ...init,
      headers: {
        "User-Agent": this.userAgent,
        ...init?.headers,
      },
    });
  }

  /**
   * Check if a URL is allowed by the domain's robots.txt.
   * Fetches and caches robots.txt per domain. Network errors = allow.
   */
  protected async checkRobotsTxt(url: string): Promise<boolean> {
    const parsed = new URL(url);
    const origin = parsed.origin;
    const hostname = parsed.hostname;

    if (!this.robotsCache.has(hostname)) {
      try {
        // Robots.txt fetch bypasses rate limiting (it's metadata, not content)
        const robotsUrl = `${origin}/robots.txt`;
        const response = await this.fetchFn(robotsUrl, {
          headers: { "User-Agent": this.userAgent },
        });

        if (response.ok) {
          const text = await response.text();
          const rules = parseRobotsTxt(text, this.userAgent);
          this.robotsCache.set(hostname, rules);
        } else {
          // 404 or other error = no robots.txt = allow everything
          this.robotsCache.set(hostname, null);
        }
      } catch {
        // Network error fetching robots.txt = allow everything
        this.robotsCache.set(hostname, null);
      }
    }

    const rules = this.robotsCache.get(hostname);
    if (!rules) return true; // No robots.txt or fetch failed

    return isPathAllowed(parsed.pathname, rules);
  }

  /**
   * Truncate content to the configured max byte size.
   * Truncates at a word boundary when possible to avoid cutting mid-word.
   */
  protected truncateContent(content: string, maxBytes?: number): string {
    const limit = maxBytes ?? this.maxContentBytes;
    if (content.length <= limit) return content;

    // Try to truncate at a whitespace boundary
    const truncated = content.slice(0, limit);
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > limit * 0.8) {
      return truncated.slice(0, lastSpace);
    }
    return truncated;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### Fixture Testing Helper (`src/testing.ts`)

```typescript
import type { Crawler, CrawlResult, CrawlOptions, CrawledPage } from "./types";

/**
 * A fixture map: URL -> HTML content string.
 *
 * Example:
 *   {
 *     "https://acme.io/": "<html><head><title>Acme</title></head>...",
 *     "https://acme.io/pricing": "<html>...",
 *   }
 */
export type FixtureMap = Record<string, string>;

export interface FixtureCrawlerOptions {
  /** Name for the fixture crawler. Default: "fixture". */
  name?: string;
  /** Source type. Default: "website". */
  sourceType?: string;
  /**
   * Custom page processor. Given a URL and its HTML fixture content,
   * return a CrawledPage. If not provided, a default processor returns
   * the raw HTML as content with pageType "other".
   */
  processPage?: (url: string, html: string) => CrawledPage;
}

/**
 * Create a Crawler that serves from saved HTML fixtures instead of HTTP.
 *
 * Use this in tests to verify crawler logic without network access:
 *
 *   const crawler = createFixtureCrawler({
 *     "https://acme.io/": homepageHtml,
 *     "https://acme.io/pricing": pricingHtml,
 *   });
 *
 *   const result = await crawler.crawl("https://acme.io/");
 *   expect(result.pages).toHaveLength(2);
 *
 * The fixture crawler:
 * - Returns all fixture pages when crawled (simulates a full-site crawl)
 * - canCrawl() returns true if the URL matches any fixture key's origin
 * - Errors for URLs not in the fixture map are reported in result.errors
 */
export function createFixtureCrawler(
  fixtures: FixtureMap,
  options: FixtureCrawlerOptions = {}
): Crawler {
  const {
    name = "fixture",
    sourceType = "website",
    processPage = defaultProcessPage,
  } = options;

  const fixtureUrls = Object.keys(fixtures);
  const origins = new Set(fixtureUrls.map((url) => new URL(url).origin));

  return {
    name,
    sourceType: sourceType as any,
    canCrawl(url: string): boolean {
      try {
        return origins.has(new URL(url).origin);
      } catch {
        return false;
      }
    },
    async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
      const startedAt = Date.now();
      const pages: CrawledPage[] = [];
      const errors: Array<{ url: string; error: string }> = [];

      // Determine which fixtures to return
      const maxPages = options?.maxPages ?? fixtureUrls.length;
      const urlsToProcess = fixtureUrls.slice(0, maxPages);

      for (const fixtureUrl of urlsToProcess) {
        try {
          const html = fixtures[fixtureUrl];
          pages.push(processPage(fixtureUrl, html));
        } catch (err) {
          errors.push({
            url: fixtureUrl,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const completedAt = Date.now();

      return {
        pages,
        timing: {
          startedAt,
          completedAt,
          totalMs: completedAt - startedAt,
        },
        errors,
      };
    },
  };
}

function defaultProcessPage(url: string, html: string): CrawledPage {
  // Extract title from <title> tag if present
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : undefined;

  return {
    url,
    pageType: "other",
    title,
    content: html,
  };
}
```

### Updated Barrel Export (`src/index.ts`)

```typescript
// Types (from S001)
export type {
  Crawler,
  CrawlResult,
  CrawlOptions,
  CrawledPage,
  CrawlError,
  SourceType,
} from "./types";

// Registry (from S001)
export { CrawlerRegistry } from "./registry";

// Base class (this story)
export { BaseCrawler, type BaseCrawlerOptions } from "./base";

// robots.txt utilities (this story)
export { parseRobotsTxt, isPathAllowed, type RobotsTxtRules } from "./robots";

// Testing utilities (this story)
export {
  createFixtureCrawler,
  type FixtureMap,
  type FixtureCrawlerOptions,
} from "./testing";
```

### Documentation (`docs/crawlers.md`)

```markdown
# Crawlers

The `@basesignal/crawlers` package provides a pluggable crawler architecture
for extracting product data from websites and other sources.

## The Crawler Interface

Every crawler implements four members:

    interface Crawler {
      readonly name: string;           // Unique identifier
      readonly sourceType: SourceType; // What kind of data this produces
      canCrawl(url: string): boolean;  // Can this crawler handle this URL?
      crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
    }

That's it. A crawler is any object that satisfies this shape.

## Writing a Crawler

### Option 1: Extend BaseCrawler (recommended)

BaseCrawler provides rate limiting, robots.txt compliance, and content
truncation. You implement one method: `doCrawl()`.

    import { BaseCrawler } from "@basesignal/crawlers";
    import type { CrawlOptions, CrawlResult } from "@basesignal/crawlers";

    export class MySourceCrawler extends BaseCrawler {
      readonly name = "my-source";
      readonly sourceType = "reviews" as const;

      canCrawl(url: string): boolean {
        return url.includes("my-source.com");
      }

      protected async doCrawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
        const startedAt = Date.now();
        const response = await this.fetchWithRateLimit(url);
        const html = await response.text();
        const content = this.truncateContent(html);

        return {
          pages: [{ url, pageType: "reviews", content, title: "My Source" }],
          timing: { startedAt, completedAt: Date.now(), totalMs: Date.now() - startedAt },
          errors: [],
        };
      }
    }

BaseCrawler handles:
- **Rate limiting**: 1 second between requests to the same domain (configurable)
- **robots.txt**: Checks before every crawl, caches per domain
- **Content truncation**: 100KB per page (configurable)

### Option 2: Implement the interface directly

If you don't need BaseCrawler's features, implement Crawler as a plain object:

    const myCrawler: Crawler = {
      name: "simple",
      sourceType: "website",
      canCrawl: (url) => url.includes("example.com"),
      crawl: async (url) => ({
        pages: [{ url, pageType: "other", content: "..." }],
        timing: { startedAt: Date.now(), completedAt: Date.now(), totalMs: 0 },
        errors: [],
      }),
    };

### Register your crawler

    import { CrawlerRegistry } from "@basesignal/crawlers";

    const registry = new CrawlerRegistry();
    registry.register(myCrawler);

    // Discover crawlers for a URL
    const crawlers = registry.getCrawlersFor("https://example.com");

## Testing Crawlers

Use `createFixtureCrawler()` to test without HTTP:

    import { createFixtureCrawler } from "@basesignal/crawlers";

    const crawler = createFixtureCrawler({
      "https://acme.io/": "<html><title>Acme</title><body>Homepage</body></html>",
      "https://acme.io/pricing": "<html><title>Pricing</title><body>$29/mo</body></html>",
    });

    const result = await crawler.crawl("https://acme.io/");
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].title).toBe("Acme");

For testing your own crawler's parsing logic, save HTML fixtures as files:

    packages/crawlers/src/__fixtures__/
      acme-homepage.html
      acme-pricing.html

Then load them in tests:

    import { readFileSync } from "fs";
    import { join } from "path";

    const homepageHtml = readFileSync(
      join(__dirname, "__fixtures__/acme-homepage.html"), "utf-8"
    );

## CrawlOptions

All options are optional. Crawlers define sensible defaults.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| maxPages | number | varies | Maximum pages to crawl |
| maxDepth | number | varies | Maximum link-follow depth |
| timeout | number | varies | Timeout in ms for entire crawl |
| userAgent | string | BasesignalBot/1.0 | User-Agent for HTTP requests |
| signal | AbortSignal | - | Cancellation signal |

## Source Types

| Type | Description |
|------|-------------|
| website | Marketing pages, landing pages |
| pricing | Pricing and plan information |
| docs | Documentation, help articles |
| social | Social media profiles |
| reviews | Product reviews (G2, Capterra, etc.) |
| video | Video content (YouTube, etc.) |
```

## Key Decisions

1. **Abstract class, not composable functions.** `BaseCrawler` is a class because the three features it provides (rate limiting, robots.txt, truncation) share state (the per-domain delay map, the robots.txt cache). Composable functions would require passing that state around explicitly, which is more code for the crawler author. The escape hatch is clear: implement `Crawler` directly if you do not want the base class.

2. **Custom robots.txt parser, no dependency.** The `robots-parser` npm package is 15KB and handles wildcards (`*`, `$`) that are non-standard extensions. Our parser handles User-Agent matching, Disallow, and Allow path prefixes -- the core of the spec. This is ~50 lines of tested code with zero dependencies, matching the package's zero-dependency goal.

3. **`fetchFn` injection for testability.** `BaseCrawler` accepts a `fetchFn` option so tests can inject a mock fetch without monkey-patching globals. This is the same pattern used by testing libraries across the ecosystem.

4. **robots.txt fetch bypasses rate limiting.** The robots.txt request is metadata about what we are allowed to crawl, not a content request. It should not count against the domain's rate limit. This is standard behavior for crawlers.

5. **`createFixtureCrawler` returns a plain Crawler, not a BaseCrawler.** The fixture helper tests your parsing/transformation logic in isolation. It does not test rate limiting or robots.txt (those are tested in `base.test.ts`). This keeps concerns separated.

6. **No fixture recording utility.** Developers save fixtures by running `curl -o fixture.html https://example.com/pricing`. A recording utility adds code without adding value at this stage. It can be added later if the manual approach becomes painful.

7. **Per-domain delay, not per-request token bucket.** A simple "wait N ms since last request to this hostname" is sufficient for a polite crawler. Token buckets and sliding windows are for high-throughput systems with concurrent requests. Our crawlers are sequential within a single crawl operation.

8. **Content truncation at word boundary.** When truncating, we look for the last whitespace character within the final 20% of the limit. This avoids cutting mid-word, which produces better content for LLM analysis downstream.

## What This Does NOT Do

- **No crawler implementations.** The website crawler (S002) and pricing crawler (S003) are separate stories that use `BaseCrawler`.
- **No fixture recording.** Fixtures are saved manually (curl or browser save-as).
- **No robots.txt wildcard patterns.** The `*` and `$` directives are non-standard. Sites that rely on them for access control are extremely rare.
- **No Crawl-delay directive.** The `Crawl-delay` robots.txt directive is non-standard and ignored by most major crawlers. Our configurable `delayMs` serves the same purpose.
- **No distributed rate limiting.** Rate limiting is per-crawler-instance, in-memory. Distributed crawling (multiple processes) is not in scope.
- **No retry logic in BaseCrawler.** Retries are application-specific (some crawlers should retry on 429, others should not). Subclasses implement retry in `doCrawl()` if needed.

## Error Handling Strategy

The `BaseCrawler.crawl()` method handles the top-level robots.txt check. Per-page error handling is the subclass's responsibility in `doCrawl()`, but the pattern is established:

| Error | Handling | Where |
|-------|----------|-------|
| robots.txt blocks URL | Return empty result with error entry | `BaseCrawler.crawl()` |
| robots.txt fetch fails (404, network error) | Treat as "allow all" | `BaseCrawler.checkRobotsTxt()` |
| HTTP timeout on a page | Catch in subclass, add to `errors[]`, continue | `doCrawl()` implementation |
| HTTP 404 on a page | Catch in subclass, add to `errors[]`, continue | `doCrawl()` implementation |
| HTTP 429 (rate limited) | Subclass decides: retry with backoff or skip | `doCrawl()` implementation |
| Redirect chain | Follow up to 5 redirects (fetch default) | Browser/Node fetch default |
| Content too large | `truncateContent()` clips at configured limit | Subclass calls explicitly |
| AbortSignal fired | Propagates through fetch, subclass catches | `doCrawl()` implementation |

## Verification Steps

1. `cd packages/crawlers && npx vitest run` -- all tests pass:
   - robots.txt parser correctly handles User-Agent sections, Disallow paths, Allow overrides, empty/missing robots.txt
   - `isPathAllowed` respects longest-match precedence
   - BaseCrawler enforces rate limiting (second request delayed by `delayMs`)
   - BaseCrawler checks robots.txt before crawling, returns error for blocked URLs
   - BaseCrawler truncates content at configured limit
   - BaseCrawler handles robots.txt fetch failure gracefully (allows crawl)
   - `createFixtureCrawler` returns pages from fixture map
   - `createFixtureCrawler` respects `maxPages` option
   - `createFixtureCrawler` extracts `<title>` from HTML fixtures
   - `createFixtureCrawler.canCrawl()` returns true for matching origins

2. A concrete crawler extending BaseCrawler:
   ```typescript
   class TestCrawler extends BaseCrawler {
     name = "test";
     sourceType = "website" as const;
     canCrawl(url: string) { return true; }
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
   ```
   This compiles and passes type checking without errors.

3. `docs/crawlers.md` exists and covers: interface definition, BaseCrawler usage, direct implementation, registration, fixture testing, CrawlOptions table, and source types.

## Success Criteria

All 6 acceptance criteria from the story TOML are met:

- [x] BaseCrawler class provides rate limiting (configurable delay between requests)
- [x] BaseCrawler fetches and respects robots.txt (checks before crawling)
- [x] Content is truncated to configurable max size (default 100KB per page)
- [x] Errors on individual pages don't crash the entire crawl (graceful degradation)
- [x] `createFixtureCrawler(fixtures)` helper creates a Crawler from saved response data
- [x] `docs/crawlers.md` explains the Crawler interface and how to contribute a new crawler
