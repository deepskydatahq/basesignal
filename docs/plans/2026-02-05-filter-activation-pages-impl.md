# Filter Activation Pages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement `filterActivationPages` and `buildActivationPageContext` functions for the activation level extraction pipeline.

**Architecture:** Add filtering and context-building functions to a new `extractActivationLevels.ts` file in `convex/analysis/`. The filter prioritizes page types (onboarding > help > customers > features > homepage). Reuses `truncateContent` from `extractIdentity.ts`. The functions will be consumed by S004 (the main extractor action).

**Tech Stack:** TypeScript, Vitest for testing

---

## Background

This implements Story M002-E003-S003. The design doc (`docs/plans/2026-02-05-filter-activation-pages-design.md`) concluded that we should inline the filtering logic in `extractActivationLevels.ts` rather than creating a separate module.

**Key patterns from `extractIdentity.ts`:**
- `filterIdentityPages()` - filters by page type
- `truncateContent()` - truncates content at newlines with `[Content truncated]` marker
- `buildPageContext()` - formats pages with headers and manages total content budget

**Page types to include (in priority order):**
1. `onboarding` - highest signal for activation behaviors (future, from E002)
2. `help` - documentation often describes activation steps (future, from E002)
3. `customers` - case studies reveal what activated users look like
4. `features` - feature pages describe value-delivery behaviors
5. `homepage` - fallback for general value proposition

**Note:** `onboarding` and `help` page types don't exist yet in the crawler (E002 will add them). Tests should document this dependency.

---

### Task 1: Create extractActivationLevels.ts with filterActivationPages

**Files:**
- Create: `convex/analysis/extractActivationLevels.ts`
- Create: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test for filterActivationPages**

Create `convex/analysis/extractActivationLevels.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { filterActivationPages } from "./extractActivationLevels";

describe("filterActivationPages", () => {
  it("filters to activation-relevant page types", () => {
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://x.io" },
      { pageType: "features", content: "Features", url: "https://x.io/features" },
      { pageType: "customers", content: "Customers", url: "https://x.io/customers" },
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
      { pageType: "about", content: "About", url: "https://x.io/about" },
    ];

    const result = filterActivationPages(pages);

    expect(result).toHaveLength(3);
    expect(result.map((p) => p.pageType)).toEqual(["customers", "features", "homepage"]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run convex/analysis/extractActivationLevels.test.ts`

