# Measurement Plan Schema Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the 3-layer measurement plan data model (Entities, Activities, Properties) with full CRUD operations.

**Architecture:** Three new Convex tables following existing patterns (journeys.ts). All tables scoped to userId with `getCurrentUser` helper for auth. Standard CRUD mutations/queries per table.

**Tech Stack:** Convex (schema.ts, mutations, queries), convex-test for testing, Vitest

---

## Task 1: Add Schema Tables

**Files:**
- Modify: `convex/schema.ts:324` (end of file, before closing)

**Step 1: Add the three measurement plan tables to schema**

Add before the closing `});`:

```typescript
  measurementEntities: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    suggestedFrom: v.optional(v.string()), // "overview_interview" | "first_value" | "manual"
    createdAt: v.number(),
  })
    .index("by_user", ["userId"]),

  measurementActivities: defineTable({
    userId: v.id("users"),
    entityId: v.id("measurementEntities"),
    name: v.string(),
    action: v.string(),
    description: v.optional(v.string()),
    lifecycleSlot: v.optional(v.string()), // "account_creation" | "activation" | "core_usage" | "revenue" | "churn"
    isFirstValue: v.boolean(),
    suggestedFrom: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_entity", ["entityId"]),

  measurementProperties: defineTable({
    userId: v.id("users"),
    entityId: v.id("measurementEntities"),
    name: v.string(),
    dataType: v.string(), // "string" | "number" | "boolean" | "timestamp"
    description: v.optional(v.string()),
    isRequired: v.boolean(),
    suggestedFrom: v.optional(v.string()), // "template" | "llm" | "manual"
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_entity", ["entityId"]),
```

**Step 2: Verify schema compiles**

Run: `npx convex dev --once`
Expected: Schema syncs successfully

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add measurement plan schema tables"
```

---

## Task 2: Create measurementEntities CRUD - Tests First

**Files:**
- Create: `convex/measurementPlan.test.ts`

**Step 1: Write the failing tests for entities**

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to set up authenticated user
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

describe("measurementEntities", () => {
  it("can create and retrieve an entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
      description: "User accounts",
      suggestedFrom: "manual",
    });

    expect(entityId).toBeDefined();

    const entity = await asUser.query(api.measurementPlan.getEntity, {
      id: entityId,
    });

    expect(entity).not.toBeNull();
    expect(entity?.name).toBe("Account");
    expect(entity?.description).toBe("User accounts");
  });

  it("can list all entities for a user", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });
    await asUser.mutation(api.measurementPlan.createEntity, {
      name: "User",
    });

    const entities = await asUser.query(api.measurementPlan.listEntities, {});

    expect(entities).toHaveLength(2);
    expect(entities.map((e) => e.name).sort()).toEqual(["Account", "User"]);
  });

  it("can update an entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.updateEntity, {
      id: entityId,
      name: "Organization",
      description: "Updated description",
    });

    const entity = await asUser.query(api.measurementPlan.getEntity, {
      id: entityId,
    });

    expect(entity?.name).toBe("Organization");
    expect(entity?.description).toBe("Updated description");
  });

  it("can delete an entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.deleteEntity, { id: entityId });

    const entity = await asUser.query(api.measurementPlan.getEntity, {
      id: entityId,
    });
    expect(entity).toBeNull();
  });

  it("returns empty list for unauthenticated users", async () => {
    const t = convexTest(schema);
    const entities = await t.query(api.measurementPlan.listEntities, {});
    expect(entities).toEqual([]);
  });

  it("prevents duplicate entity names for same user", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await expect(
      asUser.mutation(api.measurementPlan.createEntity, {
        name: "Account",
      })
    ).rejects.toThrow(/already exists/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: FAIL - module not found

**Step 3: Commit test file**

```bash
git add convex/measurementPlan.test.ts
git commit -m "test: add measurementEntities tests (failing)"
```

---

## Task 3: Implement measurementEntities CRUD

**Files:**
- Create: `convex/measurementPlan.ts`

**Step 1: Create the implementation file with entity CRUD**

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// Helper to get current authenticated user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// ============================================
// ENTITIES
// ============================================

export const listEntities = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const getEntity = query({
  args: { id: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const entity = await ctx.db.get(args.id);
    if (!entity) return null;
    if (entity.userId !== user._id) return null;

    return entity;
  },
});

export const createEntity = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    suggestedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Check for duplicate name
    const existing = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      throw new Error(`Entity "${args.name}" already exists`);
    }

    return await ctx.db.insert("measurementEntities", {
      userId: user._id,
      name: args.name,
      description: args.description,
      suggestedFrom: args.suggestedFrom,
      createdAt: Date.now(),
    });
  },
});

export const updateEntity = mutation({
  args: {
    id: v.id("measurementEntities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const entity = await ctx.db.get(args.id);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate name if name is being changed
    if (args.name && args.name !== entity.name) {
      const existing = await ctx.db
        .query("measurementEntities")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("name"), args.name))
        .first();

      if (existing) {
        throw new Error(`Entity "${args.name}" already exists`);
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.id, updates);
  },
});

export const deleteEntity = mutation({
  args: { id: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const entity = await ctx.db.get(args.id);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    // Delete all activities for this entity
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_entity", (q) => q.eq("entityId", args.id))
      .collect();
    for (const a of activities) {
      await ctx.db.delete(a._id);
    }

    // Delete all properties for this entity
    const properties = await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity", (q) => q.eq("entityId", args.id))
      .collect();
    for (const p of properties) {
      await ctx.db.delete(p._id);
    }

    // Delete the entity
    await ctx.db.delete(args.id);
  },
});
```

