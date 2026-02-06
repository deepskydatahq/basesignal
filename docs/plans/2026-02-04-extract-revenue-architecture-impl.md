# Extract Revenue Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an internalAction that extracts revenue model, billing unit, tiers, expansion paths, and contraction risks from crawled pricing pages and stores the result on the product profile.

**Architecture:** Two-tier page fetch (pricing pages first, fallback to homepage/features) using the same extractor pattern as S001/S003. The action fetches pages via `listByProductInternal`, sends labeled content to Claude Haiku for structured JSON extraction, strips evidence `field` tags, then stores via `updateSectionInternal`. Both internal helpers are prerequisites — skip Tasks 1-2 if already implemented by another extractor.

**Tech Stack:** Convex (internalAction/internalQuery/internalMutation), Anthropic SDK (Claude Haiku), convex-test + vitest for testing.

**Design doc:** `docs/plans/2026-02-04-extract-revenue-architecture-design.md`

---

## Prerequisites

This task depends on two internal helpers that are part of the S001 (Extract Core Identity) design but **may not be implemented yet**. Tasks 1-2 add these helpers. If S001 or S003 has been implemented by the time this plan runs, skip Tasks 1-2.

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

Update the import at the top of `convex/crawledPages.ts`:

Change:
```typescript
import { query, internalMutation } from "./_generated/server";
```
To:
```typescript
import { query, internalMutation, internalQuery } from "./_generated/server";
```

Then add at the bottom of the file:

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

  // Create profile directly in DB (internal, no auth)
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

### Task 3: Create `extractRevenue` internalAction with tests

**Files:**
- Create: `convex/analysis/extractRevenue.ts`
- Create: `convex/analysis/extractRevenue.test.ts`

**Step 1: Write the failing test**

Create `convex/analysis/extractRevenue.test.ts`:

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
    const now = Date.now();
    const productId = await ctx.db.insert("products", {
      name: "Test Product",
      url: "https://test.io",
      userId,
      createdAt: now,
      updatedAt: now,
    });
    const scanJobId = await ctx.db.insert("scanJobs", {
      productId,
      userId,
      status: "complete",
      url: "https://test.io",
      pagesCrawled: pages.length,
      currentPhase: "complete",
      startedAt: now,
    });
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

