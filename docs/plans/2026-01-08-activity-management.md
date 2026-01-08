# Activity Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add activity CRUD functionality to the Measurement Plan page with smart entity suggestion from activity name parsing.

**Architecture:** AddActivityModal with entity suggestion logic. When user types "Account Created", parse to suggest "Account" entity. Uses existing validation.ts for format validation. Integrates with EntityCard from #18 via "Add Activity" button.

**Tech Stack:** React, Radix Dialog, Convex (useMutation, useQuery), Tailwind CSS

**Dependencies:** Requires #17 (Data Model) and #18 (Measurement Plan Page) to be implemented first.

---

## Task 1: Create parseActivityName Utility

**Files:**
- Modify: `src/shared/validation.ts`
- Modify: `src/test/validation.test.ts`

**Step 1: Write failing tests for parseActivityName**

Add to `src/test/validation.test.ts`:

```typescript
// parseActivityName tests

test('parseActivityName extracts entity and action from "Account Created"', () => {
  const result = parseActivityName('Account Created')
  expect(result).toEqual({ entity: 'Account', action: 'Created' })
})

test('parseActivityName handles multi-word action "User Signed Up"', () => {
  const result = parseActivityName('User Signed Up')
  expect(result).toEqual({ entity: 'User', action: 'Signed Up' })
})

test('parseActivityName handles single word (no action)', () => {
  const result = parseActivityName('Account')
  expect(result).toEqual({ entity: 'Account', action: '' })
})

test('parseActivityName handles empty string', () => {
  const result = parseActivityName('')
  expect(result).toEqual({ entity: '', action: '' })
})

test('parseActivityName trims whitespace', () => {
  const result = parseActivityName('  Account   Created  ')
  expect(result).toEqual({ entity: 'Account', action: 'Created' })
})
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/test/validation.test.ts`
Expected: FAIL - parseActivityName is not defined

**Step 3: Implement parseActivityName**

Add to `src/shared/validation.ts`:

```typescript
/**
 * Parse an activity name into entity and action parts.
 * "Account Created" → { entity: "Account", action: "Created" }
 * "User Signed Up" → { entity: "User", action: "Signed Up" }
 */
export function parseActivityName(name: string): { entity: string; action: string } {
  const trimmed = name.trim()
  if (!trimmed) {
    return { entity: '', action: '' }
  }

  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { entity: parts[0], action: '' }
  }

  // First word is entity, rest is action
  const entity = parts[0]
  const action = parts.slice(1).join(' ')
  return { entity, action }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/test/validation.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/shared/validation.ts src/test/validation.test.ts
git commit -m "feat: add parseActivityName utility"
```

---

## Task 2: Create AddActivityModal Component - Tests

**Files:**
- Create: `src/components/measurement/AddActivityModal.test.tsx`

**Step 1: Write tests for AddActivityModal**

