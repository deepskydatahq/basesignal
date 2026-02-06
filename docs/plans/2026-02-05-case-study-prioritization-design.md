# Case Study Page Prioritization Design

## Overview

Enhance URL classification to recognize additional case study URL patterns and allow multiple customer pages (up to 3) to be captured during crawls, promoting them to the highest priority tier.

## Problem Statement

Case studies contain valuable success metrics (outcomes, ROI, behaviors) but the current crawler:
1. Only recognizes limited URL patterns (`/customers`, `/case-studies`, `/stories`)
2. Keeps only 1 page per type due to deduplication
3. Treats customers as SHOULD_CRAWL (lower priority)

## Expert Perspectives

### Technical
- Use counter-based deduplication with a Map instead of Set to track per-type counts
- Keep it simple: inline counting, no helper functions
- The constraint should be explicit in code (`MAX_CUSTOMERS = 3`)

### Simplification Review
- Removed proposed helper functions (`canAddType`, `addWithType`) - overkill for a counting operation
- Removed `DEFAULT_MAX_PER_TYPE` constant - use inline ternary
- Core approach is sound; implementation just needed to be leaner

## Proposed Solution

Three targeted changes to `convex/lib/urlUtils.ts`:

### 1. Expand Customer Path Patterns

**Current:**
```typescript
if (path.match(/^\/(customers?|case-studies?|stories)(\/|$)/)) return "customers";
```

**Updated:**
```typescript
if (path.match(/^\/(customers?|case-studies?|stories|success-stories?|testimonials?|results)(\/|$)/)) return "customers";
```

### 2. Promote Customers to MUST_CRAWL_TYPES

**Current:**
```typescript
const MUST_CRAWL_TYPES = ["homepage", "pricing", "features", "about", "enterprise"];
const SHOULD_CRAWL_TYPES = ["customers", "integrations", "security", "solutions", "whiteboard"];
```

**Updated:**
```typescript
const MUST_CRAWL_TYPES = ["homepage", "pricing", "features", "about", "enterprise", "customers"];
const SHOULD_CRAWL_TYPES = ["integrations", "security", "solutions", "whiteboard"];
```

### 3. Counter-Based Deduplication (Simplified)

Replace Set-based deduplication with inline Map counting:

```typescript
const MAX_CUSTOMERS = 3;
const typeCounts = new Map<string, number>();
const deduped: string[] = [];

for (const { url, type } of mustCrawl) {
  const count = typeCounts.get(type) ?? 0;
  const limit = type === "customers" ? MAX_CUSTOMERS : 1;
  if (MUST_CRAWL_TYPES.includes(type) && count >= limit) continue;
  typeCounts.set(type, count + 1);
  deduped.push(url);
}

for (const { url, type } of shouldCrawlUrls) {
  const count = typeCounts.get(type) ?? 0;
  const limit = type === "customers" ? MAX_CUSTOMERS : 1;
  if (SHOULD_CRAWL_TYPES.includes(type) && count >= limit) continue;
  typeCounts.set(type, count + 1);
  deduped.push(url);
}
```

## Alternatives Considered

1. **Special-case counter for customers only** - Rejected because it hides the mental model. A Map with explicit counts is clearer even if customers is the only type with limit > 1.

2. **Helper functions for counting** - Rejected by simplification review as unnecessary abstraction for inline counting.

## Success Criteria

| Criteria | Implementation |
|----------|----------------|
| classifyPageType returns 'customers' for /success-stories | Pattern expansion |
| classifyPageType returns 'customers' for /testimonials | Pattern expansion |
| classifyPageType returns 'customers' for /results | Pattern expansion |
| filterHighValuePages allows up to 3 customer pages | MAX_CUSTOMERS + Map counting |
| Customer pages promoted to MUST_CRAWL_TYPES | Move in array |
| Crawling miro.com captures multiple case studies | Integration test |

## Files Modified

1. `convex/lib/urlUtils.ts` - All three changes
2. `convex/lib/urlUtils.test.ts` - Unit tests for acceptance criteria
