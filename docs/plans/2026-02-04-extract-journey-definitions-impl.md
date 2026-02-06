# Extract Journey Stages & Lifecycle Definitions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create `convex/analysis/extractJourney.ts` — an internalAction that extracts journey stages and infers lifecycle definitions (activation, firstValue, active, atRisk, churn) from crawled marketing content using two sequential Claude Haiku calls, storing results as two separate profile sections.

**Architecture:** Single internalAction with two sequential LLM calls. Call 1 extracts observable journey stages from marketing copy (higher confidence). Call 2 uses the journey output plus business model context to infer lifecycle definitions with `source: 'ai-inferred'` (lower confidence). Journey is persisted before the definitions call, so partial success is possible. Uses shared internal helpers (`listByProductInternal`, `getInternal`, `updateSectionInternal`).

**Tech Stack:** Convex (internalAction, internalMutation, internalQuery), Anthropic SDK (Claude Haiku), convex-test + Vitest for testing.

---

## Prerequisites

Before starting, these internal helpers must exist. If they don't, Task 1 covers adding them (they are shared by all S001-S007 extractors):

- `crawledPages.listByProductInternal` — internalQuery in `convex/crawledPages.ts`
- `productProfiles.createInternal` — internalMutation in `convex/productProfiles.ts`
- `productProfiles.updateSectionInternal` — internalMutation in `convex/productProfiles.ts`
- `productProfiles.getInternal` — internalQuery in `convex/productProfiles.ts`

---

## Task 1: Add shared internal helpers (if missing)

**Files:**
- Modify: `convex/crawledPages.ts` (add `listByProductInternal`)
- Modify: `convex/productProfiles.ts` (add `createInternal`, `updateSectionInternal`, `getInternal`)

**Step 1: Check if helpers already exist**

```bash
grep -n "listByProductInternal\|updateSectionInternal\|createInternal\|getInternal" convex/crawledPages.ts convex/productProfiles.ts
```

If all four exist, skip to Task 2.

**Step 2: Add `listByProductInternal` to `convex/crawledPages.ts`**

Update the server import at line 1 to include `internalQuery`:
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

**Step 3: Add `createInternal`, `updateSectionInternal`, `getInternal` to `convex/productProfiles.ts`**

Update the server import at line 1 to include `internalMutation` and `internalQuery`:
```typescript
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
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

**Step 4: Run tests to verify nothing broke**

```bash
npm run test:run
```

Expected: All existing tests pass.

**Step 5: Commit**

```bash
git add convex/crawledPages.ts convex/productProfiles.ts
git commit -m "feat: add internal helpers for analysis pipeline (listByProductInternal, createInternal, updateSectionInternal, getInternal)"
```

---

## Task 2: Write failing tests for extractJourney

**Files:**
- Create: `convex/analysis/extractJourney.test.ts`

**Context:** The extractJourney function is an `internalAction` that makes two Claude Haiku calls — one for journey stages, one for lifecycle definitions. For unit testing, we mock the Anthropic SDK and verify data flow: input validation, output schema, storage, and the two-call sequence.

**Important references:**
- Journey schema: `convex/schema.ts:491-498` — `{ stages: [{ name, description, order }], confidence, evidence: [{ url, excerpt }] }`
- Definitions schema: `convex/schema.ts:502-543` — `{ activation: { criteria[], timeWindow?, reasoning, confidence, source, evidence[] }, firstValue: { description, criteria[], ... }, active: {...}, atRisk: {...}, churn: {...} }`
- Existing test pattern: `convex/productProfiles.test.ts` — `convexTest(schema)`, `t.run()`, mock setup
- The extractOutcomes pattern: `convex/analysis/extractOutcomes.test.ts` (sibling extractor)

**Step 1: Write the test file**

```typescript
// convex/analysis/extractJourney.test.ts
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

// Helper: set up a product with crawled pages, profile, and optional identity
async function setupProductWithPages(
  t: ReturnType<typeof convexTest>,
  pages: Array<{ pageType: string; url: string; content: string; title?: string }> = [],
  identity?: {
    productName: string;
    description: string;
    targetCustomer: string;
    businessModel: string;
    confidence: number;
    evidence: Array<{ url: string; excerpt: string }>;
  }
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
      ...(identity ? { identity } : {}),
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

// Standard mock response for journey stages (Call 1)
function makeMockJourneyResponse() {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          stages: [
            { name: "Sign Up", description: "User creates an account via free trial or demo request", order: 0 },
            { name: "First Value", description: "User creates their first project and invites a teammate", order: 1 },
            { name: "Activated", description: "User has completed onboarding and uses core features regularly", order: 2 },
            { name: "Active", description: "User engages with product weekly, using multiple features", order: 3 },
            { name: "Paying", description: "User converts from free trial to paid plan", order: 4 },
          ],
          confidence: 0.55,
          evidence: [
            { field: "stages", url: "https://test.io", excerpt: "Start your free trial today" },
            { field: "stages", url: "https://test.io/pricing", excerpt: "Free plan available, upgrade anytime" },
          ],
        }),
      },
    ],
  };
}