**Step 2: Run tests to verify they pass**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: All 6 entity tests PASS

**Step 3: Commit implementation**

```bash
git add convex/measurementPlan.ts
git commit -m "feat: implement measurementEntities CRUD"
```

---

## Task 4: Add measurementActivities Tests

**Files:**
- Modify: `convex/measurementPlan.test.ts`

**Step 1: Add activity tests to the test file**

Append to `convex/measurementPlan.test.ts`:

```typescript
describe("measurementActivities", () => {
  it("can create and retrieve an activity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activityId = await asUser.mutation(
      api.measurementPlan.createActivity,
      {
        entityId,
        name: "Account Created",
        action: "Created",
        lifecycleSlot: "account_creation",
        isFirstValue: false,
      }
    );

    expect(activityId).toBeDefined();

    const activity = await asUser.query(api.measurementPlan.getActivity, {
      id: activityId,
    });

    expect(activity?.name).toBe("Account Created");
    expect(activity?.action).toBe("Created");
    expect(activity?.lifecycleSlot).toBe("account_creation");
  });

  it("can list activities by entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });
    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Activated",
      action: "Activated",
      isFirstValue: true,
    });

    const activities = await asUser.query(
      api.measurementPlan.listActivitiesByEntity,
      { entityId }
    );

    expect(activities).toHaveLength(2);
  });

  it("can list all activities for a user", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entity1 = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });
    const entity2 = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "User",
    });

    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId: entity1,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });
    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId: entity2,
      name: "User Signed Up",
      action: "Signed Up",
      isFirstValue: false,
    });

    const activities = await asUser.query(api.measurementPlan.listActivities, {});

    expect(activities).toHaveLength(2);
  });

  it("can update an activity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activityId = await asUser.mutation(
      api.measurementPlan.createActivity,
      {
        entityId,
        name: "Account Created",
        action: "Created",
        isFirstValue: false,
      }
    );

    await asUser.mutation(api.measurementPlan.updateActivity, {
      id: activityId,
      isFirstValue: true,
      lifecycleSlot: "activation",
    });

    const activity = await asUser.query(api.measurementPlan.getActivity, {
      id: activityId,
    });

    expect(activity?.isFirstValue).toBe(true);
    expect(activity?.lifecycleSlot).toBe("activation");
  });

  it("can delete an activity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activityId = await asUser.mutation(
      api.measurementPlan.createActivity,
      {
        entityId,
        name: "Account Created",
        action: "Created",
        isFirstValue: false,
      }
    );

    await asUser.mutation(api.measurementPlan.deleteActivity, {
      id: activityId,
    });

    const activity = await asUser.query(api.measurementPlan.getActivity, {
      id: activityId,
    });
    expect(activity).toBeNull();
  });

  it("deletes activities when entity is deleted", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });

    // Delete the entity
    await asUser.mutation(api.measurementPlan.deleteEntity, { id: entityId });

    // Activities should be empty
    const activities = await asUser.query(api.measurementPlan.listActivities, {});
    expect(activities).toHaveLength(0);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: FAIL - activity functions not found

**Step 3: Commit test additions**

```bash
git add convex/measurementPlan.test.ts
git commit -m "test: add measurementActivities tests (failing)"
```

---

## Task 5: Implement measurementActivities CRUD

**Files:**
- Modify: `convex/measurementPlan.ts`

**Step 1: Add activity CRUD functions**

Append to `convex/measurementPlan.ts`:

```typescript
// ============================================
// ACTIVITIES
// ============================================

