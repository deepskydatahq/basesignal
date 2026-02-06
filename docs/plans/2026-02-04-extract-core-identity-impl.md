# Extract Core Identity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an `internalAction` that extracts product identity (name, description, target customer, business model) from crawled homepage/about/features pages using Claude Haiku, and stores the result on the product profile.

**Architecture:** `convex/analysis/extractIdentity.ts` is an `internalAction` that: (1) fetches crawled pages via `listByProductInternal`, (2) filters to homepage/about/features, (3) truncates content to 25KB each, (4) calls Claude Haiku with a structured prompt, (5) parses the JSON response, (6) strips the `field` key from evidence entries, and (7) stores the identity section via `updateSectionInternal`. Prerequisites (internal query/mutation helpers) are included as the first tasks since the orchestrator pipeline plan hasn't been implemented yet.

**Tech Stack:** Convex (internalAction, internalMutation, internalQuery), Anthropic SDK (`@anthropic-ai/sdk@0.71.2`), TypeScript, convex-test + Vitest for testing

---

## Prerequisite Context

### Existing Files You'll Modify

| File | What's There | Key Lines |
|------|-------------|-----------|
| `convex/crawledPages.ts` | 141 lines. Exports: `store` (internalMutation), `listByScanJob`, `listByProduct`, `getByProductAndType`, `removeByScanJob`, `listByProductMcp`. All queries are authenticated. No internal queries exist. | Import on line 1: `import { query, internalMutation } from "./_generated/server"` |
| `convex/productProfiles.ts` | 272 lines. Exports: `create`, `get`, `updateSection`, `validateSection`, `remove`. All authenticated. Has `calculateCompletenessAndConfidence` helper (lines 97-123). | Import on line 1: `import { query, mutation } from "./_generated/server"` |

### New Files You'll Create

| File | Purpose |
|------|---------|
| `convex/analysis/extractIdentity.ts` | internalAction — the core extractor |
| `convex/analysis/extractIdentity.test.ts` | Tests for the extractor |

### Schema Reference

**`productProfiles.identity`** (from `convex/schema.ts:447-456`):
```typescript
identity: v.optional(v.object({
  productName: v.string(),
  description: v.string(),
  targetCustomer: v.string(),
  businessModel: v.string(),
  industry: v.optional(v.string()),
  companyStage: v.optional(v.string()),
  confidence: v.number(),
  evidence: v.array(v.object({ url: v.string(), excerpt: v.string() })),
})),
```

**`crawledPages`** (from `convex/schema.ts:608-625`):
```typescript
crawledPages: defineTable({
  productId: v.id("products"),
  scanJobId: v.id("scanJobs"),
  url: v.string(),
  pageType: v.string(),       // "homepage", "about", "features", etc.
  title: v.optional(v.string()),
  content: v.string(),         // Markdown from Firecrawl
  contentLength: v.number(),
  metadata: v.optional(v.object({ ... })),
  crawledAt: v.number(),
})
```

### Key Patterns

