# Pricing Page Crawler — Design

## Overview

Implement a `PricingCrawler` that implements the `Crawler` interface (from M008-E003-S001) with `sourceType: 'pricing'`. Given a URL, it fetches the pricing page, extracts structured pricing data (tiers, prices, billing periods, feature lists, free tier presence), and returns both the structured metadata and raw content in a `CrawlResult`. The structured metadata enables downstream analysis (the `extractRevenue` pipeline) to work with pre-parsed data instead of re-interpreting raw HTML/markdown every time.

## Problem Statement

The current revenue extraction pipeline (`convex/extractRevenue.ts`) receives raw crawled page content and sends the entire thing to Claude Haiku for interpretation. This works, but it has two weaknesses:

1. **No structural pre-parsing.** Pricing pages have highly predictable HTML patterns (tier cards, price elements, feature lists, toggle switches for monthly/annual). A structural parser can extract these patterns reliably without an LLM, producing machine-readable output that the LLM then validates and enriches rather than constructing from scratch.

2. **No dedicated crawler.** The current pipeline treats pricing pages the same as any other page type -- the `WebsiteCrawler` (S002) fetches them as part of a general site crawl. A dedicated `PricingCrawler` can focus specifically on pricing URLs, extract pricing-specific metadata, and return it alongside the raw content.

The `PricingCrawler` sits between raw HTTP fetching and LLM analysis. It extracts what structure it can deterministically, then passes both structured data and raw content to the analysis pipeline.

## Expert Perspectives

### Technical Architect

The key insight is separation of concerns: the crawler extracts structure from HTML; the LLM interprets meaning from content. Don't try to make the parser understand every pricing page perfectly -- extract the easy patterns (price amounts, tier names, feature lists) and let the downstream LLM fill in the gaps. The structured output is a _hint_ to the LLM, not a replacement for it. Keep the parser simple: regex + DOM traversal for common patterns, with graceful fallback to raw content when structure isn't detected. The `CrawledPage.metadata` field is the right place for structured pricing data -- it's `unknown` by design, so the pricing crawler can populate it without changing the interface.

### Simplification Review

**Verdict: APPROVED with one cut.**

- **Cut: No LLM calls inside the crawler.** The crawler is a pure HTTP + parsing operation. The temptation is to call Claude from inside the crawler to "fix" ambiguous pricing structures. Don't. The crawler returns what it can parse structurally; the analysis pipeline (`extractRevenue`) handles interpretation. Two LLM calls for the same data is waste.
- Every other component is essential: `canCrawl()` URL matching, HTML fetching, structural parsing, fixture tests.
- The structured output type (`PricingMetadata`) belongs in `packages/crawlers/` alongside the crawler, not in `@basesignal/core`. It's crawler-specific data, not a profile schema type.

## Proposed Solution

### File Structure

```
packages/crawlers/
  src/
    pricing/
      index.ts              # PricingCrawler implementation
      parser.ts             # HTML-to-structured-pricing parser (pure function)
      types.ts              # PricingMetadata, PricingTier types
    pricing/
      __fixtures__/
        linear.html         # Saved pricing page HTML
        notion.html         # Saved pricing page HTML
        miro.html           # Saved pricing page HTML
      pricing-crawler.test.ts  # Tests against fixtures
      parser.test.ts           # Parser unit tests
```

### Types (`src/pricing/types.ts`)

```typescript
/**
 * A single pricing tier extracted from a pricing page.
 */
export interface PricingTier {
  /** Tier name (e.g., "Free", "Pro", "Enterprise"). */
  name: string;
  /** Price as a number, or null for "Contact Sales" / custom pricing. */
  price: number | null;
  /** Price as displayed on the page (e.g., "$29/mo", "Custom", "Free"). */
  priceDisplay: string;
  /** Billing period if detectable (e.g., "month", "year"). */
  period?: "month" | "year";
  /** Features listed under this tier. */
  features: string[];
}

/**
 * Structured pricing metadata extracted from a pricing page.
 * Stored in CrawledPage.metadata.pricing.
 */
export interface PricingMetadata {
  /** Extracted pricing tiers. */
  tiers: PricingTier[];
  /** Whether a free tier (price === 0 or "Free") was detected. */
  hasFreeTier: boolean;
  /** Whether a trial is mentioned on the page. */
  hasTrialMention: boolean;
  /** Available billing options detected (e.g., ["monthly", "annual"]). */
  billingOptions: string[];
  /** Whether an enterprise/custom tier exists. */
  hasEnterpriseTier: boolean;
  /** Billing unit if detectable (e.g., "seat", "user", "project"). */
  billingUnit?: string;
  /** Confidence in the structural extraction (0-1). */
  parseConfidence: number;
}
```

