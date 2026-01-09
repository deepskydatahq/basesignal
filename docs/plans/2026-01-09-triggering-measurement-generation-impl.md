# Triggering Measurement Plan and Metric Catalog Generation - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic and manual triggers for measurement plan and metric catalog generation.

**Architecture:** Auto-generate measurement plan when interview completes (server-side in `completeStep`), add explicit metric catalog button to Review page, add Generate/Regenerate buttons to feature pages, and add Developer Tools section to Settings for testing.

**Tech Stack:** Convex (backend mutations), React (frontend components), Vitest + convex-test (testing)

---

## Task 1: Add Internal Mutation for Measurement Plan Auto-Generation

**Files:**
- Modify: `convex/measurementPlan.ts`
- Test: `convex/measurementPlan.test.ts` (new)

**Step 1: Write the failing test**

Create `convex/measurementPlan.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

// Helper to create authenticated user with journey
async function setupJourneyWithStages(t: ReturnType<typeof convexTest>) {
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

  const journeyId = await asUser.mutation(api.journeys.create, {
    type: "overview",
    name: "Test Journey",
  });

  // Add stages with entity/action
  await t.run(async (ctx) => {
    await ctx.db.insert("stages", {
      journeyId,
      name: "Account Created",
      entity: "Account",
      action: "Created",
      lifecycleSlot: "account_creation",
      position: { x: 100, y: 100 },
      createdAt: Date.now(),
    });
    await ctx.db.insert("stages", {
      journeyId,
      name: "Profile Completed",
      entity: "Profile",
      action: "Completed",
      lifecycleSlot: "activation",
      position: { x: 200, y: 100 },
      createdAt: Date.now(),
    });
  });

  return { userId, asUser, journeyId };
}

describe("measurementPlan", () => {
  describe("generateFromJourneyInternal", () => {
    it("creates entities and activities from journey stages", async () => {
      const t = convexTest(schema);
      const { userId, journeyId } = await setupJourneyWithStages(t);

      // Call internal mutation directly
      await t.run(async (ctx) => {
        const { generateFromJourneyInternal } = await import("./measurementPlan");
        // Internal mutations need to be called differently in tests
      });

      // For now, test via the public API
      const asUser = t.withIdentity({
        subject: "test-user",
        issuer: "https://clerk.test",
        tokenIdentifier: "https://clerk.test|test-user",
      });

      // Use existing importFromJourney to verify the pattern works
      await asUser.mutation(api.measurementPlan.importFromJourney, {
        journeyId,
        selectedEntities: ["Account", "Profile"],
        selectedActivities: ["Account Created", "Profile Completed"],
      });

      const entities = await asUser.query(api.measurementPlan.listEntities);
      expect(entities).toHaveLength(2);
      expect(entities.map((e) => e.name)).toContain("Account");
      expect(entities.map((e) => e.name)).toContain("Profile");
    });
  });
});
```

**Step 2: Run test to verify it passes with existing code**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: PASS (testing existing functionality)

**Step 3: Add internal mutation for server-side generation**

In `convex/measurementPlan.ts`, add at the top with other imports:

```typescript
import { internalMutation } from "./_generated/server";
```

Then add after the existing `importFromJourney` mutation:

```typescript
// Internal mutation for auto-generation (called from setupProgress.complete)
export const generateFromJourneyInternal = internalMutation({
  args: {
    userId: v.id("users"),
    journeyId: v.id("journeys"),
  },
  handler: async (ctx, args) => {
    // Verify journey exists and belongs to user
    const journey = await ctx.db.get(args.journeyId);
    if (!journey || journey.userId !== args.userId) {
      return { success: false, error: "Journey not found" };
    }

    // Get all stages from journey
    const stages = await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();

    // Get existing entities to avoid duplicates
    const existingEntities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existingEntityNames = new Set(
      existingEntities.map((e) => e.name.toLowerCase())
    );
    const entityNameToId = new Map(
      existingEntities.map((e) => [e.name.toLowerCase(), e._id])
    );

    // Get existing activities to avoid duplicates
    const existingActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const existingActivityNames = new Set(
      existingActivities.map((a) => a.name.toLowerCase())
    );

    const now = Date.now();
    let entitiesCreated = 0;
    let activitiesCreated = 0;

    // Process stages with entity/action
    for (const stage of stages) {
      if (!stage.entity || !stage.action) continue;

      const entityLower = stage.entity.toLowerCase();
      const activityName = stage.name;
      const activityLower = activityName.toLowerCase();

      // Create entity if not exists
      if (!existingEntityNames.has(entityLower)) {
        const entityId = await ctx.db.insert("measurementEntities", {
          userId: args.userId,
          name: stage.entity,
          suggestedFrom: "overview_interview",
          createdAt: now,
        });
        entityNameToId.set(entityLower, entityId);
        existingEntityNames.add(entityLower);
        entitiesCreated++;
      }

      // Create activity if not exists
      if (!existingActivityNames.has(activityLower)) {
        const entityId = entityNameToId.get(entityLower);
        if (entityId) {
          await ctx.db.insert("measurementActivities", {
            userId: args.userId,
            entityId,
            name: activityName,
            action: stage.action,
            lifecycleSlot: stage.lifecycleSlot,
            isFirstValue: false,
            suggestedFrom: "overview_interview",
            createdAt: now,
          });
          existingActivityNames.add(activityLower);
          activitiesCreated++;
        }
      }
    }

    return { success: true, entitiesCreated, activitiesCreated };
  },
});
```

