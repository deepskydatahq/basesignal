# Metric Catalog: Generate from First Value Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Auto-generate 2 additional metrics (Activation Rate, Time to First Value) when the first_value journey interview is marked complete.

**Architecture:** When the first_value interview session completes, extract the activation activity from the journey's stages (the stage with `lifecycleSlot: "activation"`), then generate metrics where `generatedAfter === "first_value"` from the templates, interpolating the activation activity name into `{{firstValueActivity}}` placeholders. Append to existing catalog with order 7-8. Idempotent: skip if metrics already exist.

**Tech Stack:** Convex (backend), convex-test (testing), TypeScript

---

## Prerequisites

This plan assumes the following are already implemented:
- **Issue #24**: `metrics` table in schema with `userId`, `templateKey`, `order`, etc.
- **Issue #25**: `METRIC_TEMPLATES` in `src/shared/metricTemplates.ts` with `generatedAfter` field
- **Issue #26**: `generateFromOverview` mutation in `convex/metricCatalog.ts` (pattern to follow)

If these don't exist, implement them first.

---

## Task 1: Verify Prerequisites Exist

**Files:**
- Check: `convex/schema.ts` (metrics table)
- Check: `src/shared/metricTemplates.ts` (templates with generatedAfter)
- Check: `convex/metricCatalog.ts` (generateFromOverview exists)

**Step 1: Verify metrics table exists**

Run: `grep -n "metrics:" convex/schema.ts`
Expected: Find metrics table definition

**Step 2: Verify metricTemplates exists**

Run: `cat src/shared/metricTemplates.ts | head -30`
Expected: Find `METRIC_TEMPLATES` with `generatedAfter` field

**Step 3: Verify generateFromOverview exists**

Run: `grep -n "generateFromOverview" convex/metricCatalog.ts`
Expected: Find the mutation

If any prerequisite is missing, stop and implement those issues first.

---

## Task 2: Write Failing Tests for generateFromFirstValue

**Files:**
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Add test imports and helpers**

Add to the existing test file (if not already present):

```typescript
import { METRIC_TEMPLATES } from "../src/shared/metricTemplates";
```

**Step 2: Write failing test for generateFromFirstValue**

Add test block to `convex/metricCatalog.test.ts`:

```typescript
describe("generateFromFirstValue", () => {
  it("generates first_value metrics when first_value interview completes", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create first_value journey with activation stage
    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Add activation stage
      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate metrics
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId });

    // Verify metrics were created
    const metrics = await asUser.query(api.metrics.list, {});
    const firstValueMetrics = metrics.filter((m) =>
      METRIC_TEMPLATES.filter((t) => t.generatedAfter === "first_value")
        .map((t) => t.key)
        .includes(m.templateKey ?? "")
    );

    expect(firstValueMetrics).toHaveLength(2);
    expect(firstValueMetrics.map((m) => m.templateKey)).toContain("activation_rate");
    expect(firstValueMetrics.map((m) => m.templateKey)).toContain("time_to_first_value");
  });

  it("interpolates firstValueActivity into templates", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "First Report Generated",
        type: "activity",
        entity: "Report",
        action: "Generated",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId });

    const metrics = await asUser.query(api.metrics.list, {});
    const activationMetric = metrics.find((m) => m.templateKey === "activation_rate");

    expect(activationMetric).toBeDefined();
    // Should contain the activity name, not the placeholder
    expect(activationMetric?.definition).toContain("First Report Generated");
    expect(activationMetric?.definition).not.toContain("{{firstValueActivity}}");
  });

  it("is idempotent - skips if metrics already exist", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate twice
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId });
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId });

    // Should still only have 2 first_value metrics
    const metrics = await asUser.query(api.metrics.list, {});
    const firstValueMetrics = metrics.filter((m) =>
      ["activation_rate", "time_to_first_value"].includes(m.templateKey ?? "")
    );

    expect(firstValueMetrics).toHaveLength(2);
  });

  it("appends to existing overview metrics with correct order", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Pre-create overview metrics (simulating generateFromOverview already ran)
    await t.run(async (ctx) => {
      for (let i = 1; i <= 6; i++) {
        await ctx.db.insert("metrics", {
          userId,
          name: `Overview Metric ${i}`,
          definition: "Test",
          formula: "Test",
          whyItMatters: "Test",
          howToImprove: "Test",
          metricType: "default",
          templateKey: `overview_metric_${i}`,
          order: i,
          createdAt: Date.now(),
        });
      }
    });

    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId });

    const metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(8);

    // First value metrics should have order 7 and 8
    const activationRate = metrics.find((m) => m.templateKey === "activation_rate");
    const timeToFirstValue = metrics.find((m) => m.templateKey === "time_to_first_value");

    expect(activationRate?.order).toBe(7);
    expect(timeToFirstValue?.order).toBe(8);
  });

  it("links relatedActivityId to the activation stage", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    let stageId: Id<"stages">;
    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      stageId = await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId });

    const metrics = await asUser.query(api.metrics.list, {});
    const activationRate = metrics.find((m) => m.templateKey === "activation_rate");

    expect(activationRate?.relatedActivityId).toBe(stageId!);
  });

  it("throws error when journey not found", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    // Create a fake journey ID that doesn't exist
    const fakeJourneyId = await t.run(async (ctx) => {
      // Insert and immediately delete to get a valid but non-existent ID
      const id = await ctx.db.insert("journeys", {
        userId: "fake" as Id<"users">,
        type: "first_value",
        name: "Fake",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId: fakeJourneyId })
    ).rejects.toThrow("Journey not found");
  });

  it("throws error when no activation stage found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      // No stages added
    });

    await expect(
      asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId })
    ).rejects.toThrow("No activation stage found");
  });
});
```

