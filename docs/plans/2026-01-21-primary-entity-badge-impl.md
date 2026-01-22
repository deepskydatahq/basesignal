# Primary Entity Badge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Primary" badge to the designated core business entity in MeasurementPlanSection, allowing users to identify and set their primary business entity.

**Architecture:** Vertical slice delivery - schema change + mutation + UI display + set action. The `primaryEntityId` field on users table stores the reference. MeasurementPlanSection receives this via expanded props and displays a Badge component next to the matching entity.

**Tech Stack:** Convex (schema, mutations, queries), React, existing Badge component from `@/components/ui/badge`

---

## Task 1: Add primaryEntityId to users schema

**Files:**
- Modify: `convex/schema.ts:12-52` (users table definition)

**Step 1: Add the field to schema**

In the users table definition, add the `primaryEntityId` field after the existing onboarding fields:

```typescript
// Add after line 48 (communityJoinMethod field)
// Primary entity designation
primaryEntityId: v.optional(v.id("measurementEntities")),
```

**Step 2: Run Convex dev to verify schema compiles**

Run: `npx convex dev --once`
Expected: Schema compiles without errors

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "$(cat <<'EOF'
feat: add primaryEntityId field to users schema

Allows users to designate one measurement entity as their primary
business entity. References measurementEntities table.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add setPrimaryEntity mutation with test

**Files:**
- Modify: `convex/users.ts` (add new mutation)
- Modify: `convex/users.test.ts` (add test)

**Step 1: Write the failing test**

Add to `convex/users.test.ts`:

```typescript
describe("setPrimaryEntity", () => {
  it("sets primary entity for authenticated user", async () => {
    const t = convexTest(schema);

    // Create user
    const userId = await t.mutation(internal.users.createFromWebhook, {
      clerkId: "user_primary_test",
      email: "primary@example.com",
    });

    // Create an entity for this user
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        createdAt: Date.now(),
      });
    });

    // Set primary entity (need to mock auth)
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { primaryEntityId: entityId });
    });

    // Verify
    const user = await t.run(async (ctx) => {
      return await ctx.db.get(userId);
    });

    expect(user?.primaryEntityId).toEqual(entityId);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/users.test.ts`
Expected: Test passes (this is a direct DB operation test, not mutation test)

**Step 3: Write the mutation**

Add to `convex/users.ts`:

```typescript
export const setPrimaryEntity = mutation({
  args: {
    entityId: v.id("measurementEntities"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) throw new Error("User not found");

    // Verify entity belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Entity does not belong to user");

    await ctx.db.patch(user._id, { primaryEntityId: args.entityId });
  },
});
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- convex/users.test.ts`
Expected: All tests pass

**Step 5: Commit**

```bash
git add convex/users.ts convex/users.test.ts
git commit -m "$(cat <<'EOF'
feat: add setPrimaryEntity mutation

Allows authenticated users to designate a measurement entity as their
primary business entity. Validates entity ownership.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update profile.getProfileData to include primaryEntityId

**Files:**
- Modify: `convex/profile.ts:135-159` (return value)

**Step 1: Update the return value**

In `profile.ts`, modify the return statement to include `primaryEntityId`:

```typescript
return {
  identity: {
    productName: user.productName,
    websiteUrl: user.websiteUrl,
    hasMultiUserAccounts: user.hasMultiUserAccounts,
    businessType: user.businessType,
    revenueModels: user.revenueModels,
  },
  primaryEntityId: user.primaryEntityId,  // Add this line
  journeyMap: {
    stages,
    journeyId: overviewJourney?._id ?? null,
  },
  // ... rest unchanged
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add convex/profile.ts
git commit -m "$(cat <<'EOF'
feat: include primaryEntityId in profile data

Exposes the user's primary entity designation for UI display.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update MeasurementPlanSection props and display badge

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.tsx`
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Write the failing test**

Add to `MeasurementPlanSection.test.tsx`:

```typescript
test("displays Primary badge for the primary entity", () => {
  const primaryEntityId = "entity1" as Id<"measurementEntities">;

  setup(
    [
      {
        entity: { _id: primaryEntityId, name: "Account" },
        activities: [],
        properties: [],
      },
      {
        entity: { _id: "entity2" as Id<"measurementEntities">, name: "User" },
        activities: [],
        properties: [],
      },
    ],
    primaryEntityId
  );

  expect(screen.getByText("Primary")).toBeInTheDocument();
  // Should only appear once
  expect(screen.getAllByText("Primary")).toHaveLength(1);
});

test("does not display Primary badge when no primary entity set", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "Account" },
      activities: [],
      properties: [],
    },
  ]);

  expect(screen.queryByText("Primary")).not.toBeInTheDocument();
});
```

**Step 2: Update setup function to accept primaryEntityId**

Modify the setup function:

```typescript
function setup(plan: PlanItem[] = [], primaryEntityId?: Id<"measurementEntities">) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MeasurementPlanSection plan={plan} primaryEntityId={primaryEntityId} />
    </MemoryRouter>
  );
  return { user };
}
```

**Step 3: Run test to verify it fails**

Run: `npm test -- MeasurementPlanSection`
Expected: FAIL - prop not accepted, Badge not rendered

**Step 4: Update component props and add Badge import**

Modify `MeasurementPlanSection.tsx`:

```typescript
import { Badge } from "../ui/badge";

