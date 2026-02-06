# Extract Product Outcomes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `convex/analysis/extractOutcomes.ts` — an internalAction that extracts product outcomes (jobs-to-be-done) from crawled marketing pages using Claude Haiku, storing results in the product profile.

**Architecture:** Single internalAction fetches crawled homepage/features/customers pages via `listByProductInternal`, sends truncated content to Claude Haiku with a structured prompt, parses the JSON response, and stores via `updateSectionInternal`. Follows the same pattern as S001-S004 extractors.

**Tech Stack:** Convex (internalAction, internalMutation, internalQuery), Anthropic SDK (Claude Haiku), convex-test + Vitest for testing.

---

## Prerequisites

Before starting, these internal helpers must exist. If they don't, create them first (they are shared by all S001-S007 extractors):

- `crawledPages.listByProductInternal` — internalQuery in `convex/crawledPages.ts`
- `productProfiles.updateSectionInternal` — internalMutation in `convex/productProfiles.ts`
- `productProfiles.createInternal` — internalMutation in `convex/productProfiles.ts`

Check if they exist before Task 1. If missing, Task 1 covers adding them.

---

## Task 1: Add shared internal helpers (if missing)

**Files:**
- Modify: `convex/crawledPages.ts` (add `listByProductInternal`)
- Modify: `convex/productProfiles.ts` (add `createInternal`, `updateSectionInternal`)

**Step 1: Check if helpers already exist**

```bash
grep -n "listByProductInternal\|updateSectionInternal\|createInternal" convex/crawledPages.ts convex/productProfiles.ts
```

If all three exist, skip to Task 2.

**Step 2: Add `listByProductInternal` to `convex/crawledPages.ts`**

Add this import at line 1 (modify existing import):
```typescript
import { query, internalMutation, internalQuery } from "./_generated/server";
```

Add at end of file:
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

**Step 3: Add `createInternal` and `updateSectionInternal` to `convex/productProfiles.ts`**

Add to imports at line 1:
```typescript
import { query, mutation, internalMutation } from "./_generated/server";
```

Add at end of file:
```typescript
export const createInternal = internalMutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .first();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("productProfiles", {
      productId: args.productId,
      completeness: 0,
      overallConfidence: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

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

**Step 4: Run tests to verify nothing broke**

```bash
npm run test:run
```

Expected: All existing productProfiles tests pass.

**Step 5: Commit**

```bash
git add convex/crawledPages.ts convex/productProfiles.ts
git commit -m "feat: add internal helpers for analysis pipeline (listByProductInternal, createInternal, updateSectionInternal)"
```

---

## Task 2: Write failing tests for extractOutcomes

**Files:**
- Create: `convex/analysis/extractOutcomes.test.ts`

**Context:** The extractOutcomes function is an `internalAction` that calls the Anthropic API. For unit testing, we test the data flow — input validation, output schema, and storage — by mocking the Anthropic call. The convex-test library lets us test internal functions directly.

**Important references:**
- Schema for outcomes: `convex/schema.ts:545-554` — `{ items: [{ description, type, linkedFeatures[] }], confidence, evidence: [{ url, excerpt }] }`
- Existing test pattern: `convex/productProfiles.test.ts` — uses `convexTest(schema)`, `t.run()` for direct DB ops, `t.withIdentity()` for auth
- Outcome types: `primary` (hero messaging, exactly one), `secondary` (value props), `tertiary` (testimonials only)

**Step 1: Write the test file**

```typescript
// convex/analysis/extractOutcomes.test.ts
import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import schema from "../schema";
import { internal } from "../_generated/api";

// Mock Anthropic SDK
vi.mock("@anthropic-ai/sdk", () => {
  const createMock = vi.fn();
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: createMock },
    })),
    __createMock: createMock,
  };
});