### Parser (`src/pricing/parser.ts`)

The parser is a pure function that takes HTML (or markdown) content and returns `PricingMetadata`. It uses pattern matching, not an LLM.

```typescript
import type { PricingMetadata, PricingTier } from "./types";

/**
 * Parse pricing page content into structured pricing metadata.
 *
 * Strategy: cascading extraction with confidence scoring.
 *   1. Look for price patterns ($X, X/mo, X/year, Free, Custom)
 *   2. Look for tier name patterns (headings near prices)
 *   3. Look for feature lists (bullet lists near tier names)
 *   4. Look for billing toggles (monthly/annual)
 *   5. Look for billing unit mentions (per seat, per user, etc.)
 *
 * Returns whatever it can extract. Confidence reflects how much
 * structure was successfully parsed.
 */
export function parsePricingContent(content: string): PricingMetadata {
  const tiers = extractTiers(content);
  const billingOptions = extractBillingOptions(content);
  const billingUnit = extractBillingUnit(content);
  const hasTrialMention = detectTrialMention(content);

  const hasFreeTier = tiers.some(
    (t) => t.price === 0 || t.priceDisplay.toLowerCase() === "free"
  );
  const hasEnterpriseTier = tiers.some(
    (t) =>
      t.price === null &&
      /enterprise|custom|contact/i.test(t.name + " " + t.priceDisplay)
  );

  // Confidence: based on how much structure we found
  const parseConfidence = calculateConfidence(tiers, billingOptions, billingUnit);

  return {
    tiers,
    hasFreeTier,
    hasTrialMention,
    billingOptions,
    hasEnterpriseTier,
    billingUnit,
    parseConfidence,
  };
}
```

#### Extraction Heuristics

**Price patterns** (regex-based):
- `$X` or `$X.XX` followed by `/mo`, `/month`, `/yr`, `/year`, `/user`, `/seat`
- `Free` or `$0` as standalone tokens
- `Contact Sales`, `Contact Us`, `Custom` as enterprise indicators
- Currency symbols beyond `$`: `EUR`, `GBP`, unicode symbols

**Tier detection** (proximity-based):
- A tier is a cluster of: heading/name + price + feature list
- Names are typically `<h2>`, `<h3>`, or bold text near a price
- In markdown: `## Tier Name` followed by price and bullet list

**Feature lists**:
- Bullet lists (`- feature` or `* feature` in markdown)
- Items following a tier name/price block
- Checkmark indicators (unicode checkmarks, "included", etc.)

**Billing options**:
- Toggle text: "Monthly", "Annual", "Yearly", "Billed monthly", "Billed annually"
- Discount mentions: "Save X%", "X months free"

**Billing unit**:
- `/user`, `/seat`, `/member`, `/editor` near price patterns
- "per user", "per seat", "per project" in surrounding text

#### Confidence Calculation

```typescript
function calculateConfidence(
  tiers: PricingTier[],
  billingOptions: string[],
  billingUnit: string | undefined
): number {
  let confidence = 0;

  // Found any tiers at all
  if (tiers.length > 0) confidence += 0.4;
  // Found multiple tiers (typical pricing page has 2-4)
  if (tiers.length >= 2) confidence += 0.1;
  // Tiers have prices
  if (tiers.some((t) => t.price !== null || t.priceDisplay === "Free")) confidence += 0.15;
  // Tiers have features
  if (tiers.some((t) => t.features.length > 0)) confidence += 0.15;
  // Billing options detected
  if (billingOptions.length > 0) confidence += 0.1;
  // Billing unit detected
  if (billingUnit) confidence += 0.1;

  return Math.min(confidence, 1.0);
}
```

### PricingCrawler (`src/pricing/index.ts`)

