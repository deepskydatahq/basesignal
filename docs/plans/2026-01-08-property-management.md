# Property Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add property CRUD functionality with template suggestions based on entity type patterns - users can add, edit, and delete properties belonging to entities.

**Architecture:** User-scoped properties stored in `measurementProperties` table linked to entities. Template suggestions based on entity name patterns (Account → created_at, plan_type, etc). React components follow existing measurement plan patterns.

**Tech Stack:** Convex (backend), React + shadcn/ui (frontend), convex-test (testing)

---

## Task 1: Add Schema for measurementProperties

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Write the schema addition**

Add to `convex/schema.ts` after the `measurementEntities` table (which should exist from #19):

```typescript
measurementProperties: defineTable({
  userId: v.id("users"),
  entityId: v.id("measurementEntities"),
  name: v.string(),           // "plan_type", "created_at"
  dataType: v.string(),       // "string" | "number" | "boolean" | "timestamp"
  description: v.optional(v.string()),
  isRequired: v.boolean(),
  suggestedFrom: v.optional(v.string()), // "template" | "manual"
  createdAt: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_entity", ["entityId"])
  .index("by_entity_and_name", ["entityId", "name"]),
```

**Step 2: Verify schema compiles**

Run: `npx convex dev` (should show schema updated)

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add measurementProperties schema"
```

---

## Task 2: Create Property Templates

**Files:**
- Create: `src/shared/propertyTemplates.ts`
- Test: `src/test/propertyTemplates.test.ts`

**Step 1: Write failing test for template matching**

Create `src/test/propertyTemplates.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getPropertyTemplates, PropertyTemplate } from "../shared/propertyTemplates";

