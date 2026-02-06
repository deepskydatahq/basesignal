# Extract Core Identity from Crawled Pages — Design

## Overview

Create `convex/analysis/extractIdentity.ts` as an `internalAction` that fetches crawled homepage/about/features pages, sends them to Claude Haiku for structured extraction, and stores the identity section on the product profile.

## Problem Statement

When a website scan completes, the crawled page content sits in the database but isn't analyzed. This action bridges the gap — turning raw marketing copy into a structured product identity (name, description, target customer, business model) with evidence and confidence scoring.

## Expert Perspectives

### Product
The identity extraction is the foundation for all other analysis — it establishes who the product is and who it serves. Getting this right matters more than getting it fast.

### Technical
- Use `internalAction` + `internalMutation` + `internalQuery` for the full server-side pipeline (Convex actions can't access `ctx.db` directly)
- Use Haiku for extraction (pattern matching over marketing copy, not reasoning)
- Truncate pages to ~25KB each to keep costs down and avoid noise
- Flat evidence array matching existing schema; `field` tag in prompt only

### Simplification Review
- Confidence scoring: inline prompt guidance, not a framework
- Error handling: standard throws, no retries (caller responsible)
- Prompts: inline, not componentized
- Kept `analysis/` directory because 6 more extractors (S002-S007) are planned

## Proposed Solution

```
extractIdentity (internalAction)
  ├── ctx.runQuery(internal.crawledPages.listByProductInternal, { productId })
  │     → filter to pageType in ["homepage", "about", "features"]
  ├── Claude Haiku API call
  │     → system prompt: JSON schema + confidence guide + evidence rules
  │     → user prompt: truncated page content with URL headers
  │     → returns structured JSON
  └── ctx.runMutation(internal.productProfiles.updateSectionInternal, ...)
        → patches profile, recalculates completeness
```

## Design Details

### New/Modified Files

| File | Change |
|------|--------|
| `convex/crawledPages.ts` | Add `listByProductInternal` internalQuery |
| `convex/productProfiles.ts` | Add `updateSectionInternal` internalMutation |
| `convex/analysis/extractIdentity.ts` | New internalAction |

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Action type | `internalAction` | Server-initiated, no user auth |
| Storage | `internalMutation` | Auth-free; Convex actions can't use public mutations without auth context |
| Model | Claude Haiku | Pattern matching, 80% cheaper than Sonnet |
| Truncation | 25KB per page | Sufficient for marketing copy, keeps cost down |
| Evidence | Flat `[{ url, excerpt }]` | Matches existing schema; `field` used in prompt only |
| Confidence | LLM-assigned 0-1 | Inline guidance in prompt |
| Directory | `convex/analysis/` | 6 sibling extractors planned (S002-S007) |

### Evidence Flow

LLM returns `{ field, url, excerpt }` per entry → strip `field` before storage → stored as `[{ url, excerpt }]` matching existing `evidenceValidator`.

### Error Handling

Throw on: no pages found, unparseable JSON, missing profile. No retries — caller is responsible.

## Alternatives Considered

- **Regular action instead of internalAction**: Rejected — no user auth context available when triggered from scan pipeline.
- **Sonnet instead of Haiku**: Rejected — extraction is pattern matching, Haiku is sufficient and cheaper.
- **Per-field nested evidence**: Rejected — doesn't match existing schema, adds complexity.

## Success Criteria

- Extracts identity from crawled pages with evidence and confidence
- Stores via internal mutation, completeness recalculates
- Works as part of the analysis pipeline (called by orchestrator S007)