export const listActivities = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const listActivitiesByEntity = query({
  args: { entityId: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementActivities")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
  },
});

export const getActivity = query({
  args: { id: v.id("measurementActivities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const activity = await ctx.db.get(args.id);
    if (!activity) return null;
    if (activity.userId !== user._id) return null;

    return activity;
  },
});

export const createActivity = mutation({
  args: {
    entityId: v.id("measurementEntities"),
    name: v.string(),
    action: v.string(),
    description: v.optional(v.string()),
    lifecycleSlot: v.optional(v.string()),
    isFirstValue: v.boolean(),
    suggestedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Verify entity exists and belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    return await ctx.db.insert("measurementActivities", {
      userId: user._id,
      entityId: args.entityId,
      name: args.name,
      action: args.action,
      description: args.description,
      lifecycleSlot: args.lifecycleSlot,
      isFirstValue: args.isFirstValue,
      suggestedFrom: args.suggestedFrom,
      createdAt: Date.now(),
    });
  },
});

export const updateActivity = mutation({
  args: {
    id: v.id("measurementActivities"),
    name: v.optional(v.string()),
    action: v.optional(v.string()),
    description: v.optional(v.string()),
    lifecycleSlot: v.optional(v.string()),
    isFirstValue: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const activity = await ctx.db.get(args.id);
    if (!activity) throw new Error("Activity not found");
    if (activity.userId !== user._id) throw new Error("Not authorized");

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.action !== undefined) updates.action = args.action;
    if (args.description !== undefined) updates.description = args.description;
    if (args.lifecycleSlot !== undefined) updates.lifecycleSlot = args.lifecycleSlot;
    if (args.isFirstValue !== undefined) updates.isFirstValue = args.isFirstValue;

    await ctx.db.patch(args.id, updates);
  },
});

