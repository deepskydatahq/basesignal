# Extract Revenue Architecture from Pricing Pages — Design

## Overview

Create `convex/analysis/extractRevenue.ts` as an `internalAction` that fetches crawled pricing pages (with homepage/features fallback), sends them to Claude Haiku for structured extraction, and stores the revenue section on the product profile.

## Problem Statement

After a website scan completes, pricing information sits in crawled pages but isn't analyzed. This extractor turns pricing copy into a structured revenue model: model type, billing unit, free tier detection, pricing tiers, expansion paths, and contraction risks.

## Expert Perspectives

### Technical
- Two-tier page fetch: pricing pages first, fallback to homepage/features only when no pricing pages exist
- Mental model: "find the authoritative source first, backstop second"
- Don't supplement pricing pages with homepage context — creates ambiguity about which source is authoritative

### Simplification Review
- Removed tier feature cap from design (prompt tuning, not architecture)
- Simplified confidence guidance (one line instead of branching ranges)
- Kept evidence `field` tag in prompt (improves extraction quality, one-line strip before storage)
- Kept expansion/contraction paths (required by acceptance criteria and schema)

## Proposed Solution

```
extractRevenue (internalAction)
  ├── ctx.runQuery(internal.crawledPages.listByProductInternal, { productId })
  │     → filter to pageType === "pricing"
  │     → if empty, fallback to pageType in ["homepage", "features"]
  ├── Claude Haiku API call
  │     → system prompt: JSON schema + revenue-specific extraction rules
  │     → user prompt: truncated page content (~25KB each) with URL headers
  │     → returns structured JSON matching revenue schema
  └── ctx.runMutation(internal.productProfiles.updateSectionInternal, ...)
        → patches profile with section="revenue", recalculates completeness
```

## Design Details

### Files

| File | Change |
|------|--------|
| `convex/analysis/extractRevenue.ts` | New internalAction |
| `convex/crawledPages.ts` | Reuses `listByProductInternal` from S001 |
| `convex/productProfiles.ts` | Reuses `updateSectionInternal` from S001 |

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Page selection | Pricing-first, fallback to homepage/features | Required by acceptance criteria; authoritative source first |
| Model | Claude Haiku | Pattern matching over marketing copy, 80% cheaper |
| Model type | String with prompt guidance (9 common values) | Consistent extraction without rigid validation |
| billingUnit | Nullable | Some products don't expose billing unit |
| hasFreeTier | Includes free trials | From user perspective, access without payment = free tier |
| Expansion/contraction | Inferred from pricing structure | Not always explicit; LLM inference with examples in prompt |
| Confidence | Higher with dedicated pricing page, lower without | Signal quality varies by page type |
| Evidence | `field` tag in prompt, stripped before storage | Improves extraction quality; matches existing schema |

### Revenue Schema (from schema.ts)

```
{ model, billingUnit?, hasFreeTier, tiers[{name, price, features[]}],
  expansionPaths[], contractionRisks[], confidence, evidence[{url, excerpt}] }
```

### Error Handling

Throw on: no pages found, unparseable JSON, missing profile. No retries — caller responsible. Same pattern as S001.

## Alternatives Considered

- **Single fetch with priority sorting**: Rejected — two-tier is clearer and avoids fetching unnecessary data.
- **Always include homepage/features as supplement**: Rejected — creates ambiguity when pricing page exists.
- **Strict model enum validation in code**: Rejected — prompt guidance is sufficient, code validation adds brittleness.

## Success Criteria

- Extracts revenue model, tiers, billing unit, free tier flag, expansion/contraction paths from pricing pages
- Falls back to homepage/features when no pricing page found
- Confidence reflects data quality (pricing page vs inferred)
- Stores via updateSectionInternal, completeness recalculates
- Works as part of the analysis pipeline (called by orchestrator S007)
