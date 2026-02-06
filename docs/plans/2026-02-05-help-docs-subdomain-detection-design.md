# Help/Docs Subdomain Detection Design

## Overview

Extend URL classification to detect help/docs/support subdomains and create a filter for activation-focused crawling. This enables discovering activation-relevant content from documentation sites.

## Problem Statement

The current crawler skips help/docs subdomains entirely. For activation analysis, we need to:
1. Classify these subdomains by type (help, docs, support)
2. Filter to onboarding/getting-started content within them
3. Collect all discovered docs URLs (not just one)

## Expert Perspectives

### Product
Keep activation discovery separate from marketing crawling. Product leaders should be able to analyze activation independently. The efficiency of one crawl pass is negligible compared to clarity of purpose.

### Technical
Create separate functions for separate concerns. Marketing crawling wants breadth; activation crawling wants specific subdomains and onboarding-focused paths. Make the distinction explicit in function names.

### Simplification Review
- Leverage existing `isDocsSite()` for detection logic
- Keep `shouldCrawlForActivation` minimal - just what's needed for acceptance criteria
- Don't over-engineer path filtering until real usage shows what's needed

## Proposed Solution

Three minimal changes to `convex/lib/urlUtils.ts`:

### 1. Extend classifyPageType (Criteria 1-3)

Add 3 lines after existing subdomain checks (line 107):

```typescript
if (hostname.startsWith("help.")) return "help";
if (hostname.startsWith("docs.")) return "docs";
if (hostname.startsWith("support.")) return "support";
```

### 2. Create shouldCrawlForActivation (Criteria 4-5)

New function that reuses existing `DOCS_HOSTNAME_PREFIXES`:

```typescript
const ACTIVATION_PATH_PATTERNS = [
  /getting-started/i,
  /onboarding/i,
  /quick-?start/i,
  /first-steps/i,
  /tutorial/i,
];

export function shouldCrawlForActivation(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    // Must be a docs-type subdomain
    const isDocsSubdomain = DOCS_HOSTNAME_PREFIXES.some(
      prefix => hostname.startsWith(prefix)
    );
    if (!isDocsSubdomain) return false;

    // Root paths are always valuable
    if (path === "/" || path === "") return true;

    // Filter to activation-relevant paths
    return ACTIVATION_PATH_PATTERNS.some(pattern => pattern.test(path));
  } catch {
    return false;
  }
}
```

### 3. Update filterHighValuePages (Criterion 6)

Change return type and collect all docs URLs:

```typescript
export function filterHighValuePages(urls: string[], rootUrl: string): {
  targetUrls: string[];
  docsUrls: string[];  // Changed from docsUrl: string | undefined
}
```

Collect URLs using existing `isDocsSite()`:
```typescript
const docsUrls: string[] = [];

// In the filtering loop:
if (isDocsSite(url)) {
  const host = new URL(url).hostname;
  if (!docsUrls.some(u => new URL(u).hostname === host)) {
    docsUrls.push(url);
  }
}

return { targetUrls: deduped.slice(0, MAX_PAGES), docsUrls };
```

## Alternatives Considered

1. **Add option to filterHighValuePages** - Rejected. Couples marketing and activation concerns through implicit configuration.

2. **Create filterActivationPages function** - Deferred. Not needed for this story; `shouldCrawlForActivation` is sufficient for filtering URLs once discovered.

3. **Keep docsUrl singular** - Rejected. Story explicitly requires plural to capture multiple docs subdomains (help.example.com, docs.example.com, etc.).

## Success Criteria

All acceptance criteria from the story:

1. [unit] classifyPageType returns 'help' for help.example.com URLs
2. [unit] classifyPageType returns 'docs' for docs.example.com URLs
3. [unit] classifyPageType returns 'support' for support.example.com URLs
4. [unit] shouldCrawlForActivation returns true for help/docs subdomains
5. [unit] shouldCrawlForActivation filters to getting-started/onboarding paths
6. [integration] filterHighValuePages includes help.miro.com in docsUrls

## Files to Modify

- `convex/lib/urlUtils.ts` - All three changes
- `convex/lib/urlUtils.test.ts` - Add tests for new functionality

---
*Design: M002-E002-S001 · Created via /brainstorm-auto*