export const deleteActivity = mutation({
  args: { id: v.id("measurementActivities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const activity = await ctx.db.get(args.id);
    if (!activity) throw new Error("Activity not found");
    if (activity.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
  },
});
```

**Step 2: Run tests to verify they pass**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: All entity and activity tests PASS

**Step 3: Commit implementation**

```bash
git add convex/measurementPlan.ts
git commit -m "feat: implement measurementActivities CRUD"
```

---

## Task 6: Add measurementProperties Tests

**Files:**
- Modify: `convex/measurementPlan.test.ts`

**Step 1: Add property tests to the test file**

Append to `convex/measurementPlan.test.ts`:

```typescript
describe("measurementProperties", () => {
  it("can create and retrieve a property", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const propertyId = await asUser.mutation(
      api.measurementPlan.createProperty,
      {
        entityId,
        name: "plan_type",
        dataType: "string",
        description: "Subscription plan type",
        isRequired: true,
      }
    );

    expect(propertyId).toBeDefined();

    const property = await asUser.query(api.measurementPlan.getProperty, {
      id: propertyId,
    });

    expect(property?.name).toBe("plan_type");
    expect(property?.dataType).toBe("string");
    expect(property?.isRequired).toBe(true);
  });

  it("can list properties by entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "plan_type",
      dataType: "string",
      isRequired: true,
    });
    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "created_at",
      dataType: "timestamp",
      isRequired: true,
    });

    const properties = await asUser.query(
      api.measurementPlan.listPropertiesByEntity,
      { entityId }
    );

    expect(properties).toHaveLength(2);
  });

  it("can update a property", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const propertyId = await asUser.mutation(
      api.measurementPlan.createProperty,
      {
        entityId,
        name: "plan_type",
        dataType: "string",
        isRequired: false,
      }
    );

    await asUser.mutation(api.measurementPlan.updateProperty, {
      id: propertyId,
      isRequired: true,
      description: "Updated description",
    });

    const property = await asUser.query(api.measurementPlan.getProperty, {
      id: propertyId,
    });

    expect(property?.isRequired).toBe(true);
    expect(property?.description).toBe("Updated description");
  });

  it("can delete a property", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const propertyId = await asUser.mutation(
      api.measurementPlan.createProperty,
      {
        entityId,
        name: "plan_type",
        dataType: "string",
        isRequired: true,
      }
    );

    await asUser.mutation(api.measurementPlan.deleteProperty, {
      id: propertyId,
    });

    const property = await asUser.query(api.measurementPlan.getProperty, {
      id: propertyId,
    });
    expect(property).toBeNull();
  });

  it("deletes properties when entity is deleted", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "plan_type",
      dataType: "string",
      isRequired: true,
    });

    // Delete the entity
    await asUser.mutation(api.measurementPlan.deleteEntity, { id: entityId });

    // Properties should be empty
    const properties = await asUser.query(
      api.measurementPlan.listProperties,
      {}
    );
    expect(properties).toHaveLength(0);
  });

  it("prevents duplicate property names within same entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "plan_type",
      dataType: "string",
      isRequired: true,
    });

    await expect(
      asUser.mutation(api.measurementPlan.createProperty, {
        entityId,
        name: "plan_type",
        dataType: "string",
        isRequired: false,
      })
    ).rejects.toThrow(/already exists/i);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: FAIL - property functions not found

**Step 3: Commit test additions**

```bash
git add convex/measurementPlan.test.ts
git commit -m "test: add measurementProperties tests (failing)"
```

---

## Task 7: Implement measurementProperties CRUD

**Files:**
- Modify: `convex/measurementPlan.ts`

**Step 1: Add property CRUD functions**

Append to `convex/measurementPlan.ts`:

```typescript
// ============================================
// PROPERTIES
// ============================================

export const listProperties = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementProperties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const listPropertiesByEntity = query({
  args: { entityId: v.id("measurementEntities") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();
  },
});

export const getProperty = query({
  args: { id: v.id("measurementProperties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const property = await ctx.db.get(args.id);
    if (!property) return null;
    if (property.userId !== user._id) return null;

    return property;
  },
});

export const createProperty = mutation({
  args: {
    entityId: v.id("measurementEntities"),
    name: v.string(),
    dataType: v.string(),
    description: v.optional(v.string()),
    isRequired: v.boolean(),
    suggestedFrom: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Verify entity exists and belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate property name within entity
    const existing = await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      throw new Error(`Property "${args.name}" already exists on this entity`);
    }

    return await ctx.db.insert("measurementProperties", {
      userId: user._id,
      entityId: args.entityId,
      name: args.name,
      dataType: args.dataType,
      description: args.description,
      isRequired: args.isRequired,
      suggestedFrom: args.suggestedFrom,
      createdAt: Date.now(),
    });
  },
});

export const updateProperty = mutation({
  args: {
    id: v.id("measurementProperties"),
    name: v.optional(v.string()),
    dataType: v.optional(v.string()),
    description: v.optional(v.string()),
    isRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.id);
    if (!property) throw new Error("Property not found");
    if (property.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate name if name is being changed
    if (args.name && args.name !== property.name) {
      const existing = await ctx.db
        .query("measurementProperties")
        .withIndex("by_entity", (q) => q.eq("entityId", property.entityId))
        .filter((q) => q.eq(q.field("name"), args.name))
        .first();

      if (existing) {
        throw new Error(`Property "${args.name}" already exists on this entity`);
      }
    }

    const updates: Record<string, unknown> = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.dataType !== undefined) updates.dataType = args.dataType;
    if (args.description !== undefined) updates.description = args.description;
    if (args.isRequired !== undefined) updates.isRequired = args.isRequired;

    await ctx.db.patch(args.id, updates);
  },
});

export const deleteProperty = mutation({
  args: { id: v.id("measurementProperties") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const property = await ctx.db.get(args.id);
    if (!property) throw new Error("Property not found");
    if (property.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
  },
});
```

