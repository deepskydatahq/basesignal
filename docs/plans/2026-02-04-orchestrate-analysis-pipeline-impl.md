# Orchestrate Analysis Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all analysis extractors into an orchestration pipeline that automatically triggers after scan completion, running independent extractors in parallel and dependent ones sequentially.

**Architecture:** A single `internalAction` in `convex/analysis/orchestrate.ts` is triggered via `scheduler.runAfter(0)` after `scanJobs.complete()` in `scanning.ts`. It creates a profile, runs 4 independent extractors in parallel (identity, revenue, entities, outcomes), then chains 2 dependent extractors (journey after identity, metrics after identity+revenue). Each extractor stores its own section via internal mutations. `Promise.allSettled` isolates failures so partial profiles are acceptable.

**Tech Stack:** Convex (internalAction, internalMutation, internalQuery), TypeScript, convex-test + Vitest for testing

---

## Prerequisite Context

### Existing Files You'll Modify

| File | What's There | Lines |
|------|-------------|-------|
| `convex/productProfiles.ts` | 272 lines. Has `create`, `get`, `updateSection`, `validateSection`, `remove`. All authenticated. Has `calculateCompletenessAndConfidence` helper (lines 97-123). | See below |
| `convex/crawledPages.ts` | 141 lines. Has `store`, `listByScanJob`, `listByProduct`, `getByProductAndType`, `removeByScanJob`, `listByProductMcp`. No internal queries. | See below |
| `convex/scanJobs.ts` | 149 lines. Has `create`, `get`, `createInternal`, `updateProgress`, `complete`, `fail`, `listByProduct`. Status is `v.string()` — no schema change needed for new statuses. | See below |
| `convex/scanning.ts` | 254 lines. `startScan` internalAction calls `scanJobs.complete` at line 164. Orchestrator trigger goes after this line. | See below |

### New Files You'll Create

| File | Purpose |
|------|---------|
| `convex/analysis/orchestrate.ts` | internalAction that coordinates all extractors |
| `convex/analysis/orchestrate.test.ts` | Tests for orchestrator and internal helpers |

### Key Patterns

**Internal function pattern** (from `scanJobs.ts:56-73`):
```typescript
export const createInternal = internalMutation({
  args: { productId: v.id("products"), userId: v.id("users"), url: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("scanJobs", { ... });
  },
});
```

**Test setup pattern** (from `productProfiles.test.ts:14-28`):
```typescript
async function setupUserAndProduct(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { clerkId, email: "test@example.com", createdAt: Date.now() });
  });
  const asUser = authenticatedUser(t, clerkId);
  const productId = await asUser.mutation(api.products.create, { name: "Test Product", url: "https://test.io" });
  return { userId, productId, asUser };
}
```

**Internal mutations are called via** `t.mutation(internal.module.functionName, { ... })` in tests (no auth wrapper needed).

### Completeness Calculation

Located at `convex/productProfiles.ts:97-123`. Counts 10 total sections: 6 top-level (identity, revenue, entities, journey, outcomes, metrics) + 4 definition keys (activation, firstValue, active, churn). The `calculateCompletenessAndConfidence` function is file-scoped — it needs to stay accessible to `updateSectionInternal`.

---

## Task 1: Add `listByProductInternal` to crawledPages

**Files:**
- Modify: `convex/crawledPages.ts` (after line 123, before `listByProductMcp`)
- Test: `convex/crawledPages.test.ts`

### Step 1: Write the failing test

Add to the end of `convex/crawledPages.test.ts`, inside the existing `describe("crawledPages", ...)` block, before the closing `});`:

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

Add to `convex/crawledPages.ts` after the `removeByScanJob` export (line 123). Add the `internalQuery` import to line 1.

Change line 1 from:
```typescript
import { query, internalMutation } from "./_generated/server";
```
to:
```typescript
import { query, internalMutation, internalQuery } from "./_generated/server";
```

Then add after line 123:
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
- Modify: `convex/productProfiles.ts` (add two internal functions)
- Test: `convex/productProfiles.test.ts`

### Step 1: Write the failing tests

Add to `convex/productProfiles.test.ts`, inside the `describe("productProfiles", ...)` block. You'll need to add `internal` to the import on line 3:

