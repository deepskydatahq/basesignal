# Implementation Plan: Crawler Interface, CrawlResult Types, and Registry

**Task:** basesignal-f6k (M008-E003-S001)
**Design:** docs/plans/2026-02-15-crawler-interface-design.md

## Context

Define the foundational types and registry for `@basesignal/crawlers`: a `Crawler` interface with four methods, a `CrawlResult` type with pages/timing/errors, and a `CrawlerRegistry` class for runtime discovery. This is pure types + one Map-backed class. No crawler implementations, no HTTP fetching, no HTML parsing.

**Dependency:** This story depends on M008-E001-S001 (monorepo workspace setup). The `packages/` directory and npm workspaces must exist first. If workspaces are not yet configured, Step 1 below includes the minimal workspace bootstrapping needed.

## Approach

Create `packages/crawlers/` with 4 source files (types, registry, barrel export, test) plus package config (package.json, tsconfig.json, tsup.config.ts, vitest.config.ts). Zero runtime dependencies. All acceptance criteria map 1:1 to exports and tests.

## Implementation Steps

### Step 1: Bootstrap workspace (if not already done)

Check if `packages/` exists and `workspaces` is configured in root `package.json`. If not:

**Add to root `package.json`:**
```json
"workspaces": ["packages/*"]
```

**Create directory:**
```bash
mkdir -p packages/crawlers/src
```

This is the minimum needed for this story. Full workspace tooling (M008-E001-S001) may add more later.

### Step 2: Create `packages/crawlers/package.json`

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
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "~5.9.3",
    "vitest": "^4.0.16"
  }
}
```

### Step 3: Create `packages/crawlers/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true,
    "skipLibCheck": true,
    "lib": ["ES2022"]
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "dist", "node_modules"]
}
```

### Step 4: Create `packages/crawlers/tsup.config.ts`

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  outDir: "dist",
});
```

### Step 5: Create `packages/crawlers/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

### Step 6: Create `packages/crawlers/src/types.ts`

This is the core interface file. All types come directly from the design doc.

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

### Step 7: Create `packages/crawlers/src/registry.ts`

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

### Step 8: Create `packages/crawlers/src/index.ts`

Barrel export -- types are re-exported as type-only, registry as value.

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

### Step 9: Create `packages/crawlers/src/registry.test.ts`

Tests cover all 6 acceptance criteria from the story TOML. Each test verifies a specific contract.

```typescript
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
```

### Step 10: Install dependencies and verify

```bash
# From the repo root
npm install

# Type check
cd packages/crawlers && npx tsc --noEmit

# Build
cd packages/crawlers && npx tsup

# Run tests
cd packages/crawlers && npx vitest run
```

## Test Plan

All tests live in `packages/crawlers/src/registry.test.ts`. Organized by acceptance criterion:

### AC1: Crawler interface (3 tests)
1. Plain object satisfies the 4-member interface (name, sourceType, canCrawl, crawl)
2. `crawl()` returns `Promise<CrawlResult>` with correct shape
3. `crawl()` accepts optional `CrawlOptions`

### AC2: CrawlResult type (3 tests)
4. Pages include url, content, pageType, metadata (with description, ogImage, structuredData)
5. Timing includes startedAt, completedAt, totalMs
6. Errors include url and error string

### AC3: CrawlOptions type (3 tests)
7. All fields are optional
8. Includes maxPages, maxDepth, timeout, userAgent
9. Supports AbortSignal for cancellation

### AC4: CrawlerRegistry (7 tests)
10. `register()` adds a crawler
11. `register()` throws on duplicate name
12. `register()` allows different names
13. `getCrawlersFor()` returns matching crawlers
14. `getCrawlersFor()` returns empty array when no match
15. `getCrawlersFor()` returns crawlers in registration order
16. `getCrawlersFor()` returns empty array with no registered crawlers

### AC5: SourceType (1 test)
17. Covers all 6 values: website, social, reviews, docs, video, pricing

### Integration (2 tests)
18. Full register-and-discover workflow from design doc
19. Crawl returns structured pages with all CrawledPage fields

Total: **19 tests**

## Files Created

| File | Description |
|------|-------------|
| `packages/crawlers/package.json` | Package config with name `@basesignal/crawlers`, ESM+CJS exports |
| `packages/crawlers/tsconfig.json` | TypeScript config targeting ES2022, strict mode |
| `packages/crawlers/tsup.config.ts` | Build config producing ESM (.mjs) + CJS (.cjs) + declarations |
| `packages/crawlers/vitest.config.ts` | Test config with globals enabled |
| `packages/crawlers/src/types.ts` | `Crawler`, `CrawlResult`, `CrawlOptions`, `CrawledPage`, `CrawlError`, `SourceType` |
| `packages/crawlers/src/registry.ts` | `CrawlerRegistry` class with `register()`, `getCrawlersFor()`, `getAll()` |
| `packages/crawlers/src/index.ts` | Barrel export (type-only for interfaces, value for registry) |
| `packages/crawlers/src/registry.test.ts` | 19 tests covering all 6 acceptance criteria |

## Files Modified

| File | Change |
|------|--------|
| `package.json` (root) | Add `"workspaces": ["packages/*"]` if not already present |

## Risks

1. **Workspace dependency resolution.** If M008-E001-S001 (monorepo setup) hasn't been completed, npm workspaces in root package.json may conflict with the existing single-package setup. Mitigation: the `"workspaces"` field is additive; existing scripts/deps are unaffected.
2. **tsup version compatibility.** The `tsup` devDependency must be compatible with TypeScript ~5.9.3. Using `^8.0.0` which targets TS 5.x. Verify at install time.
3. **vitest config isolation.** The root `vitest.config.ts` uses jsdom environment and React plugin. The crawlers package uses plain Node (no jsdom, no React). The per-package `vitest.config.ts` overrides the root config. Verify that `npx vitest run` inside `packages/crawlers/` picks up the local config, not the root one.

## Order of Implementation

1. Create `packages/crawlers/` directory structure
2. Write `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
3. Write `src/types.ts` (pure types, no dependencies)
4. Write `src/registry.ts` (depends on types)
5. Write `src/index.ts` (barrel export)
6. Write `src/registry.test.ts` (tests for registry + type assertions)
7. Add `"workspaces"` to root `package.json` if needed
8. Run `npm install` from root
9. Verify: `tsc --noEmit`, `tsup` build, `vitest run`
