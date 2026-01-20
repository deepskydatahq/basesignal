# Metric Generation Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Change metric generation from stage-based to measurementActivities-based, replacing `relatedActivityId` with `sourceActivityId`.

**Architecture:** Replace the current approach of reading stages from journeys and extracting activity info with a direct query to measurementActivities. Metrics will link to `measurementActivities._id` via `sourceActivityId` field instead of `stages._id` via `relatedActivityId`. No migration needed - metrics are generated, not user-created.

**Tech Stack:** Convex (schema + mutations), Vitest + convex-test

---

## Background

### Current State
- `convex/schema.ts`: metrics table has `relatedActivityId: v.optional(v.id("stages"))`
- `convex/metricCatalog.ts`: `generateFromOverview` and `generateFromFirstValue` query `stages` table
- `convex/interviews.ts`: has duplicate `generateOverviewMetrics` helper that also queries stages
- Tests create stages directly to test metric generation

### Target State
- metrics table has `sourceActivityId: v.optional(v.id("measurementActivities"))`
- Generation functions query `measurementActivities` directly
- Tests create `measurementActivities` directly (no stages needed)

### Key Files
- `convex/schema.ts:385-407` - metrics table definition
- `convex/metricCatalog.ts:20-91` - generateFromOverview
- `convex/metricCatalog.ts:94-165` - generateFromFirstValue
- `convex/interviews.ts:8-65` - generateOverviewMetrics helper (duplicate)
- `convex/metricCatalog.test.ts` - comprehensive test suite

---

## Task 1: Update Schema - Replace relatedActivityId with sourceActivityId

**Files:**
- Modify: `convex/schema.ts:402`

**Step 1: Update the metrics table schema**

Change line 402 from:
```typescript
relatedActivityId: v.optional(v.id("stages")),  // Optional journey link
```
to:
```typescript
sourceActivityId: v.optional(v.id("measurementActivities")),  // Link to source event
```

**Step 2: Run type check to find all usages**

Run: `npx tsc --noEmit`
Expected: TypeScript errors in metricCatalog.ts and interviews.ts where `relatedActivityId` is used

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "$(cat <<'EOF'
refactor: replace relatedActivityId with sourceActivityId in metrics schema

Part of metric-event traceability. Metrics now link to
measurementActivities instead of stages.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update generateFromOverview - Query measurementActivities

**Files:**
- Modify: `convex/metricCatalog.ts:20-91`

**Step 1: Write the failing test**

Add this test to `convex/metricCatalog.test.ts` at the end of the `describe("generateFromOverview")` block (before the closing brace around line 556):

```typescript
  it("links sourceActivityId to the core_usage measurementActivity", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create measurementActivity with core_usage lifecycleSlot
    let activityId: Id<"measurementActivities">;
    const journeyId = await t.run(async (ctx) => {
      // Create entity first
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      // Create activity
      activityId = await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      // Create journey (still needed for auth check)
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    const coreActionMetric = metrics.find(
      (m) => m.templateKey === "core_action_frequency"
    );

    expect(coreActionMetric).toBeDefined();
    expect(coreActionMetric?.sourceActivityId).toBe(activityId!);
  });
```

Also add this import at the top of the test file (after the existing imports around line 6):
```typescript
import type { Id } from "./_generated/dataModel";
```