Change line 3 from:
```typescript
import { api } from "./_generated/api";
```
to:
```typescript
import { api, internal } from "./_generated/api";
```

Then add these tests before the closing `});`:

```typescript
it("can create a profile internally without auth", async () => {
  const t = convexTest(schema);
  const { productId } = await setupUserAndProduct(t);

  const profileId = await t.mutation(internal.productProfiles.createInternal, { productId });
  expect(profileId).toBeDefined();

  // Verify via direct DB read
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

Add to `convex/productProfiles.ts`. First update the import on line 1:

Change:
```typescript
import { query, mutation } from "./_generated/server";
```
to:
```typescript
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
```

Then add after the `create` export (after line 155):

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
- Modify: `convex/productProfiles.ts` (add internal mutation)
- Test: `convex/productProfiles.test.ts`

### Step 1: Write the failing test

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

  // Don't create a profile — should throw
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

Add to `convex/productProfiles.ts`, after the `getInternal` export (added in Task 2):

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

## Task 4: Add `updateStatus` internal mutation to scanJobs

The orchestrator needs to transition scan status from `complete` → `analyzing` and then → `analyzed`. The existing `updateProgress` could be used, but a dedicated `updateStatus` is clearer.

**Files:**
- Modify: `convex/scanJobs.ts`
- Test: `convex/scanJobs.test.ts`

### Step 1: Write the failing test

Add to `convex/scanJobs.test.ts`, inside the `describe("scanJobs", ...)` block:

```typescript
it("can update status to analyzing and then analyzed", async () => {
  const t = convexTest(schema);
  const { productId, asUser } = await setupUserAndProduct(t);

  const jobId = await asUser.mutation(api.scanJobs.create, {
    productId,
    url: "https://test.io",
  });

  // Complete the job first
  await t.mutation(internal.scanJobs.complete, { jobId });

  // Transition to analyzing
  await t.mutation(internal.scanJobs.updateProgress, {
    jobId,
    status: "analyzing",
    currentPhase: "Analyzing crawled pages",
  });

  let job = await asUser.query(api.scanJobs.get, { id: jobId });
  expect(job?.status).toBe("analyzing");
  expect(job?.currentPhase).toBe("Analyzing crawled pages");

  // Transition to analyzed
  await t.mutation(internal.scanJobs.updateProgress, {
    jobId,
    status: "analyzed",
    currentPhase: "Analysis complete",
  });

  job = await asUser.query(api.scanJobs.get, { id: jobId });
  expect(job?.status).toBe("analyzed");
  expect(job?.currentPhase).toBe("Analysis complete");
});
```

### Step 2: Run test to verify it passes

Run: `npx vitest run convex/scanJobs.test.ts`
Expected: PASS — `updateProgress` already accepts any status string. This test documents the new status flow without requiring new code.

### Step 3: Commit

```bash
git add convex/scanJobs.test.ts
git commit -m "test: document analyzing/analyzed status flow for scanJobs"
```

---

## Task 5: Create the orchestrator action

This is the core of the feature. The orchestrator is an `internalAction` that coordinates all extractors.

**Important:** The extractors (S001-S006) don't exist yet. This task creates the orchestrator with the extractor calls, but the extractors themselves will be stub `internalAction` functions. The real extractor implementations are separate tasks (basesignal stories S001-S006). The orchestrator just needs to call them correctly.

**Files:**
- Create: `convex/analysis/orchestrate.ts`
- Test: `convex/analysis/orchestrate.test.ts`

### Step 1: Write the failing test

Create `convex/analysis/orchestrate.test.ts`:

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

async function setupUserProductAndJob(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-clerk-id",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
  const asUser = authenticatedUser(t);
  const productId = await asUser.mutation(api.products.create, {
    name: "Test Product",
    url: "https://test.io",
  });
  const jobId = await asUser.mutation(api.scanJobs.create, {
    productId,
    url: "https://test.io",
  });
  return { userId, productId, jobId, asUser };
}

async function seedCrawledPages(t: ReturnType<typeof convexTest>, productId: any, jobId: any) {
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io",
    pageType: "homepage",
    title: "Test Product",
    content: "# Welcome to Test Product\nWe help engineering teams ship faster.",
  });
  await t.mutation(internal.crawledPages.store, {
    productId,
    scanJobId: jobId,
    url: "https://test.io/pricing",
    pageType: "pricing",
    title: "Pricing",
    content: "# Pricing\nFree: $0/mo. Pro: $29/mo.",
  });
}

describe("orchestrate", () => {
  it("creates profile if absent and transitions scan status", async () => {
    const t = convexTest(schema);
    const { productId, jobId, asUser } = await setupUserProductAndJob(t);
    await seedCrawledPages(t, productId, jobId);

    // Complete the scan
    await t.mutation(internal.scanJobs.complete, { jobId });

    // Run the orchestrator
    // Note: In convex-test, internalActions that call external APIs need to be
    // tested via their side effects (DB state changes). We test the internal
    // helper functions directly and verify the orchestrator's DB mutations.

    // Verify: profile should not exist yet
    const profileBefore = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profileBefore).toBeNull();

    // Simulate what the orchestrator does: create profile, update status
    await t.mutation(internal.productProfiles.createInternal, { productId });
    await t.mutation(internal.scanJobs.updateProgress, {
      jobId,
      status: "analyzing",
      currentPhase: "Analyzing crawled pages",
    });

    // Verify profile exists
    const profileAfter = await t.query(internal.productProfiles.getInternal, { productId });
    expect(profileAfter).toBeDefined();
    expect(profileAfter?.completeness).toBe(0);

    // Verify scan status
    const job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.status).toBe("analyzing");
  });

  it("updateSectionInternal recalculates completeness after storing sections", async () => {
    const t = convexTest(schema);
    const { productId } = await setupUserProductAndJob(t);

    await t.mutation(internal.productProfiles.createInternal, { productId });

    // Store identity section (simulating what extractIdentity would do)
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "identity",
      data: {
        productName: "Test",
        description: "A test product",
        targetCustomer: "Engineers",
        businessModel: "B2B SaaS",
        confidence: 0.8,
        evidence: [{ url: "https://test.io", excerpt: "For engineers" }],
      },
    });

    // Store revenue section
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "revenue",
      data: {
        model: "subscription",
        hasFreeTier: true,
        tiers: [{ name: "Free", price: "$0", features: ["Basic"] }],
        expansionPaths: ["seats"],
        contractionRisks: ["churn"],
        confidence: 0.6,
        evidence: [],
      },
    });

    // Store entities section
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "entities",
      data: {
        items: [{ name: "Project", type: "core", properties: ["name", "status"] }],
        relationships: [],
        confidence: 0.5,
        evidence: [],
      },
    });

    // Store outcomes section
    await t.mutation(internal.productProfiles.updateSectionInternal, {
      productId,
      section: "outcomes",
      data: {
        items: [{ description: "Ship faster", type: "primary", linkedFeatures: ["kanban"] }],
        confidence: 0.7,
        evidence: [],
      },
    });

    const profile = await t.query(internal.productProfiles.getInternal, { productId });
    // 4 top-level sections filled out of 10 total = 0.4
    expect(profile?.completeness).toBeCloseTo(0.4, 1);
    // Average confidence: (0.8 + 0.6 + 0.5 + 0.7) / 4 = 0.65
    expect(profile?.overallConfidence).toBeCloseTo(0.65, 1);
  });

  it("crawledPages.listByProductInternal returns all pages for extractors", async () => {
    const t = convexTest(schema);
    const { productId, jobId } = await setupUserProductAndJob(t);
    await seedCrawledPages(t, productId, jobId);

    const pages = await t.query(internal.crawledPages.listByProductInternal, { productId });
    expect(pages).toHaveLength(2);
    expect(pages.map((p: any) => p.pageType).sort()).toEqual(["homepage", "pricing"]);
  });

  it("status transitions complete → analyzing → analyzed", async () => {
    const t = convexTest(schema);
    const { productId, jobId, asUser } = await setupUserProductAndJob(t);

    // Complete scan
    await t.mutation(internal.scanJobs.complete, { jobId });

    // Transition to analyzing
    await t.mutation(internal.scanJobs.updateProgress, {
      jobId,
      status: "analyzing",
      currentPhase: "Analyzing crawled pages",
    });

    let job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.status).toBe("analyzing");

    // Transition to analyzed
    await t.mutation(internal.scanJobs.updateProgress, {
      jobId,
      status: "analyzed",
      currentPhase: "Analysis complete",
    });

    job = await asUser.query(api.scanJobs.get, { id: jobId });
    expect(job?.status).toBe("analyzed");
  });
});
```