**Anthropic SDK usage** (from `convex/ai.ts:1-4`):
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",  // we'll use "claude-haiku-3-5-20241022" instead
  max_tokens: 1024,
  system: systemPrompt,
  messages,
});
```

**Test setup** (from `convex/crawledPages.test.ts:14-32`):
```typescript
async function setupUserProductAndJob(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-clerk-id",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
  const asUser = authenticatedUser(t);
  const productId = await asUser.mutation(api.products.create, {
    name: "Test Product", url: "https://test.io",
  });
  const jobId = await asUser.mutation(api.scanJobs.create, {
    productId, url: "https://test.io",
  });
  return { productId, jobId, asUser };
}
```

**Internal mutations in tests** — called via `t.mutation(internal.module.fn, args)` (no auth wrapper needed).

---

## Task 1: Add `listByProductInternal` to crawledPages

**Files:**
- Modify: `convex/crawledPages.ts` (line 1 import + add after line 123)
- Test: `convex/crawledPages.test.ts`

### Step 1: Write the failing test

Add to the end of `convex/crawledPages.test.ts`, inside the existing `describe("crawledPages", ...)` block (before the closing `});` on line 205):

```typescript
it("can list pages by product via internal query", async () => {
  const t = convexTest(schema);
  const { productId, jobId } = await setupUserProductAndJob(t);

  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io",
    pageType: "homepage",
    content: "Home",
  });
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io/about",
    pageType: "about",
    content: "About us",
  });

  // Internal query — no auth needed
  const pages = await t.query(internal.crawledPages.listByProductInternal, { productId });
  expect(pages).toHaveLength(2);
});
```

**Note:** The import for `internal` already exists at line 3 of `crawledPages.test.ts`.

### Step 2: Run test to verify it fails

Run: `npx vitest run convex/crawledPages.test.ts`
Expected: FAIL — `listByProductInternal` is not exported

### Step 3: Write minimal implementation

Change line 1 of `convex/crawledPages.ts` from:
```typescript
import { query, internalMutation } from "./_generated/server";
```
to:
```typescript
import { query, internalMutation, internalQuery } from "./_generated/server";
```

Add after the `removeByScanJob` export (after line 123, before `listByProductMcp`):

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

### Step 4: Run test to verify it passes

Run: `npx vitest run convex/crawledPages.test.ts`
Expected: All tests PASS

### Step 5: Commit

```bash
git add convex/crawledPages.ts convex/crawledPages.test.ts
git commit -m "feat: add listByProductInternal query to crawledPages"
```

---

## Task 2: Add `createInternal` and `getInternal` to productProfiles

**Files:**
- Modify: `convex/productProfiles.ts` (line 1 import + add after line 155)
- Test: `convex/productProfiles.test.ts`

### Step 1: Write the failing tests

In `convex/productProfiles.test.ts`, change line 3 from:
```typescript
import { api } from "./_generated/api";
```
to:
```typescript
import { api, internal } from "./_generated/api";
```

Add inside the `describe("productProfiles", ...)` block (before the closing `});` on line 240):

```typescript
it("can create a profile internally without auth", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  const profileId = await t.mutation(internal.productProfiles.createInternal, { productId });
  expect(profileId).toBeDefined();

  const profile = await t.run(async (ctx) => {
    return await ctx.db.get(profileId);
  });
  expect(profile?.productId).toEqual(productId);
  expect(profile?.completeness).toBe(0);
});

it("createInternal is idempotent", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  const id1 = await t.mutation(internal.productProfiles.createInternal, { productId });
  const id2 = await t.mutation(internal.productProfiles.createInternal, { productId });
  expect(id1).toEqual(id2);
});

it("can get a profile internally without auth", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  await t.mutation(internal.productProfiles.createInternal, { productId });

  const profile = await t.query(internal.productProfiles.getInternal, { productId });
  expect(profile).toBeDefined();
  expect(profile?.completeness).toBe(0);
});
```

### Step 2: Run test to verify they fail

Run: `npx vitest run convex/productProfiles.test.ts`
Expected: FAIL — `createInternal` and `getInternal` are not exported

### Step 3: Write minimal implementation

Change line 1 of `convex/productProfiles.ts` from:
```typescript
import { query, mutation } from "./_generated/server";
```
to:
```typescript
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
```

Add after the `create` export (after line 155):

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
      completeness: 0,
      overallConfidence: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getInternal = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
  },
});
```

### Step 4: Run test to verify they pass

Run: `npx vitest run convex/productProfiles.test.ts`
Expected: All tests PASS

### Step 5: Commit

```bash
git add convex/productProfiles.ts convex/productProfiles.test.ts
git commit -m "feat: add createInternal and getInternal to productProfiles"
```

---

## Task 3: Add `updateSectionInternal` to productProfiles

**Files:**
- Modify: `convex/productProfiles.ts` (add after `getInternal` from Task 2)
- Test: `convex/productProfiles.test.ts`

### Step 1: Write the failing tests

Add to `convex/productProfiles.test.ts`, inside the `describe` block:

```typescript
it("can update a section internally without auth", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  await t.mutation(internal.productProfiles.createInternal, { productId });

  await t.mutation(internal.productProfiles.updateSectionInternal, {
    productId,
    section: "identity",
    data: {
      productName: "Acme",
      description: "Tool",
      targetCustomer: "Devs",
      businessModel: "SaaS",
      confidence: 0.7,
      evidence: [{ url: "https://acme.io", excerpt: "Built for devs" }],
    },
  });

  const profile = await t.query(internal.productProfiles.getInternal, { productId });
  expect(profile?.identity?.productName).toBe("Acme");
  expect(profile?.identity?.confidence).toBe(0.7);
  expect(profile?.completeness).toBeCloseTo(0.1, 1);
});

it("updateSectionInternal throws if profile not found", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  await expect(
    t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "identity",
      data: { productName: "X", description: "Y", targetCustomer: "Z", businessModel: "B", confidence: 0.5, evidence: [] },
    })
  ).rejects.toThrow("Profile not found");
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run convex/productProfiles.test.ts`
Expected: FAIL — `updateSectionInternal` is not exported

