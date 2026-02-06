# Orchestrate Analysis Pipeline After Scan Completion — Design

## Overview

Create `convex/analysis/orchestrate.ts` as an `internalAction` that runs all six analysis extractors after a scan completes. Independent extractors run in parallel, dependent ones chain after prerequisites, and errors in individual extractors don't block others.

## Problem Statement

After a website scan stores crawled pages, six analysis extractors (S001-S006) need to run to populate the product profile. Some are independent (identity, revenue, entities, outcomes), while others depend on upstream results (journey needs identity, metrics needs identity+revenue). The orchestrator coordinates this, handles errors gracefully, and updates scan status.

## Expert Perspectives

### Technical
Use internal mutations/queries (createInternal, updateSectionInternal, listByProductInternal) following the established `scanJobs.createInternal` pattern. The orchestrator is an internalAction — no user auth context. Mental model: internal=trust the caller, authenticated=verify ownership.

### Simplification Review
- Simplified two-wave framing to "parallel extraction with dependent chaining"
- Promise.allSettled is standard error handling, not a key architectural decision
- Pages fetched once and passed to extractors is a minor delivery change, not a contract shift

## Proposed Solution

```
scanning.startScan (after scanJobs.complete)
  └── scheduler.runAfter(0) → orchestrate.run({ productId, scanJobId })
        │
        ├── Mark scan "analyzing"
        ├── Create profile if absent (createInternal)
        ├── Fetch all crawled pages (listByProductInternal)
        │
        ├── Parallel: extractIdentity, extractRevenue, extractEntities, extractOutcomes
        │   (Promise.allSettled — errors logged, don't block others)
        │
        ├── After parallel completes:
        │   ├── extractJourney (if identity succeeded)
        │   └── suggestMetrics (if identity succeeded; revenue optional)
        │
        └── Mark scan "analyzed"
```

## Design Details

### Files

| File | Change |
|------|--------|
| `convex/scanning.ts` | Add `scheduler.runAfter` trigger after `scanJobs.complete()` (1 line) |
| `convex/productProfiles.ts` | Add `createInternal` internalMutation |
| `convex/productProfiles.ts` | Add `updateSectionInternal` internalMutation |
| `convex/productProfiles.ts` | Add `getInternal` internalQuery (for S004/S006 to read profile) |
| `convex/crawledPages.ts` | Add `listByProductInternal` internalQuery |
| `convex/analysis/orchestrate.ts` | New internalAction (~80 lines) |

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trigger mechanism | `ctx.scheduler.runAfter(0, ...)` after scan complete | Non-blocking, established Convex pattern |
| Action type | `internalAction` | Server-initiated, no user auth; matches extractor pattern |
| Page fetching | Once by orchestrator, passed to extractors | Avoids 4-6 redundant DB queries |
| Parallelism | Independent extractors run concurrently | 4 parallel LLM calls ≈ 15s vs 60s sequential |
| Dependency chaining | Wave 2 waits for wave 1 results | Journey needs identity.businessModel; metrics needs identity+revenue |
| Error isolation | Promise.allSettled + try/catch per extractor | AC8: partial profiles acceptable |
| Status flow | complete → analyzing → analyzed | AC7: scan status reflects analysis phase |

### Internal Helpers (3 new functions)

**`productProfiles.createInternal`** — internalMutation, creates profile if absent, returns ID:
```typescript
export const createInternal = internalMutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("productProfiles", {
      productId: args.productId,
      completeness: 0, overallConfidence: 0,
      createdAt: Date.now(), updatedAt: Date.now(),
    });
  },
});
```

**`productProfiles.updateSectionInternal`** — internalMutation, patches section + recalculates completeness:
```typescript
export const updateSectionInternal = internalMutation({
  args: { productId: v.id("products"), section: v.string(), data: v.any() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (!profile) throw new Error("Profile not found");
    await ctx.db.patch(profile._id, {
      [args.section]: args.data, updatedAt: Date.now(),
    });
    // Recalculate completeness
    const updated = await ctx.db.get(profile._id);
    if (updated) {
      const { completeness, overallConfidence } = calculateCompletenessAndConfidence(updated);
      await ctx.db.patch(profile._id, { completeness, overallConfidence });
    }
  },
});
```

**`crawledPages.listByProductInternal`** — internalQuery, fetches all pages for a product:
```typescript
export const listByProductInternal = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crawledPages")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();
  },
});
```

### Extractor Contract

Each extractor is an `internalAction` receiving `{ productId }`. Extractors fetch their own data as needed:
- Wave 1 extractors: receive `{ productId }`, call `listByProductInternal` internally to get pages
- Wave 2 extractors: receive `{ productId }`, call `getInternal` to read upstream results from profile

Each extractor stores its own section via `updateSectionInternal` and returns the extracted data.

### Status Flow

```
mapping → crawling → complete → analyzing → analyzed
```

No schema change needed — `status` is `v.string()`.

### Error Handling

- Wave 1: `Promise.allSettled` — each extractor wrapped independently
- If identity fails: skip journey and metrics (they need identity)
- If revenue fails: metrics still runs (uses identity alone, revenue optional per S006 design)
- If entities/outcomes fail: logged, continue
- Wave 2: try/catch per extractor, errors logged
- Final: mark "analyzed" regardless of individual failures
- Completeness naturally reflects filled sections (partial = lower score)

### Timing

- Wave 1: 4 parallel LLM calls × ~15s each = ~15s wall time
- Wave 2: 2 calls (1 LLM for journey, 1 pure code for metrics) = ~15s wall time
- Total: ~30s, well under 10-minute limit

## Alternatives Considered

- **Sequential extraction**: Rejected — 6 sequential LLM calls ≈ 90s vs ~30s parallel.
- **Separate scheduler calls per extractor**: Rejected — loses dependency chaining, harder to track completion.
- **Trigger from scanJobs.complete mutation**: Rejected — mutations can't call scheduler.runAfter for actions. Must trigger from the startScan action.
- **Each extractor fetches its own pages**: Considered but kept for simplicity — extractors call `listByProductInternal` themselves rather than receiving pages as arguments. Avoids serializing large page content through action arguments.

## Success Criteria

- Orchestrator triggered automatically after scan completes
- Profile created if absent
- Independent extractors (identity, revenue, entities, outcomes) run in parallel
- Dependent extractors (journey, metrics) chain after prerequisites
- Each section stored via updateSectionInternal with completeness recalculation
- Scan status: complete → analyzing → analyzed
- Individual extractor errors don't block others
- Total analysis under 10-minute Convex limit