// Helper: set up a product with crawled pages and a profile
async function setupProductWithPages(
  t: ReturnType<typeof convexTest>,
  pages: Array<{ pageType: string; url: string; content: string; title?: string }> = []
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: "test-clerk",
      email: "test@example.com",
      createdAt: Date.now(),
    });
    const productId = await ctx.db.insert("products", {
      name: "Test Product",
      url: "https://test.io",
      userId,
      createdAt: Date.now(),
    });
    const scanJobId = await ctx.db.insert("scanJobs", {
      productId,
      userId,
      status: "complete",
      url: "https://test.io",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const now = Date.now();
    const profileId = await ctx.db.insert("productProfiles", {
      productId,
      completeness: 0,
      overallConfidence: 0,
      createdAt: now,
      updatedAt: now,
    });

    for (const page of pages) {
      await ctx.db.insert("crawledPages", {
        productId,
        scanJobId,
        url: page.url,
        pageType: page.pageType,
        title: page.title,
        content: page.content,
        contentLength: page.content.length,
        crawledAt: Date.now(),
      });
    }

    return { userId, productId, scanJobId, profileId };
  });
}

// Standard mock response matching expected LLM output
function makeMockOutcomesResponse(items?: Array<{ description: string; type: string; linkedFeatures: string[] }>) {
  const defaultItems = [
    {
      description: "Collaborate visually in real-time",
      type: "primary",
      linkedFeatures: ["Whiteboard", "Real-time cursors"],
    },
    {
      description: "Streamline design handoff to developers",
      type: "secondary",
      linkedFeatures: ["Dev mode", "Code export"],
    },
    {
      description: "Reduce meeting time with async feedback",
      type: "tertiary",
      linkedFeatures: ["Comments"],
    },
  ];

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          items: items ?? defaultItems,
          confidence: 0.75,
          evidence: [
            { field: "primary_outcome", url: "https://test.io", excerpt: "Collaborate visually in real-time" },
            { field: "secondary_outcome", url: "https://test.io/features", excerpt: "Design handoff made simple" },
          ],
        }),
      },
    ],
  };
}

