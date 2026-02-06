# Subdomain Crawl Pass Design

## Overview

Add automatic docs subdomain crawl that triggers when the main crawl discovers a docs URL (e.g., help.miro.com). This provides richer behavioral content for activation inference.

## Problem Statement

Main crawls discover docs subdomains but don't fetch their content. Docs/help sites often contain the richest onboarding and getting-started content describing user behaviors - exactly what we need for activation level inference.

## Expert Perspectives

### Product
- **Automatic triggering over on-demand** - If we discovered a docs subdomain, we found gold for activation analysis. Forcing users to remember and trigger a second crawl is disrespectful of their attention. The system should just work.
- **Clear feedback** - Show users the system is working intelligently ("Found help docs - extracting activation patterns from 8 pages")

### Technical
- **Separate scanJob, linked by productId only** - No parentJobId needed. The docs crawl is fundamentally a separate job on the same product. Temporal ordering provides implicit traceability.
- **Reuse shouldCrawlForActivation filter** - It's "activation-focused," not "main-crawl-specific." Works for docs sites too. If patterns are too narrow, improve the filter itself rather than bifurcating.
- **Trigger immediately after main crawl Step 6** - Runs in parallel with analysis pipeline. Two small, focused jobs that can fail or retry independently.

### Simplification Review
The initial design over-engineered with:
- A separate `startDocsCrawl` action (unnecessary API boundary)
- A `classifyDocsPageType` helper (duplicate of existing classifyPageType)
- A `type` field on scanJobs (implicit from context)
- Scheduler magic (obscures flow)

**Simplified approach:** Inline the docs crawl as a conditional branch within `startScan`, reusing existing infrastructure.

## Proposed Solution

After Step 6 (main crawl complete), if `discoveredDocs` is populated, execute a focused docs crawl inline:

1. Create a new scanJob for the docs crawl (linked to same productId)
2. Map the docs subdomain with Firecrawl
3. Filter URLs through `shouldCrawlForActivation` (from S001)
4. Limit to 10 pages maximum
5. Scrape and store pages with their natural pageType from `classifyPageType`

## Design Details

### Changes to scanning.ts

Add a conditional docs crawl block after Step 6:

```typescript
// After Step 6: main crawl complete, discoveredDocs populated
if (discoveredDocs) {
  const DOCS_PAGE_LIMIT = 10;

  // Create separate scanJob for docs (linked by productId only)
  const docsScanJobId = await ctx.runMutation(internal.scanJobs.create, {
    productId,
    status: "mapping",
    targetUrl: discoveredDocs,
  });

  // Map the docs site
  const docsMapResult = await firecrawlMap(discoveredDocs);

  // Filter to activation-relevant pages, limit to 10
  const docsUrls = docsMapResult.links
    .filter(shouldCrawlForActivation)  // from S001
    .slice(0, DOCS_PAGE_LIMIT);

  if (docsUrls.length > 0) {
    await ctx.runMutation(internal.scanJobs.update, {
      id: docsScanJobId,
      status: "scraping",
      discoveredUrls: docsUrls.length,
    });

    // Scrape pages
    const docsPages = await firecrawlScrape(docsUrls);

    // Store with natural pageType classification
    for (const page of docsPages) {
      const pageType = classifyPageType(page.url);  // existing function
      await ctx.runMutation(internal.crawledPages.store, {
        productId,
        scanJobId: docsScanJobId,
        url: page.url,
        content: page.content,
        pageType,
      });
    }
  }

  await ctx.runMutation(internal.scanJobs.update, {
    id: docsScanJobId,
    status: "completed",
    pagesCrawled: docsPages?.length ?? 0,
  });
}
```

### No schema changes needed

- scanJobs already has all required fields
- classifyPageType already handles docs/help/support URLs
- shouldCrawlForActivation comes from S001 dependency

### Flow

```
startScan(productId, websiteUrl)
  │
  ├─ Step 1-5: Main crawl (map, filter, scrape marketing pages)
  │
  ├─ Step 6: Complete, store discoveredDocs if found
  │
  └─ [if discoveredDocs exists]
       │
       ├─ Create new scanJob for docs
       ├─ Map docs subdomain
       ├─ Filter through shouldCrawlForActivation
       ├─ Limit to 10 pages
       ├─ Scrape and store pages
       └─ Complete docs scanJob
```

## Alternatives Considered

| Option | Description | Why Not |
|--------|-------------|---------|
| On-demand action | User triggers docs crawl separately | Adds friction, disrespects user attention |
| Flag-based param | `includeDocsSubdomain` param on startScan | Unnecessary config - if we find docs, crawl them |
| Scheduler trigger | `runAfter(0, startDocsCrawl)` | Obscures flow, adds API boundary |
| parentJobId linking | Link docs job to main job | Not needed - productId provides traceability |

## Success Criteria

1. When main crawl finds help.miro.com, docs pages appear in crawledPages
2. Docs pages are filtered to onboarding/getting-started content (max 10)
3. Docs pages have correct pageType from existing classification
4. Docs scanJob appears as separate entry linked to same product
5. Analysis pipeline has richer content for activation extraction

---
*Design via /brainstorm-auto · Task basesignal-5u5*