// Standard mock response for lifecycle definitions (Call 2)
function makeMockDefinitionsResponse() {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          activation: {
            criteria: ["Created first project", "Invited at least one teammate"],
            timeWindow: "7 days",
            reasoning: "Onboarding flow emphasizes project creation and team collaboration as first steps",
            confidence: 0.4,
            source: "ai-inferred",
            evidence: [
              { field: "activation", url: "https://test.io", excerpt: "Get started by creating your first project" },
            ],
          },
          firstValue: {
            description: "User experiences the core collaboration benefit by working with a teammate on a shared project",
            criteria: ["Shared a project with a teammate", "Both users made edits"],
            reasoning: "Hero messaging focuses on real-time collaboration; first value comes from experiencing it",
            confidence: 0.35,
            source: "ai-inferred",
            evidence: [
              { field: "firstValue", url: "https://test.io", excerpt: "Collaborate in real-time with your team" },
            ],
          },
          active: {
            criteria: ["Logged in within last 7 days", "Performed at least one core action"],
            timeWindow: "7 days",
            reasoning: "Weekly engagement pattern inferred from feature descriptions suggesting regular use",
            confidence: 0.35,
            source: "ai-inferred",
            evidence: [
              { field: "active", url: "https://test.io/features", excerpt: "Stay on top of your projects" },
            ],
          },
          atRisk: {
            criteria: ["No login for 14+ days", "No core actions for 21+ days"],
            timeWindow: "14-21 days",
            reasoning: "Absence beyond two weekly cycles suggests disengagement",
            confidence: 0.3,
            source: "ai-inferred",
            evidence: [
              { field: "atRisk", url: "https://test.io", excerpt: "Never miss an update" },
            ],
          },
          churn: {
            criteria: ["No login for 30+ days", "Subscription cancelled or expired"],
            timeWindow: "30 days",
            reasoning: "30-day inactivity is standard churn signal; cancellation is explicit",
            confidence: 0.3,
            source: "ai-inferred",
            evidence: [
              { field: "churn", url: "https://test.io/pricing", excerpt: "Cancel anytime" },
            ],
          },
        }),
      },
    ],
  };
}