Wait - this import already exists at line 5. Good.

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/metricCatalog.test.ts --run`
Expected: FAIL with "sourceActivityId" property not existing or undefined

**Step 3: Update generateFromOverview implementation**

Replace the function body in `convex/metricCatalog.ts` (lines 20-91):

```typescript
// Generate overview metrics (New Users, MAU, DAU, DAU/MAU, 7-Day Retention, Core Action Frequency)
export const generateFromOverview = mutation({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    // 1. Get authenticated user
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // 2. Get the overview journey (for auth check)
    const journey = await ctx.db.get(journeyId);
    if (!journey) throw new Error("Journey not found");
    if (journey.userId !== user._id) throw new Error("Not authorized");

    // 3. Get measurementActivities for this user
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // 4. Find core_usage activity for {{coreAction}} slot (with fallback)
    const coreUsageActivity = activities.find((a) => a.lifecycleSlot === "core_usage");
    const coreAction = coreUsageActivity?.name ?? "Core Action";

    // 5. Get existing metrics to check for duplicates
    const existingMetrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingTemplateKeys = new Set(
      existingMetrics.map((m) => m.templateKey).filter(Boolean)
    );

    // 6. Get overview templates
    const overviewTemplates = getTemplatesByPhase("overview");

    // 7. Generate metrics that don't already exist
    let order = 1;
    const now = Date.now();
    let created = 0;
    let skipped = 0;

    for (const template of overviewTemplates) {
      // Skip if already generated
      if (existingTemplateKeys.has(template.key)) {
        skipped++;
        continue;
      }

      // Interpolate coreAction into template (only core_action_frequency uses it currently)
      const interpolate = (text: string) =>
        text.replace(/\{\{coreAction\}\}/g, coreAction);

      await ctx.db.insert("metrics", {
        userId: user._id,
        name: template.name,
        definition: interpolate(template.definition),
        formula: interpolate(template.formula),
        whyItMatters: interpolate(template.whyItMatters),
        howToImprove: interpolate(template.howToImprove),
        category: template.category,
        metricType: "generated",
        templateKey: template.key,
        sourceActivityId: coreUsageActivity?._id,
        order: order++,
        createdAt: now,
      });
      created++;
    }

    return { created, skipped };
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/metricCatalog.test.ts --run`
Expected: The new test passes, but other tests may fail (they still create stages)

**Step 5: Commit**

```bash
git add convex/metricCatalog.ts convex/metricCatalog.test.ts
git commit -m "$(cat <<'EOF'
feat: update generateFromOverview to use measurementActivities

- Query measurementActivities instead of stages
- Store sourceActivityId instead of relatedActivityId
- Add test for sourceActivityId linking

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update generateFromFirstValue - Query measurementActivities

**Files:**
- Modify: `convex/metricCatalog.ts:94-165`

**Step 1: Update the test that checks relatedActivityId**

Find the test "links relatedActivityId to the activation stage" (around line 238) and update it:

```typescript
  it("links sourceActivityId to the activation measurementActivity", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    let activityId: Id<"measurementActivities">;
    const journeyId = await t.run(async (ctx) => {
      // Create entity
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      // Create activation activity
      activityId = await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      // Create journey (for auth)
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    const activationRate = metrics.find(
      (m) => m.templateKey === "activation_rate"
    );

    expect(activationRate?.sourceActivityId).toBe(activityId!);
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/metricCatalog.test.ts -t "links sourceActivityId" --run`
Expected: FAIL - still using old implementation

**Step 3: Update generateFromFirstValue implementation**

Replace the function body in `convex/metricCatalog.ts` (lines 94-165):

```typescript
// Generate first_value metrics (Activation Rate, Time to First Value)
export const generateFromFirstValue = mutation({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, { journeyId }) => {
    // 1. Get authenticated user
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // 2. Get the first_value journey (for auth check)
    const journey = await ctx.db.get(journeyId);
    if (!journey) throw new Error("Journey not found");
    if (journey.userId !== user._id) throw new Error("Not authorized");

    // 3. Get measurementActivities for this user
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // 4. Find activation activity for {{firstValueActivity}} slot
    const activationActivity = activities.find((a) => a.lifecycleSlot === "activation");
    if (!activationActivity) throw new Error("No activation activity found");

    const firstValueActivity = activationActivity.name;

    // 5. Get existing metrics to check for duplicates and determine next order
    const existingMetrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const existingTemplateKeys = new Set(
      existingMetrics.map((m) => m.templateKey).filter(Boolean)
    );

    // Find highest existing order
    const maxOrder =
      existingMetrics.length > 0
        ? Math.max(...existingMetrics.map((m) => m.order))
        : 0;

    // 6. Get first_value templates
    const firstValueTemplates = getTemplatesByPhase("first_value");

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
        category: template.category,
        metricType: "generated",
        templateKey: template.key,
        sourceActivityId: activationActivity._id,
        order: nextOrder++,
        createdAt: now,
      });
    }
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/metricCatalog.test.ts -t "links sourceActivityId" --run`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/metricCatalog.ts convex/metricCatalog.test.ts
git commit -m "$(cat <<'EOF'
feat: update generateFromFirstValue to use measurementActivities

- Query measurementActivities instead of stages
- Store sourceActivityId instead of relatedActivityId
- Update error message to reference activity not stage

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update interviews.ts - Fix generateOverviewMetrics helper

**Files:**
- Modify: `convex/interviews.ts:8-65`

**Step 1: Update the helper function**

Replace the `generateOverviewMetrics` function in `convex/interviews.ts` (lines 8-65):

```typescript
// Helper to generate overview metrics (duplicated to avoid circular deps with internal mutations)
async function generateOverviewMetrics(ctx: MutationCtx, journeyId: string, userId: string) {
  // 1. Get measurementActivities for this user
  const activities = await ctx.db
    .query("measurementActivities")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .collect();

  // 2. Find core_usage activity for {{coreAction}} slot (with fallback)
  const coreUsageActivity = activities.find((a) => a.lifecycleSlot === "core_usage");
  const coreAction = coreUsageActivity?.name ?? "Core Action";

  // 3. Get existing metrics to check for duplicates
  const existingMetrics = await ctx.db
    .query("metrics")
    .withIndex("by_user", (q) => q.eq("userId", userId as any))
    .collect();

  const existingTemplateKeys = new Set(
    existingMetrics.map((m) => m.templateKey).filter(Boolean)
  );

  // 4. Get overview templates
  const overviewTemplates = getTemplatesByPhase("overview");

  // 5. Generate metrics that don't already exist
  let order = 1;
  const now = Date.now();
  let created = 0;

  for (const template of overviewTemplates) {
    // Skip if already generated
    if (existingTemplateKeys.has(template.key)) {
      continue;
    }

    // Interpolate coreAction into template
    const interpolate = (text: string) =>
      text.replace(/\{\{coreAction\}\}/g, coreAction);

    await ctx.db.insert("metrics", {
      userId: userId as any,
      name: template.name,
      definition: interpolate(template.definition),
      formula: interpolate(template.formula),
      whyItMatters: interpolate(template.whyItMatters),
      howToImprove: interpolate(template.howToImprove),
      category: template.category,
      metricType: "generated",
      templateKey: template.key,
      sourceActivityId: coreUsageActivity?._id,
      order: order++,
      createdAt: now,
    });
    created++;
  }

  return { created };
}
```

**Step 2: Run tests**

Run: `npm test -- convex/metricCatalog.test.ts --run`
Expected: PASS (interview trigger test should still work)

**Step 3: Commit**

```bash
git add convex/interviews.ts
git commit -m "$(cat <<'EOF'
refactor: update interviews.ts helper to use measurementActivities

Sync generateOverviewMetrics with metricCatalog changes.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update Remaining Tests - Migrate from stages to measurementActivities

**Files:**
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Create helper function for test setup**

Add this helper function after the existing `setupUser` function (around line 25):

```typescript
// Helper to create measurement plan data for tests
async function setupMeasurementActivity(
  t: ReturnType<typeof convexTest>,
  userId: ReturnType<typeof convexTest>["run"] extends (fn: (ctx: any) => Promise<infer R>) => any ? R : never,
  options: {
    entityName: string;
    activityName: string;
    action: string;
    lifecycleSlot?: string;
    isFirstValue?: boolean;
  }
) {
  return await t.run(async (ctx) => {
    // Check if entity exists
    const existingEntities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let entityId = existingEntities.find(e => e.name === options.entityName)?._id;

    if (!entityId) {
      entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: options.entityName,
        suggestedFrom: "test",
        createdAt: Date.now(),
      });
    }

    const activityId = await ctx.db.insert("measurementActivities", {
      userId,
      entityId,
      name: options.activityName,
      action: options.action,
      lifecycleSlot: options.lifecycleSlot,
      isFirstValue: options.isFirstValue ?? false,
      suggestedFrom: "test",
      createdAt: Date.now(),
    });

    return { entityId, activityId };
  });
}
```

Actually, this helper type is complex. Let's use a simpler approach - just update each test individually.

**Step 2: Update "generates first_value metrics when first_value interview completes" test**

Replace the test (lines 28-79) with:

```typescript
  it("generates first_value metrics when first_value interview completes", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create measurementActivity with activation lifecycleSlot
    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      // Create journey (for auth)
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate metrics
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    // Verify metrics were created
    const metrics = await asUser.query(api.metrics.list, {});
    const firstValueMetrics = metrics.filter((m) =>
      METRIC_TEMPLATES.filter((t) => t.generatedAfter === "first_value")
        .map((t) => t.key)
        .includes(m.templateKey ?? "")
    );

    expect(firstValueMetrics).toHaveLength(2);
    expect(firstValueMetrics.map((m) => m.templateKey)).toContain(
      "activation_rate"
    );
    expect(firstValueMetrics.map((m) => m.templateKey)).toContain(
      "time_to_first_value"
    );
  });
