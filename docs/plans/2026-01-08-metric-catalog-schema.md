# Metric Catalog: Data Model Schema Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the `metrics` table to the Convex schema for storing generated metrics, with basic CRUD operations.

**Architecture:** User-scoped metrics stored in `metrics` table. Note: The design doc references `productId: v.id("products")`, but there is no `products` table in the current schema. All data is currently scoped to `userId` (journeys, stages, setupProgress). We'll use `userId` for consistency with existing patterns. When a `products` table is added later, migration can be handled.

**Tech Stack:** Convex (backend), convex-test (testing)

---

## Task 1: Add Schema for metrics Table

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add the metrics table definition**

Add to `convex/schema.ts` after the `interviewMessages` table:

```typescript
metrics: defineTable({
  // Identity - using userId for now (products table doesn't exist yet)
  userId: v.id("users"),

  // Content
  name: v.string(),                    // "Activation Rate"
  definition: v.string(),              // Plain language, personalized
  formula: v.string(),                 // Human-readable, with activity names
  whyItMatters: v.string(),            // Business context
  howToImprove: v.string(),            // Actionable levers

  // Metadata
  metricType: v.string(),              // "default" | "generated"
  templateKey: v.optional(v.string()), // "activation_rate" - links to template
  relatedActivityId: v.optional(v.id("stages")),  // Optional journey link
  order: v.number(),                   // Display sequence
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_and_order", ["userId", "order"]),
```

**Step 2: Verify schema compiles**

Run: `npx convex dev` (should show schema updated)

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add metrics table schema"
```

---

## Task 2: Create metrics Convex Functions

**Files:**
- Create: `convex/metrics.ts`
- Test: `convex/metrics.test.ts`

**Step 1: Write failing test for list query**

Create `convex/metrics.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to create authenticated user
async function setupUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user",
  });

  return { userId, asUser };
}