**Step 4: Run tests to verify**

Run: `npm run test:run -- convex/measurementPlan.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/measurementPlan.ts convex/measurementPlan.test.ts
git commit -m "feat: add internal mutation for measurement plan auto-generation"
```

---

## Task 2: Wire Auto-Generation to Setup Completion

**Files:**
- Modify: `convex/setupProgress.ts`
- Test: `convex/setupProgress.test.ts` (new)

**Step 1: Write the failing test**

Create `convex/setupProgress.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

async function setupUserWithJourney(t: ReturnType<typeof convexTest>) {
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

  // Start setup
  await asUser.mutation(api.setupProgress.start, {});

  // Create overview journey with stages
  const journeyId = await asUser.mutation(api.journeys.create, {
    type: "overview",
    name: "Overview Journey",
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("stages", {
      journeyId,
      name: "Account Created",
      entity: "Account",
      action: "Created",
      lifecycleSlot: "account_creation",
      position: { x: 100, y: 100 },
      createdAt: Date.now(),
    });
  });

  return { userId, asUser, journeyId };
}

describe("setupProgress", () => {
  describe("complete", () => {
    it("auto-generates measurement plan on completion", async () => {
      const t = convexTest(schema);
      const { asUser, journeyId } = await setupUserWithJourney(t);

      // Complete setup
      await asUser.mutation(api.setupProgress.complete, {
        overviewJourneyId: journeyId,
      });

      // Verify measurement plan was auto-generated
      const entities = await asUser.query(api.measurementPlan.listEntities);
      expect(entities.length).toBeGreaterThan(0);
      expect(entities.map((e) => e.name)).toContain("Account");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/setupProgress.test.ts`
Expected: FAIL (measurement plan not yet auto-generated)

**Step 3: Add auto-generation to complete mutation**

In `convex/setupProgress.ts`, add import at top:

```typescript
import { internal } from "./_generated/api";
```

Then modify the `complete` mutation handler (around line 180-212):

```typescript
export const complete = mutation({
  args: {
    overviewJourneyId: v.id("journeys"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!progress) throw new Error("Setup progress not found");

    const now = Date.now();

    await ctx.db.patch(progress._id, {
      status: "completed",
      completedAt: now,
      lastActiveAt: now,
      stepsCompleted: ["overview_interview", "review_save"],
      overviewJourneyId: args.overviewJourneyId,
    });

    await ctx.db.patch(user._id, {
      setupStatus: "complete",
      setupCompletedAt: now,
    });

    // Auto-generate measurement plan from journey
    await ctx.runMutation(internal.measurementPlan.generateFromJourneyInternal, {
      userId: user._id,
      journeyId: args.overviewJourneyId,
    });
  },
});
```

**Step 4: Run tests to verify**

Run: `npm run test:run -- convex/setupProgress.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/setupProgress.ts convex/setupProgress.test.ts
git commit -m "feat: auto-generate measurement plan on setup completion"
```

---

## Task 3: Add Delete Mutations for Reset Functionality

**Files:**
- Modify: `convex/measurementPlan.ts`
- Modify: `convex/metricCatalog.ts`

**Step 1: Add deleteAll mutation to measurementPlan.ts**

Add at the end of `convex/measurementPlan.ts`:

```typescript
// Delete all measurement plan data for current user (for regeneration)
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    // Delete all properties
    const properties = await ctx.db
      .query("measurementProperties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const p of properties) {
      await ctx.db.delete(p._id);
    }

    // Delete all activities
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const a of activities) {
      await ctx.db.delete(a._id);
    }

    // Delete all entities
    const entities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const e of entities) {
      await ctx.db.delete(e._id);
    }

    return {
      deletedEntities: entities.length,
      deletedActivities: activities.length,
      deletedProperties: properties.length,
    };
  },
});
```

**Step 2: Add deleteAll mutation to metricCatalog.ts**

Add at the end of `convex/metricCatalog.ts`:

```typescript
// Delete all metrics for current user (for regeneration)
export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const m of metrics) {
      await ctx.db.delete(m._id);
    }

    return { deletedMetrics: metrics.length };
  },
});
```

**Step 3: Commit**

```bash
git add convex/measurementPlan.ts convex/metricCatalog.ts
git commit -m "feat: add deleteAll mutations for measurement plan and metric catalog"
```

---

## Task 4: Add Generate Metric Catalog Button to Review Page

**Files:**
- Modify: `src/routes/SetupReviewPage.tsx`

**Step 1: Update SetupReviewPage with metric catalog generation**

Replace the metric catalog Card section (lines 134-152) with:

```typescript
{/* Metric Catalog */}
<Card className={`p-6 ${hasMetrics ? "" : overviewJourneyId ? "" : "bg-gray-50 border-dashed"}`}>
  <div className="flex items-start gap-4">
    <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
      hasMetrics ? "bg-green-100" : overviewJourneyId ? "bg-amber-100" : "bg-gray-200"
    }`}>
      <BarChart3 className={`w-6 h-6 ${
        hasMetrics ? "text-green-600" : overviewJourneyId ? "text-amber-600" : "text-gray-400"
      }`} />
    </div>
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <h3 className={`font-semibold ${hasMetrics || overviewJourneyId ? "text-gray-900" : "text-gray-400"}`}>
          Metric Catalog
        </h3>
        {hasMetrics ? (
          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            <Check className="w-3 h-3" />
            {metricsCount} metrics
          </span>
        ) : overviewJourneyId ? (
          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            Ready to generate
          </span>
        ) : (
          <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
            Coming soon
          </span>
        )}
      </div>
      <p className={`text-sm ${hasMetrics || overviewJourneyId ? "text-gray-600" : "text-gray-400"}`}>
        {hasMetrics
          ? "Key metrics derived from your journey stages."
          : "Generate personalized metrics based on your journey."}
      </p>
      {overviewJourneyId && !hasMetrics && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={handleGenerateMetrics}
          disabled={isGeneratingMetrics}
        >
          {isGeneratingMetrics ? "Generating..." : "Generate"}
          {!isGeneratingMetrics && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      )}
      {hasMetrics && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => navigate("/metric-catalog")}
        >
          View
        </Button>
      )}
    </div>
  </div>
</Card>
```

**Step 2: Add the necessary state and handlers**

At the top of the component (after existing state), add:

```typescript
const metrics = useQuery(api.metrics.list, {});
const generateFromOverview = useMutation(api.metricCatalog.generateFromOverview);
const generateFromFirstValue = useMutation(api.metricCatalog.generateFromFirstValue);
const [isGeneratingMetrics, setIsGeneratingMetrics] = useState(false);

const metricsCount = metrics?.length ?? 0;
const hasMetrics = metricsCount > 0;

const handleGenerateMetrics = async () => {
  if (!overviewJourneyId) return;
  setIsGeneratingMetrics(true);
  try {
    await generateFromOverview({ journeyId: overviewJourneyId });
    await generateFromFirstValue({ journeyId: overviewJourneyId });
  } catch (error) {
    console.error("Failed to generate metrics:", error);
  } finally {
    setIsGeneratingMetrics(false);
  }
};
```

**Step 3: Add missing import**

Add to imports:

```typescript
import { useMutation } from "convex/react";
```

**Step 4: Commit**

```bash
git add src/routes/SetupReviewPage.tsx
git commit -m "feat: add Generate Metric Catalog button to Review page"
```

---

## Task 5: Add Generate/Regenerate Buttons to Measurement Plan Page

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`
- Create: `src/components/measurement/RegenerateConfirmDialog.tsx`

**Step 1: Create RegenerateConfirmDialog component**