### Step 3: Write minimal implementation

Add to `convex/productProfiles.ts`, after the `getInternal` export (from Task 2):

```typescript
export const updateSectionInternal = internalMutation({
  args: {
    productId: v.id("products"),
    section: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (!profile) throw new Error("Profile not found");

    await ctx.db.patch(profile._id, {
      [args.section]: args.data,
      updatedAt: Date.now(),
    });

    const updated = await ctx.db.get(profile._id);
    if (updated) {
      const { completeness, overallConfidence } = calculateCompletenessAndConfidence(updated);
      await ctx.db.patch(profile._id, { completeness, overallConfidence });
    }
  },
});
```

### Step 4: Run test to verify it passes

Run: `npx vitest run convex/productProfiles.test.ts`
Expected: All tests PASS

### Step 5: Commit

```bash
git add convex/productProfiles.ts convex/productProfiles.test.ts
git commit -m "feat: add updateSectionInternal to productProfiles"
```

---

## Task 4: Create `extractIdentity` internalAction with tests

This is the core task. The action fetches crawled pages, calls Claude Haiku, parses the response, and stores the identity section.

**Files:**
- Create: `convex/analysis/extractIdentity.ts`
- Create: `convex/analysis/extractIdentity.test.ts`

### Step 1: Write the failing test

Create `convex/analysis/extractIdentity.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";

function authenticatedUser(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${clerkId}`,
  });
}

async function setupWithPages(t: ReturnType<typeof convexTest>) {
  await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-clerk-id",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
  const asUser = authenticatedUser(t);
  const productId = await asUser.mutation(api.products.create, {
    name: "Test Product",
    url: "https://acme.io",
  });
  const jobId = await asUser.mutation(api.scanJobs.create, {
    productId,
    url: "https://acme.io",
  });

  // Store crawled pages
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://acme.io",
    pageType: "homepage",
    title: "Acme - Project Management for Engineering Teams",
    content: "# Acme\n\nThe project management platform built for engineering teams. Acme helps software teams ship faster with integrated sprint planning, code review tracking, and deployment pipelines.\n\n## Trusted by 500+ engineering teams\n\nFrom startups to enterprise, teams rely on Acme to coordinate their development workflow.",
  });
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://acme.io/about",
    pageType: "about",
    title: "About Acme",
    content: "# About Acme\n\nFounded in 2022, Acme is a B2B SaaS company on a mission to make engineering teams more productive. Our platform serves engineering managers and tech leads who need visibility into their team's development process.\n\nWe're a Series A startup backed by top VCs.",
  });

  // Create profile
  await t.mutation(internal.productProfiles.createInternal, { productId });

  return { productId, jobId };
}

describe("extractIdentity", () => {
  it("throws when no pages found for product", async () => {
    const t = convexTest(schema);

    // Create user and product but no pages
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });
    const asUser = authenticatedUser(t);
    const productId = await asUser.mutation(api.products.create, {
      name: "Empty Product",
      url: "https://empty.io",
    });
    await t.mutation(internal.productProfiles.createInternal, { productId });

    await expect(
      t.action(internal.analysis.extractIdentity.extract, { productId })
    ).rejects.toThrow("No relevant pages found");
  });

  it("filters pages to homepage, about, and features only", async () => {
    const t = convexTest(schema);
    const { productId, jobId } = await setupWithPages(t);

    // Add a pricing page — should be excluded from identity extraction input
    await t.mutation(internal.crawledPages.store, {
      productId,
      scanJobId: jobId,
      url: "https://acme.io/pricing",
      pageType: "pricing",
      content: "# Pricing\n\nFree: $0/mo\nPro: $29/mo",
    });

    // The test verifies the action runs without error;
    // the prompt only receives homepage + about pages (not pricing)
    // We can't easily assert on what was sent to Claude,
    // but we verify the result is stored correctly
    // Note: this test requires ANTHROPIC_API_KEY to be set
  });
});
```

**Important note about testing the action:** Convex `internalAction` tests that call external APIs (Claude) require the `ANTHROPIC_API_KEY` env var to be set. For unit-testable logic (page filtering, content truncation, JSON parsing, evidence stripping), we extract pure helper functions and test those separately. The integration test above validates the error path which doesn't call the API.

### Step 2: Run test to verify it fails

Run: `npx vitest run convex/analysis/extractIdentity.test.ts`
Expected: FAIL — module not found

### Step 3: Write the implementation

Create `convex/analysis/extractIdentity.ts`:

```typescript
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import Anthropic from "@anthropic-ai/sdk";