**Step 2: Run tests to verify they pass**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: All tests PASS (18 tests)

**Step 3: Commit implementation**

```bash
git add convex/measurementPlan.ts
git commit -m "feat: implement measurementProperties CRUD"
```

---

## Task 8: Add Hierarchical Query for Full Plan

**Files:**
- Modify: `convex/measurementPlan.test.ts`
- Modify: `convex/measurementPlan.ts`

**Step 1: Add test for full plan query**

Append to `convex/measurementPlan.test.ts`:

```typescript
describe("getFullPlan", () => {
  it("returns hierarchical plan with entities, activities, and properties", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    // Create entity with activities and properties
    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: false,
    });

    await asUser.mutation(api.measurementPlan.createProperty, {
      entityId,
      name: "plan_type",
      dataType: "string",
      isRequired: true,
    });

    const plan = await asUser.query(api.measurementPlan.getFullPlan, {});

    expect(plan).toHaveLength(1);
    expect(plan[0].entity.name).toBe("Account");
    expect(plan[0].activities).toHaveLength(1);
    expect(plan[0].activities[0].name).toBe("Account Created");
    expect(plan[0].properties).toHaveLength(1);
    expect(plan[0].properties[0].name).toBe("plan_type");
  });

  it("returns empty array for users with no plan", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const plan = await asUser.query(api.measurementPlan.getFullPlan, {});
    expect(plan).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: FAIL - getFullPlan not found

**Step 3: Add getFullPlan query**

Append to `convex/measurementPlan.ts`:

```typescript
// ============================================
// FULL PLAN (Hierarchical View)
// ============================================

export const getFullPlan = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const entities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const result = await Promise.all(
      entities.map(async (entity) => {
        const activities = await ctx.db
          .query("measurementActivities")
          .withIndex("by_entity", (q) => q.eq("entityId", entity._id))
          .collect();

        const properties = await ctx.db
          .query("measurementProperties")
          .withIndex("by_entity", (q) => q.eq("entityId", entity._id))
          .collect();

        return {
          entity,
          activities,
          properties,
        };
      })
    );

    return result;
  },
});
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: All tests PASS (20 tests)

**Step 5: Commit**

```bash
git add convex/measurementPlan.ts convex/measurementPlan.test.ts
git commit -m "feat: add getFullPlan hierarchical query"
```

---

## Task 9: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Verify schema syncs**

Run: `npx convex dev --once`
Expected: Schema syncs successfully

**Step 3: Final commit if any cleanup needed**

```bash
git status
# If clean, no action needed
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Add schema tables | - |
| 2-3 | Entity CRUD | 6 tests |
| 4-5 | Activity CRUD | 6 tests |
| 6-7 | Property CRUD | 6 tests |
| 8 | Full plan query | 2 tests |
| 9 | Final verification | - |

**Total: 20 tests covering all CRUD operations and hierarchical query**