describe("extractJourney", () => {
  let createMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const mod = await import("@anthropic-ai/sdk");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createMock = (mod as any).__createMock;
    createMock.mockReset();
  });

  it("extracts journey stages as array of { name, description, order }", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Start your free trial today" },
      { pageType: "pricing", url: "https://test.io/pricing", content: "Free plan, Pro plan $29/mo" },
    ]);

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile?.journey).toBeDefined();
    expect(profile!.journey!.stages).toHaveLength(5);
    expect(profile!.journey!.stages[0]).toEqual({
      name: "Sign Up",
      description: "User creates an account via free trial or demo request",
      order: 0,
    });
    // Stages should be ordered
    for (let i = 1; i < profile!.journey!.stages.length; i++) {
      expect(profile!.journey!.stages[i].order).toBeGreaterThan(
        profile!.journey!.stages[i - 1].order
      );
    }
  });

  it("drafts activation definition with criteria, timeWindow, reasoning, and evidence", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Get started by creating your first project" },
    ]);

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    const activation = profile!.definitions!.activation!;
    expect(activation.criteria).toBeInstanceOf(Array);
    expect(activation.criteria.length).toBeGreaterThan(0);
    expect(activation.timeWindow).toBeDefined();
    expect(activation.reasoning).toBeDefined();
    expect(typeof activation.reasoning).toBe("string");
    expect(activation.evidence).toBeInstanceOf(Array);
    expect(activation.evidence.length).toBeGreaterThan(0);
    expect(activation.evidence[0]).toHaveProperty("url");
    expect(activation.evidence[0]).toHaveProperty("excerpt");
    // Evidence should NOT have 'field' key (stripped before storage)
    expect(activation.evidence[0]).not.toHaveProperty("field");
  });

  it("drafts firstValue definition with description, criteria, reasoning, and evidence", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Collaborate in real-time" },
    ]);

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    const firstValue = profile!.definitions!.firstValue!;
    expect(firstValue.description).toBeDefined();
    expect(typeof firstValue.description).toBe("string");
    expect(firstValue.criteria).toBeInstanceOf(Array);
    expect(firstValue.criteria.length).toBeGreaterThan(0);
    expect(firstValue.reasoning).toBeDefined();
    expect(firstValue.evidence).toBeInstanceOf(Array);
    expect(firstValue.evidence[0]).not.toHaveProperty("field");
  });

  it("drafts active, atRisk, and churn definitions with same structure", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Stay on top" },
      { pageType: "features", url: "https://test.io/features", content: "Features page" },
    ]);

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    for (const key of ["active", "atRisk", "churn"] as const) {
      const def = profile!.definitions![key]!;
      expect(def, `${key} should be defined`).toBeDefined();
      expect(def.criteria).toBeInstanceOf(Array);
      expect(def.criteria.length).toBeGreaterThan(0);
      expect(def.reasoning).toBeDefined();
      expect(def.confidence).toBeGreaterThanOrEqual(0);
      expect(def.confidence).toBeLessThanOrEqual(1);
      expect(def.evidence).toBeInstanceOf(Array);
      expect(def.evidence[0]).not.toHaveProperty("field");
    }
  });

  it("sets source to 'ai-inferred' on all definitions", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Content" },
    ]);

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    for (const key of ["activation", "firstValue", "active", "atRisk", "churn"] as const) {
      expect(profile!.definitions![key]!.source).toBe("ai-inferred");
    }
  });

  it("definition confidence scores are medium-low (0.3-0.5)", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Content" },
    ]);

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    for (const key of ["activation", "firstValue", "active", "atRisk", "churn"] as const) {
      const conf = profile!.definitions![key]!.confidence;
      expect(conf).toBeGreaterThanOrEqual(0.2);
      expect(conf).toBeLessThanOrEqual(0.6);
    }
  });

  it("stores journey and definitions as separate sections, updating completeness", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Content" },
    ]);

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    // journey = 1 section, definitions.activation + firstValue + active + churn = 4 sections = 5/10 total
    expect(profile!.completeness).toBeCloseTo(0.5, 1);
    expect(profile!.journey!.confidence).toBe(0.55);
    expect(profile!.updatedAt).toBeGreaterThan(profile!.createdAt);
  });

  it("throws when no relevant pages found", async () => {
    const t = convexTest(schema);

    const { productId } = await setupProductWithPages(t, [
      // Only a customers page — not homepage/about/features/pricing
      { pageType: "customers", url: "https://test.io/customers", content: "Customer stories" },
    ]);

    await expect(
      t.action(internal.analysis.extractJourney.extractJourney, { productId })
    ).rejects.toThrow();
  });

  it("handles LLM response wrapped in code block", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: "```json\n" + JSON.stringify({
              stages: [
                { name: "Trial", description: "User starts trial", order: 0 },
                { name: "Active", description: "User is active", order: 1 },
              ],
              confidence: 0.5,
              evidence: [{ field: "stages", url: "https://test.io", excerpt: "Start trial" }],
            }) + "\n```",
          },
        ],
      })
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Start trial" },
    ]);

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile!.journey!.stages[0].name).toBe("Trial");
  });

  it("uses businessModel from identity when available", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    const identity = {
      productName: "Acme SaaS",
      description: "A project management tool",
      targetCustomer: "Engineering teams",
      businessModel: "B2B SaaS, product-led growth",
      confidence: 0.8,
      evidence: [{ url: "https://test.io", excerpt: "Built for teams" }],
    };

    const { productId } = await setupProductWithPages(
      t,
      [{ pageType: "homepage", url: "https://test.io", content: "Content" }],
      identity
    );

    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    // Verify the second call (definitions) received businessModel context
    expect(createMock).toHaveBeenCalledTimes(2);
    const definitionsCall = createMock.mock.calls[1];
    const userMessage = definitionsCall[0].messages[0].content;
    expect(userMessage).toContain("B2B SaaS, product-led growth");
  });

  it("proceeds without businessModel when identity is not yet extracted", async () => {
    const t = convexTest(schema);
    createMock
      .mockResolvedValueOnce(makeMockJourneyResponse())
      .mockResolvedValueOnce(makeMockDefinitionsResponse());

    // No identity set on profile
    const { productId } = await setupProductWithPages(t, [
      { pageType: "homepage", url: "https://test.io", content: "Content" },
    ]);

    // Should not throw — proceeds with null businessModel
    await t.action(internal.analysis.extractJourney.extractJourney, { productId });

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query("productProfiles")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .first();
    });

    expect(profile!.journey).toBeDefined();
    expect(profile!.definitions).toBeDefined();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm run test:run -- convex/analysis/extractJourney.test.ts