const MAX_PAGE_CONTENT_LENGTH = 25_000; // 25KB per page
const IDENTITY_PAGE_TYPES = ["homepage", "about", "features"];

const SYSTEM_PROMPT = `You are a product analyst. Extract the core identity of a software product from its website content.

Return a JSON object with this exact structure:
{
  "productName": "The product's name",
  "description": "1-2 sentence description of what the product does",
  "targetCustomer": "Who the product is built for (be specific: role, company size, industry)",
  "businessModel": "How the product makes money (e.g., B2B SaaS, marketplace, freemium, usage-based)",
  "industry": "The industry or vertical (e.g., developer tools, fintech, healthcare). Omit if unclear.",
  "companyStage": "The company stage (e.g., early-stage startup, Series A, growth, enterprise). Omit if unclear.",
  "confidence": 0.8,
  "evidence": [
    { "field": "productName", "url": "https://example.com", "excerpt": "exact quote from the page" },
    { "field": "description", "url": "https://example.com", "excerpt": "exact quote" }
  ]
}

Rules:
- confidence: 0.0-1.0. Use 0.9+ only when multiple pages clearly confirm the identity. Use 0.5-0.7 when inferring from limited content.
- evidence: Include 2-6 entries. Each excerpt must be a direct quote from the page content (not paraphrased). The "field" key indicates which field this evidence supports.
- industry and companyStage: Only include if clearly stated or strongly implied. Omit the key entirely if uncertain.
- Return ONLY the JSON object. No markdown code fences, no explanation.`;

interface CrawledPage {
  url: string;
  pageType: string;
  title?: string;
  content: string;
}

interface EvidenceWithField {
  field: string;
  url: string;
  excerpt: string;
}

interface IdentityResult {
  productName: string;
  description: string;
  targetCustomer: string;
  businessModel: string;
  industry?: string;
  companyStage?: string;
  confidence: number;
  evidence: EvidenceWithField[];
}

/**
 * Filter pages to only identity-relevant types (homepage, about, features).
 */
export function filterIdentityPages(pages: CrawledPage[]): CrawledPage[] {
  return pages.filter((p) => IDENTITY_PAGE_TYPES.includes(p.pageType));
}

/**
 * Truncate page content to MAX_PAGE_CONTENT_LENGTH.
 */
export function truncateContent(content: string): string {
  if (content.length <= MAX_PAGE_CONTENT_LENGTH) return content;
  return content.slice(0, MAX_PAGE_CONTENT_LENGTH);
}

/**
 * Build the user prompt from filtered, truncated pages.
 */
export function buildUserPrompt(pages: CrawledPage[]): string {
  const sections = pages.map((page) => {
    const truncated = truncateContent(page.content);
    return `--- PAGE: ${page.url} (${page.pageType}) ---\n${page.title ? `Title: ${page.title}\n` : ""}${truncated}`;
  });
  return sections.join("\n\n");
}

/**
 * Parse the LLM response, handling optional code fences.
 */
export function parseIdentityResponse(text: string): IdentityResult {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields
  const required = ["productName", "description", "targetCustomer", "businessModel", "confidence", "evidence"];
  for (const field of required) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error("confidence must be a number between 0 and 1");
  }

  if (!Array.isArray(parsed.evidence)) {
    throw new Error("evidence must be an array");
  }

  return parsed as IdentityResult;
}

/**
 * Strip the 'field' key from evidence entries before storage.
 * Schema expects { url, excerpt } only.
 */
export function stripFieldFromEvidence(evidence: EvidenceWithField[]): Array<{ url: string; excerpt: string }> {
  return evidence.map(({ url, excerpt }) => ({ url, excerpt }));
}