describe("extractRevenue", () => {
  let createMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@anthropic-ai/sdk");
    createMock = (mod as any).__createMock;
    createMock.mockReset();
  });

  it("extracts revenue from pricing page and stores on profile", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          model: "seat-based subscription",
          billingUnit: "seat",
          hasFreeTier: true,
          tiers: [
            { name: "Free", price: "$0/month", features: ["5 users", "Basic features"] },
            { name: "Pro", price: "$12/seat/month", features: ["Unlimited users", "API access"] },
            { name: "Enterprise", price: "Custom", features: ["SSO", "Dedicated support"] },
          ],
          expansionPaths: ["Seat upgrades", "Tier upgrades from Free to Pro"],
          contractionRisks: ["Seat removal", "Downgrade to Free tier"],
          confidence: 0.85,
          evidence: [
            { field: "model", url: "https://test.io/pricing", excerpt: "$12 per seat per month" },
            { field: "hasFreeTier", url: "https://test.io/pricing", excerpt: "Free plan - up to 5 users" },
          ],
        }),
      }],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "pricing", url: "https://test.io/pricing", content: "Pricing: Free $0/mo (5 users), Pro $12/seat/mo, Enterprise: Contact us" },
    ]);

    await t.action(internal.analysis.extractRevenue.extractRevenue, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.revenue).toBeDefined();
    expect(profile!.revenue!.model).toBe("seat-based subscription");
    expect(profile!.revenue!.billingUnit).toBe("seat");
    expect(profile!.revenue!.hasFreeTier).toBe(true);
    expect(profile!.revenue!.tiers).toHaveLength(3);
    expect(profile!.revenue!.tiers[0].name).toBe("Free");
    expect(profile!.revenue!.tiers[1].price).toBe("$12/seat/month");
    expect(profile!.revenue!.expansionPaths).toHaveLength(2);
    expect(profile!.revenue!.contractionRisks).toHaveLength(2);
    expect(profile!.revenue!.confidence).toBe(0.85);
    // Evidence should NOT have 'field' key (stripped before storage)
    expect(profile!.revenue!.evidence[0]).toHaveProperty("url");
    expect(profile!.revenue!.evidence[0]).toHaveProperty("excerpt");
    expect(profile!.revenue!.evidence[0]).not.toHaveProperty("field");
    // Completeness should update (1/10 = 0.1)
    expect(profile!.completeness).toBeCloseTo(0.1, 1);
  });

  it("falls back to homepage/features when no pricing page exists", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          model: "freemium",
          hasFreeTier: true,
          tiers: [
            { name: "Free", price: "$0", features: ["Basic"] },
          ],
          expansionPaths: ["Premium upgrade"],
          contractionRisks: ["Churn to free competitors"],
          confidence: 0.45,
          evidence: [
            { field: "model", url: "https://test.io", excerpt: "Get started for free" },
          ],
        }),
      }],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Get started for free. Premium plans available." },
      { pageType: "features", url: "https://test.io/features", content: "Feature list: Basic (free), Premium ($29/mo)" },
    ]);

    await t.action(internal.analysis.extractRevenue.extractRevenue, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.revenue).toBeDefined();
    expect(profile!.revenue!.model).toBe("freemium");
    expect(profile!.revenue!.confidence).toBe(0.45);
  });

  it("uses pricing pages only when both pricing and homepage exist", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          model: "subscription",
          hasFreeTier: false,
          tiers: [{ name: "Pro", price: "$49/mo", features: ["All features"] }],
          expansionPaths: [],
          contractionRisks: [],
          confidence: 0.8,
          evidence: [],
        }),
      }],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "pricing", url: "https://test.io/pricing", content: "Pro plan $49/mo" },
      { pageType: "homepage", url: "https://test.io", content: "Welcome to our product" },
      { pageType: "features", url: "https://test.io/features", content: "Features overview" },
    ]);

    await t.action(internal.analysis.extractRevenue.extractRevenue, { productId });

    // Verify only pricing page was sent to LLM (not homepage/features)
    const call = createMock.mock.calls[0];
    const userMessage = call[0].messages[0].content;
    expect(userMessage).toContain("https://test.io/pricing");
    expect(userMessage).not.toContain("https://test.io/features");
    expect(userMessage).not.toContain("Welcome to our product");
  });

  it("throws when no relevant pages found", async () => {
    const t = convexTest(schema);
    const { productId } = await setupProductWithPages(t, [
      { pageType: "blog", url: "https://test.io/blog", content: "Our latest updates" },
      { pageType: "docs", url: "https://test.io/docs", content: "API documentation" },
    ]);

    await expect(
      t.action(internal.analysis.extractRevenue.extractRevenue, { productId })
    ).rejects.toThrow(/No relevant pages/);
  });

  it("handles LLM response wrapped in code block", async () => {
    const t = convexTest(schema);

    const jsonPayload = JSON.stringify({
      model: "usage-based",
      billingUnit: "API call",
      hasFreeTier: true,
      tiers: [
        { name: "Free", price: "$0", features: ["1000 API calls/month"] },
        { name: "Pay-as-you-go", price: "$0.01/call", features: ["Unlimited"] },
      ],
      expansionPaths: ["Increased usage volume"],
      contractionRisks: ["Usage drop"],
      confidence: 0.7,
      evidence: [],
    });

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: "```json\n" + jsonPayload + "\n```",
      }],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "pricing", url: "https://test.io/pricing", content: "Usage-based pricing" },
    ]);

    await t.action(internal.analysis.extractRevenue.extractRevenue, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.revenue?.model).toBe("usage-based");
    expect(profile!.revenue!.billingUnit).toBe("API call");
  });

  it("handles billingUnit being null", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [{
        type: "text",
        text: JSON.stringify({
          model: "one-time purchase",
          billingUnit: null,
          hasFreeTier: false,
          tiers: [{ name: "License", price: "$299", features: ["Perpetual license"] }],
          expansionPaths: ["Add-on modules"],
          contractionRisks: [],
          confidence: 0.65,
          evidence: [],
        }),
      }],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "pricing", url: "https://test.io/pricing", content: "One-time purchase $299" },
    ]);

    await t.action(internal.analysis.extractRevenue.extractRevenue, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.revenue?.billingUnit).toBeUndefined();
    expect(profile!.revenue!.model).toBe("one-time purchase");
  });

  it("throws when LLM returns no text content", async () => {
    const t = convexTest(schema);

    createMock.mockResolvedValueOnce({
      content: [],
    });

    const { productId } = await setupProductWithPages(t, [
      { pageType: "pricing", url: "https://test.io/pricing", content: "Pricing info" },
    ]);

    await expect(
      t.action(internal.analysis.extractRevenue.extractRevenue, { productId })
    ).rejects.toThrow(/No text in LLM response/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run convex/analysis/extractRevenue.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

Create `convex/analysis/extractRevenue.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

const MAX_PAGE_CONTENT_LENGTH = 25_000;
const PRIMARY_PAGE_TYPES = ["pricing"];
const FALLBACK_PAGE_TYPES = ["homepage", "features"];

const SYSTEM_PROMPT = `You are a product analyst specializing in SaaS business models. Given marketing pages from a product website, extract the revenue architecture — how the product charges, what tiers exist, and how revenue expands or contracts.

## Revenue Model Types

Use one of these common model strings (or a short descriptive phrase if none fit):
- subscription (flat monthly/annual)
- seat-based subscription (per-seat pricing)
- usage-based (pay per use / metered)
- tiered subscription (tier-based feature gating)
- freemium (free tier + paid upgrade)
- one-time purchase (perpetual license)
- marketplace / transaction fee
- hybrid (combines multiple models)
- open-source with paid tier

## Billing Unit

The unit customers pay for: "seat", "user", "API call", "GB", "project", "workspace", etc.
Set to null if the billing unit is not clearly stated on the page.

## Free Tier

Set hasFreeTier to true if the product offers any form of free access — including free trials, freemium plans, or free-forever tiers. From the user perspective, any access without payment counts.

## Expansion & Contraction

- expansionPaths: How revenue grows from existing customers (seat additions, tier upgrades, usage growth, add-on purchases)
- contractionRisks: How revenue shrinks (seat removal, tier downgrade, usage drop, churn)
- Infer these from the pricing structure even if not explicitly stated

## Confidence Guide

Higher confidence when extracting from a dedicated pricing page with clear tiers and prices. Lower confidence when inferring from homepage/features pages that only hint at pricing.

Return a JSON object with this exact structure:
{
  "model": "string (one of the common types above or a short phrase)",
  "billingUnit": "string or null",
  "hasFreeTier": true/false,
  "tiers": [
    {
      "name": "string (tier name, e.g. Free, Pro, Enterprise)",
      "price": "string (as displayed, e.g. '$12/seat/month', 'Custom', '$0')",
      "features": ["string (key features of this tier)"]
    }
  ],
  "expansionPaths": ["string (how revenue grows from existing customers)"],
  "contractionRisks": ["string (how revenue shrinks)"],
  "confidence": 0.0-1.0,
  "evidence": [
    {
      "field": "string (which field this supports, e.g. 'model', 'hasFreeTier', 'tiers')",
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

export const extractRevenue = internalAction({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    // 1. Fetch crawled pages
    const allPages = await ctx.runQuery(
      internal.crawledPages.listByProductInternal,
      { productId: args.productId }
    );

    // 2. Two-tier page selection: pricing first, fallback to homepage/features
    let pages = allPages.filter((p: { pageType: string }) =>
      PRIMARY_PAGE_TYPES.includes(p.pageType)
    );

    if (pages.length === 0) {
      pages = allPages.filter((p: { pageType: string }) =>
        FALLBACK_PAGE_TYPES.includes(p.pageType)
      );
    }

    if (pages.length === 0) {
      throw new Error(
        `No relevant pages found. Need: ${PRIMARY_PAGE_TYPES.join(", ")} or ${FALLBACK_PAGE_TYPES.join(", ")}`
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
      model: string;
      billingUnit: string | null;
      hasFreeTier: boolean;
      tiers: Array<{ name: string; price: string; features: string[] }>;
      expansionPaths: string[];
      contractionRisks: string[];
      confidence: number;
      evidence: Array<{ field?: string; url: string; excerpt: string }>;
    };

    // 6. Strip 'field' from evidence before storage
    const evidence = parsed.evidence.map(({ url, excerpt }) => ({ url, excerpt }));

    // 7. Build data, converting null billingUnit to undefined (Convex optional field)
    const data: Record<string, unknown> = {
      model: parsed.model,
      hasFreeTier: parsed.hasFreeTier,
      tiers: parsed.tiers,
      expansionPaths: parsed.expansionPaths,
      contractionRisks: parsed.contractionRisks,
      confidence: parsed.confidence,
      evidence,
    };
    if (parsed.billingUnit) {
      data.billingUnit = parsed.billingUnit;
    }

    // 8. Store via updateSectionInternal
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "revenue",
      data,
    });
  },
});
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/analysis/extractRevenue.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add convex/analysis/extractRevenue.ts convex/analysis/extractRevenue.test.ts
git commit -m "feat: add revenue architecture extraction from crawled pages"
```

---

### Task 4: Run full test suite and verify no regressions

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: ALL PASS — no regressions from any of the changes.

**Step 2: Verify generated API types include new exports**

Check that `convex/_generated/api.d.ts` includes:
- `internal.crawledPages.listByProductInternal`
- `internal.productProfiles.updateSectionInternal`
- `internal.productProfiles.getInternal`
- `internal.analysis.extractRevenue.extractRevenue`

Note: Convex auto-generates types when `npx convex dev` is running. During testing, `convex-test` handles this. If type generation issues arise, run `npx convex dev --once`.

**Step 3: Commit if any fixes needed**

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
| 3 | Create `extractRevenue` internalAction with tests | `convex/analysis/extractRevenue.ts`, `convex/analysis/extractRevenue.test.ts` |
| 4 | Run full test suite, verify no regressions | — |

## Testing Strategy

- **Unit tests for internal helpers** (Tasks 1-2): Use `convex-test` with direct DB setup, no auth mocking needed since these are internal functions
- **Unit tests for extractor** (Task 3): Mock `@anthropic-ai/sdk` to control LLM responses, set up product + crawled pages directly in DB, verify profile is updated with correct revenue data/evidence
- **Edge cases covered**:
  - Two-tier fallback: pricing pages preferred, homepage/features used when no pricing exists
  - Pricing exclusivity: homepage/features NOT included when pricing page exists
  - No relevant pages (throws)
  - Code-block wrapped JSON response
  - Null billingUnit → undefined in Convex (optional field)
  - Empty LLM response (throws)
  - Evidence field stripping (field tag removed before storage)
- **Run**: `npm test` or `npx vitest run`