describe("extractOutcomes", () => {
  let createMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createMock = (mod as any).__createMock;
    createMock.mockReset();
  });

  it("extracts outcomes as array of { description, type, linkedFeatures[] }", async () => {
    const t = convexTest(schema);
    createMock.mockResolvedValueOnce(makeMockOutcomesResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Collaborate visually in real-time with your team" },
      { pageType: "features", url: "https://test.io/features", content: "Whiteboard, Real-time cursors, Dev mode" },
    ]);

    await t.action(internal.analysis.extractOutcomes.extractOutcomes, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.outcomes).toBeDefined();
    expect(profile!.outcomes!.items).toHaveLength(3);
    expect(profile!.outcomes!.items[0]).toEqual({
      description: "Collaborate visually in real-time",
      type: "primary",
      linkedFeatures: ["Whiteboard", "Real-time cursors"],
    });
  });

  it("primary outcome captures the main job-to-be-done", async () => {
    const t = convexTest(schema);
    createMock.mockResolvedValueOnce(makeMockOutcomesResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Hero: collaborate visually" },
    ]);

    await t.action(internal.analysis.extractOutcomes.extractOutcomes, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    const primaryOutcomes = profile!.outcomes!.items.filter((i) => i.type === "primary");
    expect(primaryOutcomes).toHaveLength(1);
    expect(primaryOutcomes[0].description).toBe("Collaborate visually in real-time");
  });

  it("outcomes are linked to specific features mentioned on the site", async () => {
    const t = convexTest(schema);
    createMock.mockResolvedValueOnce(makeMockOutcomesResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Collaborate with Whiteboard" },
      { pageType: "features", url: "https://test.io/features", content: "Dev mode, Code export" },
    ]);

    await t.action(internal.analysis.extractOutcomes.extractOutcomes, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    const withFeatures = profile!.outcomes!.items.filter((i) => i.linkedFeatures.length > 0);
    expect(withFeatures.length).toBeGreaterThan(0);
    expect(withFeatures[0].linkedFeatures).toContain("Whiteboard");
  });

  it("evidence includes URLs and excerpts", async () => {
    const t = convexTest(schema);
    createMock.mockResolvedValueOnce(makeMockOutcomesResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Hero section content" },
    ]);

    await t.action(internal.analysis.extractOutcomes.extractOutcomes, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    // Evidence should have url and excerpt, but NOT the 'field' key (stripped before storage)
    expect(profile!.outcomes!.evidence).toHaveLength(2);
    expect(profile!.outcomes!.evidence[0]).toHaveProperty("url");
    expect(profile!.outcomes!.evidence[0]).toHaveProperty("excerpt");
    expect(profile!.outcomes!.evidence[0]).not.toHaveProperty("field");
  });

  it("result stored via updateSectionInternal matching schema", async () => {
    const t = convexTest(schema);
    createMock.mockResolvedValueOnce(makeMockOutcomesResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Content" },
    ]);

    await t.action(internal.analysis.extractOutcomes.extractOutcomes, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    // Profile completeness should increase (outcomes = 1 of 10 sections)
    expect(profile!.completeness).toBeCloseTo(0.1, 1);
    expect(profile!.outcomes!.confidence).toBe(0.75);
    expect(profile!.updatedAt).toBeGreaterThan(profile!.createdAt);
  });

  it("throws when no relevant pages found", async () => {
    const t = convexTest(schema);

    const { productId } = await setupProductWithPages(t, [
      // Only a pricing page — not homepage/features/customers
      { pageType: "pricing", url: "https://test.io/pricing", content: "Pricing info" },
    ]);

    await expect(
      t.action(internal.analysis.extractOutcomes.extractOutcomes, { productId })
    ).rejects.toThrow();
  });

  it("handles LLM response wrapped in code block", async () => {
    const t = convexTest(schema);
    createMock.mockResolvedValueOnce({
      content: [
        {
          type: "text",
          text: "```json\n" + JSON.stringify({
            items: [{ description: "Ship faster", type: "primary", linkedFeatures: [] }],
            confidence: 0.6,
            evidence: [{ field: "primary", url: "https://test.io", excerpt: "Ship faster" }],
          }) + "\n```",
        },
      ],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Ship faster" },
    ]);

    await t.action(internal.analysis.extractOutcomes.extractOutcomes, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile!.outcomes!.items[0].description).toBe("Ship faster");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:run -- convex/analysis/extractOutcomes.test.ts
```

Expected: FAIL — module `convex/analysis/extractOutcomes` does not exist.

**Step 3: Commit**

```bash
git add convex/analysis/extractOutcomes.test.ts
git commit -m "test: add failing tests for extractOutcomes"
```

---

## Task 3: Implement extractOutcomes internalAction

**Files:**
- Create: `convex/analysis/extractOutcomes.ts`

**Context:**
- Must be an `internalAction` (no user auth context — called by orchestrator)
- Uses `ctx.runQuery` for `listByProductInternal` and `ctx.runMutation` for `updateSectionInternal`
- Single Claude Haiku call with structured prompt
- Truncates page content to ~25KB each
- Parses JSON response, strips `field` from evidence, stores result

**Step 1: Create the extractOutcomes module**

```typescript
// convex/analysis/extractOutcomes.ts
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

const MAX_PAGE_CONTENT_LENGTH = 25_000; // 25KB truncation per page
const RELEVANT_PAGE_TYPES = ["homepage", "features", "customers"];

const SYSTEM_PROMPT = `You are a product analyst. Analyze the provided marketing content and extract the product outcomes — the jobs-to-be-done that the product delivers for its users.

Return a JSON object with this exact structure:
{
  "items": [
    {
      "description": "string — the outcome/job-to-be-done in a clear sentence",
      "type": "primary | secondary | tertiary",
      "linkedFeatures": ["feature names from the marketing copy that enable this outcome"]
    }
  ],
  "confidence": 0.0-1.0,
  "evidence": [
    {
      "field": "string — which outcome this evidence supports",
      "url": "string — the page URL",
      "excerpt": "string — exact quote from the page"
    }
  ]
}

Outcome type definitions:
- primary: Main job-to-be-done from hero messaging. Exactly one per product.
- secondary: Supporting outcomes from value prop sections and feature categories.
- tertiary: Mentioned only in testimonials, case studies, or minor bullet points.

Feature linkage rules:
- Only link features explicitly named on the pages (e.g., "Whiteboard", "API access")
- Use the exact feature name as it appears in the marketing copy
- If no specific feature is tied to an outcome, use an empty array

Confidence scoring:
- 0.8-1.0: Clear hero messaging with supporting value props and testimonials
- 0.6-0.8: Clear hero messaging but limited supporting signals
- 0.4-0.6: Outcomes inferred from feature descriptions, no clear hero statement
- 0.2-0.4: Very limited content, mostly guessing

Return ONLY the JSON object, no markdown formatting or explanation.`;

function truncateContent(content: string): string {
  if (content.length <= MAX_PAGE_CONTENT_LENGTH) return content;
  return content.slice(0, MAX_PAGE_CONTENT_LENGTH) + "\n[... content truncated]";
}

function parseJsonResponse(text: string): unknown {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try stripping code block wrapper
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
    throw new Error("Failed to parse LLM response as JSON");
  }
}

export const extractOutcomes = internalAction({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const allPages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      { productId: args.productId }
    );

    // 2. Filter to relevant page types
    const pages = allPages.filter((p) =>
      RELEVANT_PAGE_TYPES.includes(p.pageType)
    );

    if (pages.length === 0) {
      throw new Error(
        `No relevant pages found for product ${args.productId}. ` +
        `Need at least one of: ${RELEVANT_PAGE_TYPES.join(", ")}`
      );
    }

    // 3. Build user prompt with labeled, truncated page content
    const sections = pages.map((page) => {
      const content = truncateContent(page.content);
      return `=== ${page.pageType.toUpperCase()} PAGE: ${page.url} ===\n${content}`;
    });

    const userPrompt = sections.join("\n\n");

    // 4. Call Claude Haiku
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    // 5. Parse response
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content in LLM response");
    }

    const parsed = parseJsonResponse(textBlock.text) as {
      items: Array<{ description: string; type: string; linkedFeatures: string[] }>;
      confidence: number;
      evidence: Array<{ field: string; url: string; excerpt: string }>;
    };

    // 6. Strip 'field' from evidence before storage
    const evidence = parsed.evidence.map(({ url, excerpt }) => ({ url, excerpt }));

    // 7. Store via updateSectionInternal
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "outcomes",
      data: {
        items: parsed.items,
        confidence: parsed.confidence,
        evidence,
      },
    });
  },
});
```

**Step 2: Run tests to verify they pass**

```bash
npm run test:run -- convex/analysis/extractOutcomes.test.ts
```

Expected: All 7 tests PASS.

**Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: All tests pass, including existing productProfiles tests.

**Step 4: Commit**

```bash
git add convex/analysis/extractOutcomes.ts
git commit -m "feat: implement extractOutcomes internalAction for product outcome extraction"
```

---

## Task 4: Verify integration with type system

**Files:**
- None modified — verification only

**Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No type errors. The Convex code generation should pick up the new internalAction and make it available at `internal.analysis.extractOutcomes.extractOutcomes`.

**Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors in new files.

**Step 3: Run full test suite one more time**

```bash
npm run test:run
```

Expected: All tests pass.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Add shared internal helpers (if missing) | `convex/crawledPages.ts`, `convex/productProfiles.ts` |
| 2 | Write failing tests for extractOutcomes | `convex/analysis/extractOutcomes.test.ts` (new) |
| 3 | Implement extractOutcomes internalAction | `convex/analysis/extractOutcomes.ts` (new) |
| 4 | Verify types, lint, full test suite | None (verification) |

**Total: 4 tasks, TDD approach (tests before implementation)**

### Key patterns to follow
- `internalAction` for the extractor (no user auth context)
- `ctx.runQuery(internal.crawledPages.listByProductInternal)` to fetch pages
- `ctx.runMutation(internal.productProfiles.updateSectionInternal)` to store results
- Single Claude Haiku call with JSON schema in system prompt
- 25KB page content truncation
- Code-block fallback for JSON parsing
- Strip `field` from evidence before storage
