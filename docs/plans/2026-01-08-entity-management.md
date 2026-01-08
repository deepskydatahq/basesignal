# Entity Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add entity CRUD functionality to the Measurement Plan page - users can add, edit, and delete entities.

**Architecture:** User-scoped entities stored in `measurementEntities` table with Convex queries/mutations. React components follow existing patterns: Dialog for create, inline edit for name/description, delete with confirmation warning.

**Tech Stack:** Convex (backend), React + shadcn/ui (frontend), convex-test (testing)

---

## Task 1: Add Schema for measurementEntities

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Write the schema addition**

Add to `convex/schema.ts` after the `interviewMessages` table definition:

```typescript
measurementEntities: defineTable({
  userId: v.id("users"),
  name: v.string(),
  description: v.optional(v.string()),
  suggestedFrom: v.optional(v.string()), // "overview_interview" | "first_value" | "manual"
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_user_and_name", ["userId", "name"]),
```

**Step 2: Verify schema compiles**

Run: `npx convex dev` (should show schema updated)

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add measurementEntities schema"
```

---

## Task 2: Create measurementEntities Convex Functions

**Files:**
- Create: `convex/measurementEntities.ts`
- Test: `convex/measurementEntities.test.ts`

**Step 1: Write failing test for list query**

Create `convex/measurementEntities.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to create authenticated user context
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
  describe("list", () => {
    it("returns empty array for user with no entities", async () => {
      const t = convexTest(schema);
      const { asUser } = await setupUser(t);

      const entities = await asUser.query(api.measurementEntities.list);
      expect(entities).toEqual([]);
    });

    it("returns only entities for authenticated user", async () => {
      const t = convexTest(schema);
      const { asUser, userId } = await setupUser(t);

      // Create entity directly in DB
      await t.run(async (ctx) => {
        await ctx.db.insert("measurementEntities", {
          userId,
          name: "Account",
          createdAt: Date.now(),
        });
      });

      const entities = await asUser.query(api.measurementEntities.list);
      expect(entities).toHaveLength(1);
      expect(entities[0].name).toBe("Account");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/measurementEntities.test.ts`
Expected: FAIL (api.measurementEntities.list not defined)

**Step 3: Write list query**

Create `convex/measurementEntities.ts`:

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

// List all measurement entities for current user
export const list = query({
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
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/measurementEntities.test.ts`
Expected: PASS

**Step 5: Write failing test for create mutation**

Add to test file:

```typescript
describe("create", () => {
  it("creates entity for authenticated user", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementEntities.create, {
      name: "Account",
      description: "User accounts",
    });

    expect(entityId).toBeDefined();

    const entities = await asUser.query(api.measurementEntities.list);
    expect(entities).toHaveLength(1);
    expect(entities[0].name).toBe("Account");
    expect(entities[0].description).toBe("User accounts");
    expect(entities[0].suggestedFrom).toBe("manual");
  });

  it("rejects duplicate entity names", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    await asUser.mutation(api.measurementEntities.create, {
      name: "Account",
    });

    await expect(
      asUser.mutation(api.measurementEntities.create, {
        name: "Account",
      })
    ).rejects.toThrow("already exists");
  });

  it("rejects unauthenticated requests", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.measurementEntities.create, {
        name: "Account",
      })
    ).rejects.toThrow("Not authenticated");
  });
});
```

**Step 6: Run test to verify it fails**

Run: `npm run test:run -- convex/measurementEntities.test.ts`
Expected: FAIL

**Step 7: Write create mutation**

Add to `convex/measurementEntities.ts`:

```typescript
// Create a new measurement entity
export const create = mutation({
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
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", user._id).eq("name", args.name)
      )
      .first();

    if (existing) {
      throw new Error(`Entity "${args.name}" already exists`);
    }

    return await ctx.db.insert("measurementEntities", {
      userId: user._id,
      name: args.name,
      description: args.description,
      suggestedFrom: args.suggestedFrom ?? "manual",
      createdAt: Date.now(),
    });
  },
});
```

**Step 8: Run test to verify it passes**

Run: `npm run test:run -- convex/measurementEntities.test.ts`
Expected: PASS

**Step 9: Write failing test for update mutation**

Add to test file:

```typescript
describe("update", () => {
  it("updates entity name and description", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementEntities.create, {
      name: "Account",
    });

    await asUser.mutation(api.measurementEntities.update, {
      id: entityId,
      name: "User Account",
      description: "Updated description",
    });

    const entities = await asUser.query(api.measurementEntities.list);
    expect(entities[0].name).toBe("User Account");
    expect(entities[0].description).toBe("Updated description");
  });

  it("rejects duplicate name on update", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    await asUser.mutation(api.measurementEntities.create, {
      name: "Account",
    });

    const entityId2 = await asUser.mutation(api.measurementEntities.create, {
      name: "User",
    });

    await expect(
      asUser.mutation(api.measurementEntities.update, {
        id: entityId2,
        name: "Account", // Already exists
      })
    ).rejects.toThrow("already exists");
  });
});
```

**Step 10: Run test to verify it fails**

Run: `npm run test:run -- convex/measurementEntities.test.ts`
Expected: FAIL

**Step 11: Write update mutation**

Add to `convex/measurementEntities.ts`:

```typescript
// Update a measurement entity
export const update = mutation({
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
        .withIndex("by_user_and_name", (q) =>
          q.eq("userId", user._id).eq("name", args.name)
        )
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
```

**Step 12: Run test to verify it passes**

Run: `npm run test:run -- convex/measurementEntities.test.ts`
Expected: PASS

**Step 13: Write failing test for remove mutation**

Add to test file:

```typescript
describe("remove", () => {
  it("removes entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const entityId = await asUser.mutation(api.measurementEntities.create, {
      name: "Account",
    });

    await asUser.mutation(api.measurementEntities.remove, {
      id: entityId,
    });

    const entities = await asUser.query(api.measurementEntities.list);
    expect(entities).toHaveLength(0);
  });

  it("rejects removal of non-existent entity", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    // Create and immediately delete to get a valid but non-existent ID
    const entityId = await asUser.mutation(api.measurementEntities.create, {
      name: "Account",
    });
    await asUser.mutation(api.measurementEntities.remove, { id: entityId });

    await expect(
      asUser.mutation(api.measurementEntities.remove, { id: entityId })
    ).rejects.toThrow("not found");
  });
});
```

**Step 14: Run test to verify it fails**

Run: `npm run test:run -- convex/measurementEntities.test.ts`
Expected: FAIL

**Step 15: Write remove mutation**

Add to `convex/measurementEntities.ts`:

```typescript
// Remove a measurement entity
export const remove = mutation({
  args: {
    id: v.id("measurementEntities"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const entity = await ctx.db.get(args.id);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    await ctx.db.delete(args.id);
  },
});
```

**Step 16: Run all tests to verify they pass**

Run: `npm run test:run -- convex/measurementEntities.test.ts`
Expected: All PASS

**Step 17: Commit**

```bash
git add convex/measurementEntities.ts convex/measurementEntities.test.ts
git commit -m "feat: add measurementEntities CRUD functions with tests"
```

---

## Task 3: Create AddEntityDialog Component

**Files:**
- Create: `src/components/measurement/AddEntityDialog.tsx`

**Step 1: Create the dialog component**

Create `src/components/measurement/AddEntityDialog.tsx`:

```typescript
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Plus } from "lucide-react";

interface AddEntityDialogProps {
  onSuccess?: () => void;
}

export function AddEntityDialog({ onSuccess }: AddEntityDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createEntity = useMutation(api.measurementEntities.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Entity name is required");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      await createEntity({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setIsOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entity");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setName("");
      setDescription("");
      setError(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Entity
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Entity</DialogTitle>
          <DialogDescription>
            Define a new entity for your measurement plan. Entities represent
            the key objects in your product (e.g., Account, User, Project).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Account, User, Project"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this entity represent?"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !name.trim()}>
              {isCreating ? "Creating..." : "Create Entity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run build` (should compile without errors)

**Step 3: Commit**

```bash
git add src/components/measurement/AddEntityDialog.tsx
git commit -m "feat: add AddEntityDialog component"
```

---

## Task 4: Create EntityCard Component with Edit/Delete

**Files:**
- Create: `src/components/measurement/EntityCard.tsx`

**Step 1: Create the card component**

Create `src/components/measurement/EntityCard.tsx`:

```typescript
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Card, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Pencil, Trash2, Check, X } from "lucide-react";

interface EntityCardProps {
  id: Id<"measurementEntities">;
  name: string;
  description?: string;
  suggestedFrom?: string;
  activityCount?: number;
  propertyCount?: number;
}

export function EntityCard({
  id,
  name,
  description,
  suggestedFrom,
  activityCount = 0,
  propertyCount = 0,
}: EntityCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editDescription, setEditDescription] = useState(description ?? "");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEntity = useMutation(api.measurementEntities.update);
  const removeEntity = useMutation(api.measurementEntities.remove);

  const handleSave = async () => {
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }

    try {
      await updateEntity({
        id,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleCancel = () => {
    setEditName(name);
    setEditDescription(description ?? "");
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    try {
      await removeEntity({ id });
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error("Failed to delete entity:", err);
    }
  };

  const hasChildren = activityCount > 0 || propertyCount > 0;

  return (
    <>
      <Card className="bg-white">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-2">
                  {error && (
                    <div className="text-sm text-red-600">{error}</div>
                  )}
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Entity name"
                    autoFocus
                  />
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description (optional)"
                  />
                </div>
              ) : (
                <>
                  <CardTitle className="text-lg">{name}</CardTitle>
                  {description && (
                    <CardDescription className="mt-1">
                      {description}
                    </CardDescription>
                  )}
                  <div className="mt-2 flex gap-3 text-sm text-gray-500">
                    <span>{activityCount} activities</span>
                    <span>{propertyCount} properties</span>
                    {suggestedFrom && suggestedFrom !== "manual" && (
                      <span className="text-blue-600">
                        from {suggestedFrom.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-1">
              {isEditing ? (
                <>
                  <Button size="icon" variant="ghost" onClick={handleSave}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={handleCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Entity</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{name}"?
              {hasChildren && (
                <span className="block mt-2 text-amber-600">
                  Warning: This entity has {activityCount} activities and{" "}
                  {propertyCount} properties that will also be deleted.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/measurement/EntityCard.tsx
git commit -m "feat: add EntityCard component with inline edit and delete"
```

---

## Task 5: Create MeasurementPlanPage

**Files:**
- Create: `src/routes/MeasurementPlanPage.tsx`
- Modify: `src/App.tsx`

**Step 1: Create the page component**

Create `src/routes/MeasurementPlanPage.tsx`:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AddEntityDialog } from "../components/measurement/AddEntityDialog";
import { EntityCard } from "../components/measurement/EntityCard";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

export function MeasurementPlanPage() {
  const entities = useQuery(api.measurementEntities.list);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Measurement Plan
            </h1>
            <p className="text-gray-600 mt-1">
              Define the entities, activities, and properties you want to track.
            </p>
          </div>
          <AddEntityDialog />
        </div>
      </div>

      {entities === undefined ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : entities.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <p className="text-gray-500 mb-4">
            No entities defined yet. Start by adding an entity like "Account" or
            "User".
          </p>
          <AddEntityDialog />
        </div>
      ) : (
        <div className="space-y-4">
          {entities.map((entity) => (
            <EntityCard
              key={entity._id}
              id={entity._id}
              name={entity.name}
              description={entity.description}
              suggestedFrom={entity.suggestedFrom}
              activityCount={0}
              propertyCount={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add route to App.tsx**

In `src/App.tsx`, add the import at the top with other route imports:

```typescript
import { MeasurementPlanPage } from "./routes/MeasurementPlanPage";
```

Add the route inside the DashboardLayout routes (after journeys routes):

```typescript
<Route path="measurement-plan" element={<MeasurementPlanPage />} />
```

**Step 3: Verify app compiles and route works**

Run: `npm run dev`
Navigate to: `http://localhost:5173/measurement-plan`
Expected: Page loads with "No entities defined yet" message

**Step 4: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/App.tsx
git commit -m "feat: add MeasurementPlanPage with entity listing"
```

---

## Task 6: Add Navigation Link to Sidebar (Optional)

**Files:**
- Modify: `src/components/layout/Sidebar.tsx` (if exists)

**Step 1: Check if sidebar exists and add link**

Look for sidebar component and add navigation item for `/measurement-plan`.

If using the MeasurementFoundationCard on home page, ensure clicking the "Measurement Plan" card navigates to `/measurement-plan`.

**Step 2: Commit if changes made**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add measurement plan link to navigation"
```

---

## Task 7: Final Verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Manual testing checklist**

- [ ] Navigate to `/measurement-plan`
- [ ] Click "Add Entity" - dialog opens
- [ ] Create entity with name only - succeeds
- [ ] Create entity with name and description - succeeds
- [ ] Try duplicate name - error message shows
- [ ] Click edit icon - inline editing works
- [ ] Save edited entity - changes persist
- [ ] Click delete icon - confirmation dialog shows
- [ ] Confirm delete - entity removed

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from manual testing"
```

---

## Testing Summary

| What | Tool | File |
|------|------|------|
| Convex CRUD functions | convex-test | `convex/measurementEntities.test.ts` |

Run: `npm run test:run` to verify all tests pass.

---

## Risks & Mitigations

- **Schema migration**: Adding new table is safe, no migration needed
- **Auth dependency**: Uses same `getCurrentUser` pattern as journeys - proven to work
- **Child deletion**: For now, activities/properties don't exist yet. When Task 4/5 (Activity/Property Management) are implemented, the delete mutation will need to cascade delete children.
