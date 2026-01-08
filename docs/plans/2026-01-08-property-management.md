# Property Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add property CRUD functionality to the Measurement Plan page with template suggestions based on entity type.

**Architecture:** Template-based property suggestions stored in a pure TypeScript file. AddPropertyModal shows checkboxes for suggested properties plus custom property form. Properties belong to entities (not activities). Uses existing Convex CRUD from #17.

**Tech Stack:** React, Radix Dialog/Checkbox, Convex (useMutation, useQuery), Tailwind CSS

**Dependencies:** Requires #17 (Data Model) and #18 (Measurement Plan Page) to be implemented first.

---

## Task 1: Create Property Templates

**Files:**
- Create: `src/lib/propertyTemplates.ts`
- Create: `src/lib/propertyTemplates.test.ts`

**Step 1: Write tests for getPropertyTemplates**

Create `src/lib/propertyTemplates.test.ts`:

```typescript
import { expect, test } from "vitest";
import { getPropertyTemplates, DATA_TYPES } from "./propertyTemplates";

test("returns Account templates for Account entity", () => {
  const templates = getPropertyTemplates("Account");
  expect(templates.length).toBeGreaterThan(0);
  expect(templates.some((t) => t.name === "created_at")).toBe(true);
  expect(templates.some((t) => t.name === "plan_type")).toBe(true);
});

test("returns Account templates for Organization entity (synonym)", () => {
  const templates = getPropertyTemplates("Organization");
  expect(templates.some((t) => t.name === "plan_type")).toBe(true);
});

test("returns User templates for User entity", () => {
  const templates = getPropertyTemplates("User");
  expect(templates.some((t) => t.name === "email")).toBe(true);
  expect(templates.some((t) => t.name === "role")).toBe(true);
});

test("returns Subscription templates for Subscription entity", () => {
  const templates = getPropertyTemplates("Subscription");
  expect(templates.some((t) => t.name === "billing_interval")).toBe(true);
});

test("returns generic templates for unknown entity", () => {
  const templates = getPropertyTemplates("Widget");
  expect(templates.some((t) => t.name === "created_at")).toBe(true);
  expect(templates.length).toBeLessThan(getPropertyTemplates("Account").length);
});

test("is case-insensitive", () => {
  const templates1 = getPropertyTemplates("account");
  const templates2 = getPropertyTemplates("ACCOUNT");
  expect(templates1).toEqual(templates2);
});

test("DATA_TYPES contains expected types", () => {
  expect(DATA_TYPES).toContain("string");
  expect(DATA_TYPES).toContain("number");
  expect(DATA_TYPES).toContain("boolean");
  expect(DATA_TYPES).toContain("timestamp");
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/propertyTemplates.test.ts`
Expected: FAIL - module not found

**Step 3: Implement propertyTemplates**

Create `src/lib/propertyTemplates.ts`:

```typescript
export const DATA_TYPES = ["string", "number", "boolean", "timestamp"] as const;
export type DataType = (typeof DATA_TYPES)[number];

export interface PropertyTemplate {
  name: string;
  dataType: DataType;
  description: string;
  isRequired: boolean;
}

// Entity patterns map to template sets
const ENTITY_TEMPLATES: Record<string, PropertyTemplate[]> = {
  account: [
    { name: "created_at", dataType: "timestamp", description: "When the account was created", isRequired: true },
    { name: "plan_type", dataType: "string", description: "Subscription plan tier", isRequired: true },
    { name: "mrr", dataType: "number", description: "Monthly recurring revenue", isRequired: false },
    { name: "seats", dataType: "number", description: "Number of seats/licenses", isRequired: false },
    { name: "owner_email", dataType: "string", description: "Account owner email", isRequired: true },
  ],
  user: [
    { name: "email", dataType: "string", description: "User email address", isRequired: true },
    { name: "created_at", dataType: "timestamp", description: "When the user signed up", isRequired: true },
    { name: "role", dataType: "string", description: "User role (admin, member, etc.)", isRequired: false },
    { name: "last_active_at", dataType: "timestamp", description: "Last activity timestamp", isRequired: false },
  ],
  subscription: [
    { name: "started_at", dataType: "timestamp", description: "Subscription start date", isRequired: true },
    { name: "plan_name", dataType: "string", description: "Name of the plan", isRequired: true },
    { name: "billing_interval", dataType: "string", description: "Monthly, yearly, etc.", isRequired: true },
    { name: "amount", dataType: "number", description: "Subscription amount", isRequired: false },
  ],
  project: [
    { name: "created_at", dataType: "timestamp", description: "When the project was created", isRequired: true },
    { name: "owner_id", dataType: "string", description: "ID of the project owner", isRequired: true },
    { name: "collaborator_count", dataType: "number", description: "Number of collaborators", isRequired: false },
  ],
};

// Synonyms that map to the same templates
const ENTITY_SYNONYMS: Record<string, string> = {
  organization: "account",
  company: "account",
  workspace: "account",
  team: "account",
  member: "user",
  plan: "subscription",
  document: "project",
  item: "project",
  file: "project",
};

// Generic templates for unknown entities
const GENERIC_TEMPLATES: PropertyTemplate[] = [
  { name: "created_at", dataType: "timestamp", description: "When this was created", isRequired: true },
  { name: "updated_at", dataType: "timestamp", description: "Last update timestamp", isRequired: false },
];

/**
 * Get property templates for a given entity name.
 * Returns templates based on entity name patterns, or generic templates for unknown entities.
 */
export function getPropertyTemplates(entityName: string): PropertyTemplate[] {
  const normalized = entityName.toLowerCase().trim();

  // Check direct match
  if (ENTITY_TEMPLATES[normalized]) {
    return ENTITY_TEMPLATES[normalized];
  }

  // Check synonyms
  const synonym = ENTITY_SYNONYMS[normalized];
  if (synonym && ENTITY_TEMPLATES[synonym]) {
    return ENTITY_TEMPLATES[synonym];
  }

  // Return generic templates
  return GENERIC_TEMPLATES;
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/propertyTemplates.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/propertyTemplates.ts src/lib/propertyTemplates.test.ts
git commit -m "feat: add property templates based on entity type"
```

---

## Task 2: Create AddPropertyModal Component - Tests

**Files:**
- Create: `src/components/measurement/AddPropertyModal.test.tsx`

**Step 1: Write tests for AddPropertyModal**

