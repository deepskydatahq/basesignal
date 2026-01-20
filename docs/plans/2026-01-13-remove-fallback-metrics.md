# Remove Fallback Metrics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove generic "best practice" fallback metrics so all metrics trace to actual activities in the user's journey.

**Architecture:** Modify `generateFromOverview` to skip engagement metrics (MAU, DAU, etc.) when no `core_usage` stage exists, instead of using fallback strings. Reach metrics (New Users) generate unconditionally. First value metrics already require activation stage (no change needed). Update MetricCard to display source activity name.

**Tech Stack:** Convex (backend mutations), React (MetricCard component), Vitest + convex-test (testing)

---

## Task 1: Update tests for generateFromOverview to expect skipping when no core_usage stage

**Files:**
- Modify: `convex/metricCatalog.test.ts:470-498`

**Step 1: Write the failing test for skip behavior**

Replace the test "uses fallback 'Core Action' when no core_usage activity found" with a new test that expects engagement metrics to be skipped.

```typescript
it("skips engagement metrics when no core_usage activity found", async () => {
  const t = convexTest(schema);
  const { asUser, userId } = await setupUser(t);

  // Create journey without core_usage stage
  const journeyId = await t.run(async (ctx) => {
    return await ctx.db.insert("journeys", {
      userId,
      type: "overview",
      name: "Overview",
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    // No stages added
  });

  // Generate metrics
  const result = await asUser.mutation(api.metricCatalog.generateFromOverview, {
    journeyId,
  });

  // Should only create reach metric (new_users), skip engagement metrics
  const metrics = await asUser.query(api.metrics.list, {});
  expect(metrics).toHaveLength(1);
  expect(metrics[0].templateKey).toBe("new_users");

  // Verify engagement metrics were skipped
  const templateKeys = metrics.map((m) => m.templateKey);
  expect(templateKeys).not.toContain("mau");
  expect(templateKeys).not.toContain("dau");
  expect(templateKeys).not.toContain("dau_mau_ratio");
  expect(templateKeys).not.toContain("retention_d7");
  expect(templateKeys).not.toContain("core_action_frequency");

  // Return value should indicate what was created/skipped
  expect(result.created).toBe(1);
  expect(result.skipped).toBe(0); // skipped due to duplicates, not missing stage
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/metricCatalog.test.ts -t "skips engagement metrics"`
Expected: FAIL - test expects 1 metric but gets 6

**Step 3: Commit the failing test**

```bash
git add convex/metricCatalog.test.ts
git commit -m "test: expect generateFromOverview to skip engagement metrics without core_usage stage"
```

---

## Task 2: Add test for generateFromOverview to ensure reach metrics are always generated

**Files:**
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Write test for reach metric unconditional generation**

Add test after the skip test:

```typescript
it("always generates reach metrics (new_users) regardless of stages", async () => {
  const t = convexTest(schema);
  const { asUser, userId } = await setupUser(t);

  // Create journey with no stages at all
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

  await asUser.mutation(api.metricCatalog.generateFromOverview, { journeyId });

  const metrics = await asUser.query(api.metrics.list, {});
  const newUsersMetric = metrics.find((m) => m.templateKey === "new_users");

  expect(newUsersMetric).toBeDefined();
  expect(newUsersMetric?.category).toBe("reach");
  // Reach metrics don't need relatedActivityId
  expect(newUsersMetric?.relatedActivityId).toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/metricCatalog.test.ts -t "always generates reach metrics"`
Expected: FAIL - current implementation generates all 6 metrics

**Step 3: Commit the failing test**

```bash
git add convex/metricCatalog.test.ts
git commit -m "test: expect reach metrics to always generate regardless of stages"
```

---

## Task 3: Add test for generateFromOverview engagement metrics require relatedActivityId

**Files:**
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Write test to verify engagement metrics have relatedActivityId**

