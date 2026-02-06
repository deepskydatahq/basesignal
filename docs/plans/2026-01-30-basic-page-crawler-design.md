# Basic Page Crawler Design

## Overview

Implement website crawling for the `scan_product(url)` MCP tool using Firecrawl's API. Uses a two-step approach: map the site to discover URLs, then selectively crawl high-value pages. Crawled content (markdown) is stored in Convex for downstream LLM analysis.

## Problem Statement

When a user provides their product's URL, Basesignal needs to crawl the marketing site and extract content that can be analyzed by the LLM pipeline. The crawl should be fast (~30-90 seconds), focused on high-value pages, and produce clean LLM-ready content.

## Proposed Solution

### Two-Step Crawl: Map → Selective Crawl

**Step 1: Map** (fast, ~2-5 seconds)
- Call Firecrawl's `/map` endpoint with the root URL
- Returns a list of all discoverable URLs on the domain
- Cost: 1 credit

**Step 2: Filter & Classify**
- Classify discovered URLs by likely page type based on URL patterns:
  - **Must crawl**: homepage, `/pricing`, `/features`, `/about`, `/product`
  - **Should crawl**: `/customers`, `/use-cases`, `/solutions`, `/integrations`, `/security`
  - **Skip**: `/blog/*` (unless few total pages), `/legal`, `/privacy`, `/terms`, `/careers`, `/press`
  - **Flag for later**: `/docs/*`, `docs.*` subdomain (Extended Sources, Epic 6)
- Limit to ~20-30 pages max (quality over quantity)

**Step 3: Crawl** (~20-60 seconds)
- Call Firecrawl's `/crawl` endpoint with the filtered URL list
- Returns markdown content per page
- Cost: 1 credit per page

### Firecrawl Integration

```typescript
// Firecrawl SDK usage
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

// Step 1: Map
const mapResult = await firecrawl.map(url);
// Returns: { urls: string[] }

// Step 2: Filter (our logic)
const targetUrls = filterHighValuePages(mapResult.urls);

// Step 3: Crawl
const crawlResult = await firecrawl.crawl(url, {
  includePaths: targetUrls,
  limit: 30,
  scrapeOptions: {
    formats: ['markdown'],
  },
});
// Returns: { data: [{ url, markdown, metadata }] }
```

### Data Flow

```
User: scan_product("https://acme.io")
  │
  ├─ 1. Create scanJob (status: "mapping")
  ├─ 2. Firecrawl map("https://acme.io")
  │     → Discover 87 URLs
  ├─ 3. Filter to 25 high-value pages
  │     Update scanJob (status: "crawling", pagesTotal: 25)
  ├─ 4. Firecrawl crawl with filtered URLs
  │     → Get markdown for each page
  ├─ 5. Store each page in crawledPages table
  │     Update scanJob progress as pages complete
  ├─ 6. Classify pages (homepage, pricing, features, etc.)
  │     Flag discovered doc site, pricing page
  ├─ 7. Update scanJob (status: "complete")
  │
  └─ Return: scanJob ID + summary
```

### Convex Schema Addition

```typescript
// New table: crawledPages
crawledPages: defineTable({
  productId: v.id("products"),
  scanJobId: v.id("scanJobs"),
  url: v.string(),
  pageType: v.string(),           // "homepage" | "pricing" | "features" | "about" | "customers" | "other"
  title: v.optional(v.string()),
  content: v.string(),            // Markdown content from Firecrawl
  contentLength: v.number(),      // Character count (for quick filtering)
  metadata: v.optional(v.object({
    description: v.optional(v.string()),
    ogImage: v.optional(v.string()),
    structuredData: v.optional(v.string()), // JSON-LD if present
  })),
  crawledAt: v.number(),
})
  .index("by_product", ["productId"])
  .index("by_scan_job", ["scanJobId"])
  .index("by_product_type", ["productId", "pageType"])
```

### URL Classification Logic

```typescript
function classifyPageType(url: string): string {
  const path = new URL(url).pathname.toLowerCase();

  if (path === '/' || path === '') return 'homepage';
  if (path.includes('pricing') || path.includes('plans')) return 'pricing';
  if (path.includes('feature') || path.includes('product')) return 'features';
  if (path.includes('about') || path.includes('company')) return 'about';
  if (path.includes('customer') || path.includes('case-stud')) return 'customers';
  if (path.includes('integrat')) return 'integrations';
  if (path.includes('security') || path.includes('compliance')) return 'security';
  if (path.includes('solution') || path.includes('use-case')) return 'solutions';
  return 'other';
}

function shouldCrawl(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  const skipPatterns = [
    '/blog/', '/press/', '/careers/', '/jobs/',
    '/legal/', '/privacy/', '/terms/', '/cookie/',
    '/login', '/signup', '/register',
    '.pdf', '.png', '.jpg', '.svg',
  ];
  return !skipPatterns.some(p => path.includes(p));
}
```

### MCP Tool Interface

