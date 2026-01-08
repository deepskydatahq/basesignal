# Measurement Plan Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone `/measurement-plan` page with hierarchical view of entities, activities, and properties.

**Architecture:** New route and page component using existing UI primitives (Card, Collapsible, Badge). Uses `getFullPlan` query from measurementPlan.ts (created in #17). Read-only view with collapsible entity cards.

**Tech Stack:** React, React Router, Convex (useQuery), Radix Collapsible, Tailwind CSS

**Dependencies:** Requires #17 (Data Model: Measurement Plan Schema) to be implemented first.

---

## Task 1: Create MeasurementPlanPage Route

**Files:**
- Create: `src/routes/MeasurementPlanPage.tsx`
- Modify: `src/App.tsx`

**Step 1: Write failing test for route existence**

Create `src/routes/MeasurementPlanPage.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConvexProvider } from "convex/react";
import MeasurementPlanPage from "./MeasurementPlanPage";

// Mock Convex
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(() => []),
  };
});

function setup() {
  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );
}

test("renders page title", () => {
  setup();
  expect(screen.getByRole("heading", { name: /measurement plan/i })).toBeInTheDocument();
});

test("shows empty state when no entities", () => {
  setup();
  expect(screen.getByText(/no entities/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/routes/MeasurementPlanPage.test.tsx`
Expected: FAIL - module not found

**Step 3: Create minimal MeasurementPlanPage**

Create `src/routes/MeasurementPlanPage.tsx`:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function MeasurementPlanPage() {
  const plan = useQuery(api.measurementPlan.getFullPlan);

  if (plan === undefined) {
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
          {plan.map(({ entity }) => (
            <div key={entity._id} className="p-4 border rounded-lg">
              {entity.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/routes/MeasurementPlanPage.test.tsx`
Expected: PASS

**Step 5: Add route to App.tsx**

Modify `src/App.tsx`:

Add import at top:
```typescript
import MeasurementPlanPage from './routes/MeasurementPlanPage'
```

Add route inside DashboardLayout (after journeys route, around line 137):
```typescript
<Route path="measurement-plan" element={<MeasurementPlanPage />} />
```

**Step 6: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx src/App.tsx
git commit -m "feat: add measurement plan page route"
```

---

## Task 2: Add Navigation to Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

**Step 1: Add ClipboardList icon import**

Modify import statement (line 5):
```typescript
import { Home, Route, Settings, Lock, ClipboardList } from 'lucide-react'
```

**Step 2: Add nav item for Measurement Plan**

Modify `navItems` array (after Journeys item, around line 22):
```typescript
const navItems: NavItemConfig[] = [
  { icon: Home, label: 'Home', to: '/', requiresSetupComplete: true },
  { icon: Route, label: 'Journeys', to: '/journeys', requiresSetupComplete: true },
  { icon: ClipboardList, label: 'Measurement Plan', to: '/measurement-plan', requiresSetupComplete: true },
]
```

**Step 3: Verify navigation works**

Run: `npm run dev`
Navigate to `/measurement-plan` via sidebar. Expected: Page renders.

**Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add measurement plan to sidebar navigation"
```

---

## Task 3: Create EntityCard Component with Collapsible

**Files:**
- Create: `src/components/measurement/EntityCard.tsx`
- Create: `src/components/measurement/EntityCard.test.tsx`

**Step 1: Write tests for EntityCard**

Create `src/components/measurement/EntityCard.test.tsx`:

```typescript
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityCard } from "./EntityCard";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

function createMockEntity(overrides = {}): Doc<"measurementEntities"> {
  return {
    _id: "entity1" as Id<"measurementEntities">,
    _creationTime: Date.now(),
    userId: "user1" as Id<"users">,
    name: "Account",
    description: "User accounts",
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockActivity(overrides = {}): Doc<"measurementActivities"> {
  return {
    _id: "activity1" as Id<"measurementActivities">,
    _creationTime: Date.now(),
    userId: "user1" as Id<"users">,
    entityId: "entity1" as Id<"measurementEntities">,
    name: "Account Created",
    action: "Created",
    isFirstValue: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockProperty(overrides = {}): Doc<"measurementProperties"> {
  return {
    _id: "property1" as Id<"measurementProperties">,
    _creationTime: Date.now(),
    userId: "user1" as Id<"users">,
    entityId: "entity1" as Id<"measurementEntities">,
    name: "plan_type",
    dataType: "string",
    isRequired: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

function setup(props: Partial<Parameters<typeof EntityCard>[0]> = {}) {
  const user = userEvent.setup();
  const defaultProps = {
    entity: createMockEntity(),
    activities: [],
    properties: [],
    ...props,
  };
  render(<EntityCard {...defaultProps} />);
  return { user };
}

test("renders entity name as heading", () => {
  setup({ entity: createMockEntity({ name: "Account" }) });
  expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
});

test("shows activity and property counts", () => {
  setup({
    activities: [createMockActivity(), createMockActivity({ _id: "a2" as Id<"measurementActivities">, name: "Account Activated" })],
    properties: [createMockProperty()],
  });

  expect(screen.getByText(/2 activities/i)).toBeInTheDocument();
  expect(screen.getByText(/1 property/i)).toBeInTheDocument();
});

test("expands to show activities when clicked", async () => {
  const { user } = setup({
    activities: [createMockActivity({ name: "Account Created" })],
  });

  // Initially collapsed - activities not visible
  expect(screen.queryByText("Account Created")).not.toBeInTheDocument();

  // Click to expand
  await user.click(screen.getByRole("button", { name: /account/i }));

  // Now visible
  expect(screen.getByText("Account Created")).toBeInTheDocument();
});

test("shows lifecycle slot badge for activities", async () => {
  const { user } = setup({
    activities: [createMockActivity({ lifecycleSlot: "activation" })],
  });

  await user.click(screen.getByRole("button", { name: /account/i }));

  expect(screen.getByText("activation")).toBeInTheDocument();
});

test("shows first value indicator", async () => {
  const { user } = setup({
    activities: [createMockActivity({ isFirstValue: true })],
  });

  await user.click(screen.getByRole("button", { name: /account/i }));

  expect(screen.getByText(/first value/i)).toBeInTheDocument();
});

test("shows property data type and required flag", async () => {
  const { user } = setup({
    properties: [createMockProperty({ name: "plan_type", dataType: "string", isRequired: true })],
  });

  await user.click(screen.getByRole("button", { name: /account/i }));

  expect(screen.getByText("plan_type")).toBeInTheDocument();
  expect(screen.getByText("string")).toBeInTheDocument();
  expect(screen.getByText("required")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/components/measurement/EntityCard.test.tsx`
Expected: FAIL - module not found

**Step 3: Create EntityCard component**

Create `src/components/measurement/EntityCard.tsx`:

```typescript
import { useState } from "react";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import type { Doc } from "../../../convex/_generated/dataModel";

interface EntityCardProps {
  entity: Doc<"measurementEntities">;
  activities: Doc<"measurementActivities">[];
  properties: Doc<"measurementProperties">[];
}

export function EntityCard({ entity, activities, properties }: EntityCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activityCount = activities.length;
  const propertyCount = properties.length;

  return (
    <Card className="p-0 overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
            aria-label={entity.name}
          >
            <div className="flex items-center gap-3">
              {isOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <h3 className="font-medium text-gray-900">{entity.name}</h3>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{activityCount} {activityCount === 1 ? "activity" : "activities"}</span>
              <span>·</span>
              <span>{propertyCount} {propertyCount === 1 ? "property" : "properties"}</span>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-gray-100">
            {/* Activities Section */}
            {activities.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Activities
                </h4>
                <ul className="space-y-2">
                  {activities.map((activity) => (
                    <li
                      key={activity._id}
                      className="flex items-center justify-between py-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">
                          {activity.name}
                        </span>
                        {activity.isFirstValue && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <Star className="w-3 h-3 fill-amber-400" />
                            First Value
                          </span>
                        )}
                      </div>
                      {activity.lifecycleSlot && (
                        <Badge variant="secondary" className="text-xs">
                          {activity.lifecycleSlot}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Properties Section */}
            {properties.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Properties
                </h4>
                <ul className="space-y-2">
                  {properties.map((property) => (
                    <li
                      key={property._id}
                      className="flex items-center justify-between py-1"
                    >
                      <span className="text-sm text-gray-700">
                        {property.name}
                      </span>
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
              </div>
            )}

            {/* Empty state */}
            {activities.length === 0 && properties.length === 0 && (
              <div className="mt-4 text-sm text-gray-500 text-center py-4">
                No activities or properties defined yet.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/measurement/EntityCard.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/measurement/EntityCard.tsx src/components/measurement/EntityCard.test.tsx
git commit -m "feat: add EntityCard component with collapsible content"
```

---

## Task 4: Integrate EntityCard into MeasurementPlanPage

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`
- Modify: `src/routes/MeasurementPlanPage.test.tsx`

**Step 1: Add test for entity cards rendering**

Add to `src/routes/MeasurementPlanPage.test.tsx`:

```typescript
import { useQuery } from "convex/react";

// Update mock to return entities
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

// Helper to set mock return value
function setMockPlan(plan: any[]) {
  (useQuery as any).mockReturnValue(plan);
}

test("renders entity cards when data exists", () => {
  setMockPlan([
    {
      entity: {
        _id: "e1",
        _creationTime: Date.now(),
        userId: "u1",
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [],
      properties: [],
    },
    {
      entity: {
        _id: "e2",
        _creationTime: Date.now(),
        userId: "u1",
        name: "User",
        createdAt: Date.now(),
      },
      activities: [],
      properties: [],
    },
  ]);

  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "User" })).toBeInTheDocument();
});
```

**Step 2: Update MeasurementPlanPage to use EntityCard**

Modify `src/routes/MeasurementPlanPage.tsx`:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { EntityCard } from "../components/measurement/EntityCard";

export default function MeasurementPlanPage() {
  const plan = useQuery(api.measurementPlan.getFullPlan);

  if (plan === undefined) {
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Run all tests**

Run: `npm run test:run -- src/routes/MeasurementPlanPage.test.tsx src/components/measurement/EntityCard.test.tsx`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx
git commit -m "feat: integrate EntityCard into MeasurementPlanPage"
```

---

## Task 5: Final Verification

**Step 1: Run full test suite**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Manual verification**

Run: `npm run dev`
1. Navigate to `/measurement-plan`
2. Verify empty state shows
3. (If #17 is implemented) Add an entity via Convex dashboard
4. Verify entity card appears and is collapsible

**Step 3: Final commit if any cleanup needed**

```bash
git status
# If clean, no action needed
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Create MeasurementPlanPage route | 2 tests |
| 2 | Add sidebar navigation | Manual |
| 3 | Create EntityCard component | 7 tests |
| 4 | Integrate EntityCard | 1 test |
| 5 | Final verification | - |

**Total: 10 tests covering page and component behavior**

**Note:** This is a read-only view. CRUD functionality will be added in issues #19 (Entity Management), #20 (Activity Management), and #21 (Property Management).
