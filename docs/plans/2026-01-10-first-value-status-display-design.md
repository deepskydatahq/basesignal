# First Value Completion Status Display Design

## Overview

Display a visual indicator when First Value has been defined for a journey. Show a checkmark badge in the journey list and a "First Value" label on the marked activity in the Measurement Plan. Add ability to mark an activity as First Value directly from the Measurement Plan.

## Problem Statement

Users have no visual feedback showing which journeys have First Value defined or which activity IS the First Value moment. This makes it hard to track progress and understand the current state at a glance.

## Proposed Solution

1. **Journey list**: Add green checkmark badge to journeys that have an activity marked as First Value
2. **Measurement Plan**: Show "First Value" badge on the marked activity
3. **Measurement Plan**: Add "Mark as First Value" menu option when none is set

---

## Design Details

### What Defines "First Value Completed"

An activity has `isFirstValue: true` in the database. This is the outcome-based definition - it shows the result exists regardless of whether it came from an interview or manual marking.

### Data Layer

**No schema changes needed.** Existing field covers everything:
- `measurementActivities.isFirstValue: v.boolean()`

**Updated query in `convex/journeys.ts`:**

```typescript
// Add hasFirstValue computed field to journey list
export const listWithStatus = query({
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return Promise.all(journeys.map(async (journey) => {
      // Check if any activity for this journey has isFirstValue: true
      const firstValueActivity = await ctx.db
        .query("measurementActivities")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .filter((q) => q.eq(q.field("isFirstValue"), true))
        .first();

      return {
        ...journey,
        hasFirstValue: !!firstValueActivity,
      };
    }));
  },
});
```

**New mutation in `convex/measurementActivities.ts`:**

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

    // Clear isFirstValue from all activities in this journey
    const allActivities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_journey", (q) => q.eq("journeyId", activity.journeyId))
      .collect();

    for (const act of allActivities) {
      if (act.isFirstValue) {
        await ctx.db.patch(act._id, { isFirstValue: false });
      }
    }

    // Set this activity as First Value
    await ctx.db.patch(args.activityId, { isFirstValue: true });
  },
});
```

---

### UI Components

**Journey List (`JourneysListPage.tsx`):**

Add checkmark to `JourneyRow` when `hasFirstValue: true`:

```
┌─────────────────────────────────────────────────────────────┐
│  My Product Journey  ✓                    2 days ago    ★  │
│  Another Journey                          1 week ago    ☆  │
└─────────────────────────────────────────────────────────────┘
```

Implementation:
```tsx
// In JourneyRow component
{journey.hasFirstValue && (
  <CheckCircle
    className="w-4 h-4 text-green-500 ml-1"
    title="First Value defined"
  />
)}
```

- Small green checkmark icon after journey name
- Tooltip: "First Value defined"
- No indicator when not defined (clean list)

**Measurement Plan - Activity Badge (`EntityCard.tsx`):**

Show "First Value" badge when `activity.isFirstValue: true`:

```
┌─────────────────────────────────────────────────────────────┐
│  Project Published                          [First Value]   │
│  User publishes their first project                        │
└─────────────────────────────────────────────────────────────┘
```

Implementation:
```tsx
// In activity row
{activity.isFirstValue && (
  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
    First Value
  </span>
)}
```

**Measurement Plan - Menu Option (`EntityCard.tsx`):**

Add "Mark as First Value" to activity dropdown menu:

```tsx
// In activity menu dropdown
<DropdownMenuItem onClick={() => setFirstValue({ activityId: activity._id })}>
  <Target className="w-4 h-4 mr-2" />
  Mark as First Value
</DropdownMenuItem>
```

- Only show when this activity is NOT already First Value
- Clicking calls `setFirstValue` mutation (clears others, sets this one)

---

## Files to Modify

| File | Changes |
|------|---------|
| `convex/journeys.ts` | Add `listWithStatus` query or update existing list query with `hasFirstValue` |
| `convex/measurementActivities.ts` | Add `setFirstValue` mutation |
| `src/routes/JourneysListPage.tsx` | Add checkmark badge to journey rows |
| `src/components/measurement/EntityCard.tsx` | Add "First Value" badge to marked activity |
| `src/components/measurement/EntityCard.tsx` | Add "Mark as First Value" menu option |

---

## Alternatives Considered

### Interview completion as trigger
- **Rejected**: Activity marked is more practical
- User could mark First Value manually without interview
- Outcome matters more than process

### Show "not defined" state in journey list
- **Rejected**: Adds noise to clean list
- Homepage already prompts for undefined First Value
- Keep list minimal

### Star icon instead of checkmark
- **Rejected**: Checkmark consistent with existing completion indicators
- Star already used for "default journey" in the list

---

## Success Criteria

1. Journey list shows green checkmark on journeys with First Value defined
2. Checkmark has tooltip "First Value defined"
3. No indicator shown when First Value not defined
4. Measurement Plan shows "First Value" badge on marked activity
5. Activity menu shows "Mark as First Value" option
6. Marking new First Value clears previous one (only one per journey)
7. Status updates immediately after marking

---

## Future Enhancements

- Show First Value status in Dashboard overview
- Add First Value indicator to Setup progress
- Animate badge when First Value is newly set
- Show which interview defined the First Value (audit trail)
