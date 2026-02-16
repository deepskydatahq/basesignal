# Implementation Plan: Crawler Testing Infrastructure and Rate Limiting

**Task:** basesignal-hjb
**Story:** M008-E003-S004
**Design:** [2026-02-15-crawler-testing-infra-design.md](./2026-02-15-crawler-testing-infra-design.md)

## Summary

Add three modules to `packages/crawlers/src/`: a `BaseCrawler` abstract class with rate limiting, robots.txt compliance, and content truncation; a minimal `parseRobotsTxt()` parser; and a `createFixtureCrawler()` test helper. Update the barrel export and create `docs/crawlers.md`.

## Prerequisites

This story depends on **M008-E003-S002** (website crawler, task `basesignal-07n`), which is currently in progress. That task establishes `packages/crawlers/` with `src/types.ts`, `src/registry.ts`, `src/index.ts`, `package.json`, and `vitest.config.ts`. S004 adds files to that existing package.

Before starting implementation, verify:
- `packages/crawlers/src/types.ts` exists with `Crawler`, `CrawlResult`, `CrawlOptions`, `CrawledPage`, `CrawlError`, `SourceType`
- `packages/crawlers/src/registry.ts` exists with `CrawlerRegistry`
- `packages/crawlers/src/index.ts` exists as barrel export
- `packages/crawlers/vitest.config.ts` exists
- `cd packages/crawlers && npx vitest run` passes existing tests

## Steps

### Step 1: Create robots.txt parser (`src/robots.ts`)

**File:** `packages/crawlers/src/robots.ts` (new)

Create a zero-dependency robots.txt parser with two exported functions:

1. `parseRobotsTxt(robotsTxt: string, userAgent: string): RobotsTxtRules`
   - Parse a robots.txt string and extract rules for the given user agent
   - Handle `User-Agent`, `Disallow`, and `Allow` directives
   - Prefer specific agent match, fall back to `*` wildcard section
   - If no matching rules found, return empty rules (everything allowed)
   - Skip comments (`#`) and blank lines; blank lines reset the current agent group
   - Case-insensitive matching for user-agent names and directives
   - Do NOT handle: Crawl-delay, Sitemap, wildcard patterns (`*`, `$`)

2. `isPathAllowed(path: string, rules: RobotsTxtRules): boolean`
   - Check if a URL path is allowed by the given rules
   - Longest matching prefix wins (more specific rule takes precedence)
   - Allow rules take precedence over Disallow rules at the same specificity
   - Empty rules = everything allowed

3. `RobotsTxtRules` interface:
   ```typescript
   interface RobotsTxtRules {
     disallowed: string[];
     allowed: string[];
   }
   ```

Implementation follows the design doc exactly (lines 62-170). Copy the code from the design doc.

### Step 2: Test robots.txt parser (`src/robots.test.ts`)

**File:** `packages/crawlers/src/robots.test.ts` (new)

Write tests covering:

- **parseRobotsTxt:**
  - Parses `User-Agent: *` section with Disallow paths
  - Parses specific user agent section (e.g., `User-Agent: BasesignalBot`)
  - Prefers specific agent over `*` wildcard
  - Falls back to `*` when specific agent not found
  - Returns empty rules when robots.txt is empty
  - Returns empty rules when robots.txt has no matching sections
  - Handles multiple user-agent lines in one section
  - Handles comments and blank lines correctly
  - Case-insensitive user-agent matching
  - Parses Allow directives

- **isPathAllowed:**
  - Returns true when no rules exist
  - Returns false when path matches a Disallow prefix
  - Returns true when path does not match any Disallow prefix
  - Allow overrides Disallow at same specificity
  - Longer prefix match wins (e.g., `/api/public` allowed overrides `/api` disallowed)
  - Exact path match works

### Step 3: Create BaseCrawler abstract class (`src/base.ts`)

**File:** `packages/crawlers/src/base.ts` (new)

Create the `BaseCrawler` abstract class implementing `Crawler`:

1. **Constructor** accepts `BaseCrawlerOptions`:
   - `delayMs?: number` (default: 1000) -- per-domain request delay
   - `maxContentBytes?: number` (default: 102400) -- content truncation limit
   - `userAgent?: string` (default: "BasesignalBot/1.0")
   - `fetchFn?: typeof fetch` (default: global `fetch`) -- injectable for testing

2. **Abstract members** (subclass must implement):
   - `readonly name: string`
   - `readonly sourceType: string`
   - `canCrawl(url: string): boolean`
   - `protected doCrawl(url: string, options?: CrawlOptions): Promise<CrawlResult>`