Expected: FAIL with "Cannot find module" or similar (file doesn't exist)

**Step 3: Write minimal implementation**

Create `convex/analysis/extractActivationLevels.ts`:

```typescript
/**
 * Activation levels extraction utilities.
 * Filters and formats crawled pages for activation signal extraction.
 */

// Page types relevant for activation extraction, in priority order
const ACTIVATION_PRIORITY = ["onboarding", "help", "customers", "features", "homepage"] as const;

type PageInput = { pageType: string; content: string; url: string; title?: string };

/**
 * Filter crawled pages to those relevant for activation level extraction.
 * Returns pages sorted by priority: onboarding > help > customers > features > homepage.
 *
 * Note: "onboarding" and "help" page types will be added by E002 stories.
 * Until then, only customers/features/homepage are matched.
 */
export function filterActivationPages(pages: PageInput[]): PageInput[] {
  return pages
    .filter((p) => ACTIVATION_PRIORITY.includes(p.pageType as typeof ACTIVATION_PRIORITY[number]))
    .sort(
      (a, b) =>
        ACTIVATION_PRIORITY.indexOf(a.pageType as typeof ACTIVATION_PRIORITY[number]) -
        ACTIVATION_PRIORITY.indexOf(b.pageType as typeof ACTIVATION_PRIORITY[number])
    );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run convex/analysis/extractActivationLevels.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add filterActivationPages for activation extraction

Filters crawled pages to activation-relevant types and sorts by priority:
onboarding > help > customers > features > homepage.

Part of M002-E003-S003.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add test for empty input handling

**Files:**
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test**

Add to the describe block:

```typescript
  it("returns empty array when no matching pages", () => {
    const pages = [
      { pageType: "pricing", content: "Pricing", url: "https://x.io/pricing" },
      { pageType: "about", content: "About", url: "https://x.io/about" },
    ];

    expect(filterActivationPages(pages)).toHaveLength(0);
  });

  it("handles empty input", () => {
    expect(filterActivationPages([])).toHaveLength(0);
  });
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --run convex/analysis/extractActivationLevels.test.ts`

Expected: PASS (implementation already handles these cases)

**Step 3: Commit**

```bash
git add convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
test(analysis): add edge case tests for filterActivationPages

Tests empty input and no-matching-pages scenarios.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add test for future page types (onboarding, help)

**Files:**
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the test documenting E002 dependency**

Add to the describe block:

```typescript
  it("prioritizes onboarding and help when available (E002 dependency)", () => {
    // Note: onboarding and help page types will be added by E002 stories
    // (basesignal-v8s, basesignal-wze). This test documents expected behavior.
    const pages = [
      { pageType: "homepage", content: "Home", url: "https://x.io" },
      { pageType: "features", content: "Features", url: "https://x.io/features" },
      { pageType: "onboarding", content: "Onboarding", url: "https://x.io/onboarding" },
      { pageType: "help", content: "Help", url: "https://help.x.io" },
      { pageType: "customers", content: "Customers", url: "https://x.io/customers" },
    ];

    const result = filterActivationPages(pages);

    expect(result).toHaveLength(5);
    // Priority: onboarding > help > customers > features > homepage
    expect(result.map((p) => p.pageType)).toEqual([
      "onboarding",
      "help",
      "customers",
      "features",
      "homepage",
    ]);
  });
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --run convex/analysis/extractActivationLevels.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
test(analysis): document E002 dependency for onboarding/help page types

Tests verify priority ordering will work once E002 adds onboarding and help
page types to the crawler.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Add buildActivationPageContext function

**Files:**
- Modify: `convex/analysis/extractActivationLevels.ts`
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the failing test**

Add new describe block to test file:

```typescript
import { filterActivationPages, buildActivationPageContext } from "./extractActivationLevels";

describe("buildActivationPageContext", () => {
  it("formats pages with headers and content", () => {
    const pages = [
      { pageType: "customers", content: "Case study content", url: "https://x.io/customers", title: "Customer Stories" },
    ];

    const result = buildActivationPageContext(pages);

    expect(result).toContain("--- PAGE: Customer Stories (customers) ---");
    expect(result).toContain("URL: https://x.io/customers");
    expect(result).toContain("Case study content");
  });

  it("falls back to URL when title is missing", () => {
    const pages = [
      { pageType: "features", content: "Features", url: "https://x.io/features" },
    ];

    const result = buildActivationPageContext(pages);

    expect(result).toContain("--- PAGE: https://x.io/features (features) ---");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run convex/analysis/extractActivationLevels.test.ts`

Expected: FAIL with "buildActivationPageContext is not exported"

**Step 3: Write minimal implementation**

Add to `convex/analysis/extractActivationLevels.ts`:

```typescript
// Import truncateContent from extractIdentity (it's already exported)
import { truncateContent } from "./extractIdentity";

// Maximum characters per page for activation context
const MAX_CONTENT_PER_PAGE = 8_000;
const MAX_TOTAL_CONTENT = 30_000;

/**
 * Build the context string from pages for the LLM prompt.
 * Each page is formatted with URL, type, and truncated content.
 */
export function buildActivationPageContext(pages: PageInput[]): string {
  let totalLength = 0;
  const sections: string[] = [];

  for (const page of pages) {
    const remaining = MAX_TOTAL_CONTENT - totalLength;
    if (remaining <= 0) break;

    const pageMaxLength = Math.min(MAX_CONTENT_PER_PAGE, remaining);
    const truncated = truncateContent(page.content, pageMaxLength);

    const header = `--- PAGE: ${page.title || page.url} (${page.pageType}) ---\nURL: ${page.url}`;
    sections.push(`${header}\n\n${truncated}`);
    totalLength += truncated.length;
  }

  return sections.join("\n\n");
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run convex/analysis/extractActivationLevels.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractActivationLevels.ts convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
feat(analysis): add buildActivationPageContext for activation extraction

Formats filtered pages with headers and truncated content for LLM context.
Reuses truncateContent from extractIdentity.ts.

Part of M002-E003-S003.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add content truncation test

**Files:**
- Modify: `convex/analysis/extractActivationLevels.test.ts`

**Step 1: Write the test for content limits**

Add to buildActivationPageContext describe block:

```typescript
  it("truncates individual pages to MAX_CONTENT_PER_PAGE", () => {
    const longContent = "x".repeat(10_000);
    const pages = [
      { pageType: "customers", content: longContent, url: "https://x.io/customers" },
    ];

    const result = buildActivationPageContext(pages);

    // Should be truncated to ~8000 chars plus header
    // The exact length depends on truncation at newline, but should be < 9000
    expect(result.length).toBeLessThan(9_000);
    expect(result).toContain("[Content truncated]");
  });

  it("respects total content limit across pages", () => {
    const mediumContent = "y".repeat(15_000);
    const pages = [
      { pageType: "customers", content: mediumContent, url: "https://x.io/customers" },
      { pageType: "features", content: mediumContent, url: "https://x.io/features" },
      { pageType: "homepage", content: mediumContent, url: "https://x.io" },
    ];

    const result = buildActivationPageContext(pages);

    // Total should be capped around MAX_TOTAL_CONTENT (30000)
    expect(result.length).toBeLessThan(35_000);
  });
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --run convex/analysis/extractActivationLevels.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add convex/analysis/extractActivationLevels.test.ts
git commit -m "$(cat <<'EOF'
test(analysis): add content truncation tests for buildActivationPageContext

Verifies per-page and total content limits are enforced.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Run full test suite and verify

**Files:**
- None (verification only)

**Step 1: Run full test suite**

Run: `npm test -- --run`

Expected: All tests pass

**Step 2: Run just the new tests to confirm**

Run: `npm test -- --run convex/analysis/extractActivationLevels.test.ts`

Expected output should show all tests passing:
```
✓ filterActivationPages > filters to activation-relevant page types
✓ filterActivationPages > returns empty array when no matching pages
✓ filterActivationPages > handles empty input
✓ filterActivationPages > prioritizes onboarding and help when available (E002 dependency)
✓ buildActivationPageContext > formats pages with headers and content
✓ buildActivationPageContext > falls back to URL when title is missing
✓ buildActivationPageContext > truncates individual pages to MAX_CONTENT_PER_PAGE
✓ buildActivationPageContext > respects total content limit across pages
```

---

## Summary

This plan implements M002-E003-S003 with 6 TDD tasks:

1. **filterActivationPages** - Core filtering function with priority sort
2. **Edge cases** - Empty input handling
3. **E002 dependency** - Document future page types
4. **buildActivationPageContext** - Format pages for LLM
5. **Truncation tests** - Verify content limits
6. **Verification** - Run full test suite

The functions will be consumed by S004 (extractActivationLevels action) to filter and format pages before sending to Claude for activation level extraction.
