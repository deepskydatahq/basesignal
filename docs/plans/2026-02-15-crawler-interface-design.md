# Crawler Interface, CrawlResult Types, and Registry Design

## Overview

Define the foundational types and registry for `@basesignal/crawlers`: a `Crawler` interface with four methods (`name`, `sourceType`, `canCrawl`, `crawl`), a `CrawlResult` type that carries pages with content/metadata/classification, and a `CrawlerRegistry` that discovers crawlers by URL at runtime. This is the contract that every crawler (built-in and community) must implement.

## Problem Statement

The current crawl logic lives in `convex/scanning.ts` as a monolithic Firecrawl-specific action. It hardcodes the crawl provider, page classification, and result shaping into a single function. The open source strategy (M008) requires a pluggable crawler architecture where:

1. New data sources (YouTube, G2, LinkedIn) can be added without modifying core code
2. The Firecrawl dependency becomes optional (users bring their own crawl strategy)
3. Community contributors can implement a crawler in an afternoon

This story defines the interface contract and registry mechanism. No crawl implementations yet -- just the types and wiring.

## Expert Perspectives

### Technical Architect

The interface should be dead simple: four members, no abstract classes, no inheritance hierarchy. A crawler is a plain object that satisfies a TypeScript interface. The registry is a `Map` -- not a service locator, not dependency injection, not a plugin loader. `canCrawl(url)` is the discovery mechanism: the registry asks each registered crawler "can you handle this?" and returns the ones that say yes. This is the strategy pattern at its simplest. The only design tension is whether `crawl()` should accept a signal for cancellation -- yes, include `AbortSignal` in `CrawlOptions` because crawls are long-running and callers need a way out.

### Simplification Review

**Verdict: APPROVED** -- every type directly maps to an acceptance criterion.

What to watch for:
- **No `BaseCrawler` class here.** That belongs in S004 (crawler testing infra). This story is pure types + registry, no implementation scaffolding.
- **No `fetchWithRateLimit`, no `robots.txt` helpers.** Those are S004 concerns.
- **`sourceType` enum is a union of string literals, not a runtime enum.** Simpler, tree-shakeable, extensible.
- **`CrawlerRegistry` is a class with two methods.** `register()` and `getCrawlersFor()`. No `unregister`, no priority ordering, no lifecycle hooks.
- **No re-export of existing `urlUtils`.** The crawler package is standalone; page classification from `convex/lib/urlUtils.ts` will be adapted into the website crawler (S002), not pulled into the interface layer.

Nothing to remove. This is the minimum surface area.

## Proposed Solution

### File Structure (4 source files + 1 test file + 1 package config)

```
packages/crawlers/
  package.json          # @basesignal/crawlers
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
  src/
    index.ts            # Barrel export
    types.ts            # Crawler, CrawlResult, CrawlOptions, CrawledPage, SourceType
    registry.ts         # CrawlerRegistry class
    registry.test.ts    # Registry unit tests
```

### Types (`src/types.ts`)

