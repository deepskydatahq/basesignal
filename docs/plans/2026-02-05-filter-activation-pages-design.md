# Filter Activation Pages Design

## Overview

Simple inline filtering logic for selecting activation-relevant pages from crawled content. Part of M002-E003 (Multi-Level Activation Extraction).

## Problem Statement

The activation level extractor needs to select the most relevant pages from a crawl for LLM analysis. Not all crawled pages contain activation signals - we need onboarding content, help docs, customer stories, and features pages prioritized over generic marketing content.

## Expert Perspectives

### Technical
- Code against the spec: include `onboarding` and `help` types even though E002 hasn't added them yet
- Per-page truncation (8000 chars) - caller decides total context budget
- Don't let integration tests drive architecture; let them reveal where APIs are needed

### Simplification Review
- Inline the 3-line filter predicate in the action rather than creating a separate module
- Extract only the reusable `truncateContent` utility to shared lib
- Follow the `extractIdentity.ts` pattern - all helpers in one file

## Proposed Solution

Instead of a separate `filterActivationPages` module, inline the filtering logic directly in the `extractActivationLevels` action (to be created in S004). Only extract the genuinely reusable `truncateContent` utility.

### Implementation

**In `extractActivationLevels.ts` (inline):**
```typescript
const ACTIVATION_PRIORITY = ['onboarding', 'help', 'customers', 'features', 'homepage'];

const activationPages = pages
  .filter(p => ACTIVATION_PRIORITY.includes(p.pageType))
  .sort((a, b) =>
    ACTIVATION_PRIORITY.indexOf(a.pageType) - ACTIVATION_PRIORITY.indexOf(b.pageType)
  );
```

**Shared utility (if not already in extractIdentity.ts):**
```typescript
// convex/lib/truncateContent.ts (or reuse from extractIdentity)
export const MAX_CONTENT_PER_PAGE = 8000;

export function truncateContent(content: string, maxLength: number = MAX_CONTENT_PER_PAGE): string {
  if (content.length <= maxLength) return content;
  const truncated = content.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > maxLength * 0.8
    ? truncated.slice(0, lastSpace) + '...'
    : truncated + '...';
}
```

## Alternatives Considered

1. **Separate filterActivationPages module** - Rejected. Too small (5-8 lines) to warrant dedicated module. Creates unnecessary abstraction.

2. **Shared extractorUtils.ts** - Deferred. Only extract utilities when genuinely needed by multiple extractors. Currently `truncateContent` is the only candidate.

## Success Criteria

1. Activation extractor receives prioritized pages: onboarding > help > customers > features > homepage
2. Each page content is truncated to MAX_CONTENT_PER_PAGE (8000 chars)
3. Non-activation page types (pricing, about, etc.) are excluded
4. Tests document the dependency on future page types (onboarding, help from E002)

## Dependencies

- **E002 stories** (basesignal-v8s, basesignal-wze) will add `onboarding` and `help` page types to the classifier
- Until E002 completes, the filter will only match existing types: `customers`, `features`, `homepage`

---
*Design for Story M002-E003-S003 · Created via /brainstorm-auto*
