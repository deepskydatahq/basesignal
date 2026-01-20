# First Value Status Display Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display visual indicators when First Value has been defined - a checkmark badge in the journey list and a "First Value" badge on the marked activity in the Measurement Plan.

**Architecture:** The measurement plan is user-scoped (not journey-scoped). Activities have an `isFirstValue: boolean` field. We add a query to check if ANY activity has this flag set, display checkmarks on `first_value` type journeys, and add a mutation to mark/unmark activities as First Value with single-selection enforcement.

**Tech Stack:** Convex (queries/mutations), React (components), Tailwind CSS (styling), Lucide React (icons)

---

## Task 1: Add `hasFirstValue` Query to Journeys

**Files:**
- Modify: `convex/journeys.ts` (add new query after line 34)
- Test: `convex/journeys.test.ts`

**Step 1: Write the failing test**

Add to `convex/journeys.test.ts`:

```typescript
describe("listWithFirstValueStatus", () => {
  it("returns hasFirstValue: false when no activities are marked", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "fv-status-user",
        email: "fv@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "fv-status-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|fv-status-user",
    });

    await asUser.mutation(api.journeys.create, {
      type: "first_value",
      name: "My First Value Journey",
    });

    const journeys = await asUser.query(api.journeys.listWithFirstValueStatus, {});

    expect(journeys).toHaveLength(1);
    expect(journeys[0].hasFirstValue).toBe(false);
  });

  it("returns hasFirstValue: true when an activity is marked", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "fv-marked-user",
        email: "fv-marked@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "fv-marked-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|fv-marked-user",
    });

    await asUser.mutation(api.journeys.create, {
      type: "first_value",
      name: "My First Value Journey",
    });

    // Create entity and activity with isFirstValue: true
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      return await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Account Activated",
        action: "Activated",
        isFirstValue: true,
        createdAt: Date.now(),
      });
    });

    const journeys = await asUser.query(api.journeys.listWithFirstValueStatus, {});

    expect(journeys).toHaveLength(1);
    expect(journeys[0].hasFirstValue).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/journeys.test.ts`
Expected: FAIL with "api.journeys.listWithFirstValueStatus is not a function" or similar

**Step 3: Write minimal implementation**

Add to `convex/journeys.ts` after `listByUser`:

```typescript
// Get all journeys for current user with First Value status
export const listWithFirstValueStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Check if any activity has isFirstValue: true
    const firstValueActivity = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isFirstValue"), true))
      .first();

    const hasFirstValue = !!firstValueActivity;

    return journeys.map((journey) => ({
      ...journey,
      hasFirstValue,
    }));
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/journeys.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/journeys.ts convex/journeys.test.ts
git commit -m "feat: add listWithFirstValueStatus query to journeys

Adds a query that returns journeys with hasFirstValue boolean
indicating whether any measurement activity is marked as First Value.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add `setFirstValue` Mutation

**Files:**
- Modify: `convex/measurementPlan.ts` (add mutation after `updateActivity`)
- Test: `convex/measurementPlan.test.ts`

**Step 1: Write the failing test**

Add to `convex/measurementPlan.test.ts`:

```typescript
describe("setFirstValue", () => {
  it("marks an activity as First Value", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "set-fv-user",
        email: "set-fv@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "set-fv-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|set-fv-user",
    });

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activityId = await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Activated",
      action: "Activated",
      isFirstValue: false,
    });

    await asUser.mutation(api.measurementPlan.setFirstValue, {
      activityId,
    });

    const activity = await asUser.query(api.measurementPlan.getActivity, {
      id: activityId,
    });

    expect(activity?.isFirstValue).toBe(true);
  });

  it("clears previous First Value when setting new one", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "clear-fv-user",
        email: "clear-fv@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "clear-fv-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|clear-fv-user",
    });

    const entityId = await asUser.mutation(api.measurementPlan.createEntity, {
      name: "Account",
    });

    const activity1Id = await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Created",
      action: "Created",
      isFirstValue: true,
    });

    const activity2Id = await asUser.mutation(api.measurementPlan.createActivity, {
      entityId,
      name: "Account Activated",
      action: "Activated",
      isFirstValue: false,
    });

    // Set activity2 as First Value
    await asUser.mutation(api.measurementPlan.setFirstValue, {
      activityId: activity2Id,
    });

    const activity1 = await asUser.query(api.measurementPlan.getActivity, {
      id: activity1Id,
    });
    const activity2 = await asUser.query(api.measurementPlan.getActivity, {
      id: activity2Id,
    });

    expect(activity1?.isFirstValue).toBe(false);
    expect(activity2?.isFirstValue).toBe(true);
  });

  it("throws error for unauthenticated user", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.measurementPlan.setFirstValue, {
        activityId: "j57dz1234567890123456789" as Id<"measurementActivities">,
      })
    ).rejects.toThrow("Not authenticated");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/measurementPlan.test.ts -t "setFirstValue"`
Expected: FAIL with "api.measurementPlan.setFirstValue is not a function"

**Step 3: Write minimal implementation**

Add to `convex/measurementPlan.ts` after `updateActivity`:

```typescript
export const setFirstValue = mutation({
  args: {
    activityId: v.id("measurementActivities"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const activity = await ctx.db.get(args.activityId);
    if (!activity) throw new Error("Activity not found");
    if (activity.userId !== user._id) throw new Error("Not authorized");

    // Clear isFirstValue from all user's activities
    const allActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    for (const act of allActivities) {
      if (act.isFirstValue && act._id !== args.activityId) {
        await ctx.db.patch(act._id, { isFirstValue: false });
      }
    }

    // Set this activity as First Value
    await ctx.db.patch(args.activityId, { isFirstValue: true });
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/measurementPlan.test.ts -t "setFirstValue"`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/measurementPlan.ts convex/measurementPlan.test.ts
git commit -m "feat: add setFirstValue mutation

Adds mutation to mark an activity as First Value, clearing the flag
from any previously marked activity (only one First Value allowed).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Checkmark Badge to Journey List

**Files:**
- Modify: `src/routes/JourneysListPage.tsx`

**Step 1: Update imports**

Add `CheckCircle2` to the lucide-react import:

```typescript
import { Star, Plus, CheckCircle2 } from "lucide-react";
```

**Step 2: Update query to use `listWithFirstValueStatus`**

Change line 32:

```typescript
const journeys = useQuery(api.journeys.listWithFirstValueStatus);
```

**Step 3: Update JourneyRow type and add checkmark**

Update the type in `JourneyRow` props (around line 177):

```typescript
function JourneyRow({
  journey,
  onSetDefault,
}: {
  journey: {
    _id: Id<"journeys">;
    name: string;
    isDefault?: boolean;
    updatedAt: number;
    hasFirstValue: boolean;
  };
  onSetDefault: () => void;
}) {
```

Add checkmark after the journey name (around line 201):

```typescript
<span className="text-sm font-medium text-gray-900">{journey.name}</span>
{journey.hasFirstValue && (
  <CheckCircle2
    className="w-4 h-4 text-green-500"
    title="First Value defined"
  />
)}
```

**Step 4: Update JourneyTypeSection type**

Update the journeys type in `JourneyTypeSection` props (around line 90):

```typescript
journeys: Array<{
  _id: Id<"journeys">;
  name: string;
  isDefault?: boolean;
  updatedAt: number;
  hasFirstValue: boolean;
}>;
```

**Step 5: Run dev server and verify**

Run: `npm run dev`
Verify: Journey list shows green checkmark next to journeys when First Value is defined

**Step 6: Commit**

```bash
git add src/routes/JourneysListPage.tsx
git commit -m "feat: add First Value checkmark to journey list

Shows green checkmark icon next to journey name when First Value
is defined. Uses listWithFirstValueStatus query.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add "Mark as First Value" Menu to Activity Row

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`

**Step 1: Add imports**

Update imports at top of file:

```typescript
import { FileText, Download, Plus, RefreshCw, Target } from "lucide-react";
import { useMutation } from "convex/react";
```

Also add dropdown menu components:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

**Step 2: Add mutation hook**

Inside `MeasurementPlanPage` component, add:

```typescript
const setFirstValue = useMutation(api.measurementPlan.setFirstValue);
```

**Step 3: Update activity row to include dropdown**

Replace the activity button (around lines 187-212) with:

```typescript
{activities.map((activity) => (
  <div
    key={activity._id}
    className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
  >
    <button
      type="button"
      onClick={() => setEditActivity(activity)}
      className="flex items-center gap-2 text-left flex-1"
    >
      <span className="text-sm font-medium text-gray-900">
        {activity.name}
      </span>
      {activity.isFirstValue && (
        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
          First Value
        </span>
      )}
    </button>
    <div className="flex items-center gap-2">
      {activity.lifecycleSlot && (
        <span className="text-xs text-gray-500">
          {activity.lifecycleSlot.replace(/_/g, " ")}
        </span>
      )}
      {!activity.isFirstValue && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Target className="w-3.5 h-3.5 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => setFirstValue({ activityId: activity._id })}
            >
              <Target className="w-4 h-4 mr-2" />
              Mark as First Value
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  </div>
))}
```

**Step 4: Run dev server and verify**

Run: `npm run dev`
Verify:
- Activities show target icon dropdown when not marked as First Value
- Clicking "Mark as First Value" sets the flag
- Badge appears and dropdown disappears
- Previous First Value (if any) gets cleared

**Step 5: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx
git commit -m "feat: add 'Mark as First Value' dropdown to activities

Adds target icon dropdown on activity rows that are not marked as
First Value. Clicking the menu option calls setFirstValue mutation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Final Verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Manual verification checklist**

- [ ] Journey list shows green checkmark when First Value is defined
- [ ] Checkmark has tooltip "First Value defined"
- [ ] No indicator when First Value not defined
- [ ] Measurement Plan shows "First Value" badge on marked activity
- [ ] Activities have target icon dropdown when not marked
- [ ] "Mark as First Value" sets the flag and clears previous
- [ ] Status updates immediately (no page refresh needed)

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify First Value status display implementation

All tests pass, build succeeds, manual verification complete.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Test Coverage |
|------|-------------|---------------|
| 1 | `listWithFirstValueStatus` query | 2 tests |
| 2 | `setFirstValue` mutation | 3 tests |
| 3 | Journey list checkmark UI | Manual |
| 4 | Activity dropdown menu UI | Manual |
| 5 | Final verification | Full suite |

**Total new tests:** 5
**Files modified:** 4
- `convex/journeys.ts`
- `convex/journeys.test.ts`
- `convex/measurementPlan.ts`
- `convex/measurementPlan.test.ts`
- `src/routes/JourneysListPage.tsx`
- `src/routes/MeasurementPlanPage.tsx`