describe("metrics", () => {
  describe("list", () => {
    it("returns empty array for user with no metrics", async () => {
      const t = convexTest(schema);
      const { asUser } = await setupUser(t);

      const metrics = await asUser.query(api.metrics.list, {});
      expect(metrics).toEqual([]);
    });

    it("returns metrics ordered by order field", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      // Insert metrics in reverse order
      await t.run(async (ctx) => {
        await ctx.db.insert("metrics", {
          userId,
          name: "DAU",
          definition: "Daily active users",
          formula: "Count unique users active per day",
          whyItMatters: "Growth indicator",
          howToImprove: "Improve onboarding",
          metricType: "default",
          templateKey: "dau",
          order: 2,
          createdAt: Date.now(),
        });
        await ctx.db.insert("metrics", {
          userId,
          name: "New Users",
          definition: "New signups",
          formula: "Count signups per period",
          whyItMatters: "Acquisition health",
          howToImprove: "Marketing",
          metricType: "default",
          templateKey: "new_users",
          order: 1,
          createdAt: Date.now(),
        });
      });

      const metrics = await asUser.query(api.metrics.list, {});
      expect(metrics).toHaveLength(2);
      expect(metrics[0].name).toBe("New Users");
      expect(metrics[1].name).toBe("DAU");
    });

    it("returns empty for unauthenticated users", async () => {
      const t = convexTest(schema);

      const metrics = await t.query(api.metrics.list, {});
      expect(metrics).toEqual([]);
    });
  });

  describe("get", () => {
    it("returns a metric by ID", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      const metricId = await t.run(async (ctx) => {
        return await ctx.db.insert("metrics", {
          userId,
          name: "Activation Rate",
          definition: "Users who complete first value",
          formula: "Activated / Signed Up",
          whyItMatters: "Value delivery",
          howToImprove: "Simplify onboarding",
          metricType: "default",
          templateKey: "activation_rate",
          order: 1,
          createdAt: Date.now(),
        });
      });

      const metric = await asUser.query(api.metrics.get, { id: metricId });
      expect(metric).not.toBeNull();
      expect(metric?.name).toBe("Activation Rate");
    });

    it("returns null for another user's metric", async () => {
      const t = convexTest(schema);

      // Create first user's metric
      const otherUserId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "other-user",
          email: "other@example.com",
          createdAt: Date.now(),
        });
      });

      const metricId = await t.run(async (ctx) => {
        return await ctx.db.insert("metrics", {
          userId: otherUserId,
          name: "Other Metric",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          metricType: "default",
          order: 1,
          createdAt: Date.now(),
        });
      });

      // Second user tries to access
      const { asUser } = await setupUser(t);
      const metric = await asUser.query(api.metrics.get, { id: metricId });
      expect(metric).toBeNull();
    });
  });

  describe("getByTemplateKey", () => {
    it("returns metric by template key", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("metrics", {
          userId,
          name: "Activation Rate",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          metricType: "default",
          templateKey: "activation_rate",
          order: 1,
          createdAt: Date.now(),
        });
      });

      const metric = await asUser.query(api.metrics.getByTemplateKey, {
        templateKey: "activation_rate",
      });
      expect(metric).not.toBeNull();
      expect(metric?.name).toBe("Activation Rate");
    });

    it("returns null when template key not found", async () => {
      const t = convexTest(schema);
      const { asUser } = await setupUser(t);

      const metric = await asUser.query(api.metrics.getByTemplateKey, {
        templateKey: "nonexistent",
      });
      expect(metric).toBeNull();
    });
  });

  describe("count", () => {
    it("returns count of metrics for user", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("metrics", {
          userId,
          name: "Metric 1",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          metricType: "default",
          order: 1,
          createdAt: Date.now(),
        });
        await ctx.db.insert("metrics", {
          userId,
          name: "Metric 2",
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          metricType: "default",
          order: 2,
          createdAt: Date.now(),
        });
      });

      const count = await asUser.query(api.metrics.count, {});
      expect(count).toBe(2);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/metrics.test.ts`
Expected: FAIL (module not found)

**Step 3: Write metrics implementation**

Create `convex/metrics.ts`:

```typescript
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

// Helper to get current authenticated user
async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// List all metrics for current user, ordered by order field
export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Sort by order field
    return metrics.sort((a, b) => a.order - b.order);
  },
});

// Get a single metric by ID
export const get = query({
  args: { id: v.id("metrics") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const metric = await ctx.db.get(args.id);
    if (!metric) return null;
    if (metric.userId !== user._id) return null;

    return metric;
  },
});

// Get metric by template key (for checking if already generated)
export const getByTemplateKey = query({
  args: { templateKey: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return metrics.find((m) => m.templateKey === args.templateKey) ?? null;
  },
});

// Count metrics for current user (for dashboard status)
export const count = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return 0;

    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return metrics.length;
  },
});
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- convex/metrics.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add convex/metrics.ts convex/metrics.test.ts
git commit -m "feat: add metrics CRUD queries with tests"
```

---

## Task 3: Final Verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Verify schema sync**

Run: `npx convex dev` - confirm no errors

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from verification"
```

---

## Testing Summary

| What | Tool | File |
|------|------|------|
| Metrics queries | convex-test | `convex/metrics.test.ts` |

Run: `npm run test:run` to verify all tests pass.

---

## Design Notes

### Scoping Decision

The original design doc uses `productId: v.id("products")`, but:
1. No `products` table exists in the current schema
2. All existing data is user-scoped (journeys, stages, setupProgress)
3. Using `userId` maintains consistency

When a `products` table is introduced later (multi-product support), migration would involve:
1. Creating products table
2. Adding `productId` to metrics
3. Data migration script

### Future Considerations

- **Issue #25** (Metric Templates) will define the template structure
- **Issue #26** (Generate from Overview) will add mutation to create metrics
- **Issue #27** (Generate from First Value) will extend generation

This schema provides the foundation for those features.