```typescript
it("links engagement metrics to core_usage stage via relatedActivityId", async () => {
  const t = convexTest(schema);
  const { asUser, userId } = await setupUser(t);

  let coreUsageStageId: Id<"stages">;
  const journeyId = await t.run(async (ctx) => {
    const jId = await ctx.db.insert("journeys", {
      userId,
      type: "overview",
      name: "Overview",
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    coreUsageStageId = await ctx.db.insert("stages", {
      journeyId: jId,
      name: "Report Generated",
      type: "activity",
      entity: "Report",
      action: "Generated",
      lifecycleSlot: "core_usage",
      position: { x: 100, y: 100 },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return jId;
  });

  await asUser.mutation(api.metricCatalog.generateFromOverview, { journeyId });

  const metrics = await asUser.query(api.metrics.list, {});

  // All engagement metrics should have relatedActivityId pointing to core_usage stage
  const engagementMetrics = metrics.filter((m) => m.category === "engagement");
  expect(engagementMetrics.length).toBe(5); // mau, dau, dau_mau_ratio, retention_d7, core_action_frequency

  for (const metric of engagementMetrics) {
    expect(metric.relatedActivityId).toBe(coreUsageStageId!);
  }

  // Reach metrics should NOT have relatedActivityId
  const reachMetrics = metrics.filter((m) => m.category === "reach");
  expect(reachMetrics.length).toBe(1);
  expect(reachMetrics[0].relatedActivityId).toBeUndefined();
});
```

**Step 2: Run test to verify behavior**

Run: `npm test -- convex/metricCatalog.test.ts -t "links engagement metrics"`
Expected: Should pass or fail depending on current implementation details

**Step 3: Commit the test**

```bash
git add convex/metricCatalog.test.ts
git commit -m "test: verify engagement metrics link to core_usage stage"
```

---

## Task 4: Update metricTemplates.ts to add category-based helpers

**Files:**
- Modify: `src/shared/metricTemplates.ts`

**Step 1: Add helper to get templates requiring core_usage stage**

Add after existing helper functions (around line 163):

```typescript
// Helper to check if a template requires core_usage stage (engagement metrics)
export function requiresCoreUsage(template: MetricTemplate): boolean {
  return template.category === "engagement" && template.generatedAfter === "overview";
}

// Get templates that don't require any stage (reach metrics)
export function getUnconditionalTemplates(): MetricTemplate[] {
  return METRIC_TEMPLATES.filter(
    (t) => t.generatedAfter === "overview" && t.category === "reach"
  );
}

// Get templates that require core_usage stage (engagement metrics)
export function getEngagementTemplates(): MetricTemplate[] {
  return METRIC_TEMPLATES.filter(
    (t) => t.generatedAfter === "overview" && t.category === "engagement"
  );
}
```

**Step 2: Run type check to verify**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit the helpers**

```bash
git add src/shared/metricTemplates.ts
git commit -m "feat: add helper functions to categorize templates by stage requirements"
```

---

## Task 5: Update generateFromOverview to skip engagement metrics without core_usage stage

**Files:**
- Modify: `convex/metricCatalog.ts:20-91`

**Step 1: Update the import statement**

Change the import at line 4:

```typescript
import {
  getTemplatesByPhase,
  getUnconditionalTemplates,
  getEngagementTemplates
} from "../src/shared/metricTemplates";
```

**Step 2: Rewrite generateFromOverview handler**

Replace the handler body (lines 22-90) with:

```typescript
handler: async (ctx, { journeyId }) => {
  // 1. Get authenticated user
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");

  // 2. Get the overview journey
  const journey = await ctx.db.get(journeyId);
  if (!journey) throw new Error("Journey not found");
  if (journey.userId !== user._id) throw new Error("Not authorized");

  // 3. Get stages for this journey
  const stages = await ctx.db
    .query("stages")
    .withIndex("by_journey", (q) => q.eq("journeyId", journeyId))
    .collect();

  // 4. Find core_usage stage for engagement metrics
  const coreUsageStage = stages.find((s) => s.lifecycleSlot === "core_usage");

  // 5. Get existing metrics to check for duplicates
  const existingMetrics = await ctx.db
    .query("metrics")
    .withIndex("by_user", (q) => q.eq("userId", user._id))
    .collect();

  const existingTemplateKeys = new Set(
    existingMetrics.map((m) => m.templateKey).filter(Boolean)
  );

  // 6. Determine which templates to generate
  // - Reach metrics: always generate (no stage required)
  // - Engagement metrics: only if core_usage stage exists
  const unconditionalTemplates = getUnconditionalTemplates();
  const engagementTemplates = coreUsageStage ? getEngagementTemplates() : [];
  const templatesToGenerate = [...unconditionalTemplates, ...engagementTemplates];

  // 7. Generate metrics that don't already exist
  let order = 1;
  const now = Date.now();
  let created = 0;
  let skipped = 0;

  for (const template of templatesToGenerate) {
    // Skip if already generated
    if (existingTemplateKeys.has(template.key)) {
      skipped++;
      continue;
    }

    // Interpolate coreAction into template (engagement metrics use it)
    const coreAction = coreUsageStage?.name ?? "";
    const interpolate = (text: string) =>
      text.replace(/\{\{coreAction\}\}/g, coreAction);

    // Only link relatedActivityId for engagement metrics
    const relatedActivityId =
      template.category === "engagement" ? coreUsageStage?._id : undefined;

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
      relatedActivityId,
      order: order++,
      createdAt: now,
    });
    created++;
  }

  return { created, skipped };
},
```

**Step 3: Run the tests to verify**

Run: `npm test -- convex/metricCatalog.test.ts`
Expected: All new tests pass, some old tests may need updating

**Step 4: Commit the implementation**

```bash
git add convex/metricCatalog.ts
git commit -m "feat: skip engagement metrics when no core_usage stage exists"
```

---

## Task 6: Update existing tests that expect 6 overview metrics

**Files:**
- Modify: `convex/metricCatalog.test.ts`

**Step 1: Update "generates 6 overview metrics" test**

The test at line 330 should still pass since it has a core_usage stage. Verify and update description if needed:

```typescript
it("generates 6 overview metrics when overview interview completes with core_usage stage", async () => {
  // ... existing test body (should pass as-is since it has core_usage stage)
});
```

**Step 2: Run all tests to verify**

Run: `npm test -- convex/metricCatalog.test.ts`
Expected: All tests pass

**Step 3: Commit any test updates**

```bash
git add convex/metricCatalog.test.ts
git commit -m "test: clarify tests depend on core_usage stage for engagement metrics"
```

---

## Task 7: Add test for MetricCard to display source activity name

**Files:**
- Modify: `src/components/metrics/MetricCard.test.tsx`

**Step 1: Write failing test for source activity display**

```typescript
it("displays source activity name when provided", () => {
  render(
    <MetricCard
      name="Monthly Active Users"
      definition="Count of unique users who performed any tracked activity"
      category="engagement"
      sourceActivityName="Report Generated"
    />
  );

  expect(screen.getByText("Based on: Report Generated")).toBeInTheDocument();
});

it("does not display source activity section when not provided", () => {
  render(
    <MetricCard
      name="New Users"
      definition="Count of new accounts created"
      category="reach"
    />
  );

  expect(screen.queryByText(/Based on:/)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/metrics/MetricCard.test.tsx -t "displays source activity"`
Expected: FAIL - sourceActivityName prop doesn't exist

**Step 3: Commit the failing test**

```bash
git add src/components/metrics/MetricCard.test.tsx
git commit -m "test: expect MetricCard to display source activity name"
```

---

## Task 8: Update MetricCard component to display source activity

**Files:**
- Modify: `src/components/metrics/MetricCard.tsx`

**Step 1: Add sourceActivityName prop and display**