```typescript
import { expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddActivityModal } from "./AddActivityModal";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

// Mock Convex
const mockCreateActivity = vi.fn();
const mockCreateEntity = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: vi.fn((fn) => {
    if (fn.toString().includes("createActivity")) return mockCreateActivity;
    if (fn.toString().includes("createEntity")) return mockCreateEntity;
    return vi.fn();
  }),
}));

function createMockEntity(overrides = {}): Doc<"measurementEntities"> {
  return {
    _id: "entity1" as Id<"measurementEntities">,
    _creationTime: Date.now(),
    userId: "user1" as Id<"users">,
    name: "Account",
    createdAt: Date.now(),
    ...overrides,
  };
}

function setup(props: Partial<Parameters<typeof AddActivityModal>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const defaultProps = {
    open: true,
    onClose,
    entities: [createMockEntity()],
    preselectedEntityId: undefined,
    ...props,
  };
  render(<AddActivityModal {...defaultProps} />);
  return { user, onClose };
}

test("renders modal with activity name input", () => {
  setup();
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByLabelText(/activity name/i)).toBeInTheDocument();
});

test("suggests entity when user types activity name", async () => {
  const { user } = setup({
    entities: [createMockEntity({ name: "Account" })],
  });

  const input = screen.getByLabelText(/activity name/i);
  await user.type(input, "Account Created");

  // Should auto-select Account entity
  await waitFor(() => {
    expect(screen.getByText(/suggested.*account/i)).toBeInTheDocument();
  });
});

test("shows entity select dropdown", async () => {
  const { user } = setup({
    entities: [
      createMockEntity({ _id: "e1" as Id<"measurementEntities">, name: "Account" }),
      createMockEntity({ _id: "e2" as Id<"measurementEntities">, name: "User" }),
    ],
  });

  // Open entity select
  await user.click(screen.getByRole("combobox", { name: /entity/i }));

  expect(screen.getByRole("option", { name: "Account" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "User" })).toBeInTheDocument();
});

test("shows lifecycle slot select", () => {
  setup();
  expect(screen.getByRole("combobox", { name: /lifecycle/i })).toBeInTheDocument();
});

test("shows first value checkbox", () => {
  setup();
  expect(screen.getByRole("checkbox", { name: /first value/i })).toBeInTheDocument();
});

test("calls createActivity on submit with valid data", async () => {
  const { user, onClose } = setup({
    entities: [createMockEntity({ _id: "e1" as Id<"measurementEntities">, name: "Account" })],
  });

  await user.type(screen.getByLabelText(/activity name/i), "Account Created");
  await user.click(screen.getByRole("combobox", { name: /entity/i }));
  await user.click(screen.getByRole("option", { name: "Account" }));
  await user.click(screen.getByRole("button", { name: /add activity/i }));

  await waitFor(() => {
    expect(mockCreateActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Account Created",
        action: "Created",
        entityId: "e1",
      })
    );
  });
});

test("shows validation error for invalid format", async () => {
  const { user } = setup();

  await user.type(screen.getByLabelText(/activity name/i), "Account Create"); // Not past tense
  await user.click(screen.getByRole("button", { name: /add activity/i }));

  await waitFor(() => {
    expect(screen.getByText(/past tense/i)).toBeInTheDocument();
  });
});

test("offers to create new entity when not found", async () => {
  const { user } = setup({
    entities: [createMockEntity({ name: "Account" })],
  });

  await user.type(screen.getByLabelText(/activity name/i), "Project Created");

  await waitFor(() => {
    expect(screen.getByText(/create.*project/i)).toBeInTheDocument();
  });
});

test("disables submit when entity not selected", async () => {
  const { user } = setup({ entities: [] });

  await user.type(screen.getByLabelText(/activity name/i), "Account Created");

  expect(screen.getByRole("button", { name: /add activity/i })).toBeDisabled();
});

test("preselects entity when preselectedEntityId provided", () => {
  setup({
    entities: [createMockEntity({ _id: "e1" as Id<"measurementEntities">, name: "Account" })],
    preselectedEntityId: "e1" as Id<"measurementEntities">,
  });

  expect(screen.getByRole("combobox", { name: /entity/i })).toHaveTextContent("Account");
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/components/measurement/AddActivityModal.test.tsx`
Expected: FAIL - module not found

**Step 3: Commit test file**

```bash
git add src/components/measurement/AddActivityModal.test.tsx
git commit -m "test: add AddActivityModal tests (failing)"
```

---

## Task 3: Implement AddActivityModal Component

**Files:**
- Create: `src/components/measurement/AddActivityModal.tsx`

**Step 1: Create the AddActivityModal component**