```

**Step 3: Update "interpolates firstValueActivity into templates" test**

Replace the test (lines 81-123) with:

```typescript
  it("interpolates firstValueActivity into templates", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "First Report Generated",
        action: "Generated",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    const activationMetric = metrics.find(
      (m) => m.templateKey === "activation_rate"
    );

    expect(activationMetric).toBeDefined();
    // Should contain the activity name, not the placeholder
    expect(activationMetric?.definition).toContain("First Report Generated");
    expect(activationMetric?.definition).not.toContain("{{firstValueActivity}}");
  });
```

**Step 4: Run tests incrementally**

Run: `npm test -- convex/metricCatalog.test.ts --run`
Expected: Some tests pass, some fail (the ones not yet updated)

**Step 5: Continue updating remaining tests**

Update "is idempotent - skips if metrics already exist" (first_value version, lines 125-169):

```typescript
  it("is idempotent - skips if metrics already exist", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate twice
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });
    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    // Should still only have 2 first_value metrics
    const metrics = await asUser.query(api.metrics.list, {});
    const firstValueMetrics = metrics.filter((m) =>
      ["activation_rate", "time_to_first_value"].includes(m.templateKey ?? "")
    );

    expect(firstValueMetrics).toHaveLength(2);
  });
```

Update "appends to existing overview metrics with correct order" (lines 171-236):

```typescript
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
          category: "engagement",
          metricType: "default",
          templateKey: `overview_metric_${i}`,
          order: i,
          createdAt: Date.now(),
        });
      }
    });

    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromFirstValue, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(8);

    // First value metrics should have order 7 and 8
    const activationRate = metrics.find(
      (m) => m.templateKey === "activation_rate"
    );
    const timeToFirstValue = metrics.find(
      (m) => m.templateKey === "time_to_first_value"
    );

    expect(activationRate?.order).toBe(7);
    expect(timeToFirstValue?.order).toBe(8);
  });