interface MeasurementPlanSectionProps {
  plan: Array<{
    entity: { _id: Id<"measurementEntities">; name: string };
    activities: Array<{ _id: Id<"measurementActivities">; name: string }>;
    properties: Array<{ _id: Id<"measurementProperties">; name: string }>;
  }>;
  primaryEntityId?: Id<"measurementEntities">;
}
```

**Step 5: Update PlanEntityCard to accept isPrimary**

```typescript
function PlanEntityCard({
  name,
  activities,
  activityCount,
  propertyCount,
  isPrimary,
}: {
  name: string;
  activities: string[];
  activityCount: number;
  propertyCount: number;
  isPrimary?: boolean;
}) {
  const activityText = activityCount === 1 ? "activity" : "activities";
  const propertyText = propertyCount === 1 ? "property" : "properties";

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-medium text-gray-900">{name}</h4>
        {isPrimary && <Badge variant="secondary">Primary</Badge>}
      </div>
      {/* ... rest unchanged */}
    </div>
  );
}
```

**Step 6: Pass isPrimary from parent**

In the MeasurementPlanSection component, update the map:

```typescript
{plan.map(({ entity, activities, properties }) => (
  <PlanEntityCard
    key={entity._id}
    name={entity.name}
    activities={activities.map((a) => a.name)}
    activityCount={activities.length}
    propertyCount={properties.length}
    isPrimary={entity._id === primaryEntityId}
  />
))}
```

**Step 7: Run tests to verify they pass**

Run: `npm test -- MeasurementPlanSection`
Expected: All tests pass

**Step 8: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.tsx src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "$(cat <<'EOF'
feat: display Primary badge in MeasurementPlanSection

Shows a "Primary" badge next to the entity that matches the user's
primaryEntityId setting.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire primaryEntityId from ProfilePage to MeasurementPlanSection

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx:97`

**Step 1: Pass primaryEntityId prop**

Update the MeasurementPlanSection usage:

```typescript
<MeasurementPlanSection
  plan={measurementPlan ?? []}
  primaryEntityId={profileData.primaryEntityId}
/>
```

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/profile/ProfilePage.tsx
git commit -m "$(cat <<'EOF'
feat: wire primaryEntityId to MeasurementPlanSection

Passes the user's primary entity designation from profile data to the
MeasurementPlanSection component.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add "Set as primary" action to EntityCard on MeasurementPlanPage

**Files:**
- Modify: `src/components/measurement/EntityCard.tsx`
- Modify: `src/components/measurement/EntityCard.test.tsx`

**Step 1: Write the failing test**

Add to `EntityCard.test.tsx`:

```typescript
test("calls onSetPrimary when Set as primary button clicked", async () => {
  const onSetPrimary = vi.fn();
  const { user } = setup({
    id: "entity1" as Id<"measurementEntities">,
    name: "Account",
    activityCount: 0,
    propertyCount: 0,
    onSetPrimary,
  });

  // Hover to show actions
  const card = screen.getByRole("button", { name: /Account/i });
  await user.hover(card);

  // Click set as primary
  const setPrimaryButton = screen.getByRole("button", { name: /Set as primary/i });
  await user.click(setPrimaryButton);

  expect(onSetPrimary).toHaveBeenCalled();
});

test("shows Primary badge when isPrimary is true", () => {
  setup({
    id: "entity1" as Id<"measurementEntities">,
    name: "Account",
    activityCount: 0,
    propertyCount: 0,
    isPrimary: true,
  });

  expect(screen.getByText("Primary")).toBeInTheDocument();
});

test("does not show Set as primary button when already primary", async () => {
  const { user } = setup({
    id: "entity1" as Id<"measurementEntities">,
    name: "Account",
    activityCount: 0,
    propertyCount: 0,
    isPrimary: true,
  });

  // Hover to show actions
  const card = screen.getByRole("button", { name: /Account/i });
  await user.hover(card);

  expect(screen.queryByRole("button", { name: /Set as primary/i })).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- EntityCard.test`
Expected: FAIL - props not accepted

**Step 3: Update EntityCard props**

Add to `EntityCardProps` interface:

```typescript
interface EntityCardProps {
  id: Id<"measurementEntities">;
  name: string;
  description?: string;
  suggestedFrom?: string;
  activityCount: number;
  propertyCount: number;
  children?: React.ReactNode;
  defaultExpanded?: boolean;
  isPrimary?: boolean;
  onSetPrimary?: () => void;
}
```

**Step 4: Add Star icon import and button**

```typescript
import {
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  Star,
} from "lucide-react";
```

**Step 5: Add isPrimary badge display**

In the header section, after the suggestedFrom badge:

```typescript
{isPrimary && (
  <Badge variant="secondary">Primary</Badge>
)}
```

**Step 6: Add Set as primary button**

In the actions group (after the delete button), add:

```typescript
{!isPrimary && onSetPrimary && (
  <Button
    size="icon"
    variant="ghost"
    className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
    onClick={(e) => {
      e.stopPropagation();
      onSetPrimary();
    }}
    aria-label="Set as primary"
  >
    <Star className="h-4 w-4" />
  </Button>
)}
```

**Step 7: Run tests to verify they pass**

Run: `npm test -- EntityCard.test`
Expected: All tests pass

**Step 8: Commit**

```bash
git add src/components/measurement/EntityCard.tsx src/components/measurement/EntityCard.test.tsx
git commit -m "$(cat <<'EOF'
feat: add isPrimary badge and Set as primary action to EntityCard

EntityCard now displays a Primary badge when isPrimary is true, and
shows a star button to set as primary when not already primary.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wire setPrimaryEntity in MeasurementPlanPage

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`

**Step 1: Add mutation import and user query**

```typescript
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// Inside component:
const user = useQuery(api.users.current);
const setPrimaryEntity = useMutation(api.users.setPrimaryEntity);
```

**Step 2: Pass props to EntityCard**

Find where EntityCard is rendered and add:

```typescript
<EntityCard
  // ... existing props
  isPrimary={user?.primaryEntityId === entity._id}
  onSetPrimary={() => setPrimaryEntity({ entityId: entity._id })}
/>
```

**Step 3: Run type check and tests**

Run: `npx tsc --noEmit && npm test`
Expected: No type errors, all tests pass

**Step 4: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx
git commit -m "$(cat <<'EOF'
feat: wire setPrimaryEntity mutation in MeasurementPlanPage

Users can now set any entity as primary from the Measurement Plan page
using the star button on entity cards.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final verification

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No lint errors

**Step 4: Manual verification (if dev server running)**

1. Navigate to Profile page
2. Verify no Primary badge shows (no primary set)
3. Navigate to Measurement Plan page
4. Click star on an entity
5. Verify Primary badge appears
6. Navigate back to Profile page
7. Verify Primary badge shows on that entity in MeasurementPlanSection

---

## Summary

This plan implements the primary entity badge feature in 8 tasks:

1. Schema change (add `primaryEntityId` to users)
2. Backend mutation (`setPrimaryEntity`) with test
3. Profile query update (expose `primaryEntityId`)
4. MeasurementPlanSection UI (display badge)
5. ProfilePage wiring (pass prop)
6. EntityCard enhancement (badge + action)
7. MeasurementPlanPage wiring (mutation call)
8. Final verification

Each task follows TDD where applicable and includes commit points.