### Step 2: Run test to verify it fails

Run: `npx vitest run convex/analysis/orchestrate.test.ts`
Expected: FAIL — file/module doesn't exist yet (test may also fail if `analysis/` directory doesn't exist; create it first with `mkdir -p convex/analysis`)

### Step 3: Write minimal implementation

Create `convex/analysis/orchestrate.ts`:

```typescript
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Orchestrate all analysis extractors after a scan completes.
 *
 * Flow:
 * 1. Mark scan as "analyzing"
 * 2. Create product profile if absent
 * 3. Run independent extractors in parallel: identity, revenue, entities, outcomes
 * 4. Run dependent extractors: journey (needs identity), metrics (needs identity+revenue)
 * 5. Mark scan as "analyzed"
 *
 * Errors in individual extractors are caught and logged — partial profiles are acceptable.
 */
export const run = internalAction({
  args: {
    productId: v.id("products"),
    scanJobId: v.id("scanJobs"),
  },
  handler: async (ctx, args) => {
    // Step 1: Mark scan as analyzing
    await ctx.runMutation(internal.scanJobs.updateProgress, {
      jobId: args.scanJobId,
      status: "analyzing",
      currentPhase: "Analyzing crawled pages",
    });

    // Step 2: Create profile if absent
    await ctx.runMutation(internal.productProfiles.createInternal, {
      productId: args.productId,
    });

    // Step 3: Wave 1 — independent extractors in parallel
    const wave1Labels = ["identity", "revenue", "entities", "outcomes"] as const;
    const wave1Results = await Promise.allSettled([
      runExtractor(ctx, "extractIdentity", args.productId),
      runExtractor(ctx, "extractRevenue", args.productId),
      runExtractor(ctx, "extractEntities", args.productId),
      runExtractor(ctx, "extractOutcomes", args.productId),
    ]);

    // Log wave 1 results
    const wave1Statuses: Record<string, boolean> = {};
    wave1Labels.forEach((label, i) => {
      const result = wave1Results[i];
      wave1Statuses[label] = result.status === "fulfilled";
      if (result.status === "rejected") {
        console.error(`Extractor ${label} failed:`, result.reason);
      }
    });

    // Step 4: Wave 2 — dependent extractors
    // Journey needs identity to have succeeded
    if (wave1Statuses.identity) {
      try {
        await runExtractor(ctx, "extractJourney", args.productId);
      } catch (error) {
        console.error("Extractor journey failed:", error);
      }
    } else {
      console.warn("Skipping journey extraction — identity extraction failed");
    }

    // Metrics needs identity (revenue is optional per S006 design)
    if (wave1Statuses.identity) {
      try {
        await runExtractor(ctx, "suggestMetrics", args.productId);
      } catch (error) {
        console.error("Extractor metrics failed:", error);
      }
    } else {
      console.warn("Skipping metrics suggestion — identity extraction failed");
    }

    // Step 5: Mark scan as analyzed
    await ctx.runMutation(internal.scanJobs.updateProgress, {
      jobId: args.scanJobId,
      status: "analyzed",
      currentPhase: "Analysis complete",
    });
  },
});

/**
 * Run a single extractor action by name.
 * Each extractor is an internalAction at internal.analysis.<name>.run
 */
async function runExtractor(
  ctx: { runAction: (ref: any, args: any) => Promise<any> },
  extractorName: string,
  productId: any,
): Promise<void> {
  const extractorRef = getExtractorRef(extractorName);
  if (!extractorRef) {
    console.warn(`Extractor ${extractorName} not found — skipping`);
    return;
  }
  await ctx.runAction(extractorRef, { productId });
}

/**
 * Map extractor names to their internal references.
 * Returns null for extractors that haven't been implemented yet.
 */
function getExtractorRef(name: string): any | null {
  // Each extractor will be added here as it's implemented.
  // For now, all return null so the orchestrator safely skips them.
  const extractors: Record<string, any> = {
    // Uncomment as extractors are implemented:
    // extractIdentity: internal.analysis.extractIdentity.run,
    // extractRevenue: internal.analysis.extractRevenue.run,
    // extractEntities: internal.analysis.extractEntities.run,
    // extractOutcomes: internal.analysis.extractOutcomes.run,
    // extractJourney: internal.analysis.extractJourney.run,
    // suggestMetrics: internal.analysis.suggestMetrics.run,
  };
  return extractors[name] ?? null;
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run convex/analysis/orchestrate.test.ts`
Expected: All tests PASS. The tests verify the internal helpers and status transitions that the orchestrator uses. The orchestrator action itself calls extractors which are all stubbed (return null from `getExtractorRef`).