```

Update "throws error when journey not found" (first_value version, lines 280-303):

```typescript
  it("throws error when journey not found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create and delete a journey to get a valid but non-existent ID
    const fakeJourneyId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "Temp",
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.delete(id);
      return id;
    });

    await expect(
      asUser.mutation(api.metricCatalog.generateFromFirstValue, {
        journeyId: fakeJourneyId,
      })
    ).rejects.toThrow("Journey not found");
  });
```

Update "throws error when no activation stage found" → "throws error when no activation activity found" (lines 305-326):

```typescript
  it("throws error when no activation activity found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      // Create journey but no measurementActivities
      return await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await expect(
      asUser.mutation(api.metricCatalog.generateFromFirstValue, {
        journeyId,
      })
    ).rejects.toThrow("No activation activity found");
  });
```

**Step 6: Run all first_value tests**

Run: `npm test -- convex/metricCatalog.test.ts -t "generateFromFirstValue" --run`
Expected: PASS

**Step 7: Commit first_value test updates**

```bash
git add convex/metricCatalog.test.ts
git commit -m "$(cat <<'EOF'
test: update generateFromFirstValue tests to use measurementActivities

Tests now create measurementActivities directly instead of stages,
reflecting the actual production data flow.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update Overview Tests - Migrate from stages to measurementActivities

