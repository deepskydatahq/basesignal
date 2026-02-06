# Onboarding URL Patterns Design

## Overview

Add onboarding page type recognition to `classifyPageType()` and include it in `MUST_CRAWL_TYPES`. Onboarding content describes first-time user experience and conversion moments—exactly what activation levels measure.

## Problem Statement

The URL classifier doesn't recognize onboarding-related paths (`/getting-started`, `/onboarding`, `/quick-start`, `/first-steps`). These pages contain behavioral descriptions of what users should DO, which is critical for activation level inference.

## Expert Perspectives

### Product
Onboarding paths describe the first-time user experience and conversion moments—behavioral pivot points that directly map to activation levels. These are distinct from tutorial/docs content which is reference material.

### Technical
Keep clean separation between `classifyPageType()` (crawl priority) and `isDocsSite()` (routing). Don't add `/learn` or `/tutorials` since they're doc-like content already handled by `isDocsSite()`. Onboarding is genuinely distinct and belongs in the main crawl pipeline.

### Simplification Review
The onboarding addition is inevitable and clean. The design correctly excludes tutorials (diverging from task guidance) based on sound reasoning. Minor enhancement: add test coverage for edge cases like `/docs/getting-started` to verify docs paths take precedence.

## Proposed Solution

### 1. Add onboarding pattern to `classifyPageType()`

In `convex/lib/urlUtils.ts`, add before the final `return "other"`:

```typescript
// Onboarding content - first-time user experience and activation moments
if (path.match(/^\/(getting-started|onboarding|quick-start|first-steps)(\/|$)/)) return "onboarding";
```

### 2. Add "onboarding" to MUST_CRAWL_TYPES

```typescript
const MUST_CRAWL_TYPES = ["homepage", "pricing", "features", "about", "enterprise", "onboarding"];
```

### 3. Unit tests

Test each path pattern:
- `/getting-started`, `/getting-started/`, `/getting-started/step-1`
- `/onboarding`, `/onboarding/`, `/onboarding/welcome`
- `/quick-start`, `/quick-start/`, `/quick-start/install`
- `/first-steps`, `/first-steps/`, `/first-steps/setup`

Negative tests:
- `/getting-started-guide` should NOT match (partial segment)
- `/my-onboarding` should NOT match (partial segment)

### 4. Integration test

Verify `filterHighValuePages` prioritizes onboarding content over 'other' pages.

## Alternatives Considered

**Including "tutorial" type for `/tutorials` and `/learn`:** Rejected. These paths contain reference material (process flows, how-to guides) rather than behavioral signals about activated states. The existing `isDocsSite()` mechanism with `DOCS_PATH_PREFIXES` already handles this category. This maintains a cleaner mental model: `MUST_CRAWL_TYPES` = behavioral pivot points, `isDocsSite()` = reference material.

## Success Criteria

1. `classifyPageType` returns `'onboarding'` for all four path patterns
2. Onboarding pages appear in `MUST_CRAWL_TYPES` priority tier
3. `filterHighValuePages` prioritizes onboarding content over 'other' pages
4. All existing tests continue to pass

---
*Brainstormed via /brainstorm-auto on 2026-02-05*