```typescript
import { expect, test, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPropertyModal } from "./AddPropertyModal";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

// Mock Convex
const mockCreateProperty = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => mockCreateProperty),
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

function setup(props: Partial<Parameters<typeof AddPropertyModal>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const defaultProps = {
    open: true,
    onClose,
    entity: createMockEntity(),
    existingProperties: [],
    ...props,
  };
  render(<AddPropertyModal {...defaultProps} />);
  return { user, onClose };
}

test("renders modal with entity name in title", () => {
  setup({ entity: createMockEntity({ name: "Account" }) });
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText(/add property.*account/i)).toBeInTheDocument();
});

test("shows template suggestions for Account entity", () => {
  setup({ entity: createMockEntity({ name: "Account" }) });

  expect(screen.getByText("created_at")).toBeInTheDocument();
  expect(screen.getByText("plan_type")).toBeInTheDocument();
  expect(screen.getByText("owner_email")).toBeInTheDocument();
});

test("shows checkboxes for each template", () => {
  setup({ entity: createMockEntity({ name: "Account" }) });

  const checkboxes = screen.getAllByRole("checkbox");
  expect(checkboxes.length).toBeGreaterThan(0);
});

test("shows custom property form", () => {
  setup();

  expect(screen.getByLabelText(/custom property/i)).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: /data type/i })).toBeInTheDocument();
});

test("excludes already existing properties from templates", () => {
  setup({
    entity: createMockEntity({ name: "Account" }),
    existingProperties: [
      {
        _id: "p1" as Id<"measurementProperties">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        entityId: "entity1" as Id<"measurementEntities">,
        name: "created_at",
        dataType: "timestamp",
        isRequired: true,
        createdAt: Date.now(),
      },
    ],
  });

  // created_at should not be in the list since it already exists
  const suggestions = screen.getByTestId("template-suggestions");
  expect(within(suggestions).queryByText("created_at")).not.toBeInTheDocument();
});

test("creates selected template properties on submit", async () => {
  const { user, onClose } = setup({
    entity: createMockEntity({ _id: "e1" as Id<"measurementEntities">, name: "Account" }),
  });

  // Check the first template
  const checkboxes = screen.getAllByRole("checkbox");
  await user.click(checkboxes[0]);

  await user.click(screen.getByRole("button", { name: /add properties/i }));

  await waitFor(() => {
    expect(mockCreateProperty).toHaveBeenCalled();
  });
});

test("creates custom property when filled out", async () => {
  const { user, onClose } = setup({
    entity: createMockEntity({ _id: "e1" as Id<"measurementEntities">, name: "Account" }),
  });

  await user.type(screen.getByLabelText(/custom property/i), "custom_field");
  await user.click(screen.getByRole("combobox", { name: /data type/i }));
  await user.click(screen.getByRole("option", { name: "string" }));

  await user.click(screen.getByRole("button", { name: /add properties/i }));

  await waitFor(() => {
    expect(mockCreateProperty).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "custom_field",
        dataType: "string",
      })
    );
  });
});

test("disables submit when nothing selected", () => {
  setup();
  expect(screen.getByRole("button", { name: /add properties/i })).toBeDisabled();
});

test("shows required badge for required templates", () => {
  setup({ entity: createMockEntity({ name: "Account" }) });

  // created_at and owner_email are required in Account templates
  expect(screen.getAllByText(/required/i).length).toBeGreaterThan(0);
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/components/measurement/AddPropertyModal.test.tsx`
Expected: FAIL - module not found

**Step 3: Commit test file**

```bash
git add src/components/measurement/AddPropertyModal.test.tsx
git commit -m "test: add AddPropertyModal tests (failing)"
```

---

## Task 3: Implement AddPropertyModal Component

**Files:**
- Create: `src/components/measurement/AddPropertyModal.tsx`

**Step 1: Create the AddPropertyModal component**