```typescript
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { parseActivityName, validateActivityFormat } from "../../shared/validation";
import { Plus } from "lucide-react";

const LIFECYCLE_SLOTS = [
  { value: "account_creation", label: "Account Creation" },
  { value: "activation", label: "Activation" },
  { value: "core_usage", label: "Core Usage" },
  { value: "revenue", label: "Revenue" },
  { value: "churn", label: "Churn" },
];

interface AddActivityModalProps {
  open: boolean;
  onClose: () => void;
  entities: Doc<"measurementEntities">[];
  preselectedEntityId?: Id<"measurementEntities">;
}

export function AddActivityModal({
  open,
  onClose,
  entities,
  preselectedEntityId,
}: AddActivityModalProps) {
  const [activityName, setActivityName] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState<string>(
    preselectedEntityId ?? ""
  );
  const [lifecycleSlot, setLifecycleSlot] = useState<string>("");
  const [isFirstValue, setIsFirstValue] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestedEntity, setSuggestedEntity] = useState<string | null>(null);
  const [showCreateEntity, setShowCreateEntity] = useState(false);

  const createActivity = useMutation(api.measurementPlan.createActivity);
  const createEntity = useMutation(api.measurementPlan.createEntity);

  // Parse activity name and suggest entity
  useEffect(() => {
    if (!activityName.trim()) {
      setSuggestedEntity(null);
      setShowCreateEntity(false);
      return;
    }

    const { entity: parsedEntity } = parseActivityName(activityName);
    if (!parsedEntity) {
      setSuggestedEntity(null);
      setShowCreateEntity(false);
      return;
    }

    // Find matching entity (case-insensitive)
    const matchingEntity = entities.find(
      (e) => e.name.toLowerCase() === parsedEntity.toLowerCase()
    );

    if (matchingEntity) {
      setSuggestedEntity(matchingEntity.name);
      // Auto-select if no entity selected yet
      if (!selectedEntityId) {
        setSelectedEntityId(matchingEntity._id);
      }
      setShowCreateEntity(false);
    } else {
      setSuggestedEntity(null);
      setShowCreateEntity(true);
    }
  }, [activityName, entities, selectedEntityId]);

  const handleCreateEntity = async () => {
    const { entity: parsedEntity } = parseActivityName(activityName);
    if (!parsedEntity) return;

    try {
      const newEntityId = await createEntity({
        name: parsedEntity,
        suggestedFrom: "manual",
      });
      setSelectedEntityId(newEntityId);
      setShowCreateEntity(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entity");
    }
  };

  const handleSubmit = async () => {
    setError(null);

    const { entity: parsedEntity, action } = parseActivityName(activityName);

    // Validate format
    const validation = validateActivityFormat(parsedEntity, action);
    if (!validation.valid) {
      setError(validation.error ?? "Invalid activity format");
      return;
    }

    // Require entity selection
    if (!selectedEntityId) {
      setError("Please select an entity");
      return;
    }

    try {
      await createActivity({
        entityId: selectedEntityId as Id<"measurementEntities">,
        name: activityName.trim(),
        action: action,
        description: description || undefined,
        lifecycleSlot: lifecycleSlot || undefined,
        isFirstValue,
        suggestedFrom: "manual",
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create activity");
    }
  };

  const handleClose = () => {
    setActivityName("");
    setSelectedEntityId(preselectedEntityId ?? "");
    setLifecycleSlot("");
    setIsFirstValue(false);
    setDescription("");
    setError(null);
    setSuggestedEntity(null);
    setShowCreateEntity(false);
    onClose();
  };

  const canSubmit = activityName.trim() && selectedEntityId;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Activity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Activity Name */}
          <div className="space-y-2">
            <Label htmlFor="activityName">Activity Name</Label>
            <Input
              id="activityName"
              placeholder="e.g., Account Created, User Signed Up"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
            />
            {suggestedEntity && (
              <p className="text-sm text-green-600">
                Suggested entity: {suggestedEntity}
              </p>
            )}
          </div>

          {/* Entity Select */}
          <div className="space-y-2">
            <Label htmlFor="entity">Entity</Label>
            <div className="flex gap-2">
              <Select
                value={selectedEntityId}
                onValueChange={setSelectedEntityId}
              >
                <SelectTrigger id="entity" className="flex-1" aria-label="Entity">
                  <SelectValue placeholder="Select entity..." />
                </SelectTrigger>
                <SelectContent>
                  {entities.map((entity) => (
                    <SelectItem key={entity._id} value={entity._id}>
                      {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showCreateEntity && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCreateEntity}
                className="mt-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Create "{parseActivityName(activityName).entity}" entity
              </Button>
            )}
          </div>

          {/* Lifecycle Slot */}
          <div className="space-y-2">
            <Label htmlFor="lifecycle">Lifecycle Stage (optional)</Label>
            <Select value={lifecycleSlot} onValueChange={setLifecycleSlot}>
              <SelectTrigger id="lifecycle" aria-label="Lifecycle">
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {LIFECYCLE_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* First Value Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="firstValue"
              checked={isFirstValue}
              onCheckedChange={(checked) => setIsFirstValue(checked === true)}
              aria-label="First Value"
            />
            <Label htmlFor="firstValue" className="text-sm font-normal">
              Mark as First Value moment (activation)
            </Label>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Brief description of this activity"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Error Display */}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            Add Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `npm run test:run -- src/components/measurement/AddActivityModal.test.tsx`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/components/measurement/AddActivityModal.tsx
git commit -m "feat: implement AddActivityModal with entity suggestion"
```

---

## Task 4: Add "Add Activity" Button to EntityCard

**Files:**
- Modify: `src/components/measurement/EntityCard.tsx`
- Modify: `src/components/measurement/EntityCard.test.tsx`

**Step 1: Add test for Add Activity button**

Add to `src/components/measurement/EntityCard.test.tsx`:

```typescript
test("shows Add Activity button when expanded", async () => {
  const onAddActivity = vi.fn();
  const { user } = setup({ onAddActivity });

  await user.click(screen.getByRole("button", { name: /account/i }));

  expect(screen.getByRole("button", { name: /add activity/i })).toBeInTheDocument();
});

test("calls onAddActivity when Add Activity clicked", async () => {
  const onAddActivity = vi.fn();
  const { user } = setup({ onAddActivity });

  await user.click(screen.getByRole("button", { name: /account/i }));
  await user.click(screen.getByRole("button", { name: /add activity/i }));

  expect(onAddActivity).toHaveBeenCalledWith("entity1");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/measurement/EntityCard.test.tsx`
Expected: FAIL - onAddActivity prop not recognized

**Step 3: Update EntityCard to include Add Activity button**

Modify `src/components/measurement/EntityCard.tsx`:

Add `onAddActivity` to props:

```typescript
interface EntityCardProps {
  entity: Doc<"measurementEntities">;
  activities: Doc<"measurementActivities">[];
  properties: Doc<"measurementProperties">[];
  onAddActivity?: (entityId: Id<"measurementEntities">) => void;
}
```

Add button in the activities section (after the ul):

```typescript
{/* Activities Section */}
{(activities.length > 0 || onAddActivity) && (
  <div className="mt-4">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Activities
      </h4>
      {onAddActivity && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddActivity(entity._id)}
          className="h-6 px-2 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Activity
        </Button>
      )}
    </div>
    {activities.length > 0 ? (
      <ul className="space-y-2">
        {/* ... existing activity list ... */}
      </ul>
    ) : (
      <p className="text-sm text-gray-400 italic">No activities yet</p>
    )}
  </div>
)}
```

Import Button and Plus:

```typescript
import { Button } from "../ui/button";
import { ChevronDown, ChevronRight, Star, Plus } from "lucide-react";
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/measurement/EntityCard.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/measurement/EntityCard.tsx src/components/measurement/EntityCard.test.tsx
git commit -m "feat: add Add Activity button to EntityCard"
```

---

## Task 5: Integrate AddActivityModal into MeasurementPlanPage

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`

**Step 1: Add modal state and integration**

Update `src/routes/MeasurementPlanPage.tsx`:

```typescript
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { EntityCard } from "../components/measurement/EntityCard";
import { AddActivityModal } from "../components/measurement/AddActivityModal";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";

export default function MeasurementPlanPage() {
  const plan = useQuery(api.measurementPlan.getFullPlan);
  const entities = useQuery(api.measurementPlan.listEntities);

  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [preselectedEntityId, setPreselectedEntityId] = useState<
    Id<"measurementEntities"> | undefined
  >();

  const handleAddActivity = (entityId?: Id<"measurementEntities">) => {
    setPreselectedEntityId(entityId);
    setActivityModalOpen(true);
  };

  if (plan === undefined || entities === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Measurement Plan</h1>
        <Button onClick={() => handleAddActivity()} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Activity
        </Button>
      </div>

      {plan.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No entities in your measurement plan yet.</p>
          <p className="text-sm mt-2">
            Complete an interview to auto-generate your plan, or add entities manually.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {plan.map(({ entity, activities, properties }) => (
            <EntityCard
              key={entity._id}
              entity={entity}
              activities={activities}
              properties={properties}
              onAddActivity={handleAddActivity}
            />
          ))}
        </div>
      )}

      <AddActivityModal
        open={activityModalOpen}
        onClose={() => {
          setActivityModalOpen(false);
          setPreselectedEntityId(undefined);
        }}
        entities={entities}
        preselectedEntityId={preselectedEntityId}
      />
    </div>
  );
}
```

**Step 2: Verify manually**

Run: `npm run dev`
Navigate to `/measurement-plan`, verify Add Activity button and modal work.

**Step 3: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx
git commit -m "feat: integrate AddActivityModal into MeasurementPlanPage"
```

---

## Task 6: Add Edit/Delete Activity Functionality

**Files:**
- Create: `src/components/measurement/EditActivityModal.tsx`
- Modify: `src/components/measurement/EntityCard.tsx`

**Step 1: Create EditActivityModal**

