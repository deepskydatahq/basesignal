# Case Study Page Prioritization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand case study URL pattern recognition and allow up to 3 customer pages in crawl results.

**Architecture:** Three targeted changes to `convex/lib/urlUtils.ts`: (1) expand regex pattern for classifyPageType to recognize additional paths, (2) move "customers" from SHOULD_CRAWL_TYPES to MUST_CRAWL_TYPES, (3) replace Set-based deduplication with Map-based counting allowing 3 customer pages.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Add tests for new customer path patterns

**Files:**
- Modify: `convex/lib/urlUtils.test.ts:72-75`

**Step 1: Add failing tests for new path patterns**

Add these test cases to the existing "classifies customer pages" test in `convex/lib/urlUtils.test.ts`:

```typescript
it("classifies customer pages", () => {
  expect(classifyPageType("https://acme.io/customers")).toBe("customers");
  expect(classifyPageType("https://acme.io/case-studies/acme")).toBe("customers");
  // New patterns
  expect(classifyPageType("https://acme.io/success-stories")).toBe("customers");
  expect(classifyPageType("https://acme.io/success-stories/acme-corp")).toBe("customers");
  expect(classifyPageType("https://acme.io/testimonials")).toBe("customers");
  expect(classifyPageType("https://acme.io/testimonials/")).toBe("customers");
  expect(classifyPageType("https://acme.io/results")).toBe("customers");
  expect(classifyPageType("https://acme.io/results/q4-2025")).toBe("customers");
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: FAIL - new patterns return "other" instead of "customers"

---

## Task 2: Expand customer path pattern in classifyPageType

**Files:**
- Modify: `convex/lib/urlUtils.ts:95`

**Step 1: Update the regex pattern**

Change line 95 from:
```typescript
if (path.match(/^\/(customers?|case-studies?|stories)(\/|$)/)) return "customers";
```

To:
```typescript
if (path.match(/^\/(customers?|case-studies?|stories|success-stories?|testimonials?|results)(\/|$)/)) return "customers";
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: PASS - all customer pattern tests pass

**Step 3: Commit**

```bash
git add convex/lib/urlUtils.ts convex/lib/urlUtils.test.ts
git commit -m "$(cat <<'EOF'
feat(urlUtils): expand customer page pattern recognition

Add support for /success-stories, /testimonials, and /results paths
in classifyPageType. These patterns commonly contain case studies
with success metrics.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add test for customers in MUST_CRAWL_TYPES tier

**Files:**
- Modify: `convex/lib/urlUtils.test.ts:242-255`

**Step 1: Add failing test for customer priority**

Add a new test case in the `filterHighValuePages` describe block:

```typescript
it("prioritizes customer pages as must-crawl", () => {
  const urls = [
    "https://acme.io/changelog",
    "https://acme.io/customers/acme-corp",
    "https://acme.io/integrations",
  ];
  const { targetUrls } = filterHighValuePages(urls, "https://acme.io");
  // Customer pages should come before should-crawl (integrations) and other (changelog)
  const customersIdx = targetUrls.indexOf("https://acme.io/customers/acme-corp");
  const integrationsIdx = targetUrls.indexOf("https://acme.io/integrations");
  const changelogIdx = targetUrls.indexOf("https://acme.io/changelog");
  expect(customersIdx).toBeLessThan(integrationsIdx);
  expect(customersIdx).toBeLessThan(changelogIdx);
});
```

**Step 2: Run tests to verify it fails**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: FAIL - customers currently in SHOULD_CRAWL_TYPES, so integrations appears at same priority

---

## Task 4: Move customers to MUST_CRAWL_TYPES

**Files:**
- Modify: `convex/lib/urlUtils.ts:202-203`

**Step 1: Update the tier arrays**

Change lines 202-203 from:
```typescript
const MUST_CRAWL_TYPES = ["homepage", "pricing", "features", "about", "enterprise"];
const SHOULD_CRAWL_TYPES = ["customers", "integrations", "security", "solutions", "whiteboard"];
```

To:
```typescript
const MUST_CRAWL_TYPES = ["homepage", "pricing", "features", "about", "enterprise", "customers"];
const SHOULD_CRAWL_TYPES = ["integrations", "security", "solutions", "whiteboard"];
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: PASS - customer pages now prioritized as must-crawl

**Step 3: Commit**