```typescript
import { useState, useMemo } from "react";
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
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  getPropertyTemplates,
  DATA_TYPES,
  type PropertyTemplate,
} from "../../lib/propertyTemplates";

interface AddPropertyModalProps {
  open: boolean;
  onClose: () => void;
  entity: Doc<"measurementEntities">;
  existingProperties: Doc<"measurementProperties">[];
}

export function AddPropertyModal({
  open,
  onClose,
  entity,
  existingProperties,
}: AddPropertyModalProps) {
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
    new Set()
  );
  const [customName, setCustomName] = useState("");
  const [customDataType, setCustomDataType] = useState<string>("");
  const [customDescription, setCustomDescription] = useState("");
  const [customRequired, setCustomRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createProperty = useMutation(api.measurementPlan.createProperty);

  // Get templates and filter out existing properties
  const existingNames = new Set(existingProperties.map((p) => p.name.toLowerCase()));
  const templates = useMemo(() => {
    return getPropertyTemplates(entity.name).filter(
      (t) => !existingNames.has(t.name.toLowerCase())
    );
  }, [entity.name, existingNames]);

  const toggleTemplate = (name: string) => {
    const newSet = new Set(selectedTemplates);
    if (newSet.has(name)) {
      newSet.delete(name);
    } else {
      newSet.add(name);
    }
    setSelectedTemplates(newSet);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      // Create selected template properties
      for (const name of selectedTemplates) {
        const template = templates.find((t) => t.name === name);
        if (template) {
          await createProperty({
            entityId: entity._id,
            name: template.name,
            dataType: template.dataType,
            description: template.description,
            isRequired: template.isRequired,
            suggestedFrom: "template",
          });
        }
      }

      // Create custom property if specified
      if (customName.trim() && customDataType) {
        await createProperty({
          entityId: entity._id,
          name: customName.trim(),
          dataType: customDataType,
          description: customDescription || undefined,
          isRequired: customRequired,
          suggestedFrom: "manual",
        });
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create properties");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplates(new Set());
    setCustomName("");
    setCustomDataType("");
    setCustomDescription("");
    setCustomRequired(false);
    setError(null);
    onClose();
  };

  const canSubmit =
    selectedTemplates.size > 0 || (customName.trim() && customDataType);

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Property to {entity.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Template Suggestions */}
          {templates.length > 0 && (
            <div>
              <Label className="text-sm font-medium">
                Suggested Properties for "{entity.name}"
              </Label>
              <div
                className="mt-2 space-y-2"
                data-testid="template-suggestions"
              >
                {templates.map((template) => (
                  <div
                    key={template.name}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <Checkbox
                      id={`template-${template.name}`}
                      checked={selectedTemplates.has(template.name)}
                      onCheckedChange={() => toggleTemplate(template.name)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor={`template-${template.name}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {template.name}
                        </label>
                        <Badge variant="outline" className="text-xs">
                          {template.dataType}
                        </Badge>
                        {template.isRequired && (
                          <Badge variant="secondary" className="text-xs">
                            required
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {template.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {templates.length === 0 && (
            <p className="text-sm text-gray-500">
              No suggested templates available. Add a custom property below.
            </p>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">or add custom</span>
            </div>
          </div>

          {/* Custom Property Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customName">Custom Property Name</Label>
              <Input
                id="customName"
                placeholder="e.g., industry, source"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dataType">Data Type</Label>
                <Select value={customDataType} onValueChange={setCustomDataType}>
                  <SelectTrigger id="dataType" aria-label="Data type">
                    <SelectValue placeholder="Select type..." />
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
                <Label htmlFor="customDescription">Description</Label>
                <Input
                  id="customDescription"
                  placeholder="Optional"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="customRequired"
                checked={customRequired}
                onCheckedChange={(checked) => setCustomRequired(checked === true)}
              />
              <Label htmlFor="customRequired" className="text-sm font-normal">
                Required for analytics
              </Label>
            </div>
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
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Adding..." : "Add Properties"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `npm run test:run -- src/components/measurement/AddPropertyModal.test.tsx`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/components/measurement/AddPropertyModal.tsx
git commit -m "feat: implement AddPropertyModal with template suggestions"
```

---

## Task 4: Add "Add Property" Button to EntityCard

**Files:**
- Modify: `src/components/measurement/EntityCard.tsx`
- Modify: `src/components/measurement/EntityCard.test.tsx`

**Step 1: Add test for Add Property button**

Add to `src/components/measurement/EntityCard.test.tsx`:

```typescript
test("shows Add Property button when expanded", async () => {
  const onAddProperty = vi.fn();
  const { user } = setup({ onAddProperty });

  await user.click(screen.getByRole("button", { name: /account/i }));

  expect(screen.getByRole("button", { name: /add property/i })).toBeInTheDocument();
});

test("calls onAddProperty when Add Property clicked", async () => {
  const onAddProperty = vi.fn();
  const { user } = setup({ onAddProperty });

  await user.click(screen.getByRole("button", { name: /account/i }));
  await user.click(screen.getByRole("button", { name: /add property/i }));

  expect(onAddProperty).toHaveBeenCalledWith("entity1");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/measurement/EntityCard.test.tsx`
Expected: FAIL - onAddProperty prop not recognized

**Step 3: Update EntityCard props**

Add to EntityCard props interface:

```typescript
interface EntityCardProps {
  entity: Doc<"measurementEntities">;
  activities: Doc<"measurementActivities">[];
  properties: Doc<"measurementProperties">[];
  onAddActivity?: (entityId: Id<"measurementEntities">) => void;
  onEditActivity?: (activity: Doc<"measurementActivities">) => void;
  onAddProperty?: (entityId: Id<"measurementEntities">) => void;
  onEditProperty?: (property: Doc<"measurementProperties">) => void;
}
```

**Step 4: Add button in properties section**

Update the properties section in EntityCard:

```typescript
{/* Properties Section */}
{(properties.length > 0 || onAddProperty) && (
  <div className="mt-4">
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        Properties
      </h4>
      {onAddProperty && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onAddProperty(entity._id)}
          className="h-6 px-2 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Property
        </Button>
      )}
    </div>
    {properties.length > 0 ? (
      <ul className="space-y-2">
        {properties.map((property) => (
          <li
            key={property._id}
            className="flex items-center justify-between py-1"
          >
            <button
              onClick={() => onEditProperty?.(property)}
              className="text-sm text-gray-700 hover:text-gray-900 transition-colors text-left"
            >
              {property.name}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {property.dataType}
              </span>
              {property.isRequired && (
                <Badge variant="outline" className="text-xs">
                  required
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-gray-400 italic">No properties yet</p>
    )}
  </div>
)}
```

**Step 5: Run tests to verify they pass**

Run: `npm run test:run -- src/components/measurement/EntityCard.test.tsx`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/components/measurement/EntityCard.tsx src/components/measurement/EntityCard.test.tsx
git commit -m "feat: add Add Property button to EntityCard"
```

---

## Task 5: Integrate AddPropertyModal into MeasurementPlanPage

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
import { EditActivityModal } from "../components/measurement/EditActivityModal";
import { AddPropertyModal } from "../components/measurement/AddPropertyModal";
import { Button } from "../components/ui/button";
import { Plus } from "lucide-react";
import type { Doc, Id } from "../../convex/_generated/dataModel";

export default function MeasurementPlanPage() {
  const plan = useQuery(api.measurementPlan.getFullPlan);
  const entities = useQuery(api.measurementPlan.listEntities);

  // Activity modal state
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [preselectedEntityId, setPreselectedEntityId] = useState<
    Id<"measurementEntities"> | undefined
  >();
  const [editActivity, setEditActivity] = useState<Doc<"measurementActivities"> | null>(null);

  // Property modal state
  const [propertyModalOpen, setPropertyModalOpen] = useState(false);
  const [propertyEntity, setPropertyEntity] = useState<{
    entity: Doc<"measurementEntities">;
    properties: Doc<"measurementProperties">[];
  } | null>(null);

  const handleAddActivity = (entityId?: Id<"measurementEntities">) => {
    setPreselectedEntityId(entityId);
    setActivityModalOpen(true);
  };

  const handleAddProperty = (entityId: Id<"measurementEntities">) => {
    const planItem = plan?.find((p) => p.entity._id === entityId);
    if (planItem) {
      setPropertyEntity({
        entity: planItem.entity,
        properties: planItem.properties,
      });
      setPropertyModalOpen(true);
    }
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
              onEditActivity={setEditActivity}
              onAddProperty={handleAddProperty}
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

      <EditActivityModal
        open={editActivity !== null}
        onClose={() => setEditActivity(null)}
        activity={editActivity}
      />

      {propertyEntity && (
        <AddPropertyModal
          open={propertyModalOpen}
          onClose={() => {
            setPropertyModalOpen(false);
            setPropertyEntity(null);
          }}
          entity={propertyEntity.entity}
          existingProperties={propertyEntity.properties}
        />
      )}
    </div>
  );
}
```

**Step 2: Verify manually**

Run: `npm run dev`
Navigate to `/measurement-plan`, verify Add Property button and modal work.

**Step 3: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx
git commit -m "feat: integrate AddPropertyModal into MeasurementPlanPage"
```

---

## Task 6: Add Edit/Delete Property Functionality

**Files:**
- Create: `src/components/measurement/EditPropertyModal.tsx`
- Modify: `src/routes/MeasurementPlanPage.tsx`

**Step 1: Create EditPropertyModal**

```typescript
import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
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
import { DATA_TYPES } from "../../lib/propertyTemplates";
import { Trash2 } from "lucide-react";

interface EditPropertyModalProps {
  open: boolean;
  onClose: () => void;
  property: Doc<"measurementProperties"> | null;
}

export function EditPropertyModal({
  open,
  onClose,
  property,
}: EditPropertyModalProps) {
  const [name, setName] = useState("");
  const [dataType, setDataType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProperty = useMutation(api.measurementPlan.updateProperty);
  const deleteProperty = useMutation(api.measurementPlan.deleteProperty);

  useEffect(() => {
    if (property) {
      setName(property.name);
      setDataType(property.dataType);
      setDescription(property.description ?? "");
      setIsRequired(property.isRequired);
    }
  }, [property]);

  const handleUpdate = async () => {
    if (!property) return;
    setError(null);

    try {
      await updateProperty({
        id: property._id,
        name,
        dataType,
        description: description || undefined,
        isRequired,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update property");
    }
  };

  const handleDelete = async () => {
    if (!property) return;

    if (!confirm("Are you sure you want to delete this property?")) return;

    try {
      await deleteProperty({ id: property._id });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete property");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Property</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Property Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataType">Data Type</Label>
            <Select value={dataType} onValueChange={setDataType}>
              <SelectTrigger id="dataType">
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
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isRequired"
              checked={isRequired}
              onCheckedChange={(checked) => setIsRequired(checked === true)}
            />
            <Label htmlFor="isRequired" className="text-sm font-normal">
              Required for analytics
            </Label>
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

**Step 2: Integrate into MeasurementPlanPage**

Add to `MeasurementPlanPage.tsx`:

```typescript
import { EditPropertyModal } from "../components/measurement/EditPropertyModal";

// Add state:
const [editProperty, setEditProperty] = useState<Doc<"measurementProperties"> | null>(null);

// In EntityCard:
onEditProperty={setEditProperty}

// Add modal:
<EditPropertyModal
  open={editProperty !== null}
  onClose={() => setEditProperty(null)}
  property={editProperty}
/>
```

**Step 3: Commit**

```bash
git add src/components/measurement/EditPropertyModal.tsx src/routes/MeasurementPlanPage.tsx
git commit -m "feat: add edit/delete property functionality"
```

---

## Task 7: Final Verification

**Step 1: Run full test suite**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Manual verification**

Run: `npm run dev`
1. Navigate to `/measurement-plan`
2. Add an entity (if not already present)
3. Click "Add Property" on an entity card
4. Verify template suggestions appear (e.g., for Account: created_at, plan_type, etc.)
5. Check some templates, submit
6. Verify properties appear in the entity card
7. Add a custom property
8. Click a property to edit
9. Test delete functionality

**Step 3: Final commit if cleanup needed**

```bash
git status
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Property templates utility | 7 tests |
| 2 | AddPropertyModal tests | 10 tests |
| 3 | AddPropertyModal implementation | - |
| 4 | EntityCard Add Property button | 2 tests |
| 5 | Page integration | - |
| 6 | Edit/Delete functionality | - |
| 7 | Final verification | - |

**Total: 19 tests covering templates, modal behavior, and entity interaction**

**Dependencies:**
- #17 (Data Model) - uses `createProperty`, `updateProperty`, `deleteProperty` mutations
- #18 (Measurement Plan Page) - integrates into existing page and EntityCard