```typescript
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Trash2 } from "lucide-react";

const LIFECYCLE_SLOTS = [
  { value: "account_creation", label: "Account Creation" },
  { value: "activation", label: "Activation" },
  { value: "core_usage", label: "Core Usage" },
  { value: "revenue", label: "Revenue" },
  { value: "churn", label: "Churn" },
];

interface EditActivityModalProps {
  open: boolean;
  onClose: () => void;
  activity: Doc<"measurementActivities"> | null;
}

export function EditActivityModal({
  open,
  onClose,
  activity,
}: EditActivityModalProps) {
  const [name, setName] = useState("");
  const [lifecycleSlot, setLifecycleSlot] = useState<string>("");
  const [isFirstValue, setIsFirstValue] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const updateActivity = useMutation(api.measurementPlan.updateActivity);
  const deleteActivity = useMutation(api.measurementPlan.deleteActivity);

  useEffect(() => {
    if (activity) {
      setName(activity.name);
      setLifecycleSlot(activity.lifecycleSlot ?? "");
      setIsFirstValue(activity.isFirstValue);
      setDescription(activity.description ?? "");
    }
  }, [activity]);

  const handleUpdate = async () => {
    if (!activity) return;
    setError(null);

    try {
      await updateActivity({
        id: activity._id,
        name,
        lifecycleSlot: lifecycleSlot || undefined,
        isFirstValue,
        description: description || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update activity");
    }
  };

  const handleDelete = async () => {
    if (!activity) return;

    if (!confirm("Are you sure you want to delete this activity?")) return;

    try {
      await deleteActivity({ id: activity._id });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete activity");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Activity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Activity Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lifecycle">Lifecycle Stage</Label>
            <Select value={lifecycleSlot} onValueChange={setLifecycleSlot}>
              <SelectTrigger id="lifecycle">
                <SelectValue placeholder="Select stage..." />
              </SelectTrigger>
              <SelectContent>
                {LIFECYCLE_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="firstValue"
              checked={isFirstValue}
              onCheckedChange={(checked) => setIsFirstValue(checked === true)}
            />
            <Label htmlFor="firstValue" className="text-sm font-normal">
              Mark as First Value moment
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Update EntityCard to make activities clickable**

Modify the activity list item in EntityCard to be a button:

```typescript
<li
  key={activity._id}
  className="flex items-center justify-between py-1"
>
  <button
    onClick={() => onEditActivity?.(activity)}
    className="flex items-center gap-2 hover:text-gray-900 transition-colors text-left"
  >
    <span className="text-sm text-gray-700">
      {activity.name}
    </span>
    {activity.isFirstValue && (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <Star className="w-3 h-3 fill-amber-400" />
        First Value
      </span>
    )}
  </button>
  {activity.lifecycleSlot && (
    <Badge variant="secondary" className="text-xs">
      {activity.lifecycleSlot}
    </Badge>
  )}
</li>
```

Add `onEditActivity` to props interface:

```typescript
interface EntityCardProps {
  entity: Doc<"measurementEntities">;
  activities: Doc<"measurementActivities">[];
  properties: Doc<"measurementProperties">[];
  onAddActivity?: (entityId: Id<"measurementEntities">) => void;
  onEditActivity?: (activity: Doc<"measurementActivities">) => void;
}
```

**Step 3: Integrate EditActivityModal into MeasurementPlanPage**

Add state and modal to `MeasurementPlanPage.tsx`:

```typescript
import { EditActivityModal } from "../components/measurement/EditActivityModal";

// In component:
const [editActivity, setEditActivity] = useState<Doc<"measurementActivities"> | null>(null);

// In EntityCard:
onEditActivity={setEditActivity}

// Add modal:
<EditActivityModal
  open={editActivity !== null}
  onClose={() => setEditActivity(null)}
  activity={editActivity}
/>
```

**Step 4: Commit**

```bash
git add src/components/measurement/EditActivityModal.tsx src/components/measurement/EntityCard.tsx src/routes/MeasurementPlanPage.tsx
git commit -m "feat: add edit/delete activity functionality"
```

---

## Task 7: Final Verification

**Step 1: Run full test suite**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Manual verification**

Run: `npm run dev`
1. Navigate to `/measurement-plan`
2. Click "Add Activity" button
3. Type "Account Created" - verify entity suggestion appears
4. Submit - verify activity appears in entity card
5. Click activity to edit - verify modal opens with data
6. Test lifecycle slot and first value toggle
7. Test delete functionality

**Step 3: Final commit if cleanup needed**

```bash
git status
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | parseActivityName utility | 5 tests |
| 2 | AddActivityModal tests | 10 tests |
| 3 | AddActivityModal implementation | - |
| 4 | EntityCard Add Activity button | 2 tests |
| 5 | Page integration | - |
| 6 | Edit/Delete functionality | - |
| 7 | Final verification | - |

**Total: 17 tests covering parsing, modal behavior, and entity interaction**

**Dependencies:**
- #17 (Data Model) - uses `createActivity`, `updateActivity`, `deleteActivity` mutations
- #18 (Measurement Plan Page) - integrates into existing page and EntityCard
