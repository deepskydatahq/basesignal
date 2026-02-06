# Basic Data Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `products`, `productProfiles`, `scanJobs`, and `crawledPages` tables to the Convex schema with CRUD functions and tests.

**Architecture:** Extend existing `convex/schema.ts` with 4 new tables per the design doc. Create corresponding function files (`products.ts`, `productProfiles.ts`, `scanJobs.ts`, `crawledPages.ts`) with mutations and queries. All functions enforce ownership via userId. Tests use `convex-test` with `withIdentity` pattern established in the codebase.

**Tech Stack:** Convex, TypeScript, convex-test, Vitest

---

### Task 1: Add `products` table to schema and create CRUD functions

**Files:**
- Modify: `convex/schema.ts` (add `products` table definition)
- Create: `convex/products.ts` (create, list, get, remove, update mutations/queries)
- Create: `convex/products.test.ts`

**Step 1: Write failing test for products CRUD**

Create `convex/products.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

function setupUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-clerk-id",
      email: "test@example.com",
      name: "Test User",
      createdAt: Date.now(),
    });
  });
}

function authenticatedUser(t: ReturnType<typeof convexTest>, clerkId = "test-clerk-id") {
  return t.withIdentity({
    subject: clerkId,
    issuer: "https://clerk.test",
    tokenIdentifier: `https://clerk.test|${clerkId}`,
  });
}

describe("products", () => {
  it("can create a product", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    const productId = await asUser.mutation(api.products.create, {
      name: "Acme SaaS",
      url: "https://acme.io",
    });

    expect(productId).toBeDefined();

    const product = await t.run(async (ctx) => ctx.db.get(productId));
    expect(product).toMatchObject({
      name: "Acme SaaS",
      url: "https://acme.io",
    });
    expect(product?.createdAt).toBeDefined();
    expect(product?.updatedAt).toBeDefined();
  });

  it("can list products for authenticated user", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    await asUser.mutation(api.products.create, { name: "Product A", url: "https://a.io" });
    await asUser.mutation(api.products.create, { name: "Product B", url: "https://b.io" });

    const products = await asUser.query(api.products.list, {});
    expect(products).toHaveLength(2);
    expect(products[0].name).toBe("Product A");
  });

  it("cannot see another user's products", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);
    await asUser.mutation(api.products.create, { name: "Secret", url: "https://secret.io" });

    // Second user
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other-clerk-id",
        email: "other@example.com",
        createdAt: Date.now(),
      });
    });
    const asOther = authenticatedUser(t, "other-clerk-id");

    const products = await asOther.query(api.products.list, {});
    expect(products).toHaveLength(0);
  });

  it("can get a product by id with ownership check", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    const productId = await asUser.mutation(api.products.create, { name: "Mine", url: "https://mine.io" });
    const product = await asUser.query(api.products.get, { id: productId });
    expect(product?.name).toBe("Mine");
  });

  it("can delete a product", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    const productId = await asUser.mutation(api.products.create, { name: "Delete Me", url: "https://del.io" });
    await asUser.mutation(api.products.remove, { id: productId });

    const product = await asUser.query(api.products.get, { id: productId });
    expect(product).toBeNull();
  });

  it("can update a product", async () => {
    const t = convexTest(schema);
    await setupUser(t);
    const asUser = authenticatedUser(t);

    const productId = await asUser.mutation(api.products.create, { name: "Old Name", url: "https://old.io" });
    await asUser.mutation(api.products.update, { id: productId, name: "New Name", url: "https://new.io" });

    const product = await asUser.query(api.products.get, { id: productId });
    expect(product?.name).toBe("New Name");
    expect(product?.url).toBe("https://new.io");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd ../worktrees/feat/basic-data-persistence && npm run test:run -- convex/products.test.ts`
Expected: FAIL (products table doesn't exist yet)

**Step 3: Add products table to schema**

In `convex/schema.ts`, add inside `defineSchema({})`:

```typescript
products: defineTable({
  userId: v.id("users"),
  name: v.string(),
  url: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user", ["userId"]),
```

**Step 4: Create products.ts with CRUD functions**

Create `convex/products.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.string(),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const now = Date.now();
    return await ctx.db.insert("products", {
      userId: user._id,
      name: args.name,
      url: args.url,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return [];

    return await ctx.db
      .query("products")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== user._id) return null;

    return product;
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    await ctx.db.delete(args.id);
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    const product = await ctx.db.get(args.id);
    if (!product || product.userId !== user._id) {
      throw new Error("Product not found");
    }

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.url !== undefined && { url: args.url }),
      updatedAt: Date.now(),
    });
  },
});
```

**Step 5: Run tests to verify they pass**

Run: `cd ../worktrees/feat/basic-data-persistence && npm run test:run -- convex/products.test.ts`
Expected: All PASS

**Step 6: Commit**

```bash
git add convex/schema.ts convex/products.ts convex/products.test.ts
git commit -m "feat: add products table with CRUD and ownership checks"
```

---

### Task 2: Add `productProfiles` table to schema and create functions

**Files:**
- Modify: `convex/schema.ts` (add `productProfiles` table)
- Create: `convex/productProfiles.ts` (create, get, updateSection, validateSection, calculateCompleteness, remove)
- Create: `convex/productProfiles.test.ts`

**Step 1: Write failing test for productProfiles**

Create `convex/productProfiles.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