```

Expected: FAIL — module `convex/analysis/extractJourney` does not exist.

**Step 3: Commit**

```bash
git add convex/analysis/extractJourney.test.ts
git commit -m "test: add failing tests for extractJourney"
```

---

## Task 3: Implement extractJourney internalAction

**Files:**
- Create: `convex/analysis/extractJourney.ts`

**Context:**
- Must be an `internalAction` (no user auth context — called by orchestrator)
- Two sequential Claude Haiku calls: journey stages first, then lifecycle definitions
- Uses `ctx.runQuery` for `listByProductInternal` and `getInternal`
- Uses `ctx.runMutation` for `updateSectionInternal` (called twice — once for journey, once for definitions)
- Journey is stored before definitions call (partial success safe)
- Reads `identity.businessModel` from profile if available
- Truncates page content to ~25KB each
- Parses JSON response, strips `field` from evidence, stores result

**Step 1: Create the extractJourney module**

```typescript
// convex/analysis/extractJourney.ts
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

const MAX_PAGE_CONTENT_LENGTH = 25_000;
const RELEVANT_PAGE_TYPES = ["homepage", "about", "features", "pricing"];

const JOURNEY_SYSTEM_PROMPT = `You are a product analyst. Analyze the provided marketing content and extract the observable user journey stages for this product.

Look for signals in:
- Pricing tiers and plan names (e.g., "Free trial → Pro → Enterprise")
- Onboarding flows and getting-started guides
- Feature descriptions that imply lifecycle progression
- CTAs that show the user path (e.g., "Sign up free", "Start trial", "Upgrade")

Return a JSON object with this exact structure:
{
  "stages": [
    {
      "name": "string — product-specific stage name (e.g., 'Sign Up', 'First Project', 'Team Adoption')",
      "description": "string — what the user does/achieves at this stage",
      "order": number — 0-indexed sequential order
    }
  ],
  "confidence": 0.0-1.0,
  "evidence": [
    {
      "field": "stages",
      "url": "string — the page URL",
      "excerpt": "string — exact quote from the page"
    }
  ]
}

Stage naming rules:
- Use product-specific names, not generic lifecycle labels
- Typical stages: signup/trial → first value moment → activated → regular usage → paying/upgrading
- 3-7 stages is typical; don't force more than the content supports
- Order should reflect the natural user progression

Confidence scoring:
- 0.5-0.7: Clear pricing tiers and onboarding flow visible
- 0.3-0.5: Some lifecycle signals but gaps in the journey
- 0.1-0.3: Very limited content, mostly inferring from feature descriptions

Return ONLY the JSON object, no markdown formatting or explanation.`;

