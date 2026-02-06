# Help/Docs Subdomain Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect help/docs/support subdomains and classify them for activation-focused crawling.

**Architecture:** Extend URL classification with subdomain-based page types, add a new `shouldCrawlForActivation` function for activation-specific filtering, and update `filterHighValuePages` to return an array of docs URLs instead of a single URL.

**Tech Stack:** TypeScript, Vitest

---

## Task 1: Add tests for classifyPageType subdomain detection

**Files:**
- Modify: `convex/lib/urlUtils.test.ts`

**Step 1: Write the failing tests**

Add this test block after the existing `classifyPageType` tests (around line 94):

```typescript
it("classifies help subdomains", () => {
  expect(classifyPageType("https://help.acme.io/article/123", "acme.io")).toBe("help");
  expect(classifyPageType("https://help.example.com/", "example.com")).toBe("help");
});

it("classifies docs subdomains", () => {
  expect(classifyPageType("https://docs.acme.io/api", "acme.io")).toBe("docs");
  expect(classifyPageType("https://docs.example.com/getting-started", "example.com")).toBe("docs");
});

it("classifies support subdomains", () => {
  expect(classifyPageType("https://support.acme.io/tickets", "acme.io")).toBe("support");
  expect(classifyPageType("https://support.example.com/", "example.com")).toBe("support");
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run convex/lib/urlUtils.test.ts`

Expected: 3 failures - returns "other" instead of "help", "docs", "support"

---

## Task 2: Implement classifyPageType subdomain detection

**Files:**
- Modify: `convex/lib/urlUtils.ts:103-108`

**Step 1: Add subdomain classification**

Add these 3 lines after line 107 (after the `community.` check), before `return "other"`:

```typescript
if (hostname.startsWith("help.")) return "help";
if (hostname.startsWith("docs.")) return "docs";
if (hostname.startsWith("support.")) return "support";
```

The full block should read:

```typescript
  // Subdomain-specific classifications (only when rootHostname provided)
  if (rootHostname) {
    if (hostname.startsWith("status.")) return "status";
    if (hostname.startsWith("developers.") || hostname.startsWith("api.")) return "developers";
    if (hostname.startsWith("trust.")) return "trust";
    if (hostname.startsWith("community.")) return "community";
    if (hostname.startsWith("help.")) return "help";
    if (hostname.startsWith("docs.")) return "docs";
    if (hostname.startsWith("support.")) return "support";
  }

  return "other";
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run convex/lib/urlUtils.test.ts`

Expected: All tests pass

**Step 3: Commit**

```bash
git add convex/lib/urlUtils.ts convex/lib/urlUtils.test.ts
git commit -m "$(cat <<'EOF'
feat(urlUtils): classify help/docs/support subdomains

Add page type classification for help.*, docs.*, and support.*
subdomains when rootHostname is provided.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add tests for shouldCrawlForActivation

**Files:**
- Modify: `convex/lib/urlUtils.test.ts`

**Step 1: Write the failing tests**

Add this new describe block after the `isDocsSite` describe block (around line 214):

```typescript
describe("shouldCrawlForActivation", () => {
  it("returns true for help subdomain root", () => {
    expect(shouldCrawlForActivation("https://help.acme.io/")).toBe(true);
    expect(shouldCrawlForActivation("https://help.acme.io")).toBe(true);
  });

  it("returns true for docs subdomain root", () => {
    expect(shouldCrawlForActivation("https://docs.acme.io/")).toBe(true);
  });

  it("returns true for support subdomain root", () => {
    expect(shouldCrawlForActivation("https://support.acme.io/")).toBe(true);
  });

  it("returns true for getting-started paths", () => {
    expect(shouldCrawlForActivation("https://help.acme.io/getting-started")).toBe(true);
    expect(shouldCrawlForActivation("https://docs.acme.io/getting-started/quick-intro")).toBe(true);
  });

  it("returns true for onboarding paths", () => {
    expect(shouldCrawlForActivation("https://help.acme.io/onboarding")).toBe(true);
    expect(shouldCrawlForActivation("https://docs.acme.io/user-onboarding")).toBe(true);
  });

  it("returns true for quick-start paths", () => {
    expect(shouldCrawlForActivation("https://docs.acme.io/quick-start")).toBe(true);
    expect(shouldCrawlForActivation("https://docs.acme.io/quickstart")).toBe(true);
  });

  it("returns true for tutorial paths", () => {
    expect(shouldCrawlForActivation("https://help.acme.io/tutorials/first-steps")).toBe(true);
    expect(shouldCrawlForActivation("https://docs.acme.io/tutorial")).toBe(true);
  });

  it("returns true for first-steps paths", () => {
    expect(shouldCrawlForActivation("https://help.acme.io/first-steps")).toBe(true);
  });

  it("returns false for non-docs subdomains", () => {
    expect(shouldCrawlForActivation("https://acme.io/getting-started")).toBe(false);
    expect(shouldCrawlForActivation("https://www.acme.io/onboarding")).toBe(false);
    expect(shouldCrawlForActivation("https://blog.acme.io/tutorials")).toBe(false);
  });

  it("returns false for deep reference paths in docs", () => {
    expect(shouldCrawlForActivation("https://docs.acme.io/api/v2/users")).toBe(false);
    expect(shouldCrawlForActivation("https://help.acme.io/articles/12345")).toBe(false);
    expect(shouldCrawlForActivation("https://docs.acme.io/reference/functions")).toBe(false);
  });

  it("returns false for invalid URLs", () => {
    expect(shouldCrawlForActivation("not-a-url")).toBe(false);
  });
});
```

**Step 2: Update the import**

Update the import at the top of the test file to include `shouldCrawlForActivation`:

```typescript
import {
  validateUrl,
  classifyPageType,
  shouldCrawl,
  isDocsSite,
  filterHighValuePages,
  shouldCrawlForActivation,
} from "./urlUtils";
```

**Step 3: Run tests to verify they fail**

Run: `npm test -- --run convex/lib/urlUtils.test.ts`

Expected: Import error - `shouldCrawlForActivation` is not exported

---

## Task 4: Implement shouldCrawlForActivation

**Files:**
- Modify: `convex/lib/urlUtils.ts`

**Step 1: Add the activation path patterns constant**

Add this constant after `DOCS_HOSTNAME_PREFIXES` (around line 179):

```typescript
const ACTIVATION_PATH_PATTERNS = [
  /getting-started/i,
  /onboarding/i,
  /quick-?start/i,
  /first-steps/i,
  /tutorial/i,
];
```

**Step 2: Add the shouldCrawlForActivation function**

Add this function after `isDocsSite` (around line 197):

```typescript
/**
 * Check if a URL should be crawled for activation analysis.
 * Returns true for docs-type subdomains with activation-relevant paths.
 */