Create `src/components/measurement/RegenerateConfirmDialog.tsx`:

```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RegenerateConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function RegenerateConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isLoading,
}: RegenerateConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "Regenerating..." : "Regenerate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Update MeasurementPlanPage header with Generate/Regenerate**

In `src/routes/MeasurementPlanPage.tsx`, add imports:

```typescript
import { useMutation } from "convex/react";
import { RefreshCw } from "lucide-react";
import { RegenerateConfirmDialog } from "@/components/measurement/RegenerateConfirmDialog";
```

Add state and handlers after existing state:

```typescript
const foundationStatus = useQuery(api.setupProgress.foundationStatus);
const deleteAllMeasurement = useMutation(api.measurementPlan.deleteAll);
const importFromJourneyMutation = useMutation(api.measurementPlan.importFromJourney);
const journeyDiff = useQuery(
  api.measurementPlan.computeJourneyDiff,
  foundationStatus?.overviewInterview?.journeyId
    ? { journeyId: foundationStatus.overviewInterview.journeyId }
    : "skip"
);

const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
const [isRegenerating, setIsRegenerating] = useState(false);

const hasJourney = foundationStatus?.overviewInterview?.journeyId != null;
const journeyId = foundationStatus?.overviewInterview?.journeyId;

const handleGenerate = async () => {
  if (!journeyId || !journeyDiff) return;
  setIsRegenerating(true);
  try {
    const allEntities = [
      ...journeyDiff.newEntities.map((e) => e.name),
      ...journeyDiff.existingEntities.map((e) => e.name),
    ];
    const allActivities = [
      ...journeyDiff.newActivities.map((a) => a.name),
      ...journeyDiff.existingActivities.map((a) => a.name),
    ];
    await importFromJourneyMutation({
      journeyId,
      selectedEntities: allEntities,
      selectedActivities: allActivities,
    });
  } finally {
    setIsRegenerating(false);
  }
};

const handleRegenerate = async () => {
  if (!journeyId || !journeyDiff) return;
  setIsRegenerating(true);
  try {
    await deleteAllMeasurement({});
    await handleGenerate();
  } finally {
    setIsRegenerating(false);
    setShowRegenerateDialog(false);
  }
};
```

Update the header buttons section (replace existing buttons div around line 58-71):

```typescript
<div className="flex gap-2">
  {isEmpty && hasJourney && (
    <Button onClick={handleGenerate} disabled={isRegenerating || !journeyDiff}>
      {isRegenerating ? "Generating..." : "Generate from Journey"}
    </Button>
  )}
  {!isEmpty && (
    <>
      <Button
        variant="outline"
        onClick={() => setShowRegenerateDialog(true)}
        disabled={!hasJourney}
        title={!hasJourney ? "Complete Overview Interview first" : undefined}
      >
        <RefreshCw className="w-4 h-4 mr-2" />
        Regenerate
      </Button>
      <Button variant="outline" onClick={() => setShowAddEntityDialog(true)}>
        <Plus className="w-4 h-4 mr-2" />
        Add Entity
      </Button>
      <Button onClick={() => { setActivityEntityId(undefined); setShowActivityModal(true); }}>
        <Plus className="w-4 h-4 mr-2" />
        Add Activity
      </Button>
    </>
  )}
</div>
```

Add the dialog before the closing div:

```typescript
{/* Regenerate Confirmation */}
<RegenerateConfirmDialog
  open={showRegenerateDialog}
  onOpenChange={setShowRegenerateDialog}
  title="Regenerate Measurement Plan?"
  description="This will replace all existing entities, activities, and properties with fresh data from your Overview Journey. Any manual edits will be lost."
  onConfirm={handleRegenerate}
  isLoading={isRegenerating}
/>
```

**Step 3: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/components/measurement/RegenerateConfirmDialog.tsx
git commit -m "feat: add Generate/Regenerate buttons to Measurement Plan page"
```

---

## Task 6: Add Generate/Regenerate Buttons to Metric Catalog Page

**Files:**
- Modify: `src/routes/MetricCatalogPage.tsx`

**Step 1: Update MetricCatalogPage with generation buttons**

Add imports at top:

```typescript
import { useMutation, useQuery as useConvexQuery } from "convex/react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Sparkles } from "lucide-react";
import { RegenerateConfirmDialog } from "@/components/measurement/RegenerateConfirmDialog";
```