3. **Public `crawl()` method:**
   - Checks robots.txt via `checkRobotsTxt(url)`
   - If blocked, returns empty result with error entry `"Blocked by robots.txt"`
   - Otherwise delegates to `doCrawl(url, options)`

4. **Protected `fetchWithRateLimit(url, init?): Promise<Response>`:**
   - Extracts hostname from URL
   - Checks `lastRequestTime` map for the domain
   - If elapsed time < `delayMs`, awaits the difference
   - Updates `lastRequestTime` with current timestamp
   - Calls `fetchFn` with User-Agent header injected

5. **Protected `checkRobotsTxt(url): Promise<boolean>`:**
   - Extracts origin and hostname from URL
   - Checks `robotsCache` map for the domain
   - If not cached, fetches `{origin}/robots.txt` (bypasses rate limiting)
   - On success: parses with `parseRobotsTxt()`, caches rules
   - On 404 or network error: caches `null` (allow all)
   - Looks up cached rules, returns `isPathAllowed()` result

6. **Protected `truncateContent(content, maxBytes?): string`:**
   - If content length <= limit, return as-is
   - Truncate to limit, then look for last whitespace within final 20%
   - If found, truncate at whitespace boundary to avoid mid-word cut

7. **Private state:**
   - `lastRequestTime: Map<string, number>` -- per-domain delay tracking
   - `robotsCache: Map<string, RobotsTxtRules | null>` -- robots.txt cache

8. **Helper:** `function delay(ms: number): Promise<void>` -- private to the module

Implementation follows the design doc (lines 177-349). Copy the code from the design doc.

### Step 4: Test BaseCrawler (`src/base.test.ts`)

**File:** `packages/crawlers/src/base.test.ts` (new)

Create a concrete `TestCrawler extends BaseCrawler` in the test file for all tests:

```typescript
class TestCrawler extends BaseCrawler {
  name = "test";
  sourceType = "website" as const;
  canCrawl() { return true; }
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

Use a mock `fetchFn` for all tests (no real HTTP). The mock fetch should:
- Return configurable responses for different URLs
- Serve a robots.txt fixture for `{origin}/robots.txt` requests
- Track call count and timing for rate limit verification

Write tests covering:

- **Rate limiting:**
  - Second request to same domain is delayed by `delayMs`
  - Requests to different domains are not delayed
  - Custom `delayMs` is respected
  - Verify by checking timestamps or elapsed time between mock fetch calls

- **robots.txt compliance:**
  - Crawl succeeds when robots.txt allows the path
  - Crawl returns error when robots.txt disallows the path
  - robots.txt is fetched only once per domain (caching)
  - robots.txt fetch failure (404) allows crawl
  - robots.txt network error allows crawl

- **Content truncation:**
  - Content within limit is unchanged
  - Content exceeding limit is truncated
  - Truncation prefers word boundary
  - Custom `maxContentBytes` is respected

- **crawl() method integration:**
  - Calls checkRobotsTxt before doCrawl
  - Returns `"Blocked by robots.txt"` error for disallowed URLs
  - Delegates to doCrawl for allowed URLs

### Step 5: Create fixture testing helper (`src/testing.ts`)

**File:** `packages/crawlers/src/testing.ts` (new)

1. `FixtureMap` type: `Record<string, string>` (URL -> HTML content)

2. `FixtureCrawlerOptions` interface:
   - `name?: string` (default: "fixture")
   - `sourceType?: string` (default: "website")
   - `processPage?: (url: string, html: string) => CrawledPage` (custom page processor)

3. `createFixtureCrawler(fixtures: FixtureMap, options?: FixtureCrawlerOptions): Crawler`
   - Returns a plain `Crawler` object (not a `BaseCrawler`)
   - `canCrawl(url)` returns true if URL's origin matches any fixture key's origin
   - `crawl(url, options)` returns all fixture pages (up to `maxPages`)
   - Default `processPage` extracts `<title>` from HTML, sets `pageType: "other"`
   - Catches errors from `processPage` and adds them to `errors[]`

4. Private `defaultProcessPage(url, html): CrawledPage`:
   - Extract title from `<title>` tag via regex
   - Return `{ url, pageType: "other", title, content: html }`

Implementation follows the design doc (lines 354-469). Copy the code from the design doc.

### Step 6: Test fixture crawler (`src/testing.test.ts`)

**File:** `packages/crawlers/src/testing.test.ts` (new)

Write tests covering:

- **createFixtureCrawler:**
  - Returns all fixture pages when crawled
  - Extracts `<title>` from HTML fixtures
  - `canCrawl()` returns true for matching origins
  - `canCrawl()` returns false for non-matching origins
  - `canCrawl()` returns false for invalid URLs
  - Respects `maxPages` option from `CrawlOptions`
  - Custom `processPage` function is used when provided
  - Errors from `processPage` are caught and reported in `errors[]`
  - Custom `name` and `sourceType` options are applied
  - Returns timing information in the result

### Step 7: Update barrel export (`src/index.ts`)

**File:** `packages/crawlers/src/index.ts` (modify existing)

Add exports after the existing types and registry exports:

```typescript
// Base class
export { BaseCrawler, type BaseCrawlerOptions } from "./base";