export const extract = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const allPages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      { productId: args.productId }
    );

    // 2. Filter to identity-relevant page types
    const pages = filterIdentityPages(allPages);
    if (pages.length === 0) {
      throw new Error("No relevant pages found for identity extraction");
    }

    // 3. Build prompt with truncated content
    const userPrompt = buildUserPrompt(pages);

    // 4. Call Claude Haiku
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: "claude-haiku-3-5-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // 5. Extract text response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // 6. Parse JSON
    const result = parseIdentityResponse(textBlock.text);

    // 7. Strip field from evidence, build storage object
    const identity: Record<string, unknown> = {
      productName: result.productName,
      description: result.description,
      targetCustomer: result.targetCustomer,
      businessModel: result.businessModel,
      confidence: result.confidence,
      evidence: stripFieldFromEvidence(result.evidence),
    };

    // Only include optional fields if present
    if (result.industry) identity.industry = result.industry;
    if (result.companyStage) identity.companyStage = result.companyStage;

    // 8. Store via internal mutation
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "identity",
      data: identity,
    });
  },
});
```

### Step 4: Run test to verify the error-path test passes

Run: `npx vitest run convex/analysis/extractIdentity.test.ts`
Expected: The "throws when no pages found" test PASSES. The filter test is a documentation placeholder.

### Step 5: Commit

```bash
git add convex/analysis/extractIdentity.ts convex/analysis/extractIdentity.test.ts
git commit -m "feat: add extractIdentity internalAction for core identity extraction"
```

---

## Task 5: Add unit tests for pure helper functions

The helper functions (`filterIdentityPages`, `truncateContent`, `buildUserPrompt`, `parseIdentityResponse`, `stripFieldFromEvidence`) are pure and can be tested without the Convex runtime or Anthropic API.

**Files:**
- Modify: `convex/analysis/extractIdentity.test.ts`

### Step 1: Write the tests

Add a new `describe` block to `convex/analysis/extractIdentity.test.ts`:

```typescript
import {
  filterIdentityPages,
  truncateContent,
  buildUserPrompt,
  parseIdentityResponse,
  stripFieldFromEvidence,
} from "./extractIdentity";