```typescript
/**
 * Source types that crawlers produce data for.
 * Built-in types cover the core analysis pipeline.
 * Community crawlers can use any string -- this union is advisory, not restrictive.
 */
export type SourceType =
  | "website"
  | "social"
  | "reviews"
  | "docs"
  | "video"
  | "pricing";

/**
 * Options passed to a crawler's crawl() method.
 * All fields optional -- crawlers define sensible defaults.
 */
export interface CrawlOptions {
  /** Maximum number of pages to crawl. */
  maxPages?: number;
  /** Maximum link-follow depth from the root URL. */
  maxDepth?: number;
  /** Timeout in milliseconds for the entire crawl operation. */
  timeout?: number;
  /** User-Agent string for HTTP requests. */
  userAgent?: string;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/**
 * A single crawled page with content and metadata.
 */
export interface CrawledPage {
  /** The URL that was crawled. */
  url: string;
  /** Classified page type (e.g., 'homepage', 'features', 'pricing'). */
  pageType: string;
  /** Page title extracted from HTML <title> or og:title. */
  title?: string;
  /** The main text content (markdown or plain text). */
  content: string;
  /** Optional metadata extracted from the page. */
  metadata?: {
    description?: string;
    ogImage?: string;
    structuredData?: unknown;
  };
}

/**
 * The result of a crawl operation.
 */
export interface CrawlResult {
  /** Pages successfully crawled. */
  pages: CrawledPage[];
  /** Timing information for the crawl. */
  timing: {
    startedAt: number;
    completedAt: number;
    totalMs: number;
  };
  /** Errors encountered during crawling (per-page failures). */
  errors: CrawlError[];
}

/**
 * A per-page error that didn't halt the crawl.
 */
export interface CrawlError {
  url: string;
  error: string;
}

/**
 * The interface every crawler must implement.
 *
 * A crawler is a plain object -- no base class required.
 * Implement these four members and register with CrawlerRegistry.
 */
export interface Crawler {
  /** Human-readable name (e.g., 'website', 'g2-reviews'). */
  readonly name: string;
  /** What kind of data this crawler produces. */
  readonly sourceType: SourceType;
  /** Returns true if this crawler can handle the given URL. */
  canCrawl(url: string): boolean;
  /** Crawl the URL and return structured results. */
  crawl(url: string, options?: CrawlOptions): Promise<CrawlResult>;
}
```

### Registry (`src/registry.ts`)

```typescript
import type { Crawler } from "./types";

/**
 * Registry for discovering crawlers at runtime.
 *
 * Usage:
 *   const registry = new CrawlerRegistry();
 *   registry.register(websiteCrawler);
 *   registry.register(pricingCrawler);
 *
 *   const crawlers = registry.getCrawlersFor("https://linear.app");
 *   // Returns all registered crawlers where canCrawl() returns true
 */
export class CrawlerRegistry {
  private crawlers: Map<string, Crawler> = new Map();

  /**
   * Register a crawler. Throws if a crawler with the same name is already registered.
   */
  register(crawler: Crawler): void {
    if (this.crawlers.has(crawler.name)) {
      throw new Error(
        `Crawler "${crawler.name}" is already registered. ` +
        `Each crawler must have a unique name.`
      );
    }
    this.crawlers.set(crawler.name, crawler);
  }

  /**
   * Get all registered crawlers that can handle the given URL.
   * Returns crawlers in registration order.
   */
  getCrawlersFor(url: string): Crawler[] {
    const matches: Crawler[] = [];
    for (const crawler of this.crawlers.values()) {
      if (crawler.canCrawl(url)) {
        matches.push(crawler);
      }
    }
    return matches;
  }

  /**
   * Get all registered crawlers.
   */
  getAll(): Crawler[] {
    return Array.from(this.crawlers.values());
  }
}
```

### Barrel Export (`src/index.ts`)

```typescript
export type {
  Crawler,
  CrawlResult,
  CrawlOptions,
  CrawledPage,
  CrawlError,
  SourceType,
} from "./types";

export { CrawlerRegistry } from "./registry";
```

### Package Configuration (`package.json`)