const DEFINITIONS_SYSTEM_PROMPT = `You are a product analyst. Based on the marketing content, journey stages, and business model context provided, infer lifecycle definitions for this product.

You are creating DRAFT definitions — starting points that a product team will refine with their actual data. Be explicit about what you're inferring vs. observing.

Return a JSON object with this exact structure:
{
  "activation": {
    "criteria": ["string — observable action that signals activation"],
    "timeWindow": "string — expected time from signup (e.g., '7 days')",
    "reasoning": "string — why these criteria indicate activation based on the marketing content",
    "confidence": 0.3-0.5,
    "source": "ai-inferred",
    "evidence": [{ "field": "activation", "url": "string", "excerpt": "string" }]
  },
  "firstValue": {
    "description": "string — what 'first value' looks like for this product's users",
    "criteria": ["string — observable action that signals first value delivery"],
    "reasoning": "string — why this represents the first value moment",
    "confidence": 0.3-0.5,
    "source": "ai-inferred",
    "evidence": [{ "field": "firstValue", "url": "string", "excerpt": "string" }]
  },
  "active": {
    "criteria": ["string — observable action that signals active usage"],
    "timeWindow": "string — measurement window (e.g., '7 days')",
    "reasoning": "string — why these criteria indicate active usage",
    "confidence": 0.3-0.5,
    "source": "ai-inferred",
    "evidence": [{ "field": "active", "url": "string", "excerpt": "string" }]
  },
  "atRisk": {
    "criteria": ["string — observable signal that a user is at risk of churning"],
    "timeWindow": "string — inactivity window (e.g., '14-21 days')",
    "reasoning": "string — why these signals indicate risk",
    "confidence": 0.3-0.5,
    "source": "ai-inferred",
    "evidence": [{ "field": "atRisk", "url": "string", "excerpt": "string" }]
  },
  "churn": {
    "criteria": ["string — observable signal that a user has churned"],
    "timeWindow": "string — inactivity threshold (e.g., '30 days')",
    "reasoning": "string — why this threshold indicates churn",
    "confidence": 0.3-0.5,
    "source": "ai-inferred",
    "evidence": [{ "field": "churn", "url": "string", "excerpt": "string" }]
  }
}

Key rules:
- ALL confidence scores MUST be between 0.3 and 0.5 — these are drafts, not validated definitions
- ALL source fields MUST be "ai-inferred"
- Criteria should be specific observable actions, not vague statements
- Reasoning should reference specific marketing content that informed the inference
- If business model context is provided, use it to calibrate (PLG vs sales-led vs hybrid)
- For PLG: emphasize self-serve milestones (first project, invite, upgrade)
- For sales-led: emphasize onboarding milestones (trial, demo, contract)

Return ONLY the JSON object, no markdown formatting or explanation.`;

function truncateContent(content: string): string {
  if (content.length <= MAX_PAGE_CONTENT_LENGTH) return content;
  return content.slice(0, MAX_PAGE_CONTENT_LENGTH) + "\n[... content truncated]";
}

function parseJsonResponse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
    throw new Error("Failed to parse LLM response as JSON");
  }
}

function stripFieldFromEvidence(
  evidence: Array<{ field?: string; url: string; excerpt: string }>
): Array<{ url: string; excerpt: string }> {
  return evidence.map(({ url, excerpt }) => ({ url, excerpt }));
}