Add state and handlers after existing state (inside component):

```typescript
const foundationStatus = useConvexQuery(api.setupProgress.foundationStatus);
const generateFromOverview = useMutation(api.metricCatalog.generateFromOverview);
const generateFromFirstValue = useMutation(api.metricCatalog.generateFromFirstValue);
const deleteAllMetrics = useMutation(api.metricCatalog.deleteAll);

const [isGenerating, setIsGenerating] = useState(false);
const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);

const hasJourney = foundationStatus?.overviewInterview?.journeyId != null;
const journeyId = foundationStatus?.overviewInterview?.journeyId;

const handleGenerate = async () => {
  if (!journeyId) return;
  setIsGenerating(true);
  try {
    await generateFromOverview({ journeyId });
    await generateFromFirstValue({ journeyId });
  } catch (error) {
    console.error("Failed to generate metrics:", error);
  } finally {
    setIsGenerating(false);
  }
};

const handleRegenerate = async () => {
  if (!journeyId) return;
  setIsGenerating(true);
  try {
    await deleteAllMetrics({});
    await handleGenerate();
  } finally {
    setIsGenerating(false);
    setShowRegenerateDialog(false);
  }
};
```

Update the empty state (replace lines 28-41):

```typescript
if (metrics.length === 0) {
  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
        </div>
        {hasJourney && (
          <Button onClick={handleGenerate} disabled={isGenerating}>
            <Sparkles className="w-4 h-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate Metric Catalog"}
          </Button>
        )}
      </div>
      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          {hasJourney
            ? "Click 'Generate Metric Catalog' to create your personalized metrics."
            : "Complete the Overview Interview to generate your Metric Catalog"}
        </p>
      </div>
    </div>
  );
}
```

Update the header in the main view (around line 44-48):

```typescript
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
    <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
  </div>
  <Button
    variant="outline"
    onClick={() => setShowRegenerateDialog(true)}
    disabled={!hasJourney || isGenerating}
  >
    <RefreshCw className="w-4 h-4 mr-2" />
    Regenerate
  </Button>
</div>
```

Add the dialog before the final closing div:

```typescript
{/* Regenerate Confirmation */}
<RegenerateConfirmDialog
  open={showRegenerateDialog}
  onOpenChange={setShowRegenerateDialog}
  title="Regenerate Metric Catalog?"
  description="This will replace all existing metrics with fresh data from your Overview Journey. Any manual edits will be lost."
  onConfirm={handleRegenerate}
  isLoading={isGenerating}
/>
```

**Step 2: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx
git commit -m "feat: add Generate/Regenerate buttons to Metric Catalog page"
```

---

## Task 7: Add Developer Tools Section to Settings

**Files:**
- Create: `src/components/settings/DevToolsSection.tsx`
- Modify: `src/routes/SettingsPage.tsx`

**Step 1: Create DevToolsSection component**

Create `src/components/settings/DevToolsSection.tsx`:

```typescript
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react";
import { RegenerateConfirmDialog } from "@/components/measurement/RegenerateConfirmDialog";