```json
{
  "name": "@basesignal/crawlers",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

### Mapping to Current Firecrawl Usage

The current `convex/scanning.ts` does several things that map to this interface:

| Current behavior | Maps to |
|---|---|
| `filterHighValuePages()` URL selection | `Crawler.canCrawl()` + internal logic per crawler |
| `classifyPageType()` | `CrawledPage.pageType` (set by crawler) |
| Firecrawl map + batch scrape | Inside `Crawler.crawl()` implementation (S002) |
| `ScrapedPage` type | `CrawledPage` type |
| Storing to `crawledPages` table | Consumer responsibility (not in crawler) |
| Progress callbacks | Not in interface (orchestrator concern for later epic) |

The `crawledPages` Convex table schema already matches `CrawledPage` closely:
- `url` -> `url`
- `pageType` -> `pageType`
- `title` -> `title`
- `content` -> `content`
- `metadata.description`, `metadata.ogImage`, `metadata.structuredData` -> `metadata.*`

This alignment is intentional. The existing schema was well-designed.

## Key Decisions

1. **Interface over abstract class.** A `Crawler` is a TypeScript interface, not a base class. This means any object satisfying the shape works -- plain objects, class instances, factory functions. The `BaseCrawler` abstract class (S004) will be a convenience, not a requirement.

2. **`SourceType` is a string union, not an enum.** String unions are simpler, work with plain JSON, and don't require importing a runtime value. Community crawlers can use `as SourceType` or the type will be widened -- both are fine.

3. **`CrawlOptions.signal` for cancellation.** Crawls can take minutes. `AbortSignal` is the platform-standard cancellation mechanism. Crawlers that don't support it can ignore it.

4. **Registry uses `Map<string, Crawler>` keyed by name.** Duplicate names throw immediately rather than silently overwriting. This catches configuration bugs early.

5. **No `unregister()` method.** YAGNI. The registry is typically set up once at startup. If someone needs dynamic registration, they can create a new registry.

6. **`getAll()` convenience method.** Useful for CLI commands like `basesignal crawlers list` and for debugging. Costs one line of code.

7. **No progress callbacks in the interface.** Progress reporting is an orchestration concern (the MCP server or CLI wraps the crawl). Crawlers return a `Promise<CrawlResult>` -- they don't push updates. This keeps the interface simple and testable.

8. **`metadata.structuredData` is `unknown`.** JSON-LD, microdata, etc. vary wildly. Let downstream consumers (the analysis pipeline) interpret what they find.

## What This Does NOT Do

- **No crawler implementations.** The website crawler (S002) and pricing crawler (S003) are separate stories.
- **No `BaseCrawler` abstract class.** That's S004 (rate limiting, robots.txt, fixture testing).
- **No HTTP fetching or HTML parsing.** This is pure types and a `Map`.
- **No integration with `convex/scanning.ts`.** Wiring the new interface into the existing scan pipeline is a separate integration story.
- **No page classification logic.** The existing `classifyPageType()` in `convex/lib/urlUtils.ts` stays where it is. Crawlers set `pageType` themselves.
- **No build infrastructure.** Assumes the monorepo workspace setup (M008-E001-S001) is already done with tsup, vitest configs, etc.

## Verification Steps

1. `cd packages/crawlers && npx tsc --noEmit` -- zero type errors
2. `cd packages/crawlers && npx tsup` -- produces dist/ with .mjs, .cjs, .d.ts files
3. `cd packages/crawlers && npx vitest run` -- all registry tests pass
4. Import test: `import { CrawlerRegistry, type Crawler } from "@basesignal/crawlers"` resolves in another workspace package
5. A mock crawler satisfying the `Crawler` interface can be registered and discovered:

```typescript
const mock: Crawler = {
  name: "test",
  sourceType: "website",
  canCrawl: (url) => url.includes("example.com"),
  crawl: async () => ({ pages: [], timing: { startedAt: 0, completedAt: 0, totalMs: 0 }, errors: [] }),
};

const registry = new CrawlerRegistry();
registry.register(mock);
expect(registry.getCrawlersFor("https://example.com")).toEqual([mock]);
expect(registry.getCrawlersFor("https://other.com")).toEqual([]);
```

6. Duplicate registration throws: `registry.register(mock)` twice throws `Crawler "test" is already registered`

## Success Criteria

- All 6 acceptance criteria from the story TOML are met:
  - [x] Crawler interface exports: `name`, `sourceType`, `canCrawl(url)`, `crawl(url, options)`
  - [x] CrawlResult type includes: `pages` (with url, content, pageType, metadata), `timing`, `errors`
  - [x] CrawlOptions type includes: `maxPages`, `maxDepth`, `timeout`, `userAgent`
  - [x] `CrawlerRegistry.register(crawler)` and `CrawlerRegistry.getCrawlersFor(url)` work
  - [x] sourceType union covers: `'website'`, `'social'`, `'reviews'`, `'docs'`, `'video'`, `'pricing'`
  - [x] `packages/crawlers/` has its own `package.json` with name `@basesignal/crawlers`
- Zero runtime dependencies (pure TypeScript types + one Map-backed class)
- Interface is simple enough that a community contributor can implement a crawler by looking at the types alone
