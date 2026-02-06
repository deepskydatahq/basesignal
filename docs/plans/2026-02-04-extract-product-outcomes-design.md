# Extract Product Outcomes from Marketing Content — Design

## Overview

Create `convex/analysis/extractOutcomes.ts` as an `internalAction` that fetches crawled homepage, features, and customers pages, sends them to Claude Haiku for structured extraction, and stores the outcomes section on the product profile.

## Problem Statement

After a website scan, marketing content contains explicit signals about the outcomes a product delivers — the jobs-to-be-done it promises to solve. Hero messaging, value propositions, and customer testimonials all articulate these outcomes at different levels of emphasis. This extractor turns that marketing copy into structured outcome data with type classification and feature linkage.

## Expert Perspectives

### Product
Classify outcome type by positioning hierarchy on the page rather than inferred business impact. Hero messaging = primary, below-fold value props = secondary, testimonial-only mentions = tertiary. This reflects how the company itself prioritizes outcomes in its market messaging, which is both more objectively extractable and more actionable. Product leaders want to understand "what is this competitor emphasizing and why" — let them judge business impact from clean positioning data.

### Simplification Review
- Tightened outcome type definitions (one line each instead of multi-sentence)
- Confirmed single-call approach is sufficient — outcomes are surface-level marketing copy
- Confirmed linkedFeatures as string array is correct — references feature names from marketing copy, not a structured entity

## Proposed Solution

```
extractOutcomes (internalAction)
  ├── ctx.runQuery(internal.crawledPages.listByProductInternal, { productId })
  │     → filter to pageType in ["homepage", "features", "customers"]
  ├── Claude Haiku API call (single pass, labeled sections)
  │     → system prompt: JSON schema + outcome type definitions + feature linkage rules
  │     → user prompt: labeled, truncated page content (~25KB each)
  └── ctx.runMutation(internal.productProfiles.updateSectionInternal, ...)
        → patches profile with section="outcomes", recalculates completeness
```

## Design Details

### Files

| File | Change |
|------|--------|
| `convex/analysis/extractOutcomes.ts` | New internalAction |
| `convex/crawledPages.ts` | Reuses `listByProductInternal` from S001 |
| `convex/productProfiles.ts` | Reuses `updateSectionInternal` from S001 |

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pass count | Single Haiku call | Outcomes are explicit in marketing copy; no cross-section reasoning needed |
| Page types | homepage, features, customers | Hero messaging (primary), feature descriptions (linkage), testimonials (tertiary) |
| Type classification | Positioning hierarchy: hero=primary, value-props=secondary, testimonial-only=tertiary | Reflects company's own prioritization; more objective than business impact inference |
| Model | Claude Haiku | Pattern matching over marketing copy, 80% cheaper than Sonnet |
| Feature linkage | String array of feature names from marketing copy | Not a structured entity reference; just names from the same pages |
| Evidence | Flat `[{ url, excerpt }]` with `field` tag in prompt, stripped before storage | Matches existing schema and S001-S004 pattern |
| Confidence | LLM-assigned, typically 0.6-0.8 | Marketing copy is explicit about outcomes |
| No customers page | Proceed with homepage + features only | Customers page is optional bonus signal |

### Outcome Type Definitions

- **primary**: Main job-to-be-done from hero messaging; exactly one per product
- **secondary**: Supporting outcomes from value prop sections and feature categories
- **tertiary**: Mentioned only in testimonials, case studies, or minor bullet points

### Output Schema

```typescript
{
  items: [{ description: string, type: "primary"|"secondary"|"tertiary", linkedFeatures: string[] }],
  confidence: number,
  evidence: [{ url: string, excerpt: string }]
}
```

### Error Handling

Throw on: no pages found, unparseable JSON, missing profile. No retries — caller responsible. Same pattern as S001-S004.

## Alternatives Considered

- **Two-pass (extract then classify)**: Rejected — outcomes are directly stated in marketing copy, classification by page position is a single-pass problem.
- **Business impact classification**: Rejected — requires inference that varies by industry, less reliable. Positioning hierarchy is objective.
- **Including pricing/about pages**: Rejected — pricing rarely states outcomes, about pages are company-focused. Homepage + features + customers covers outcome signals.
- **Reading identity section for context**: Rejected — outcome extraction works directly from marketing copy without prior context.

## Success Criteria

- Extracts outcomes from crawled pages as `{ description, type, linkedFeatures[] }` array
- Primary outcome captures the main job-to-be-done from hero messaging
- Outcomes linked to specific feature names where evidence exists
- Evidence includes URLs and excerpts from hero sections, value props, testimonials
- Stores via updateSectionInternal, completeness recalculates
- Works as part of the analysis pipeline (called by orchestrator S007)