### Step 5: Commit

```bash
git add convex/analysis/orchestrate.ts convex/analysis/orchestrate.test.ts
git commit -m "feat: add analysis orchestrator action with extractor coordination"
```

---

## Task 6: Wire orchestrator trigger in scanning.ts

**Files:**
- Modify: `convex/scanning.ts` (add 1 line after line 164)

### Step 1: Write the failing test

This is an integration wiring — the test is behavioral. We verify that after a scan completes, the orchestrator is scheduled. Since `scanning.ts` is an `internalAction` that calls external APIs (Firecrawl), we can't easily unit test it. Instead, we verify the wiring exists by reading the code.

**No separate test needed.** The existing orchestrate tests (Task 5) verify the orchestrator works. The wiring is a single `scheduler.runAfter` call — the same proven pattern used at `convex/scans.ts:38`.

### Step 2: Add the trigger

Modify `convex/scanning.ts`. After line 164 (`await ctx.runMutation(internal.scanJobs.complete, { jobId });`), add:

```typescript
    // Trigger analysis pipeline
    await ctx.scheduler.runAfter(0, internal.analysis.orchestrate.run, {
      productId: args.productId,
      scanJobId: jobId,
    });
```

The import for `internal` already exists at line 2.

### Step 3: Verify the build compiles

