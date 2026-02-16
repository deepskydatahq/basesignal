# Crawlers

## Overview

Crawlers are the data extraction layer of Basesignal. They fetch content from different source types -- websites, documentation, pricing pages, reviews -- and return structured results that the analysis pipeline uses to generate a Product Profile.

The scan pipeline works in three steps:

1. **Crawl** -- crawlers fetch and parse content from the target URL
2. **Analyze** -- the LLM extracts product insights from the crawled pages
3. **Generate** -- insights are assembled into a ProductProfile

Basesignal ships with built-in crawlers for common sources. You can extend the system by implementing the `Crawler` interface and registering your crawler with the `CrawlerRegistry`.

## Built-in Crawlers

| Crawler | Source Type | What It Crawls |
|---------|------------|----------------|
| `WebsiteCrawler` | `website` | Marketing pages, features, about, docs -- follows links up to a configurable depth |
| `PricingCrawler` | `pricing` | Pricing page structure, tier names, prices, and feature lists |

## The Crawler Interface

Every crawler implements four members:

```typescript
interface Crawler {
  readonly name: string;
  readonly sourceType: SourceType;
  canCrawl(url: string): boolean;
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
}
```

### Source Types

```typescript
type SourceType = "website" | "social" | "reviews" | "docs" | "video" | "pricing";
```

| Type | Description |
|------|-------------|
| `website` | Marketing pages, landing pages |
| `pricing` | Pricing and plan information |
| `docs` | Documentation, help articles |
| `social` | Social media profiles |
| `reviews` | Product reviews (G2, Capterra, etc.) |
| `video` | Video content (YouTube, etc.) |

### CrawlOptions

All options are optional. Crawlers define sensible defaults.

```typescript
interface CrawlOptions {
  maxPages?: number;   // Maximum pages to crawl
  maxDepth?: number;   // Maximum link-follow depth
  timeout?: number;    // Timeout in ms for the entire crawl
  userAgent?: string;  // User-Agent for HTTP requests
  signal?: AbortSignal; // Cancellation signal
}
```

### CrawlResult

```typescript
interface CrawlResult {
  pages: CrawledPage[];
  timing: {
    startedAt: number;
    completedAt: number;
    totalMs: number;
  };
  errors: CrawlError[];
}

interface CrawledPage {
  url: string;
  pageType: string;    // "homepage", "features", "pricing", "about", "docs", etc.
  title?: string;
  content: string;
  metadata?: {
    description?: string;
    ogImage?: string;
    structuredData?: unknown;
  };
}

interface CrawlError {
  url: string;
  error: string;
}
```

## Building a Custom Crawler

This tutorial builds a `GitHubReadmeCrawler` that fetches README content from GitHub repositories using the GitHub API. By the end, you will have a complete, tested crawler that can be registered with Basesignal.

### Step 1: Create the File

```
packages/crawlers/src/crawlers/github-readme.ts
```

### Step 2: Implement the Interface

```typescript
import type { Crawler, CrawlOptions, CrawlResult } from "../types.js";

export class GitHubReadmeCrawler implements Crawler {
  readonly name = "github-readme";
  readonly sourceType = "docs" as const;

  canCrawl(url: string): boolean {
    return url.includes("github.com");
  }

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const startedAt = Date.now();

    // Parse owner/repo from URL
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      return {
        pages: [],
        timing: { startedAt, completedAt: Date.now(), totalMs: Date.now() - startedAt },
        errors: [{ url, error: "Could not parse GitHub URL" }],
      };
    }

    const [, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;

    const response = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.raw+json" },
      signal: options?.timeout ? AbortSignal.timeout(options.timeout) : undefined,
    });

    if (!response.ok) {
      return {
        pages: [],
        timing: { startedAt, completedAt: Date.now(), totalMs: Date.now() - startedAt },
        errors: [{ url: apiUrl, error: `GitHub API returned ${response.status}` }],
      };
    }

    const content = await response.text();
    const completedAt = Date.now();

    return {
      pages: [{
        url: `https://github.com/${owner}/${repo}#readme`,
        pageType: "docs",
        title: `${owner}/${repo} README`,
        content,
      }],
      timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
      errors: [],
    };
  }
}
```

### Step 3: Register It

```typescript
import { CrawlerRegistry } from "@basesignal/crawlers";
import { GitHubReadmeCrawler } from "./github-readme.js";

const registry = new CrawlerRegistry();
registry.register(new GitHubReadmeCrawler());

// The registry auto-discovers crawlers for a URL
const crawlers = registry.getCrawlersFor("https://github.com/deepskydatahq/basesignal");
// => [GitHubReadmeCrawler]
```

### Step 4: Test It

```typescript
import { describe, test, expect } from "vitest";
import { GitHubReadmeCrawler } from "./github-readme.js";

describe("GitHubReadmeCrawler", () => {
  const crawler = new GitHubReadmeCrawler();

  test("canCrawl returns true for GitHub URLs", () => {
    expect(crawler.canCrawl("https://github.com/deepskydatahq/basesignal")).toBe(true);
    expect(crawler.canCrawl("https://linear.app")).toBe(false);
  });

  test("crawl returns README content", async () => {
    const result = await crawler.crawl("https://github.com/deepskydatahq/basesignal");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageType).toBe("docs");
    expect(result.errors).toHaveLength(0);
  });
});
```

## Using BaseCrawler

For crawlers that need rate limiting, robots.txt compliance, and content truncation, extend `BaseCrawler` instead of implementing the interface directly:

```typescript
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
```

`BaseCrawler` handles:

- **Rate limiting:** 1 second between requests to the same domain (configurable)
- **robots.txt:** Checks before every crawl, caches per domain
- **Content truncation:** 100KB per page (configurable)

## Testing Crawlers

### Using Fixture Crawlers

Use `createFixtureCrawler()` to test without making HTTP requests:

```typescript
import { createFixtureCrawler } from "@basesignal/crawlers";

const crawler = createFixtureCrawler({
  "https://acme.io/": "<html><title>Acme</title><body>Homepage</body></html>",
  "https://acme.io/pricing": "<html><title>Pricing</title><body>$29/mo</body></html>",
});

const result = await crawler.crawl("https://acme.io/");
expect(result.pages).toHaveLength(2);
expect(result.pages[0].title).toBe("Acme");
```

### Using HTML Fixtures

For testing your own crawler's parsing logic, save HTML fixtures as files:

```
packages/crawlers/src/__fixtures__/
  acme-homepage.html
  acme-pricing.html
```

Then load them in tests:

```typescript
import { readFileSync } from "fs";
import { join } from "path";

const homepageHtml = readFileSync(
  join(__dirname, "__fixtures__/acme-homepage.html"), "utf-8"
);
```

### Testing Best Practices

- Test `canCrawl` separately with positive and negative URL cases
- Test error handling: invalid URLs, HTTP errors, timeouts
- Use fixtures for offline testing -- avoid hitting real APIs in CI
- Test edge cases: empty pages, missing titles, malformed HTML

## Contributing a Crawler

If you build a crawler that others would find useful, consider contributing it upstream. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the PR process.

Key requirements for contributed crawlers:

- Implements the `Crawler` interface (directly or via `BaseCrawler`)
- Has tests with fixtures (no live HTTP calls in tests)
- Does not add heavy dependencies
- Handles errors gracefully (no unhandled rejections)
- Includes a JSDoc comment on the class describing what it crawls