export function shouldCrawlForActivation(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    // Must be a docs-type subdomain
    const isDocsSubdomain = DOCS_HOSTNAME_PREFIXES.some(
      (prefix) => hostname.startsWith(prefix)
    );
    if (!isDocsSubdomain) return false;

    // Root paths are always valuable
    if (path === "/" || path === "") return true;

    // Filter to activation-relevant paths
    return ACTIVATION_PATH_PATTERNS.some((pattern) => pattern.test(path));
  } catch {
    return false;
  }
}
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- --run convex/lib/urlUtils.test.ts`

Expected: All tests pass

**Step 4: Commit**

```bash
git add convex/lib/urlUtils.ts convex/lib/urlUtils.test.ts
git commit -m "$(cat <<'EOF'
feat(urlUtils): add shouldCrawlForActivation function

New function filters docs subdomains to activation-relevant paths:
- Root paths (always included)
- getting-started, onboarding, quick-start, first-steps, tutorial

Reuses existing DOCS_HOSTNAME_PREFIXES constant.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add test for filterHighValuePages docsUrls array

**Files:**
- Modify: `convex/lib/urlUtils.test.ts`

**Step 1: Write the failing test**

Replace the existing `detects docs site URLs` test (around line 263) with this expanded version:

```typescript
it("collects multiple docs URLs in docsUrls array", () => {
  const urls = [
    "https://acme.io/",
    "https://docs.acme.io/",
    "https://help.acme.io/getting-started",
    "https://support.acme.io/",
  ];
  const { docsUrls } = filterHighValuePages(urls, "https://acme.io");
  expect(docsUrls).toContain("https://docs.acme.io/");
  expect(docsUrls).toContain("https://help.acme.io/getting-started");
  expect(docsUrls).toContain("https://support.acme.io/");
  expect(docsUrls.length).toBe(3);
});

it("deduplicates docs URLs by hostname", () => {
  const urls = [
    "https://acme.io/",
    "https://docs.acme.io/",
    "https://docs.acme.io/api",
    "https://docs.acme.io/getting-started",
  ];
  const { docsUrls } = filterHighValuePages(urls, "https://acme.io");
  // Should only include one URL per hostname
  const docsHostnames = docsUrls.map(u => new URL(u).hostname);
  expect(new Set(docsHostnames).size).toBe(docsHostnames.length);
});
```

**Step 2: Update the existing /docs path test**

Update the test at line 272 to use `docsUrls` instead of `docsUrl`:

```typescript
it("detects /docs path as docs URL", () => {
  const urls = [
    "https://acme.io/",
    "https://acme.io/docs/getting-started",
  ];
  const { docsUrls } = filterHighValuePages(urls, "https://acme.io");
  expect(docsUrls).toContain("https://acme.io/docs/getting-started");
});
```

**Step 3: Run tests to verify they fail**

Run: `npm test -- --run convex/lib/urlUtils.test.ts`

Expected: TypeScript error - `docsUrls` does not exist, only `docsUrl`

---

## Task 6: Update filterHighValuePages to return docsUrls array

**Files:**
- Modify: `convex/lib/urlUtils.ts:210-294`

**Step 1: Update the return type**

Change the return type from `docsUrl: string | undefined` to `docsUrls: string[]`:

```typescript
export function filterHighValuePages(urls: string[], rootUrl: string): {
  targetUrls: string[];
  docsUrls: string[];
} {
```

**Step 2: Update the variable declaration**

Replace `let docsUrl: string | undefined;` (line 221) with:

```typescript
const docsUrls: string[] = [];
const seenDocsHostnames = new Set<string>();
```

**Step 3: Update the collection logic in the filtering loop**

Replace the docs URL collection logic in the filter callback (lines 233-236) with:

```typescript
// Check for docs subdomain on different domain
if (isDocsSite(url)) {
  const docsHost = parsed.hostname;
  if (!seenDocsHostnames.has(docsHost)) {
    seenDocsHostnames.add(docsHost);
    docsUrls.push(url);
  }
}
```

**Step 4: Update the docs URL collection for filtered URLs**

Replace the docs URL collection loop (lines 244-249) with:

```typescript
// Check filtered URLs for docs sites
for (const url of filtered) {
  if (isDocsSite(url)) {
    try {
      const docsHost = new URL(url).hostname;
      if (!seenDocsHostnames.has(docsHost)) {
        seenDocsHostnames.add(docsHost);
        docsUrls.push(url);
      }
    } catch {
      // Skip invalid URLs
    }
  }
}
```

**Step 5: Update the return statement**

Change line 293 from:

```typescript
return { targetUrls: deduped.slice(0, MAX_PAGES), docsUrl };
```

to:

```typescript
return { targetUrls: deduped.slice(0, MAX_PAGES), docsUrls };
```

**Step 6: Run tests to verify they pass**

Run: `npm test -- --run convex/lib/urlUtils.test.ts`

Expected: All tests pass

**Step 7: Commit**

```bash
git add convex/lib/urlUtils.ts convex/lib/urlUtils.test.ts
git commit -m "$(cat <<'EOF'
feat(urlUtils): return docsUrls array from filterHighValuePages

BREAKING: filterHighValuePages now returns docsUrls: string[]
instead of docsUrl: string | undefined.

Collects all docs site URLs, deduplicated by hostname.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update caller in scanning.ts

**Files:**
- Modify: `convex/scanning.ts`

**Step 1: Update destructuring at line 67**

Change:
```typescript
const { targetUrls, docsUrl } = filterHighValuePages(discoveredUrls, normalizedUrl);
```

to:
```typescript
const { targetUrls, docsUrls } = filterHighValuePages(discoveredUrls, normalizedUrl);
const docsUrl = docsUrls[0]; // Use first docs URL for backward compatibility
```

**Step 2: Run the full test suite**

Run: `npm test -- --run`

Expected: All tests pass

**Step 3: Commit**

```bash
git add convex/scanning.ts
git commit -m "$(cat <<'EOF'
refactor(scanning): adapt to docsUrls array return type

Use first docs URL from array for backward compatibility with
existing progress reporting and product update logic.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add integration test for Miro-style scanning

**Files:**
- Modify: `convex/lib/urlUtils.test.ts`

**Step 1: Add integration test**

Add this test to the `filterHighValuePages` describe block:

```typescript
it("includes help.miro.com in docsUrls when scanning miro.com", () => {
  const urls = [
    "https://miro.com/",
    "https://miro.com/pricing",
    "https://help.miro.com/",
    "https://help.miro.com/hc/en-us/articles/getting-started",
    "https://developers.miro.com/",
  ];
  const { docsUrls } = filterHighValuePages(urls, "https://miro.com");
  expect(docsUrls).toContain("https://help.miro.com/");
  expect(docsUrls.some(u => u.includes("developers.miro.com"))).toBe(true);
});
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run convex/lib/urlUtils.test.ts`

Expected: All tests pass

**Step 3: Commit**

```bash
git add convex/lib/urlUtils.test.ts
git commit -m "$(cat <<'EOF'
test(urlUtils): add integration test for miro-style docs discovery

Verifies filterHighValuePages correctly discovers help.miro.com
and developers.miro.com subdomains.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Final verification

**Step 1: Run full test suite**

Run: `npm test -- --run`

Expected: All tests pass

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: No type errors

**Step 3: Create final commit if any changes**

If there are any uncommitted changes:

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: final cleanup for help-docs subdomain detection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance Criteria Verification

| Criterion | Test | Task |
|-----------|------|------|
| 1. classifyPageType returns 'help' for help.example.com | `classifies help subdomains` | Task 1-2 |
| 2. classifyPageType returns 'docs' for docs.example.com | `classifies docs subdomains` | Task 1-2 |
| 3. classifyPageType returns 'support' for support.example.com | `classifies support subdomains` | Task 1-2 |
| 4. shouldCrawlForActivation returns true for help/docs subdomains | Multiple tests in describe block | Task 3-4 |
| 5. shouldCrawlForActivation filters to getting-started/onboarding paths | Path pattern tests | Task 3-4 |
| 6. filterHighValuePages includes help.miro.com in docsUrls | Integration test | Task 5-8 |

---
*Implementation plan for M002-E002-S001 · Created via /plan-issue*
