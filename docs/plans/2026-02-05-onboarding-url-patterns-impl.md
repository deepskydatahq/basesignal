# Onboarding URL Patterns Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add onboarding page type recognition to classifyPageType() and prioritize it in MUST_CRAWL_TYPES.

**Architecture:** Add a single regex pattern to classifyPageType() for onboarding paths, add "onboarding" to MUST_CRAWL_TYPES array for crawl priority.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Add unit tests for classifyPageType onboarding patterns

**Files:**
- Modify: `convex/lib/urlUtils.test.ts:91-95` (add after "classifies solution pages" test)

**Step 1: Write the failing tests**

Add this test block in the `classifyPageType` describe block, after the "classifies solution pages" test:

```typescript
it("classifies onboarding pages", () => {
  // /getting-started paths
  expect(classifyPageType("https://acme.io/getting-started")).toBe("onboarding");
  expect(classifyPageType("https://acme.io/getting-started/")).toBe("onboarding");
  expect(classifyPageType("https://acme.io/getting-started/step-1")).toBe("onboarding");

  // /onboarding paths
  expect(classifyPageType("https://acme.io/onboarding")).toBe("onboarding");
  expect(classifyPageType("https://acme.io/onboarding/")).toBe("onboarding");
  expect(classifyPageType("https://acme.io/onboarding/welcome")).toBe("onboarding");

  // /quick-start paths
  expect(classifyPageType("https://acme.io/quick-start")).toBe("onboarding");
  expect(classifyPageType("https://acme.io/quick-start/")).toBe("onboarding");
  expect(classifyPageType("https://acme.io/quick-start/install")).toBe("onboarding");

  // /first-steps paths
  expect(classifyPageType("https://acme.io/first-steps")).toBe("onboarding");
  expect(classifyPageType("https://acme.io/first-steps/")).toBe("onboarding");
  expect(classifyPageType("https://acme.io/first-steps/setup")).toBe("onboarding");
});

it("does not classify partial onboarding matches", () => {
  // Should NOT match - these are partial segment matches
  expect(classifyPageType("https://acme.io/getting-started-guide")).toBe("other");
  expect(classifyPageType("https://acme.io/my-onboarding")).toBe("other");
  expect(classifyPageType("https://acme.io/quick-starter")).toBe("other");
  expect(classifyPageType("https://acme.io/first-steps-advanced")).toBe("other");
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: FAIL - classifyPageType returns "other" for onboarding paths

**Step 3: Commit failing tests**

```bash
git add convex/lib/urlUtils.test.ts
git commit -m "test: add failing tests for onboarding page classification

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Implement classifyPageType onboarding pattern

**Files:**
- Modify: `convex/lib/urlUtils.ts:109-110` (add before `return "other"`)

**Step 1: Add onboarding pattern to classifyPageType**

Add this line before `return "other"` (line 110):

```typescript
  // Onboarding content - first-time user experience and activation moments
  if (path.match(/^\/(getting-started|onboarding|quick-start|first-steps)(\/|$)/)) return "onboarding";
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: PASS - all classifyPageType tests pass

**Step 3: Commit implementation**

```bash
git add convex/lib/urlUtils.ts
git commit -m "feat: classify onboarding pages in URL classifier

Add pattern matching for /getting-started, /onboarding, /quick-start,
and /first-steps paths. These contain behavioral descriptions of
first-time user experience critical for activation level inference.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add onboarding to MUST_CRAWL_TYPES

**Files:**
- Modify: `convex/lib/urlUtils.ts:202` (update MUST_CRAWL_TYPES array)

**Step 1: Write the failing integration test**

Add this test to the `filterHighValuePages` describe block in `urlUtils.test.ts`:

```typescript
it("prioritizes onboarding pages over other pages", () => {
  const urls = [
    "https://acme.io/changelog",
    "https://acme.io/getting-started",
    "https://acme.io/random-page",
  ];
  const { targetUrls } = filterHighValuePages(urls, "https://acme.io");

  // Onboarding (must-crawl) should come before other pages
  const onboardingIdx = targetUrls.indexOf("https://acme.io/getting-started");
  const changelogIdx = targetUrls.indexOf("https://acme.io/changelog");
  expect(onboardingIdx).toBeLessThan(changelogIdx);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: FAIL - onboarding not prioritized (treated as "other")

**Step 3: Add onboarding to MUST_CRAWL_TYPES**

Update line 202 in `convex/lib/urlUtils.ts`:

```typescript
const MUST_CRAWL_TYPES = ["homepage", "pricing", "features", "about", "enterprise", "onboarding"];
```

**Step 4: Run all tests to verify they pass**

Run: `npm test -- convex/lib/urlUtils.test.ts --run`
Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add convex/lib/urlUtils.ts convex/lib/urlUtils.test.ts
git commit -m "feat: prioritize onboarding pages in crawl pipeline

Add 'onboarding' to MUST_CRAWL_TYPES so these pages are crawled
with highest priority alongside homepage, pricing, features, etc.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Run full test suite and verify

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Verify no lint errors**

Run: `npm run lint`
Expected: No errors

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Add unit tests for onboarding classification | 2 test cases |
| 2 | Implement classifyPageType onboarding pattern | - |
| 3 | Add onboarding to MUST_CRAWL_TYPES + integration test | 1 test case |
| 4 | Full test suite verification | - |

**Total:** 4 tasks, 3 test cases added

---
*Plan created via headless session on 2026-02-05*