```typescript
interface MetricCardProps {
  name: string;
  definition: string;
  category: MetricCategory;
  sourceActivityName?: string;
  selected?: boolean;
  onClick?: () => void;
}

export function MetricCard({
  name,
  definition,
  category,
  sourceActivityName,
  selected = false,
  onClick,
}: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 bg-white border border-gray-200 rounded-lg",
        "hover:shadow-md transition-shadow cursor-pointer",
        selected && "ring-2 ring-black"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-medium text-gray-900">{name}</h3>
        <CategoryBadge category={category} />
      </div>
      <p className="text-sm text-gray-600 line-clamp-2">{definition}</p>
      {sourceActivityName && (
        <p className="text-xs text-gray-400 mt-2">
          Based on: {sourceActivityName}
        </p>
      )}
    </button>
  );
}
```

**Step 2: Run tests to verify**

Run: `npm test -- src/components/metrics/MetricCard.test.tsx`
Expected: All tests pass

**Step 3: Commit the implementation**

```bash
git add src/components/metrics/MetricCard.tsx
git commit -m "feat: display source activity name on MetricCard"
```

---

## Task 9: Add Convex query to fetch stage by ID

**Files:**
- Create: `convex/stages.ts` (if not exists, otherwise modify)

**Step 1: Check if stages query file exists and add get query**

First check if file exists. If not, create it:

```typescript
import { v } from "convex/values";
import { query } from "./_generated/server";

export const get = query({
  args: { id: v.id("stages") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});
```

If file exists, add the `get` query to it.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/stages.ts
git commit -m "feat: add stages.get query for fetching stage by ID"
```

---

## Task 10: Update MetricCatalogPage to pass source activity name to MetricCard

**Files:**
- Modify: `src/routes/MetricCatalogPage.tsx`

**Step 1: Create a lookup for stage names**

Add after existing queries (around line 17):

```typescript
// Fetch stages for looking up activity names
const stages = useQuery(api.stages.list, {});

// Create a lookup map for stage names
const stageNameById = useMemo(() => {
  if (!stages) return new Map<string, string>();
  return new Map(stages.map((s) => [s._id, s.name]));
}, [stages]);
```

Add the import for useMemo:

```typescript
import { useState, useMemo } from "react";
```

**Step 2: Update MetricCard usage to pass sourceActivityName**

Update the MetricCard in the grid (around line 119):

```typescript
<MetricCard
  key={metric._id}
  name={metric.name}
  definition={metric.definition}
  category={metric.category as MetricCategory}
  sourceActivityName={
    metric.relatedActivityId
      ? stageNameById.get(metric.relatedActivityId)
      : undefined
  }
  selected={metric._id === selectedMetricId}
  onClick={() => setSelectedMetricId(metric._id)}
/>
```

**Step 3: Run the app to verify**

Run: `npm run dev`
Expected: MetricCards display source activity name for engagement metrics

**Step 4: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx
git commit -m "feat: display source activity name on metric cards in catalog page"
```

---

## Task 11: Add test for MetricCatalogPage integration

**Files:**
- Modify: `src/routes/MetricCatalogPage.test.tsx`

**Step 1: Add test for source activity display**

```typescript
it("displays source activity name for metrics with relatedActivityId", async () => {
  // Setup mock data with metric that has relatedActivityId
  // This depends on the existing test setup pattern in the file
  // Add appropriate test based on existing patterns
});
```

**Step 2: Run tests**

Run: `npm test -- src/routes/MetricCatalogPage.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/routes/MetricCatalogPage.test.tsx
git commit -m "test: verify metric catalog page displays source activity names"
```

---