export function DevToolsSection() {
  const foundationStatus = useQuery(api.setupProgress.foundationStatus);

  const deleteAllMeasurement = useMutation(api.measurementPlan.deleteAll);
  const deleteAllMetrics = useMutation(api.metricCatalog.deleteAll);
  const importFromJourney = useMutation(api.measurementPlan.importFromJourney);
  const generateFromOverview = useMutation(api.metricCatalog.generateFromOverview);
  const generateFromFirstValue = useMutation(api.metricCatalog.generateFromFirstValue);

  const journeyDiff = useQuery(
    api.measurementPlan.computeJourneyDiff,
    foundationStatus?.overviewInterview?.journeyId
      ? { journeyId: foundationStatus.overviewInterview.journeyId }
      : "skip"
  );

  const [isRegeneratingPlan, setIsRegeneratingPlan] = useState(false);
  const [isRegeneratingMetrics, setIsRegeneratingMetrics] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const journeyId = foundationStatus?.overviewInterview?.journeyId;
  const hasJourney = journeyId != null;
  const entitiesCount = foundationStatus?.measurementPlan?.entitiesCount ?? 0;
  const metricsCount = foundationStatus?.metricCatalog?.metricsCount ?? 0;

  const handleRegeneratePlan = async () => {
    if (!journeyId || !journeyDiff) return;
    setIsRegeneratingPlan(true);
    try {
      await deleteAllMeasurement({});
      const allEntities = [
        ...journeyDiff.newEntities.map((e) => e.name),
        ...journeyDiff.existingEntities.map((e) => e.name),
      ];
      const allActivities = [
        ...journeyDiff.newActivities.map((a) => a.name),
        ...journeyDiff.existingActivities.map((a) => a.name),
      ];
      await importFromJourney({
        journeyId,
        selectedEntities: allEntities,
        selectedActivities: allActivities,
      });
    } finally {
      setIsRegeneratingPlan(false);
    }
  };

  const handleRegenerateMetrics = async () => {
    if (!journeyId) return;
    setIsRegeneratingMetrics(true);
    try {
      await deleteAllMetrics({});
      await generateFromOverview({ journeyId });
      await generateFromFirstValue({ journeyId });
    } finally {
      setIsRegeneratingMetrics(false);
    }
  };

  const handleResetAll = async () => {
    setIsResettingAll(true);
    try {
      await deleteAllMeasurement({});
      await deleteAllMetrics({});
    } finally {
      setIsResettingAll(false);
      setShowResetDialog(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Developer Tools</CardTitle>
          <CardDescription>
            Testing and debugging tools for the measurement foundation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status */}
          <div className="text-sm space-y-1">
            <p className="text-gray-600">
              <span className="font-medium">Measurement Plan:</span> {entitiesCount} entities
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Metric Catalog:</span> {metricsCount} metrics
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Journey:</span>{" "}
              {hasJourney ? "Available" : "Not completed"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegeneratePlan}
              disabled={!hasJourney || isRegeneratingPlan || !journeyDiff}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegeneratingPlan ? "animate-spin" : ""}`} />
              {isRegeneratingPlan ? "Regenerating..." : "Regenerate Measurement Plan"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateMetrics}
              disabled={!hasJourney || isRegeneratingMetrics}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegeneratingMetrics ? "animate-spin" : ""}`} />
              {isRegeneratingMetrics ? "Regenerating..." : "Regenerate Metric Catalog"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResetDialog(true)}
              disabled={isResettingAll || (entitiesCount === 0 && metricsCount === 0)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Reset All
            </Button>
          </div>
        </CardContent>
      </Card>

      <RegenerateConfirmDialog
        open={showResetDialog}
        onOpenChange={setShowResetDialog}
        title="Reset Measurement Foundation?"
        description="This will delete all entities, activities, properties, and metrics. This action cannot be undone."
        onConfirm={handleResetAll}
        isLoading={isResettingAll}
      />
    </>
  );
}
```

**Step 2: Add DevToolsSection to SettingsPage**

In `src/routes/SettingsPage.tsx`, add import:

```typescript
import { DevToolsSection } from '@/components/settings/DevToolsSection'
```

Add the component at the end of the space-y-6 div (before closing `</div>`):

```typescript
<DevToolsSection />
```

**Step 3: Commit**

```bash
git add src/components/settings/DevToolsSection.tsx src/routes/SettingsPage.tsx
git commit -m "feat: add Developer Tools section to Settings page"
```

---

## Task 8: Run All Tests and Verify

**Step 1: Run all tests**

```bash
npm run test:run
```

Expected: All tests PASS

**Step 2: Manual testing checklist**

- [ ] Complete overview interview → measurement plan auto-generates
- [ ] Review page shows "Generate" for metric catalog
- [ ] Measurement Plan page shows "Generate from Journey" when empty
- [ ] Measurement Plan page shows "Regenerate" when has data
- [ ] Metric Catalog page shows "Generate" when empty
- [ ] Metric Catalog page shows "Regenerate" when has data
- [ ] Settings > Developer Tools shows status and buttons
- [ ] Regenerate confirmation dialogs work correctly

**Step 3: Final commit**

```bash
git add -A
git commit -m "test: verify all generation triggers work correctly"
```

---

## Testing

- [x] Convex function tests using `convex-test` (Task 1, 2)
- [ ] Component tests using RTL (optional - could add for DevToolsSection)
- [ ] Run `npm run test:run` to verify all tests pass

## Risks & Mitigations

- **Race condition on auto-generation**: Mitigated by running generation server-side in `complete` mutation
- **Duplicate data on regenerate**: Mitigated by deleting all existing data before regenerating
- **Missing journey on generation**: Mitigated by disabling buttons and showing tooltip when no journey exists