function setupUserAndProduct(t: ReturnType<typeof convexTest>) {
  return {
    async create(clerkId = "test-clerk-id") {
      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId,
          email: "test@example.com",
          createdAt: Date.now(),
        });
      });
      const asUser = t.withIdentity({
        subject: clerkId,
        issuer: "https://clerk.test",
        tokenIdentifier: `https://clerk.test|${clerkId}`,
      });
      const productId = await asUser.mutation(api.products.create, {
        name: "Test Product",
        url: "https://test.io",
      });
      return { userId, productId, asUser };
    },
  };
}

describe("productProfiles", () => {
  it("can create an empty profile for a product", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t).create();

    const profileId = await asUser.mutation(api.productProfiles.create, {
      productId,
    });

    expect(profileId).toBeDefined();

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile).toBeDefined();
    expect(profile?.completeness).toBe(0);
    expect(profile?.overallConfidence).toBe(0);
  });

  it("can update the identity section", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t).create();
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme SaaS",
        description: "A project management tool",
        targetCustomer: "Engineering teams",
        businessModel: "B2B SaaS",
        confidence: 0.7,
        evidence: [{ url: "https://acme.io", excerpt: "Built for engineering teams" }],
      },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.identity?.productName).toBe("Acme SaaS");
    expect(profile?.identity?.confidence).toBe(0.7);
    expect(profile?.completeness).toBeGreaterThan(0);
  });

  it("can update the revenue section", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t).create();
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
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

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.revenue?.model).toBe("subscription");
    expect(profile?.revenue?.hasFreeTier).toBe(true);
  });

  it("validates a section by setting confidence to 1.0", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t).create();
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme",
        description: "Tool",
        targetCustomer: "Devs",
        businessModel: "SaaS",
        confidence: 0.5,
        evidence: [],
      },
    });

    await asUser.mutation(api.productProfiles.validateSection, {
      productId,
      section: "identity",
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile?.identity?.confidence).toBe(1.0);
  });

  it("calculates completeness correctly", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t).create();
    await asUser.mutation(api.productProfiles.create, { productId });

    // Add identity section (1 of 10 sections)
    await asUser.mutation(api.productProfiles.updateSection, {
      productId,
      section: "identity",
      data: {
        productName: "Acme",
        description: "Tool",
        targetCustomer: "Devs",
        businessModel: "SaaS",
        confidence: 0.8,
        evidence: [],
      },
    });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    // 1 section filled out of 10 = 0.1
    expect(profile?.completeness).toBeCloseTo(0.1, 1);
    expect(profile?.overallConfidence).toBeCloseTo(0.8, 1);
  });

  it("removes profile when called", async () => {
    const t = convexTest(schema);
    const { productId, asUser } = await setupUserAndProduct(t).create();
    await asUser.mutation(api.productProfiles.create, { productId });

    await asUser.mutation(api.productProfiles.remove, { productId });

    const profile = await asUser.query(api.productProfiles.get, { productId });
    expect(profile).toBeNull();
  });

  it("enforces ownership - cannot access other user's profile", async () => {
    const t = convexTest(schema);
    const { productId } = await setupUserAndProduct(t).create();

    // Different user
    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other-clerk-id",
        email: "other@example.com",
        createdAt: Date.now(),
      });
    });
    const asOther = t.withIdentity({
      subject: "other-clerk-id",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|other-clerk-id",
    });

    const profile = await asOther.query(api.productProfiles.get, { productId });
    expect(profile).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- convex/productProfiles.test.ts`
Expected: FAIL

**Step 3: Add productProfiles table to schema**

In `convex/schema.ts`, add the full `productProfiles` table definition from the design doc (lines 29-161 of the design doc).

**Step 4: Create productProfiles.ts with functions**

Create `convex/productProfiles.ts` with: `create`, `get`, `updateSection`, `validateSection`, `remove`. The `updateSection` mutation accepts a `section` name and generic `data` object, patches the profile, and recalculates completeness/confidence.

**Step 5: Run tests to verify they pass**

Run: `npm run test:run -- convex/productProfiles.test.ts`
Expected: All PASS

**Step 6: Commit**

```bash
git add convex/schema.ts convex/productProfiles.ts convex/productProfiles.test.ts
git commit -m "feat: add productProfiles table with section updates and completeness"
```

---

### Task 3: Add `scanJobs` table to schema and create functions

**Files:**
- Modify: `convex/schema.ts` (add `scanJobs` table)
- Create: `convex/scanJobs.ts` (create, get, updateProgress, complete, fail, listByProduct)
- Create: `convex/scanJobs.test.ts`

**Step 1: Write failing test for scanJobs**

Test coverage: create job, update progress, complete, fail, list by product.

**Step 2: Run tests to verify they fail**

**Step 3: Add scanJobs table to schema** (per design doc lines 168-199)

**Step 4: Create scanJobs.ts with functions**

Internal mutations for scan pipeline operations. Queries with ownership checks.

**Step 5: Run tests to verify they pass**

**Step 6: Commit**

```bash
git add convex/schema.ts convex/scanJobs.ts convex/scanJobs.test.ts
git commit -m "feat: add scanJobs table with progress tracking"
```

---

### Task 4: Add `crawledPages` table to schema and create functions

**Files:**
- Modify: `convex/schema.ts` (add `crawledPages` table)
- Create: `convex/crawledPages.ts` (store, listByJob, listByProduct, getByType, remove)
- Create: `convex/crawledPages.test.ts`

**Step 1: Write failing test for crawledPages**

Test coverage: store page, list by job, list by product, get by type, content truncation.

**Step 2: Run tests to verify they fail**

**Step 3: Add crawledPages table to schema** (per crawler design doc lines 84-101)

**Step 4: Create crawledPages.ts with functions**

Internal mutations for crawler pipeline. Queries with ownership via product.

**Step 5: Run tests to verify they pass**

**Step 6: Commit**

```bash
git add convex/schema.ts convex/crawledPages.ts convex/crawledPages.test.ts
git commit -m "feat: add crawledPages table with storage and retrieval"
```

---

### Task 5: Run full test suite and verify

**Step 1: Run ALL tests**

Run: `npm run test:run`
Expected: All existing and new tests pass

**Step 2: Fix any failures**

**Step 3: Final commit if needed**