```typescript
import type { Crawler, CrawlResult, CrawlOptions, CrawledPage } from "../types";
import { parsePricingContent } from "./parser";
import type { PricingMetadata } from "./types";

/**
 * Pricing-specific URL patterns.
 */
const PRICING_URL_PATTERNS = [
  /\/pricing(\/|$)/i,
  /\/plans(\/|$)/i,
  /\/price(\/|$)/i,
];

/**
 * A crawler specialized for pricing pages.
 *
 * Unlike the WebsiteCrawler which discovers and crawls multiple pages,
 * the PricingCrawler targets a single pricing page URL, fetches it,
 * and returns both raw content and structured pricing metadata.
 *
 * canCrawl() returns true for URLs containing /pricing, /plans, or /price.
 */
export const pricingCrawler: Crawler = {
  name: "pricing",
  sourceType: "pricing",

  canCrawl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      return PRICING_URL_PATTERNS.some((pattern) => pattern.test(path));
    } catch {
      return false;
    }
  },

  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const startedAt = Date.now();
    const errors: Array<{ url: string; error: string }> = [];
    const pages: CrawledPage[] = [];

    try {
      // Check for cancellation
      options?.signal?.throwIfAborted();

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            options?.userAgent ??
            "Basesignal/1.0 (https://basesignal.io; product analysis)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: options?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      // Convert HTML to markdown-like text for content field
      const content = htmlToText(html);

      // Extract structured pricing metadata
      const pricing: PricingMetadata = parsePricingContent(content);

      // Extract page title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      pages.push({
        url,
        pageType: "pricing",
        title,
        content,
        metadata: {
          description: extractMetaDescription(html),
          structuredData: { pricing },
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ url, error: message });
    }

    const completedAt = Date.now();
    return {
      pages,
      timing: { startedAt, completedAt, totalMs: completedAt - startedAt },
      errors,
    };
  },
};
```

### HTML-to-Text Conversion

The crawler needs a lightweight HTML-to-text/markdown converter. Two options:

**Option A: Use `cheerio` (recommended).** It's a fast, DOM-like API for server-side HTML parsing. Already well-established in the Node ecosystem, ~500KB, no browser dependency.

```typescript
import * as cheerio from "cheerio";

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $("script, style, nav, footer, header, noscript, iframe").remove();

  // Extract text with basic structure preservation
  return $("body").text().replace(/\s+/g, " ").trim();
}
```

**Option B: Regex-based strip.** Zero dependencies, handles 80% of cases, fails on complex HTML. Suitable for a first implementation, replaceable later.

Recommendation: Start with regex-based for the initial implementation to keep dependencies minimal. The raw content is a backup -- the LLM can interpret messy text. If extraction quality suffers, upgrade to `cheerio` in a follow-up.

### Structured Metadata Flow

The pricing metadata flows through the system:

```
PricingCrawler.crawl(url)
  -> CrawlResult.pages[0].metadata.structuredData.pricing = PricingMetadata
  -> stored in crawledPages table (metadata.structuredData is v.optional(v.string()))
  -> extractRevenue reads crawledPages
  -> if metadata.structuredData.pricing exists:
       send BOTH raw content AND structured pricing to Claude
       -> LLM validates/enriches the structured extraction
  -> if no structured pricing:
       send raw content only (current behavior, unchanged)
```

This is backward-compatible. The `extractRevenue` pipeline continues to work with pages that have no structured pricing metadata -- it just gets a hint when the pricing crawler has pre-parsed the page.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parser approach | Regex + heuristics, no LLM | Crawler is a pure HTTP + parsing layer. LLM interpretation belongs in the analysis pipeline. Keeps the crawler fast, testable, and deterministic. |
| Metadata location | `CrawledPage.metadata.structuredData.pricing` | Fits the existing `CrawledPage` type. `structuredData` is typed as `unknown`, so no interface change needed. |
| HTML parsing library | Regex first, cheerio upgrade path | Minimize initial dependencies. The raw content backup means imperfect parsing is acceptable. |
| Crawler scope | Single page only | Pricing crawlers don't discover links. They fetch one URL, parse it, return it. `maxPages` and `maxDepth` are ignored (always 1 page, 0 depth). |
| URL matching | Path-based regex (`/pricing`, `/plans`, `/price`) | Matches the existing `classifyPageType()` logic in `convex/lib/urlUtils.ts`. Consistent detection across the system. |
| Export style | Named export `pricingCrawler` (object literal) | Matches the interface-over-class philosophy from the crawler interface design (S001). No `new PricingCrawler()` ceremony. |
| Price parsing | Numbers extracted to `number | null` | Enables programmatic comparison. `null` for "Contact Sales" / custom. `priceDisplay` preserves the original string for the LLM. |