**Files:**
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Update "generates 6 overview metrics when overview interview completes"**

Replace the test (lines 330-381):

```typescript
  it("generates 6 overview metrics when overview interview completes", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create measurementActivity with core_usage lifecycleSlot
    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate metrics
    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    // Verify metrics were created
    const metrics = await asUser.query(api.metrics.list, {});
    const overviewMetrics = metrics.filter((m) =>
      METRIC_TEMPLATES.filter((t) => t.generatedAfter === "overview")
        .map((t) => t.key)
        .includes(m.templateKey ?? "")
    );

    expect(overviewMetrics).toHaveLength(6);
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("new_users");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("mau");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("dau");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("dau_mau_ratio");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("retention_d7");
    expect(overviewMetrics.map((m) => m.templateKey)).toContain("core_action_frequency");
  });
```

**Step 2: Update "is idempotent - skips if metrics already exist" (overview)**

Replace the test (lines 383-429):

```typescript
  it("is idempotent - skips if metrics already exist", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Generate twice
    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });
    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    // Should still only have 6 overview metrics
    const metrics = await asUser.query(api.metrics.list, {});
    const overviewMetrics = metrics.filter((m) =>
      METRIC_TEMPLATES.filter((t) => t.generatedAfter === "overview")
        .map((t) => t.key)
        .includes(m.templateKey ?? "")
    );

    expect(overviewMetrics).toHaveLength(6);
  });
```

**Step 3: Update "assigns correct order 1-6 to overview metrics"**

Replace the test (lines 431-468):

```typescript
  it("assigns correct order 1-6 to overview metrics", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    const orders = metrics.map((m) => m.order).sort((a, b) => a - b);

    expect(orders).toEqual([1, 2, 3, 4, 5, 6]);
  });
```

**Step 4: Update "uses fallback 'Core Action' when no core_usage activity found"**

Replace the test (lines 470-498):

```typescript
  it("uses fallback 'Core Action' when no core_usage activity found", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create journey without any measurementActivities
    const journeyId = await t.run(async (ctx) => {
      return await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Should still generate with fallback
    await asUser.mutation(api.metricCatalog.generateFromOverview, {
      journeyId,
    });

    const metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(6);

    // core_action_frequency should use fallback
    const coreActionMetric = metrics.find((m) => m.templateKey === "core_action_frequency");
    expect(coreActionMetric).toBeDefined();
  });
```

**Step 5: Update remaining overview error tests**

"throws error when journey not found" (lines 500-523) - no changes needed, just verify

"throws error when not authorized to access journey" (lines 525-555) - no changes needed, just verify

**Step 6: Run all overview tests**

Run: `npm test -- convex/metricCatalog.test.ts -t "generateFromOverview" --run`
Expected: PASS

**Step 7: Commit overview test updates**