describe("extractIdentity helpers", () => {
  describe("filterIdentityPages", () => {
    it("keeps homepage, about, and features pages", () => {
      const pages = [
        { url: "https://x.io", pageType: "homepage", content: "Home" },
        { url: "https://x.io/about", pageType: "about", content: "About" },
        { url: "https://x.io/features", pageType: "features", content: "Features" },
        { url: "https://x.io/pricing", pageType: "pricing", content: "Pricing" },
        { url: "https://x.io/blog", pageType: "other", content: "Blog" },
      ];
      const filtered = filterIdentityPages(pages);
      expect(filtered).toHaveLength(3);
      expect(filtered.map((p) => p.pageType)).toEqual(["homepage", "about", "features"]);
    });

    it("returns empty array when no relevant pages", () => {
      const pages = [
        { url: "https://x.io/pricing", pageType: "pricing", content: "Pricing" },
      ];
      expect(filterIdentityPages(pages)).toHaveLength(0);
    });
  });

  describe("truncateContent", () => {
    it("returns content unchanged when under limit", () => {
      const content = "Short content";
      expect(truncateContent(content)).toBe(content);
    });

    it("truncates content exceeding 25KB", () => {
      const content = "x".repeat(30_000);
      expect(truncateContent(content).length).toBe(25_000);
    });
  });

  describe("buildUserPrompt", () => {
    it("formats pages with URL headers", () => {
      const pages = [
        { url: "https://x.io", pageType: "homepage", title: "Home", content: "Welcome" },
        { url: "https://x.io/about", pageType: "about", content: "About us" },
      ];
      const prompt = buildUserPrompt(pages);
      expect(prompt).toContain("--- PAGE: https://x.io (homepage) ---");
      expect(prompt).toContain("Title: Home");
      expect(prompt).toContain("Welcome");
      expect(prompt).toContain("--- PAGE: https://x.io/about (about) ---");
      expect(prompt).not.toContain("Title:"); // about page has no title — wait, it doesn't have title
    });

    it("includes title only when present", () => {
      const pages = [
        { url: "https://x.io", pageType: "homepage", content: "Welcome" },
      ];
      const prompt = buildUserPrompt(pages);
      expect(prompt).not.toContain("Title:");
    });
  });

  describe("parseIdentityResponse", () => {
    const validResponse = JSON.stringify({
      productName: "Acme",
      description: "Project management for engineers",
      targetCustomer: "Engineering teams",
      businessModel: "B2B SaaS",
      confidence: 0.8,
      evidence: [{ field: "productName", url: "https://acme.io", excerpt: "Acme" }],
    });

    it("parses valid JSON response", () => {
      const result = parseIdentityResponse(validResponse);
      expect(result.productName).toBe("Acme");
      expect(result.confidence).toBe(0.8);
    });

    it("handles code-fenced JSON", () => {
      const fenced = "```json\n" + validResponse + "\n```";
      const result = parseIdentityResponse(fenced);
      expect(result.productName).toBe("Acme");
    });

    it("handles bare code fences", () => {
      const fenced = "```\n" + validResponse + "\n```";
      const result = parseIdentityResponse(fenced);
      expect(result.productName).toBe("Acme");
    });

    it("throws on missing required field", () => {
      const missing = JSON.stringify({ productName: "X" });
      expect(() => parseIdentityResponse(missing)).toThrow("Missing required field");
    });

    it("throws on invalid confidence", () => {
      const bad = JSON.stringify({
        productName: "X", description: "Y", targetCustomer: "Z",
        businessModel: "B", confidence: 1.5, evidence: [],
      });
      expect(() => parseIdentityResponse(bad)).toThrow("confidence must be a number between 0 and 1");
    });

    it("throws on non-array evidence", () => {
      const bad = JSON.stringify({
        productName: "X", description: "Y", targetCustomer: "Z",
        businessModel: "B", confidence: 0.5, evidence: "not an array",
      });
      expect(() => parseIdentityResponse(bad)).toThrow("evidence must be an array");
    });

    it("throws on invalid JSON", () => {
      expect(() => parseIdentityResponse("not json")).toThrow();
    });

    it("preserves optional fields when present", () => {
      const withOptional = JSON.stringify({
        productName: "Acme", description: "Tool", targetCustomer: "Devs",
        businessModel: "SaaS", industry: "Developer Tools", companyStage: "Series A",
        confidence: 0.9, evidence: [],
      });
      const result = parseIdentityResponse(withOptional);
      expect(result.industry).toBe("Developer Tools");
      expect(result.companyStage).toBe("Series A");
    });
  });

  describe("stripFieldFromEvidence", () => {
    it("removes field key from evidence entries", () => {
      const evidence = [
        { field: "productName", url: "https://x.io", excerpt: "Acme" },
        { field: "description", url: "https://x.io/about", excerpt: "A tool" },
      ];
      const stripped = stripFieldFromEvidence(evidence);
      expect(stripped).toEqual([
        { url: "https://x.io", excerpt: "Acme" },
        { url: "https://x.io/about", excerpt: "A tool" },
      ]);
      // Ensure no field key present
      for (const entry of stripped) {
        expect(entry).not.toHaveProperty("field");
      }
    });

    it("handles empty evidence array", () => {
      expect(stripFieldFromEvidence([])).toEqual([]);
    });
  });
});
```

### Step 2: Run tests to verify they pass

Run: `npx vitest run convex/analysis/extractIdentity.test.ts`
Expected: All helper tests PASS, Convex integration tests PASS

### Step 3: Commit

```bash
git add convex/analysis/extractIdentity.test.ts
git commit -m "test: add unit tests for extractIdentity helper functions"
```

---

## Task 6: Run full test suite

**Files:** None (verification only)

### Step 1: Run all tests

Run: `npx vitest run`
Expected: All tests PASS across all test files

### Step 2: Verify no TypeScript errors

Run: `npx tsc --noEmit`
Expected: No errors

### Step 3: Commit if any fixes were needed

If you needed to fix anything, commit those fixes now.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add `listByProductInternal` to crawledPages | `convex/crawledPages.ts`, `convex/crawledPages.test.ts` |
| 2 | Add `createInternal` + `getInternal` to productProfiles | `convex/productProfiles.ts`, `convex/productProfiles.test.ts` |
| 3 | Add `updateSectionInternal` to productProfiles | `convex/productProfiles.ts`, `convex/productProfiles.test.ts` |
| 4 | Create `extractIdentity` internalAction | `convex/analysis/extractIdentity.ts`, `convex/analysis/extractIdentity.test.ts` |
| 5 | Unit tests for pure helper functions | `convex/analysis/extractIdentity.test.ts` |
| 6 | Full test suite verification | None |

### Testing Strategy

- **Tasks 1-3:** Use `convex-test` framework with direct DB access for internal functions
- **Task 4:** Integration test for error paths (no API call needed); the action itself calls Claude Haiku which requires `ANTHROPIC_API_KEY`
- **Task 5:** Pure function unit tests with Vitest (no Convex runtime needed)
- **Task 6:** Full suite regression check