```typescript
// scan_product tool
{
  name: "scan_product",
  description: "Crawl a product website and generate a draft profile",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The product's website URL" },
    },
    required: ["url"],
  },
}

// Returns immediately with job ID
// { jobId: "...", message: "Scanning acme.io — found 87 URLs, crawling 25 high-value pages..." }
```

The scan runs asynchronously. The MCP tool returns immediately with a job ID. The AI assistant can then poll `get_scan_status(jobId)` (Story 2.6) or wait for a notification.

### Async Execution

The crawl runs as a Convex action (not a mutation — actions can make external HTTP calls):

```typescript
// convex/scanning.ts
export const startScan = action({
  args: { productId: v.id("products"), url: v.string() },
  handler: async (ctx, args) => {
    // 1. Create scanJob via mutation
    const jobId = await ctx.runMutation(internal.scanJobs.create, { ... });

    // 2. Map the site
    const mapResult = await firecrawl.map(args.url);

    // 3. Filter URLs
    const targetUrls = filterHighValuePages(mapResult.urls);

    // 4. Update job with page count
    await ctx.runMutation(internal.scanJobs.updateProgress, {
      jobId, status: "crawling", pagesTotal: targetUrls.length,
    });

    // 5. Crawl
    const crawlResult = await firecrawl.crawl(args.url, {
      includePaths: targetUrls,
      limit: 30,
      scrapeOptions: { formats: ['markdown'] },
    });

    // 6. Store pages
    for (const page of crawlResult.data) {
      await ctx.runMutation(internal.crawledPages.store, {
        productId: args.productId,
        scanJobId: jobId,
        url: page.url,
        pageType: classifyPageType(page.url),
        title: page.metadata?.title,
        content: page.markdown,
        contentLength: page.markdown.length,
      });
    }

    // 7. Mark complete
    await ctx.runMutation(internal.scanJobs.complete, { jobId });

    return { jobId };
  },
});
```

### Content Size Handling

- Typical marketing page markdown: 2-20KB
- Convex document limit: 1MB
- If a page exceeds 100KB of markdown, truncate to first 100KB (extremely rare for marketing pages)
- Store `contentLength` for quick filtering during analysis

### Error Handling

- **Invalid URL**: Validate URL format before calling Firecrawl. Return clear error.
- **Site unreachable**: Firecrawl returns error → mark scanJob as failed with message.
- **Rate limit**: Firecrawl free tier is 100 RPM. Unlikely to hit but handle gracefully with retry.
- **Partial failure**: If some pages fail to crawl, continue with what we have. Note failures in scanJob.
- **Timeout**: Convex actions have a 10-minute timeout. A 30-page crawl should complete well within this.

### Cost Analysis

| Scenario | Map Credits | Crawl Credits | Total Credits | Cost (Hobby) |
|----------|------------|---------------|---------------|---------------|
| Small site (10 pages) | 1 | 10 | 11 | $0.06 |
| Typical site (25 pages) | 1 | 25 | 26 | $0.13 |
| Large site (50 pages) | 1 | 50 | 51 | $0.26 |

Hobby plan ($16/month) gives 3,000 credits ≈ 115 typical scans/month. Sufficient for MVP.

### Dependencies

| Package | Purpose |
|---------|---------|
| `@mendable/firecrawl-js` | Firecrawl SDK |

Environment variable: `FIRECRAWL_API_KEY`

## Alternatives Considered

### Jina Reader + custom crawl
Jina Reader extracts single pages well but has no multi-page crawling. We'd need to build link discovery, queue management, depth limiting, and robots.txt parsing. More code, more maintenance, for marginal cost savings.

### Playwright/Puppeteer self-hosted
Full control, no API costs, but requires managing headless browser infrastructure, handling JS rendering edge cases, and building the entire extraction pipeline. Significant operational burden for a solo founder.

### Firecrawl map + Jina read (hybrid)
Use Firecrawl for URL discovery, Jina for content extraction. Potentially better extraction quality on some pages, but two API dependencies and more complex integration. Not worth the added complexity for MVP.

## Open Questions

1. **Firecrawl crawl vs. batch scrape**: Firecrawl's `/crawl` auto-discovers pages. We could alternatively use `/map` + `/batch/scrape` for more control over exactly which URLs get scraped. Need to test which gives better results.
2. **Convex action timeout**: Verify that a 30-page crawl completes within Convex's action timeout limit. May need to break into smaller batches if not.
3. **Re-scan behavior**: When scanning a product that already has crawled data, should we replace or append? Likely replace (delete old crawledPages, create new ones).

## Success Criteria

- `scan_product(url)` initiates a crawl and returns a job ID
- Firecrawl maps the site and discovers relevant pages
- High-value pages are selectively crawled (skip blog, legal, etc.)
- Markdown content is stored in Convex for each crawled page
- Pages are classified by type (homepage, pricing, features, etc.)
- Documentation sites are detected and flagged for later (Epic 6)
- Scan completes in under 90 seconds for a typical marketing site
- Crawl progress is trackable via scanJob status updates