```bash
git add convex/metricCatalog.test.ts
git commit -m "$(cat <<'EOF'
test: update generateFromOverview tests to use measurementActivities

Tests now create measurementActivities directly instead of stages.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update Interview Trigger Tests

**Files:**
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Update "generates overview metrics when overview interview is completed"**

Replace the test (lines 558-616):

```typescript
  it("generates overview metrics when overview interview is completed", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // Create measurementActivity and journey
    const journeyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Report",
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Report Generated",
        action: "Generated",
        lifecycleSlot: "core_usage",
        isFirstValue: false,
        suggestedFrom: "overview_interview",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Create an active interview session
    const sessionId = await asUser.mutation(api.interviews.createSession, {
      journeyId,
      interviewType: "overview",
    });

    // Verify no metrics exist yet
    let metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(0);

    // Complete the interview session (this should trigger metric generation)
    await asUser.mutation(api.interviews.completeSession, {
      sessionId,
    });

    // Verify 6 overview metrics were generated
    metrics = await asUser.query(api.metrics.list, {});
    expect(metrics).toHaveLength(6);

    // Verify the correct templates were used
    const templateKeys = metrics.map((m) => m.templateKey);
    expect(templateKeys).toContain("new_users");
    expect(templateKeys).toContain("mau");
    expect(templateKeys).toContain("dau");
    expect(templateKeys).toContain("dau_mau_ratio");
    expect(templateKeys).toContain("retention_d7");
    expect(templateKeys).toContain("core_action_frequency");
  });
```

**Step 2: Update "does not generate metrics for non-overview interview completion"**

Replace the test (lines 618-686):

```typescript
  it("does not generate metrics for non-overview interview completion", async () => {
    const t = convexTest(schema);
    const { asUser, userId } = await setupUser(t);

    // First create an overview journey with a completed overview session (to unlock first_value)
    const journeyId = await t.run(async (ctx) => {
      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Create completed overview session to unlock first_value
      await ctx.db.insert("interviewSessions", {
        journeyId: jId,
        interviewType: "overview",
        status: "completed",
        startedAt: Date.now(),
        completedAt: Date.now(),
      });

      return jId;
    });

    // Create first_value journey with activation activity
    const firstValueJourneyId = await t.run(async (ctx) => {
      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        lifecycleSlot: "activation",
        isFirstValue: true,
        suggestedFrom: "first_value",
        createdAt: Date.now(),
      });

      const jId = await ctx.db.insert("journeys", {
        userId,
        type: "first_value",
        name: "First Value",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return jId;
    });

    // Create and complete a first_value interview session
    const sessionId = await asUser.mutation(api.interviews.createSession, {
      journeyId: firstValueJourneyId,
      interviewType: "first_value",
    });

    await asUser.mutation(api.interviews.completeSession, {
      sessionId,
    });

    // Verify no overview metrics were generated (first_value doesn't trigger overview generation)
    const metrics = await asUser.query(api.metrics.list, {});
    // Should have 0 metrics since we're testing that non-overview interviews don't trigger
    // (Note: first_value metrics would be generated by a separate flow)
    expect(metrics).toHaveLength(0);
  });
```

**Step 3: Run all tests**

Run: `npm test -- convex/metricCatalog.test.ts --run`
Expected: PASS (all tests)

**Step 4: Commit interview trigger test updates**

```bash
git add convex/metricCatalog.test.ts
git commit -m "$(cat <<'EOF'
test: update interview trigger tests to use measurementActivities

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final Verification and Cleanup

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No linting errors

**Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: cleanup after metric generation refactor

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan refactors metric generation in 8 tasks:

1. **Schema change** - Replace `relatedActivityId` with `sourceActivityId`
2. **generateFromOverview** - Query measurementActivities instead of stages
3. **generateFromFirstValue** - Query measurementActivities instead of stages
4. **interviews.ts helper** - Update duplicate helper function
5. **First_value tests** - Migrate to measurementActivities
6. **Overview tests** - Migrate to measurementActivities
7. **Interview trigger tests** - Migrate to measurementActivities
8. **Final verification** - Full test suite, types, lint

Each task follows TDD: write failing test → implement → verify pass → commit.