## Task 12: Update MetricCatalogSection profile component

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.tsx`

**Step 1: Add stage name lookup similar to MetricCatalogPage**

Follow the same pattern as Task 10 to add sourceActivityName to MetricCard usage in this component.

**Step 2: Run tests**

Run: `npm test -- src/components/profile/MetricCatalogSection.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.tsx
git commit -m "feat: display source activity name in profile metric catalog section"
```

---

## Task 13: Remove fallback strings from metricTemplates interpolation

**Files:**
- Modify: `src/shared/metricTemplates.ts:178-205`

**Step 1: Update interpolateTemplate to not use fallbacks**

The fallback strings "core action" and "first value action" should be removed since we now skip metrics that don't have a valid source:

```typescript
export function interpolateTemplate(
  template: MetricTemplate,
  slots: TemplateSlots
): InterpolatedTemplate {
  const replacements: Record<string, string> = {
    "{{productName}}": slots.productName,
    "{{coreAction}}": slots.coreAction ?? "", // Empty if not provided - metrics should be skipped upstream
    "{{firstValueActivity}}": slots.firstValueActivity ?? "", // Empty if not provided - should error upstream
  };

  const interpolate = (text: string): string => {
    let result = text;
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replaceAll(placeholder, value);
    }
    return result;
  };

  return {
    key: template.key,
    name: interpolate(template.name),
    definition: interpolate(template.definition),
    formula: interpolate(template.formula),
    whyItMatters: interpolate(template.whyItMatters),
    howToImprove: interpolate(template.howToImprove),
    category: template.category,
  };
}
```

**Step 2: Run tests**

Run: `npm test`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/shared/metricTemplates.ts
git commit -m "refactor: remove fallback strings from template interpolation"
```

---

## Task 14: Final verification and cleanup

**Files:**
- All modified files

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

**Step 3: Run linter**

Run: `npm run lint`
Expected: PASS or fix any lint errors

**Step 4: Manual testing checklist**

1. Start fresh dev environment: `npx convex dev` and `npm run dev`
2. Create new user account
3. Complete Overview Interview WITHOUT defining core_usage stage
4. Verify only "New Users" metric is generated (1 metric, not 6)
5. Go back and edit journey to add core_usage stage
6. Regenerate metrics
7. Verify all 6 overview metrics are now generated
8. Verify engagement metrics show "Based on: [Stage Name]"
9. Complete First Value Interview
10. Verify first value metrics show "Based on: [Activation Stage Name]"

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove fallback metrics - all metrics now require source activities

- Engagement metrics (MAU, DAU, retention) only generate when core_usage stage exists
- Reach metrics (New Users) generate unconditionally
- First value metrics continue to require activation stage (unchanged)
- MetricCard now displays source activity name
- Removed fallback strings from template interpolation

Closes #53"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Test: expect skip behavior without core_usage | `convex/metricCatalog.test.ts` |
| 2 | Test: reach metrics always generate | `convex/metricCatalog.test.ts` |
| 3 | Test: engagement metrics link to core_usage | `convex/metricCatalog.test.ts` |
| 4 | Add category-based template helpers | `src/shared/metricTemplates.ts` |
| 5 | Skip engagement metrics without core_usage | `convex/metricCatalog.ts` |
| 6 | Update existing tests | `convex/metricCatalog.test.ts` |
| 7 | Test: MetricCard source activity display | `src/components/metrics/MetricCard.test.tsx` |
| 8 | Add source activity to MetricCard | `src/components/metrics/MetricCard.tsx` |
| 9 | Add stages.get query | `convex/stages.ts` |
| 10 | MetricCatalogPage shows source activity | `src/routes/MetricCatalogPage.tsx` |
| 11 | Test: MetricCatalogPage integration | `src/routes/MetricCatalogPage.test.tsx` |
| 12 | MetricCatalogSection shows source activity | `src/components/profile/MetricCatalogSection.tsx` |
| 13 | Remove fallback strings | `src/shared/metricTemplates.ts` |
| 14 | Final verification | All files |

**Total tasks:** 14 TDD tasks

**Key behavior changes:**
- Without `core_usage` stage: Only 1 metric (New Users) instead of 6
- With `core_usage` stage: All 6 metrics with proper linking
- First value metrics: No change (already requires activation stage)
- UI: Shows "Based on: [Activity Name]" for metrics with sources