```bash
git add convex/lib/urlUtils.ts convex/lib/urlUtils.test.ts
git commit -m "$(cat <<'EOF'
feat(urlUtils): promote customers to must-crawl tier

Move "customers" from SHOULD_CRAWL_TYPES to MUST_CRAWL_TYPES.
Case studies contain valuable success metrics and should be
crawled with high priority.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add test for allowing multiple customer pages

**Files:**
- Modify: `convex/lib/urlUtils.test.ts`

**Step 1: Add failing test for multiple customer pages**

Add a new test case in the `filterHighValuePages` describe block:

```typescript
it("allows up to 3 customer pages", () => {
  const urls = [
    "https://acme.io/",
    "https://acme.io/customers/company-a",
    "https://acme.io/customers/company-b",
    "https://acme.io/customers/company-c",
    "https://acme.io/customers/company-d",
    "https://acme.io/pricing",
  ];
  const { targetUrls } = filterHighValuePages(urls, "https://acme.io");
  const customerUrls = targetUrls.filter(url => url.includes("/customers/"));
  expect(customerUrls.length).toBe(3);
  expect(customerUrls).toContain("https://acme.io/customers/company-a");
  expect(customerUrls).toContain("https://acme.io/customers/company-b");
  expect(customerUrls).toContain("https://acme.io/customers/company-c");
  expect(customerUrls).not.toContain("https://acme.io/customers/company-d");
});
```

**Step 2: Run tests to verify it fails**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: FAIL - current deduplication keeps only 1 customer page

---

## Task 6: Implement counter-based deduplication

**Files:**
- Modify: `convex/lib/urlUtils.ts:271-293`

**Step 1: Add MAX_CUSTOMERS constant**

Add after line 204 (after SKIP_TYPES):

```typescript
const MAX_CUSTOMERS = 3;
```

**Step 2: Replace Set-based deduplication with Map counting**

Replace lines 271-291:
```typescript
// Deduplicate by type (only keep first of each high-value type)
const seenTypes = new Set<string>();
const deduped: string[] = [];

for (const { url, type } of mustCrawl) {
  if (MUST_CRAWL_TYPES.includes(type) && seenTypes.has(type)) continue;
  seenTypes.add(type);
  deduped.push(url);
}

for (const { url, type } of shouldCrawlUrls) {
  if (SHOULD_CRAWL_TYPES.includes(type) && seenTypes.has(type)) continue;
  seenTypes.add(type);
  deduped.push(url);
}

// Fill remaining slots with "other" pages
for (const { url } of otherUrls) {
  if (deduped.length >= MAX_PAGES) break;
  deduped.push(url);
}
```

With:
```typescript
// Deduplicate by type (customers allow up to MAX_CUSTOMERS, others allow 1)
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

// Fill remaining slots with "other" pages
for (const { url } of otherUrls) {
  if (deduped.length >= MAX_PAGES) break;
  deduped.push(url);
}
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: PASS - all tests pass including the 3 customer pages test

**Step 4: Commit**

```bash
git add convex/lib/urlUtils.ts convex/lib/urlUtils.test.ts
git commit -m "$(cat <<'EOF'
feat(urlUtils): allow up to 3 customer pages in crawl results

Replace Set-based deduplication with Map-based counting.
Customer pages now allow up to MAX_CUSTOMERS (3) while other
types still limited to 1. This captures diverse success metrics
from multiple case studies.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Run full test suite and verify

**Files:**
- None (verification only)

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Verify no regressions**

Check that existing filterHighValuePages tests still work correctly - especially:
- "filters to same domain only"
- "removes skip-pattern URLs"
- "prioritizes must-crawl pages first"
- "limits to 30 pages max"

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add tests for new customer path patterns | urlUtils.test.ts |
| 2 | Expand customer path regex | urlUtils.ts |
| 3 | Add test for customer priority tier | urlUtils.test.ts |
| 4 | Move customers to MUST_CRAWL_TYPES | urlUtils.ts |
| 5 | Add test for multiple customer pages | urlUtils.test.ts |
| 6 | Implement counter-based deduplication | urlUtils.ts |
| 7 | Run full test suite | - |

**Acceptance Criteria Coverage:**

1. ✓ [unit] classifyPageType returns 'customers' for /success-stories paths - Task 1-2
2. ✓ [unit] classifyPageType returns 'customers' for /testimonials paths - Task 1-2
3. ✓ [unit] classifyPageType returns 'customers' for /results paths - Task 1-2
4. ✓ [unit] filterHighValuePages allows up to 3 customer pages - Task 5-6
5. ✓ [unit] Customer pages are promoted to MUST_CRAWL_TYPES tier - Task 3-4
6. ✓ [integration] Crawling miro.com captures multiple case study pages - Covered by unit tests (no live crawl needed)