export const extractJourney = internalAction({
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

    // 3. Read existing profile for businessModel context
    const profile = await ctx.runQuery(
      internal.productProfiles.getInternal,
      { productId: args.productId }
    );
    const businessModel = profile?.identity?.businessModel ?? null;

    // 4. Build page content for prompts
    const sections = pages.map((page) => {
      const content = truncateContent(page.content);
      return `=== ${page.pageType.toUpperCase()} PAGE: ${page.url} ===\n${content}`;
    });
    const pageContent = sections.join("\n\n");

    // 5. Initialize Anthropic client
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // === LLM Call 1: Journey Stages ===
    const journeyResponse = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 2048,
      system: JOURNEY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: pageContent }],
    });

    const journeyTextBlock = journeyResponse.content.find((b) => b.type === "text");
    if (!journeyTextBlock || journeyTextBlock.type !== "text") {
      throw new Error("No text content in journey LLM response");
    }

    const journeyParsed = parseJsonResponse(journeyTextBlock.text) as {
      stages: Array<{ name: string; description: string; order: number }>;
      confidence: number;
      evidence: Array<{ field?: string; url: string; excerpt: string }>;
    };

    // Store journey immediately (partial success safe)
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "journey",
      data: {
        stages: journeyParsed.stages,
        confidence: journeyParsed.confidence,
        evidence: stripFieldFromEvidence(journeyParsed.evidence),
      },
    });

    // === LLM Call 2: Lifecycle Definitions ===
    const stagesContext = journeyParsed.stages
      .map((s) => `${s.order}. ${s.name}: ${s.description}`)
      .join("\n");

    const definitionsUserPrompt = [
      businessModel ? `=== BUSINESS MODEL ===\n${businessModel}\n` : "",
      `=== JOURNEY STAGES ===\n${stagesContext}\n`,
      pageContent,
    ]
      .filter(Boolean)
      .join("\n");

    const definitionsResponse = await client.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 4096,
      system: DEFINITIONS_SYSTEM_PROMPT,
      messages: [{ role: "user", content: definitionsUserPrompt }],
    });

    const defTextBlock = definitionsResponse.content.find((b) => b.type === "text");
    if (!defTextBlock || defTextBlock.type !== "text") {
      throw new Error("No text content in definitions LLM response");
    }

    const defParsed = parseJsonResponse(defTextBlock.text) as {
      activation: {
        criteria: string[];
        timeWindow?: string;
        reasoning: string;
        confidence: number;
        source: string;
        evidence: Array<{ field?: string; url: string; excerpt: string }>;
      };
      firstValue: {
        description: string;
        criteria: string[];
        reasoning: string;
        confidence: number;
        source: string;
        evidence: Array<{ field?: string; url: string; excerpt: string }>;
      };
      active: {
        criteria: string[];
        timeWindow?: string;
        reasoning: string;
        confidence: number;
        source: string;
        evidence: Array<{ field?: string; url: string; excerpt: string }>;
      };
      atRisk: {
        criteria: string[];
        timeWindow?: string;
        reasoning: string;
        confidence: number;
        source: string;
        evidence: Array<{ field?: string; url: string; excerpt: string }>;
      };
      churn: {
        criteria: string[];
        timeWindow?: string;
        reasoning: string;
        confidence: number;
        source: string;
        evidence: Array<{ field?: string; url: string; excerpt: string }>;
      };
    };

    // Strip 'field' from all evidence arrays and enforce source='ai-inferred'
    const definitions = {
      activation: {
        ...defParsed.activation,
        source: "ai-inferred",
        evidence: stripFieldFromEvidence(defParsed.activation.evidence),
      },
      firstValue: {
        ...defParsed.firstValue,
        source: "ai-inferred",
        evidence: stripFieldFromEvidence(defParsed.firstValue.evidence),
      },
      active: {
        ...defParsed.active,
        source: "ai-inferred",
        evidence: stripFieldFromEvidence(defParsed.active.evidence),
      },
      atRisk: {
        ...defParsed.atRisk,
        source: "ai-inferred",
        evidence: stripFieldFromEvidence(defParsed.atRisk.evidence),
      },
      churn: {
        ...defParsed.churn,
        source: "ai-inferred",
        evidence: stripFieldFromEvidence(defParsed.churn.evidence),
      },
    };

    // Store definitions
    await ctx.runMutation(internal.productProfiles.updateSectionInternal, {
      productId: args.productId,
      section: "definitions",
      data: definitions,
    });
  },
});
```

**Step 2: Run tests to verify they pass**

```bash
npm run test:run -- convex/analysis/extractJourney.test.ts
```

Expected: All 11 tests PASS.

**Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: All tests pass, including existing productProfiles tests.

**Step 4: Commit**

```bash
git add convex/analysis/extractJourney.ts
git commit -m "feat: implement extractJourney internalAction for journey stages and lifecycle definitions"
```

---

## Task 4: Verify integration with type system and lint

**Files:**
- None modified — verification only

**Step 1: Run TypeScript type check**

```bash
npx tsc --noEmit
```

Expected: No type errors. The Convex code generation should pick up the new internalAction and make it available at `internal.analysis.extractJourney.extractJourney`.

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
| 2 | Write failing tests for extractJourney (11 test cases) | `convex/analysis/extractJourney.test.ts` (new) |
| 3 | Implement extractJourney internalAction | `convex/analysis/extractJourney.ts` (new) |
| 4 | Verify types, lint, full test suite | None (verification) |

**Total: 4 tasks, TDD approach (tests before implementation)**

### Key patterns to follow
- `internalAction` for the extractor (no user auth context)
- Two sequential Claude Haiku calls: journey stages (higher confidence) → lifecycle definitions (lower confidence)
- Journey stored before definitions call (partial success safe)
- `ctx.runQuery(internal.productProfiles.getInternal)` to read businessModel context
- `ctx.runQuery(internal.crawledPages.listByProductInternal)` to fetch pages
- `ctx.runMutation(internal.productProfiles.updateSectionInternal)` to store results (called twice)
- 25KB page content truncation
- Code-block fallback for JSON parsing
- Strip `field` from evidence before storage
- Enforce `source: 'ai-inferred'` on all definitions regardless of LLM output
- Relevant page types: homepage, about, features, pricing

### Test coverage (11 tests)
1. Journey stages extracted as `{ name, description, order }` array
2. Activation definition with criteria, timeWindow, reasoning, evidence
3. FirstValue definition with description, criteria, reasoning, evidence
4. Active, atRisk, churn definitions with same structure
5. Source set to `'ai-inferred'` on all definitions
6. Definition confidence scores in 0.3-0.5 range
7. Journey and definitions stored as separate sections, completeness updated
8. Throws when no relevant pages found
9. Handles LLM response wrapped in code block
10. Uses businessModel from identity when available
11. Proceeds without businessModel when identity not extracted