describe("propertyTemplates", () => {
  describe("getPropertyTemplates", () => {
    it("returns account properties for 'Account' entity", () => {
      const templates = getPropertyTemplates("Account");
      expect(templates.length).toBeGreaterThan(0);
      const names = templates.map((t) => t.name);
      expect(names).toContain("created_at");
      expect(names).toContain("plan_type");
    });

    it("returns account properties for 'Organization' entity", () => {
      const templates = getPropertyTemplates("Organization");
      const names = templates.map((t) => t.name);
      expect(names).toContain("created_at");
      expect(names).toContain("mrr");
    });

    it("returns user properties for 'User' entity", () => {
      const templates = getPropertyTemplates("User");
      const names = templates.map((t) => t.name);
      expect(names).toContain("email");
      expect(names).toContain("role");
    });

    it("returns user properties for 'Member' entity", () => {
      const templates = getPropertyTemplates("Member");
      const names = templates.map((t) => t.name);
      expect(names).toContain("email");
    });

    it("returns subscription properties for 'Subscription' entity", () => {
      const templates = getPropertyTemplates("Subscription");
      const names = templates.map((t) => t.name);
      expect(names).toContain("started_at");
      expect(names).toContain("billing_interval");
    });

    it("returns project properties for 'Project' entity", () => {
      const templates = getPropertyTemplates("Project");
      const names = templates.map((t) => t.name);
      expect(names).toContain("created_at");
      expect(names).toContain("owner_id");
    });

    it("returns generic properties for unknown entity", () => {
      const templates = getPropertyTemplates("Widget");
      const names = templates.map((t) => t.name);
      expect(names).toContain("created_at");
      expect(names).toContain("id");
    });

    it("is case-insensitive", () => {
      const lower = getPropertyTemplates("account");
      const upper = getPropertyTemplates("ACCOUNT");
      expect(lower).toEqual(upper);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/test/propertyTemplates.test.ts`
Expected: FAIL (module not found)

**Step 3: Write property templates implementation**

Create `src/shared/propertyTemplates.ts`:

```typescript
export interface PropertyTemplate {
  name: string;
  dataType: "string" | "number" | "boolean" | "timestamp";
  description: string;
  isRequired: boolean;
}

const ACCOUNT_PROPERTIES: PropertyTemplate[] = [
  { name: "created_at", dataType: "timestamp", description: "When the account was created", isRequired: true },
  { name: "plan_type", dataType: "string", description: "Current subscription plan", isRequired: false },
  { name: "mrr", dataType: "number", description: "Monthly recurring revenue", isRequired: false },
  { name: "seats", dataType: "number", description: "Number of seats/users allowed", isRequired: false },
  { name: "owner_email", dataType: "string", description: "Primary account owner email", isRequired: false },
];

const USER_PROPERTIES: PropertyTemplate[] = [
  { name: "email", dataType: "string", description: "User email address", isRequired: true },
  { name: "created_at", dataType: "timestamp", description: "When the user was created", isRequired: true },
  { name: "role", dataType: "string", description: "User role (admin, member, etc.)", isRequired: false },
  { name: "last_active_at", dataType: "timestamp", description: "Last activity timestamp", isRequired: false },
];

const SUBSCRIPTION_PROPERTIES: PropertyTemplate[] = [
  { name: "started_at", dataType: "timestamp", description: "Subscription start date", isRequired: true },
  { name: "plan_name", dataType: "string", description: "Name of the plan", isRequired: true },
  { name: "billing_interval", dataType: "string", description: "monthly, yearly, etc.", isRequired: false },
  { name: "amount", dataType: "number", description: "Subscription amount", isRequired: false },
];

const PROJECT_PROPERTIES: PropertyTemplate[] = [
  { name: "created_at", dataType: "timestamp", description: "When the item was created", isRequired: true },
  { name: "owner_id", dataType: "string", description: "ID of the owner/creator", isRequired: false },
  { name: "collaborator_count", dataType: "number", description: "Number of collaborators", isRequired: false },
];

const GENERIC_PROPERTIES: PropertyTemplate[] = [
  { name: "id", dataType: "string", description: "Unique identifier", isRequired: true },
  { name: "created_at", dataType: "timestamp", description: "Creation timestamp", isRequired: true },
];

// Entity name patterns (case-insensitive)
const ACCOUNT_PATTERNS = ["account", "organization", "company", "workspace", "team"];
const USER_PATTERNS = ["user", "member", "person", "customer"];
const SUBSCRIPTION_PATTERNS = ["subscription", "plan", "billing"];
const PROJECT_PATTERNS = ["project", "document", "item", "file", "folder"];

export function getPropertyTemplates(entityName: string): PropertyTemplate[] {
  const name = entityName.toLowerCase();

  if (ACCOUNT_PATTERNS.some((p) => name.includes(p))) {
    return ACCOUNT_PROPERTIES;
  }
  if (USER_PATTERNS.some((p) => name.includes(p))) {
    return USER_PROPERTIES;
  }
  if (SUBSCRIPTION_PATTERNS.some((p) => name.includes(p))) {
    return SUBSCRIPTION_PROPERTIES;
  }
  if (PROJECT_PATTERNS.some((p) => name.includes(p))) {
    return PROJECT_PROPERTIES;
  }

  return GENERIC_PROPERTIES;
}

export const DATA_TYPES = ["string", "number", "boolean", "timestamp"] as const;
export type DataType = (typeof DATA_TYPES)[number];
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/test/propertyTemplates.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/propertyTemplates.ts src/test/propertyTemplates.test.ts
git commit -m "feat: add property templates based on entity patterns"
```

---

## Task 3: Create measurementProperties Convex Functions

**Files:**
- Create: `convex/measurementProperties.ts`
- Test: `convex/measurementProperties.test.ts`

**Step 1: Write failing test for list query**

Create `convex/measurementProperties.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to create authenticated user with entity
async function setupUserWithEntity(t: ReturnType<typeof convexTest>) {
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

  // Create an entity to attach properties to
  const entityId = await t.run(async (ctx) => {
    return await ctx.db.insert("measurementEntities", {
      userId,
      name: "Account",
      createdAt: Date.now(),
    });
  });

  return { userId, asUser, entityId };
}

describe("measurementProperties", () => {
  describe("listByEntity", () => {
    it("returns empty array for entity with no properties", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties).toEqual([]);
    });

    it("returns properties for specified entity", async () => {
      const t = convexTest(schema);
      const { asUser, entityId, userId } = await setupUserWithEntity(t);

      await t.run(async (ctx) => {
        await ctx.db.insert("measurementProperties", {
          userId,
          entityId,
          name: "created_at",
          dataType: "timestamp",
          isRequired: true,
          createdAt: Date.now(),
        });
      });

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe("created_at");
    });
  });

  describe("create", () => {
    it("creates property for entity", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const propertyId = await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "plan_type",
        dataType: "string",
        description: "Current plan",
        isRequired: false,
      });

      expect(propertyId).toBeDefined();

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties).toHaveLength(1);
      expect(properties[0].name).toBe("plan_type");
      expect(properties[0].dataType).toBe("string");
      expect(properties[0].isRequired).toBe(false);
      expect(properties[0].suggestedFrom).toBe("manual");
    });

    it("rejects duplicate property names within same entity", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "created_at",
        dataType: "timestamp",
        isRequired: true,
      });

      await expect(
        asUser.mutation(api.measurementProperties.create, {
          entityId,
          name: "created_at",
          dataType: "string",
          isRequired: false,
        })
      ).rejects.toThrow("already exists");
    });

    it("allows same property name on different entities", async () => {
      const t = convexTest(schema);
      const { asUser, entityId, userId } = await setupUserWithEntity(t);

      // Create a second entity
      const entityId2 = await t.run(async (ctx) => {
        return await ctx.db.insert("measurementEntities", {
          userId,
          name: "User",
          createdAt: Date.now(),
        });
      });

      await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "created_at",
        dataType: "timestamp",
        isRequired: true,
      });

      // Should not throw - different entity
      const propertyId2 = await asUser.mutation(api.measurementProperties.create, {
        entityId: entityId2,
        name: "created_at",
        dataType: "timestamp",
        isRequired: true,
      });

      expect(propertyId2).toBeDefined();
    });
  });

  describe("update", () => {
    it("updates property fields", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const propertyId = await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "plan",
        dataType: "string",
        isRequired: false,
      });

      await asUser.mutation(api.measurementProperties.update, {
        id: propertyId,
        name: "plan_type",
        description: "Updated description",
        isRequired: true,
      });

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties[0].name).toBe("plan_type");
      expect(properties[0].description).toBe("Updated description");
      expect(properties[0].isRequired).toBe(true);
    });
  });

  describe("remove", () => {
    it("removes property", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const propertyId = await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "test_prop",
        dataType: "string",
        isRequired: false,
      });

      await asUser.mutation(api.measurementProperties.remove, {
        id: propertyId,
      });

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties).toHaveLength(0);
    });
  });

  describe("createFromTemplate", () => {
    it("creates property with template suggestedFrom", async () => {
      const t = convexTest(schema);
      const { asUser, entityId } = await setupUserWithEntity(t);

      const propertyId = await asUser.mutation(api.measurementProperties.create, {
        entityId,
        name: "created_at",
        dataType: "timestamp",
        description: "When created",
        isRequired: true,
        suggestedFrom: "template",
      });

      const properties = await asUser.query(api.measurementProperties.listByEntity, {
        entityId,
      });
      expect(properties[0].suggestedFrom).toBe("template");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/measurementProperties.test.ts`
Expected: FAIL

**Step 3: Write measurementProperties implementation**

Create `convex/measurementProperties.ts`:

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

// List all properties for an entity
export const listByEntity = query({
  args: {
    entityId: v.id("measurementEntities"),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    // Verify entity belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity || entity.userId !== user._id) return [];

    return await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity", (q) => q.eq("entityId", args.entityId))
      .collect();
  },
});

// Create a new property
export const create = mutation({
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

    // Verify entity belongs to user
    const entity = await ctx.db.get(args.entityId);
    if (!entity) throw new Error("Entity not found");
    if (entity.userId !== user._id) throw new Error("Not authorized");

    // Check for duplicate name within this entity
    const existing = await ctx.db
      .query("measurementProperties")
      .withIndex("by_entity_and_name", (q) =>
        q.eq("entityId", args.entityId).eq("name", args.name)
      )
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
      suggestedFrom: args.suggestedFrom ?? "manual",
      createdAt: Date.now(),
    });
  },
});

// Update a property
export const update = mutation({
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
        .withIndex("by_entity_and_name", (q) =>
          q.eq("entityId", property.entityId).eq("name", args.name)
        )
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

// Remove a property
export const remove = mutation({
  args: {
    id: v.id("measurementProperties"),
  },
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

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- convex/measurementProperties.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add convex/measurementProperties.ts convex/measurementProperties.test.ts
git commit -m "feat: add measurementProperties CRUD functions with tests"
```

---

## Task 4: Create AddPropertyDialog Component

**Files:**
- Create: `src/components/measurement/AddPropertyDialog.tsx`

**Step 1: Create the dialog component with template suggestions**

Create `src/components/measurement/AddPropertyDialog.tsx`:

```typescript
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Plus, Sparkles } from "lucide-react";
import {
  getPropertyTemplates,
  PropertyTemplate,
  DATA_TYPES,
} from "../../shared/propertyTemplates";

interface AddPropertyDialogProps {
  entityId: Id<"measurementEntities">;
  entityName: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AddPropertyDialog({
  entityId,
  entityName,
  trigger,
  onSuccess,
}: AddPropertyDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<string>("string");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const createProperty = useMutation(api.measurementProperties.create);
  const existingProperties = useQuery(api.measurementProperties.listByEntity, {
    entityId,
  });

  // Get template suggestions based on entity name
  const templates = getPropertyTemplates(entityName);
  const existingNames = new Set(existingProperties?.map((p) => p.name) ?? []);
  const availableTemplates = templates.filter((t) => !existingNames.has(t.name));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Property name is required");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      await createProperty({
        entityId,
        name: name.trim(),
        dataType,
        description: description.trim() || undefined,
        isRequired,
      });
      resetForm();
      setIsOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create property");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddFromTemplate = async (template: PropertyTemplate) => {
    setIsCreating(true);
    setError(null);

    try {
      await createProperty({
        entityId,
        name: template.name,
        dataType: template.dataType,
        description: template.description,
        isRequired: template.isRequired,
        suggestedFrom: "template",
      });
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add property");
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDataType("string");
    setDescription("");
    setIsRequired(false);
    setError(null);
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) resetForm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Property
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Property to {entityName}</DialogTitle>
          <DialogDescription>
            Define a property that should be tracked on this entity.
          </DialogDescription>
        </DialogHeader>

        {/* Template Suggestions */}
        {availableTemplates.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Sparkles className="h-4 w-4" />
              <span>Suggested properties</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTemplates.slice(0, 5).map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddFromTemplate(template)}
                  disabled={isCreating}
                  className="text-xs"
                >
                  {template.name}
                  <span className="ml-1 text-gray-400">({template.dataType})</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-sm text-gray-600 mb-4">Or create a custom property:</p>
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
                placeholder="e.g., plan_type, created_at"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataType">Data Type</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this property represent?"
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRequired"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(checked === true)}
              />
              <Label htmlFor="isRequired" className="font-normal">
                Required for analytics
              </Label>
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
                {isCreating ? "Creating..." : "Create Property"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify component compiles**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/measurement/AddPropertyDialog.tsx
git commit -m "feat: add AddPropertyDialog with template suggestions"
```

---

## Task 5: Create PropertyList Component

**Files:**
- Create: `src/components/measurement/PropertyList.tsx`

**Step 1: Create the property list component with edit/delete**

Create `src/components/measurement/PropertyList.tsx`:

```typescript
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { DATA_TYPES } from "../../shared/propertyTemplates";

interface PropertyListProps {
  properties: Doc<"measurementProperties">[];
}

export function PropertyList({ properties }: PropertyListProps) {
  if (properties.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic py-2">
        No properties defined yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {properties.map((property) => (
        <PropertyRow key={property._id} property={property} />
      ))}
    </div>
  );
}

function PropertyRow({ property }: { property: Doc<"measurementProperties"> }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(property.name);
  const [editDataType, setEditDataType] = useState(property.dataType);
  const [editDescription, setEditDescription] = useState(property.description ?? "");
  const [editIsRequired, setEditIsRequired] = useState(property.isRequired);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProperty = useMutation(api.measurementProperties.update);
  const removeProperty = useMutation(api.measurementProperties.remove);

  const handleSave = async () => {
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }

    try {
      await updateProperty({
        id: property._id,
        name: editName.trim(),
        dataType: editDataType,
        description: editDescription.trim() || undefined,
        isRequired: editIsRequired,
      });
      setIsEditing(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleCancel = () => {
    setEditName(property.name);
    setEditDataType(property.dataType);
    setEditDescription(property.description ?? "");
    setEditIsRequired(property.isRequired);
    setIsEditing(false);
    setError(null);
  };

  const handleDelete = async () => {
    try {
      await removeProperty({ id: property._id });
      setIsDeleteDialogOpen(false);
    } catch (err) {
      console.error("Failed to delete property:", err);
    }
  };

  const dataTypeBadgeColor = {
    string: "bg-blue-100 text-blue-800",
    number: "bg-green-100 text-green-800",
    boolean: "bg-purple-100 text-purple-800",
    timestamp: "bg-orange-100 text-orange-800",
  }[property.dataType] ?? "bg-gray-100 text-gray-800";

  if (isEditing) {
    return (
      <div className="p-3 border rounded-lg bg-gray-50 space-y-3">
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="flex gap-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Property name"
            className="flex-1"
          />
          <Select value={editDataType} onValueChange={setEditDataType}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          value={editDescription}
          onChange={(e) => setEditDescription(e.target.value)}
          placeholder="Description (optional)"
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`required-${property._id}`}
              checked={editIsRequired}
              onCheckedChange={(checked) => setEditIsRequired(checked === true)}
            />
            <label htmlFor={`required-${property._id}`} className="text-sm">
              Required
            </label>
          </div>
          <div className="flex gap-1">
            <Button size="sm" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between p-2 border rounded-lg hover:bg-gray-50 group">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm">{property.name}</span>
          <Badge variant="secondary" className={dataTypeBadgeColor}>
            {property.dataType}
          </Badge>
          {property.isRequired && (
            <Badge variant="outline" className="text-xs">
              required
            </Badge>
          )}
          {property.suggestedFrom === "template" && (
            <Badge variant="outline" className="text-xs text-blue-600">
              template
            </Badge>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{property.name}"?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
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
git add src/components/measurement/PropertyList.tsx
git commit -m "feat: add PropertyList component with edit and delete"
```

---

## Task 6: Integrate Properties into EntityCard

**Files:**
- Modify: `src/components/measurement/EntityCard.tsx`

**Step 1: Update EntityCard to show properties**

Add these imports to `src/components/measurement/EntityCard.tsx`:

```typescript
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AddPropertyDialog } from "./AddPropertyDialog";
import { PropertyList } from "./PropertyList";
import { ChevronDown, ChevronRight } from "lucide-react";
```

Add expanded state and property query inside the component:

```typescript
const [isExpanded, setIsExpanded] = useState(false);
const properties = useQuery(api.measurementProperties.listByEntity, { entityId: id });
```

Update the card to include expand toggle and properties section. After the stats display, add:

```typescript
<Button
  size="sm"
  variant="ghost"
  onClick={() => setIsExpanded(!isExpanded)}
  className="mt-2"
>
  {isExpanded ? (
    <ChevronDown className="h-4 w-4 mr-1" />
  ) : (
    <ChevronRight className="h-4 w-4 mr-1" />
  )}
  {isExpanded ? "Hide" : "Show"} details
</Button>
```

After CardHeader, inside the Card, add the expanded section:

```typescript
{isExpanded && (
  <div className="px-6 pb-4 space-y-4">
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">Properties</h4>
        <AddPropertyDialog entityId={id} entityName={name} />
      </div>
      <PropertyList properties={properties ?? []} />
    </div>
  </div>
)}
```

**Step 2: Verify component compiles**

Run: `npm run build`

**Step 3: Commit**

```bash
git add src/components/measurement/EntityCard.tsx
git commit -m "feat: integrate properties into EntityCard with expand/collapse"
```

---

## Task 7: Final Verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Manual testing checklist**

- [ ] Navigate to `/measurement-plan`
- [ ] Create an entity (e.g., "Account")
- [ ] Click "Show details" on the entity card
- [ ] See "Suggested properties" buttons for Account (created_at, plan_type, etc.)
- [ ] Click a suggested property - it's added with "template" badge
- [ ] Click "Add Property" - dialog opens
- [ ] Create custom property with all fields
- [ ] Try duplicate property name - error shows
- [ ] Edit a property - inline editing works
- [ ] Delete a property - confirmation dialog shows

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from manual testing"
```

---

## Testing Summary

| What | Tool | File |
|------|------|------|
| Property templates | Vitest | `src/test/propertyTemplates.test.ts` |
| Convex CRUD functions | convex-test | `convex/measurementProperties.test.ts` |

Run: `npm run test:run` to verify all tests pass.

---

## Risks & Mitigations

- **Depends on #19 (Entity Management)**: Schema assumes `measurementEntities` table exists. If running standalone, ensure entity schema is added first.
- **Template matching**: Case-insensitive pattern matching may have edge cases. Tests cover main patterns.
- **Property uniqueness**: Scoped to entity, not globally unique. Same property name allowed on different entities.