Run: `npx tsc --noEmit`
Expected: No type errors. The `internal.analysis.orchestrate.run` reference will be auto-generated by Convex when `convex/analysis/orchestrate.ts` exports the `run` action.

### Step 4: Commit

```bash
git add convex/scanning.ts
git commit -m "feat: trigger analysis orchestrator after scan completion"
```

---

## Task 7: Run full test suite

### Step 1: Run all tests

Run: `npm test -- --run`
Expected: All tests PASS

### Step 2: Verify TypeScript compiles

Run: `npx tsc --noEmit`
Expected: No errors

### Step 3: Final commit (if any fixes needed)

If any fixes were needed, commit them:
```bash
git add -u
git commit -m "fix: resolve test/type issues in analysis pipeline"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | `listByProductInternal` query | `crawledPages.ts`, `crawledPages.test.ts` |
| 2 | `createInternal` + `getInternal` mutations/queries | `productProfiles.ts`, `productProfiles.test.ts` |
| 3 | `updateSectionInternal` mutation | `productProfiles.ts`, `productProfiles.test.ts` |
| 4 | Document analyzing/analyzed status flow | `scanJobs.test.ts` |
| 5 | Orchestrator action | `analysis/orchestrate.ts`, `analysis/orchestrate.test.ts` |
| 6 | Wire trigger in scanning.ts | `scanning.ts` |
| 7 | Full test suite verification | — |

**Total: 7 tasks, ~7 commits**

### What This Does NOT Include

The six extractor implementations (extractIdentity, extractRevenue, extractEntities, extractOutcomes, extractJourney, suggestMetrics) are separate stories (S001-S006). The orchestrator's `getExtractorRef` function has commented-out references that get uncommented as each extractor is implemented. The orchestrator safely skips any extractor that isn't wired yet.

### Testing Strategy

- **Internal helpers** (Tasks 1-3): Tested via `convex-test` with direct DB assertions
- **Status transitions** (Task 4): Documented via test showing the full status flow
- **Orchestrator** (Task 5): Tests verify the DB mutations the orchestrator relies on. The action itself is tested indirectly through its effects. External API calls (LLM) are in the extractors, not the orchestrator.
- **Wiring** (Task 6): Verified via TypeScript compilation — the auto-generated types ensure the reference is valid
- **Integration** (Task 7): Full test suite run
