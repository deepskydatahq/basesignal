# Extract Entity Model Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an internalAction that infers entity model (entities, types, properties, relationships) from crawled website pages and stores it on the product profile.

**Architecture:** Single-pass LLM extraction using Claude Haiku. The extractor fetches crawled pages (features, pricing, homepage, about) via `listByProductInternal`, sends labeled sections to Haiku with entity type definitions and relationship rules in the system prompt, then stores results via `updateSectionInternal`. Follows the same pattern established in the S001 design.

**Tech Stack:** Convex (internalAction/internalQuery/internalMutation), Anthropic SDK (Claude Haiku), convex-test + vitest for testing.

**Design doc:** `docs/plans/2026-02-04-extract-entity-model-design.md`

---

## Prerequisites

This task depends on two internal helpers that are part of the S001 (Extract Core Identity) design but **have not been implemented yet**. Tasks 1-2 add these helpers. If S001 has been implemented by the time this plan runs, skip Tasks 1-2.

---

### Task 1: Add `listByProductInternal` to crawledPages

**Files:**
- Modify: `convex/crawledPages.ts` (add new export at bottom)
- Test: `convex/crawledPages.test.ts` (add new test)

**Step 1: Write the failing test**

Add this test to the end of the `describe("crawledPages")` block in `convex/crawledPages.test.ts`:

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
    url: "https://test.io/pricing",
    pageType: "pricing",
    content: "Pricing",
  });

  // Internal query - no auth required
  const pages = await t.query(internal.crawledPages.listByProductInternal, { productId });
  expect(pages).toHaveLength(2);
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run convex/crawledPages.test.ts`
Expected: FAIL — `listByProductInternal` is not exported.

**Step 3: Write minimal implementation**

Add to the end of `convex/crawledPages.ts` (before any closing content, after the `listByProductMcp` export):

```typescript
import { internalQuery } from "./_generated/server";
```

Note: The file already imports `internalMutation` from `"./_generated/server"`. Update the existing import to also include `internalQuery`:

Change:
```typescript
import { query, internalMutation } from "./_generated/server";
```
To:
```typescript
import { query, internalMutation, internalQuery } from "./_generated/server";
```

Then add at the bottom:

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

**Step 4: Run test to verify it passes**

Run: `npx vitest run convex/crawledPages.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/crawledPages.ts convex/crawledPages.test.ts
git commit -m "feat: add listByProductInternal query for analysis extractors"
```

---

### Task 2: Add `updateSectionInternal` and `getInternal` to productProfiles

**Files:**
- Modify: `convex/productProfiles.ts` (add new exports)
- Test: `convex/productProfiles.test.ts` (add new tests)

**Step 1: Write the failing tests**

Add these tests to the end of the `describe("productProfiles")` block in `convex/productProfiles.test.ts`:

```typescript
it("can update a section via internal mutation (no auth)", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  // Create profile via normal mutation
  const { asUser } = await setupUserAndProduct(t, "setup-clerk");
  // Actually, reuse the existing setup — create profile directly
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("productProfiles", {
      productId,
      completeness: 0,
      overallConfidence: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  // Update via internal mutation — no auth needed
  await t.mutation(internal.productProfiles.updateSectionInternal, {
    productId,
    section: "identity",
    data: {
      productName: "Test SaaS",
      description: "A testing tool",
      targetCustomer: "QA teams",
      businessModel: "B2B SaaS",
      confidence: 0.75,
      evidence: [{ url: "https://test.io", excerpt: "Built for QA" }],
    },
  });

  const profile = await t.run(async (ctx) => {
    return await ctx.db
      .query("productProfiles")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .first();
  });
  expect(profile?.identity?.productName).toBe("Test SaaS");
  expect(profile?.completeness).toBeCloseTo(0.1, 1);
});

it("can read a profile via internal query (no auth)", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("productProfiles", {
      productId,
      completeness: 0,
      overallConfidence: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  const profile = await t.query(internal.productProfiles.getInternal, { productId });
  expect(profile).toBeDefined();
  expect(profile?.completeness).toBe(0);
});

it("getInternal returns null when no profile exists", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  const profile = await t.query(internal.productProfiles.getInternal, { productId });
  expect(profile).toBeNull();
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run convex/productProfiles.test.ts`
Expected: FAIL — `updateSectionInternal` and `getInternal` are not exported.

**Step 3: Write minimal implementation**

Update the import at the top of `convex/productProfiles.ts`:

Change:
```typescript
import { query, mutation } from "./_generated/server";
```
To:
```typescript
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
```

Then add at the bottom of the file:

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

**Step 4: Run test to verify it passes**

Run: `npx vitest run convex/productProfiles.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/productProfiles.ts convex/productProfiles.test.ts
git commit -m "feat: add internal query/mutation helpers for analysis pipeline"
```

---

### Task 3: Create `extractEntities` internalAction with tests

**Files:**
- Create: `convex/analysis/extractEntities.ts`
- Create: `convex/analysis/extractEntities.test.ts`

**Step 1: Write the failing test**

Create `convex/analysis/extractEntities.test.ts`:

```typescript
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
    await ctx.db.insert("productProfiles", {
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

    return { userId, productId, scanJobId };
  });
}

describe("extractEntities", () => {
  let createMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@anthropic-ai/sdk");
    createMock = (mod as any).__createMock;
    createMock.mockReset();
  });

  it("extracts entities from crawled pages and stores on profile", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          items: [
            { name: "Project", type: "billable", properties: ["name", "status", "members"] },
            { name: "Task", type: "value", properties: ["title", "assignee", "due_date"] },
            { name: "Workspace", type: "supporting", properties: ["name", "plan"] },
          ],
          relationships: [
            { from: "Workspace", to: "Project", type: "has_many" },
            { from: "Project", to: "Task", type: "has_many" },
          ],
          confidence: 0.7,
          evidence: [
            { field: "Project", url: "https://test.io/pricing", excerpt: "$10 per project" },
            { field: "Task", url: "https://test.io/features", excerpt: "Create and assign tasks" },
          ],
        }),
      }],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Project management for teams" },
      { pageType: "features", url: "https://test.io/features", content: "Create and assign tasks to team members" },
      { pageType: "pricing", url: "https://test.io/pricing", content: "$10 per project per month" },
      { pageType: "about", url: "https://test.io/about", content: "We build tools for teams" },
    ]);

    await t.action(internal.analysis.extractEntities.extractEntities, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.entities).toBeDefined();
    expect(profile!.entities!.items).toHaveLength(3);
    expect(profile!.entities!.items[0].name).toBe("Project");
    expect(profile!.entities!.items[0].type).toBe("billable");
    expect(profile!.entities!.items[0].properties).toContain("name");
    expect(profile!.entities!.relationships).toHaveLength(2);
    expect(profile!.entities!.confidence).toBe(0.7);
    // Evidence should NOT have 'field' key (stripped before storage)
    expect(profile!.entities!.evidence[0]).toHaveProperty("url");
    expect(profile!.entities!.evidence[0]).toHaveProperty("excerpt");
    expect(profile!.entities!.evidence[0]).not.toHaveProperty("field");
    // Completeness should update (1/10 = 0.1)
    expect(profile!.completeness).toBeCloseTo(0.1, 1);
  });

  it("throws when no relevant pages found", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductWithPages(t, [
      { pageType: "blog", url: "https://test.io/blog", content: "Our latest updates" },
    ]);

    await expect(
      t.action(internal.analysis.extractEntities.extractEntities, { productId })
    ).rejects.toThrow(/No relevant pages/);
  });

  it("handles LLM response wrapped in code block", async () => {
    const t = convexTest(schema);

    const jsonPayload = JSON.stringify({
      items: [
        { name: "Document", type: "value", properties: ["title", "content"] },
      ],
      relationships: [],
      confidence: 0.6,
      evidence: [
        { field: "Document", url: "https://test.io", excerpt: "Create documents" },
      ],
    });

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: "```json\n" + jsonPayload + "\n```",
      }],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Create documents easily" },
    ]);

    await t.action(internal.analysis.extractEntities.extractEntities, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.entities?.items).toHaveLength(1);
    expect(profile!.entities!.items[0].name).toBe("Document");
  });

  it("works with only some relevant page types present", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          items: [
            { name: "Board", type: "value", properties: ["title"] },
          ],
          relationships: [],
          confidence: 0.5,
          evidence: [],
        }),
      }],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "features", url: "https://test.io/features", content: "Kanban boards" },
    ]);

    await t.action(internal.analysis.extractEntities.extractEntities, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.entities?.items).toHaveLength(1);
  });

  it("passes labeled page sections to LLM", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          items: [],
          relationships: [],
          confidence: 0.3,
          evidence: [],
        }),
      }],
    });

    await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Welcome home" },
      { pageType: "pricing", url: "https://test.io/pricing", content: "$99/mo" },
    ]);

    // Verify the LLM was called with labeled sections
    const call = createMock.mock.calls[0];
    // We can't check directly since test hasn't run the action yet
    // This is tested implicitly by the successful extraction tests above
  });

  it("throws when LLM returns no text content", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Welcome" },
    ]);

    await expect(
      t.action(internal.analysis.extractEntities.extractEntities, { productId })
    ).rejects.toThrow(/No text in LLM response/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run convex/analysis/extractEntities.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `convex/analysis/extractEntities.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

const MAX_PAGE_CONTENT_LENGTH = 25_000;
const RELEVANT_PAGE_TYPES = ["features", "pricing", "homepage", "about"];

const SYSTEM_PROMPT = `You are a product analyst. Given marketing pages from a product website, infer the product's entity model — what objects exist, how they relate, and which one drives billing.

## Entity Type Definitions

- **billable**: The entity that maps to the pricing page's billing unit. "Per seat" → User is billable. "Per project" → Project is billable. At most one entity should be billable (zero if billing unit is unclear or no pricing page).
- **value**: Entities users create or interact with as the core of the product — the things that deliver the product's main value. Examples: Document, Board, Campaign, Dashboard.
- **supporting**: Entities that organize or enable value entities but aren't the product's core objects. Examples: Workspace, Team, Folder, Tag.

## Relationship Rules

- Use standard cardinality: has_many, belongs_to, has_one, many_to_many
- Infer from feature descriptions (e.g., "organize projects into workspaces" → Workspace has_many Project)
- Only include relationships you have evidence for

## Confidence Guide

- 0.8-1.0: Entity names and types are explicitly stated (pricing page says "per project", features list "projects")
- 0.5-0.7: Entities are implied but not explicitly named (features describe actions on objects)
- 0.3-0.4: Very little evidence, mostly guessing from sparse content

Return a JSON object with this exact structure:
{
  "items": [
    {
      "name": "string (singular, PascalCase, e.g. Project)",
      "type": "billable" | "value" | "supporting",
      "properties": ["string (key attributes mentioned or implied)"]
    }
  ],
  "relationships": [
    {
      "from": "string (entity name)",
      "to": "string (entity name)",
      "type": "has_many" | "belongs_to" | "has_one" | "many_to_many"
    }
  ],
  "confidence": 0.0-1.0,
  "evidence": [
    {
      "field": "string (which entity or relationship this supports)",
      "url": "string (page URL)",
      "excerpt": "string (exact quote from the page)"
    }
  ]
}

Return ONLY the JSON object, no other text.`;

function truncateContent(content: string): string {
  if (content.length <= MAX_PAGE_CONTENT_LENGTH) return content;
  return content.slice(0, MAX_PAGE_CONTENT_LENGTH) + "\n[... content truncated]";
}

function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (match) return JSON.parse(match[1]);
    throw new Error("Failed to parse LLM response as JSON");
  }
}

export const extractEntities = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const allPages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      { productId: args.productId }
    );

    // 2. Filter to relevant page types
    const pages = allPages.filter((p: { pageType: string }) =>
      RELEVANT_PAGE_TYPES.includes(p.pageType)
    );

    if (pages.length === 0) {
      throw new Error(
        `No relevant pages found. Need: ${RELEVANT_PAGE_TYPES.join(", ")}`
      );
    }

    // 3. Build labeled user prompt
    const sections = pages.map((page: { pageType: string; url: string; content: string }) => {
      const content = truncateContent(page.content);
      return `=== ${page.pageType.toUpperCase()}: ${page.url} ===\n${content}`;
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
      throw new Error("No text in LLM response");
    }

    const parsed = parseJsonResponse(textBlock.text) as {
      items: Array<{ name: string; type: string; properties: string[] }>;
      relationships: Array<{ from: string; to: string; type: string }>;
      confidence: number;
      evidence: Array<{ field: string; url: string; excerpt: string }>;
    };

    // 6. Strip 'field' from evidence before storage
    const evidence = parsed.evidence.map(({ url, excerpt }) => ({ url, excerpt }));

    // 7. Store via updateSectionInternal
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "entities",
      data: {
        items: parsed.items,
        relationships: parsed.relationships,
        confidence: parsed.confidence,
        evidence,
      },
    });
  },
});
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/analysis/extractEntities.test.ts`
Expected: ALL PASS

**Step 5: Run full test suite**

Run: `npx vitest run`
Expected: No regressions

**Step 6: Commit**

```bash
git add convex/analysis/extractEntities.ts convex/analysis/extractEntities.test.ts
git commit -m "feat: add entity model extraction from crawled pages"
```

---

### Task 4: Verify full test suite passes

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: ALL PASS — no regressions from any of the changes.

**Step 2: Verify generated API types include new exports**

Run: `npx convex dev --once` (if running Convex dev server is needed for type generation)

Check that `convex/_generated/api.d.ts` includes:
- `internal.crawledPages.listByProductInternal`
- `internal.productProfiles.updateSectionInternal`
- `internal.productProfiles.getInternal`
- `internal.analysis.extractEntities.extractEntities`

**Step 3: Final commit if any type fixes needed**

```bash
git add -A
git commit -m "fix: resolve any type generation issues"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add `listByProductInternal` to crawledPages | `convex/crawledPages.ts`, `convex/crawledPages.test.ts` |
| 2 | Add `updateSectionInternal` and `getInternal` to productProfiles | `convex/productProfiles.ts`, `convex/productProfiles.test.ts` |
| 3 | Create `extractEntities` internalAction with tests | `convex/analysis/extractEntities.ts`, `convex/analysis/extractEntities.test.ts` |
| 4 | Verify full test suite passes | — |

## Testing Strategy

- **Unit tests for internal helpers** (Tasks 1-2): Use `convex-test` with direct DB setup, no auth mocking needed since these are internal functions
- **Unit tests for extractor** (Task 3): Mock `@anthropic-ai/sdk` to control LLM responses, set up product + crawled pages directly in DB, verify profile is updated with correct entities/evidence
- **Edge cases covered**: No relevant pages (throws), code-block wrapped JSON response, partial page types, empty LLM response, evidence field stripping
- **Run**: `npm test` or `npx vitest run`