// robots.txt utilities
export { parseRobotsTxt, isPathAllowed, type RobotsTxtRules } from "./robots";

// Testing utilities
export {
  createFixtureCrawler,
  type FixtureMap,
  type FixtureCrawlerOptions,
} from "./testing";
```

### Step 8: Create crawler documentation (`docs/crawlers.md`)

**File:** `docs/crawlers.md` (new, at repo root)

Write documentation covering these sections:

1. **The Crawler Interface** -- show the 4-member interface definition
2. **Writing a Crawler:**
   - Option 1: Extend `BaseCrawler` (recommended) with a complete example
   - Option 2: Implement the interface directly as a plain object
3. **Register your crawler** -- show `CrawlerRegistry` usage
4. **Testing Crawlers:**
   - `createFixtureCrawler()` usage with inline HTML
   - Saving HTML fixtures as files in `__fixtures__/` directories
5. **CrawlOptions** table (maxPages, maxDepth, timeout, userAgent, signal)
6. **Source Types** table (website, pricing, docs, social, reviews, video)

Content follows the design doc (lines 504-637). Use code fences (not indented blocks) for code examples.

### Step 9: Run all tests

Run `cd packages/crawlers && npx vitest run` to verify:
- `robots.test.ts` -- parser and path-allowed tests pass
- `base.test.ts` -- rate limiting, robots.txt, truncation tests pass
- `testing.test.ts` -- fixture crawler tests pass
- Existing `registry.test.ts` still passes (no regressions)

Then run `cd packages/crawlers && npx tsc --noEmit` to verify zero type errors.

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/crawlers/src/robots.ts` | New | `parseRobotsTxt()` and `isPathAllowed()` pure functions |
| `packages/crawlers/src/robots.test.ts` | New | robots.txt parser unit tests |
| `packages/crawlers/src/base.ts` | New | `BaseCrawler` abstract class |
| `packages/crawlers/src/base.test.ts` | New | BaseCrawler unit tests (rate limiting, robots.txt, truncation) |
| `packages/crawlers/src/testing.ts` | New | `createFixtureCrawler()` helper |
| `packages/crawlers/src/testing.test.ts` | New | Fixture crawler unit tests |
| `packages/crawlers/src/index.ts` | Modify | Add barrel exports for BaseCrawler, robots, testing |
| `docs/crawlers.md` | New | Crawler interface guide and contribution howto |

## What Does NOT Change

- `packages/crawlers/src/types.ts` -- types are defined in S001, unchanged here
- `packages/crawlers/src/registry.ts` -- registry is defined in S001, unchanged here
- `packages/crawlers/package.json` -- no new dependencies (zero-dependency parser)
- Any `convex/` files -- this story is entirely within the crawlers package
- Website crawler (`src/website-crawler.ts`) -- S002 is a separate story
- Pricing parser -- S003 is a separate story

## Verification

- `cd packages/crawlers && npx vitest run` -- all tests pass (robots, base, testing, registry)
- `cd packages/crawlers && npx tsc --noEmit` -- zero type errors
- `docs/crawlers.md` exists and covers: interface, BaseCrawler usage, direct implementation, registration, fixture testing, CrawlOptions table, source types
- Each acceptance criterion is covered:
  1. BaseCrawler provides configurable rate limiting -- tested in `base.test.ts`
  2. BaseCrawler fetches and respects robots.txt -- tested in `base.test.ts`
  3. Content truncated to configurable max (default 100KB) -- tested in `base.test.ts`
  4. Individual page errors don't crash entire crawl -- tested in `base.test.ts` and `testing.test.ts`
  5. `createFixtureCrawler(fixtures)` creates Crawler from saved data -- tested in `testing.test.ts`
  6. `docs/crawlers.md` explains interface and contribution -- verified by file existence and content