## Fixture-Based Testing

### Fixtures

Save real pricing page HTML from 3+ products. These are static snapshots, not live fetches.

| Product | URL | Why This Fixture |
|---------|-----|------------------|
| Linear | `https://linear.app/pricing` | Clean tier cards, free tier, per-seat billing, monthly/annual toggle |
| Notion | `https://www.notion.com/pricing` | Freemium, per-member billing, 4 tiers including Enterprise |
| Miro | `https://miro.com/pricing/` | Free tier, multiple paid tiers, per-member, annual discount |

Fixtures are saved as HTML files in `packages/crawlers/src/pricing/__fixtures__/`. Tests load these files and verify extraction results.

### Test Cases

**`parser.test.ts`** -- Pure function tests against fixture content:

```typescript
describe("parsePricingContent", () => {
  it("extracts tiers from Linear pricing page", () => {
    const content = loadFixture("linear.html");
    const result = parsePricingContent(htmlToText(content));

    expect(result.tiers.length).toBeGreaterThanOrEqual(3); // Free, Standard, Plus (at minimum)
    expect(result.hasFreeTier).toBe(true);
    expect(result.billingOptions).toContain("monthly");
    expect(result.billingOptions).toContain("annual");
    expect(result.parseConfidence).toBeGreaterThan(0.5);
  });

  it("detects enterprise tier from Notion pricing page", () => {
    const content = loadFixture("notion.html");
    const result = parsePricingContent(htmlToText(content));

    expect(result.hasEnterpriseTier).toBe(true);
    expect(result.hasFreeTier).toBe(true);
  });

  it("detects per-seat billing from Miro pricing page", () => {
    const content = loadFixture("miro.html");
    const result = parsePricingContent(htmlToText(content));

    expect(result.billingUnit).toMatch(/member|seat|user/i);
  });

  it("returns empty tiers for non-pricing content", () => {
    const result = parsePricingContent("This is a blog post about our company.");

    expect(result.tiers).toEqual([]);
    expect(result.hasFreeTier).toBe(false);
    expect(result.parseConfidence).toBe(0);
  });

  it("handles 'Contact Sales' as null price", () => {
    const content = "## Enterprise\n\nContact Sales\n\n- SSO\n- Custom SLA";
    const result = parsePricingContent(content);

    const enterprise = result.tiers.find((t) => /enterprise/i.test(t.name));
    expect(enterprise?.price).toBeNull();
    expect(enterprise?.priceDisplay).toMatch(/contact/i);
  });
});
```

**`pricing-crawler.test.ts`** -- Crawler integration tests:

```typescript
describe("pricingCrawler", () => {
  describe("canCrawl", () => {
    it("returns true for /pricing URLs", () => {
      expect(pricingCrawler.canCrawl("https://linear.app/pricing")).toBe(true);
      expect(pricingCrawler.canCrawl("https://example.com/pricing/")).toBe(true);
      expect(pricingCrawler.canCrawl("https://example.com/pricing/enterprise")).toBe(true);
    });

    it("returns true for /plans URLs", () => {
      expect(pricingCrawler.canCrawl("https://example.com/plans")).toBe(true);
    });

    it("returns true for /price URLs", () => {
      expect(pricingCrawler.canCrawl("https://example.com/price")).toBe(true);
    });

    it("returns false for non-pricing URLs", () => {
      expect(pricingCrawler.canCrawl("https://example.com/features")).toBe(false);
      expect(pricingCrawler.canCrawl("https://example.com/about")).toBe(false);
      expect(pricingCrawler.canCrawl("https://example.com/")).toBe(false);
    });

    it("returns false for invalid URLs", () => {
      expect(pricingCrawler.canCrawl("not-a-url")).toBe(false);
    });
  });

  describe("interface compliance", () => {
    it("has name 'pricing'", () => {
      expect(pricingCrawler.name).toBe("pricing");
    });

    it("has sourceType 'pricing'", () => {
      expect(pricingCrawler.sourceType).toBe("pricing");
    });
  });

  describe("crawl (with fixture server)", () => {
    // These tests use a local HTTP server serving fixture HTML files.
    // Alternatively, mock fetch() to return fixture content.

    it("returns structured metadata alongside raw content", async () => {
      // Mock fetch to return Linear pricing HTML
      const result = await crawlWithFixture("linear.html");

      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].pageType).toBe("pricing");
      expect(result.pages[0].content).toBeTruthy();

      const pricing = result.pages[0].metadata?.structuredData as { pricing: PricingMetadata };
      expect(pricing.pricing.tiers.length).toBeGreaterThan(0);
      expect(pricing.pricing.hasFreeTier).toBe(true);
    });

    it("reports errors for failed fetches without crashing", async () => {
      // Mock fetch to return 404
      const result = await crawlWithError(404);

      expect(result.pages).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain("404");
    });

    it("includes timing information", async () => {
      const result = await crawlWithFixture("linear.html");

      expect(result.timing.startedAt).toBeLessThanOrEqual(result.timing.completedAt);
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    });
  });
});
```

## What This Does NOT Do

- **No LLM calls.** The parser is deterministic regex + heuristics. LLM interpretation stays in `extractRevenue`.
- **No multi-page crawling.** The pricing crawler fetches exactly one URL. Link discovery is the website crawler's job.
- **No `BaseCrawler` dependency.** This story does not depend on S004 (rate limiting, robots.txt). The pricing crawler is simple enough -- single page, single fetch -- that it doesn't need the base class infrastructure.
- **No modification to `extractRevenue.ts`.** The analysis pipeline can optionally consume the structured pricing metadata in a follow-up. This story delivers the crawler only.
- **No HTML rendering (JavaScript execution).** Some pricing pages are SPAs that require JS rendering. This crawler fetches static HTML. SPA support would require a headless browser and belongs in a separate story if needed.

## Alternatives Considered

1. **LLM-assisted parsing inside the crawler.** Rejected. Violates separation of concerns. The crawler is infrastructure; the LLM is analysis. Mixing them creates a dependency on API keys for basic crawling and makes tests non-deterministic.

2. **Reuse `cheerio` from the start.** Deferred. Regex-based parsing covers the common cases (price patterns, tier names, feature lists). The raw content serves as a fallback for the LLM. If fixture tests show poor extraction quality with regex alone, adding `cheerio` is a one-file change in `parser.ts`.

3. **Extend the `CrawledPage` type with a typed `pricingMetadata` field.** Rejected. The `structuredData: unknown` field already exists and is designed for crawler-specific metadata. Adding a typed field to the shared interface couples it to one crawler type.

4. **Make the crawler discover the pricing page from a root URL.** Rejected. That's the website crawler's job (S002). The pricing crawler takes a pricing URL directly. The registry's `getCrawlersFor(url)` mechanism handles discovery: the website crawler finds `/pricing` during its crawl, then the pricing crawler can be invoked specifically for that URL.

## Verification Steps

1. `pricingCrawler.canCrawl("https://linear.app/pricing")` returns `true`
2. `pricingCrawler.canCrawl("https://linear.app/features")` returns `false`
3. Parser extracts at least 3 tiers from Linear fixture with features and prices
4. Parser detects free tier from Notion fixture
5. Parser detects per-seat billing unit from Miro fixture
6. Parser returns empty tiers and zero confidence for non-pricing content
7. `crawl()` returns errors (not throws) for HTTP failures
8. `crawl()` includes timing information
9. All fixture tests pass with `vitest run`

## Success Criteria

All 6 acceptance criteria from the story TOML are met:
- [x] PricingCrawler implements the Crawler interface with sourceType `'pricing'`
- [x] `canCrawl()` returns true for URLs containing `/pricing`, `/plans`, or `/price`
- [x] Extracts tier names, prices, and billing periods from common pricing page layouts
- [x] Detects free tier presence and trial availability
- [x] Returns structured metadata alongside raw content
- [x] Tests use saved pricing page fixtures from 3+ real products