**Step 3: Run test to verify it fails**

Run: `npm run test:run -- convex/metricCatalog.test.ts`
Expected: FAIL (generateFromFirstValue not found or not implemented)

**Step 4: Commit failing tests**

```bash
git add convex/metricCatalog.test.ts
git commit -m "test: add failing tests for generateFromFirstValue"
```

---

## Task 3: Implement generateFromFirstValue Mutation

**Files:**
- Modify: `convex/metricCatalog.ts`

**Step 1: Add the generateFromFirstValue mutation**

Add to `convex/metricCatalog.ts`:

```typescript
// Generate first_value metrics (Activation Rate, Time to First Value)
export const generateFromFirstValue = mutation({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    // 1. Get authenticated user
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // 2. Get the first_value journey
    const journey = await ctx.db.get(journeyId);
    if (!journey) throw new Error("Journey not found");
    if (journey.userId !== user._id) throw new Error("Not authorized");

    // 3. Get stages for this journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", journeyId))
      .collect();

    // 4. Find activation stage for {{firstValueActivity}} slot
    const activationStage = stages.find((s) => s.lifecycleSlot === "activation");
    if (!activationStage) throw new Error("No activation stage found");

    const firstValueActivity = activationStage.name;

    // 5. Get existing metrics to check for duplicates and determine next order
    const existingMetrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingTemplateKeys = new Set(
      existingMetrics.map((m) => m.templateKey).filter(Boolean)
    );

    // Find highest existing order
    const maxOrder = existingMetrics.length > 0
      ? Math.max(...existingMetrics.map((m) => m.order))
      : 0;

    // 6. Get first_value templates
    const firstValueTemplates = METRIC_TEMPLATES.filter(
      (t) => t.generatedAfter === "first_value"
    );

    // 7. Generate metrics that don't already exist
    let nextOrder = maxOrder + 1;
    const now = Date.now();

    for (const template of firstValueTemplates) {
      // Skip if already generated
      if (existingTemplateKeys.has(template.key)) continue;

      // Interpolate activity name into template
      const interpolate = (text: string) =>
        text.replace(/\{\{firstValueActivity\}\}/g, firstValueActivity);

      await ctx.db.insert("metrics", {
        userId: user._id,
        name: template.name,
        definition: interpolate(template.definition),
        formula: interpolate(template.formula),
        whyItMatters: interpolate(template.whyItMatters),
        howToImprove: interpolate(template.howToImprove),
        metricType: "generated",
        templateKey: template.key,
        relatedActivityId: activationStage._id,
        order: nextOrder++,
        createdAt: now,
      });
    }
  },
});
```

**Step 2: Add import for METRIC_TEMPLATES**

At the top of `convex/metricCatalog.ts`, add:

```typescript
import { METRIC_TEMPLATES } from "../src/shared/metricTemplates";
```

**Step 3: Run tests to verify they pass**

Run: `npm run test:run -- convex/metricCatalog.test.ts`
Expected: All tests PASS

**Step 4: Commit implementation**

```bash
git add convex/metricCatalog.ts
git commit -m "feat: add generateFromFirstValue mutation"
```

---

## Task 4: Integration Test with Interview Completion

**Files:**
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Add integration test for interview completion flow**

```typescript
describe("integration with interview completion", () => {
  it("can be called after first_value interview is marked complete", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create first_value journey with activation stage
    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId: jId,
        name: "Project Created",
        type: "activity",
        entity: "Project",
        action: "Created",
        lifecycleSlot: "activation",
        position: { x: 100, y: 100 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Create and complete interview session
    const sessionId = await asUser.mutation(api.interviews.createSession, {
      journeyId,
      interviewType: "first_value",
    });

    await asUser.mutation(api.interviews.completeSession, { sessionId });

    // Verify session is completed
    const session = await asUser.query(api.interviews.getSession, { sessionId });
    expect(session?.status).toBe("completed");

    // Now generate metrics
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, { journeyId });

    // Verify metrics exist
    const metrics = await asUser.query(api.metrics.list, {});
    expect(metrics.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run all tests**

Run: `npm run test:run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add convex/metricCatalog.test.ts
git commit -m "test: add integration test for interview completion flow"
```

---

## Task 5: Final Verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Verify Convex compiles**

Run: `npx convex dev` briefly to confirm no schema/type errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from final verification"
```

---

## Testing Summary

| What | Tool | File |
|------|------|------|
| generateFromFirstValue mutation | convex-test | `convex/metricCatalog.test.ts` |
| Integration with interview flow | convex-test | `convex/metricCatalog.test.ts` |

Run: `npm run test:run` to verify all tests pass.

---

## Design Notes

### Key Implementation Details

1. **Trigger**: This mutation is called manually when first_value interview completes. The UI will call this after `completeSession` succeeds.

2. **Activity Extraction**: Finds the stage with `lifecycleSlot === "activation"` and uses its `name` field for the `{{firstValueActivity}}` placeholder.

3. **Idempotency**: Checks `templateKey` of existing metrics before inserting. If a metric with the same template key exists, it's skipped.

4. **Order Calculation**: Finds max existing order and appends new metrics starting from `maxOrder + 1`. Typically this will be 7-8 if overview metrics (1-6) already exist.

5. **relatedActivityId**: Links each first_value metric to the activation stage, enabling navigation from metric detail to journey editor.

### Template Keys Expected

From the design doc, the two first_value metrics are:
- `activation_rate` - Activation Rate (order 7)
- `time_to_first_value` - Time to First Value (order 8)

### Future Integration Points

The UI code that handles interview completion should call this mutation:

```typescript
// In first_value interview completion handler
await completeSession({ sessionId });
await generateFromFirstValue({ journeyId });
```

This is NOT implemented in this issue - just the backend mutation.
