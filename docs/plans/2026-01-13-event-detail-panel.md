# Event Detail Panel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an event detail panel to the Measurement Plan page that shows all metrics derived from a selected activity, enabling bidirectional metric-event traceability.

**Architecture:** When a user clicks an activity in the Measurement Plan, a slide-over panel opens showing the activity name and a "Derived Metrics" section. Metrics are matched using a temporary client-side bridge that maps `measurementActivities.name` → `stages.name` → `metrics.relatedActivityId`. Each metric is clickable and navigates to the Metric Catalog with a query param.

**Tech Stack:** React, Convex (useQuery), React Router (useNavigate), Tailwind CSS, Lucide icons

---

## Task 1: Write ActivityDetailPanel component test - renders header and close button

**Files:**
- Create: `src/components/measurement/ActivityDetailPanel.test.tsx`
- Create: `src/components/measurement/ActivityDetailPanel.tsx`

**Step 1: Write the failing test**

Create test file `src/components/measurement/ActivityDetailPanel.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityDetailPanel } from "./ActivityDetailPanel";

const mockActivity = {
  name: "Account Created",
  entityName: "Account",
  lifecycleSlot: "account_creation",
};

function setup(props: Partial<Parameters<typeof ActivityDetailPanel>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const onMetricClick = props.onMetricClick ?? vi.fn();
  const defaultProps = {
    activity: mockActivity,
    derivedMetrics: [],
    onClose,
    onMetricClick,
    ...props,
  };
  render(<ActivityDetailPanel {...defaultProps} />);
  return { user, onClose, onMetricClick };
}

test("renders activity name in header", () => {
  setup();

  expect(screen.getByText("Account Created")).toBeInTheDocument();
});

test("calls onClose when close button is clicked", async () => {
  const onClose = vi.fn();
  const { user } = setup({ onClose });

  await user.click(screen.getByRole("button", { name: /close/i }));

  expect(onClose).toHaveBeenCalledOnce();
});

test("renders nothing when activity is null", () => {
  const { container } = render(
    <ActivityDetailPanel
      activity={null}
      derivedMetrics={[]}
      onClose={vi.fn()}
      onMetricClick={vi.fn()}
    />
  );

  expect(container).toBeEmptyDOMElement();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/measurement/ActivityDetailPanel.test.tsx`
Expected: FAIL with "Cannot find module './ActivityDetailPanel'"

**Step 3: Write minimal implementation**

Create component file `src/components/measurement/ActivityDetailPanel.tsx`:

```typescript
import { X } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface DerivedMetric {
  id: Id<"metrics">;
  name: string;
  category: string;
}

interface ActivityDetailPanelProps {
  activity: {
    name: string;
    entityName: string;
    lifecycleSlot: string;
  } | null;
  derivedMetrics: DerivedMetric[];
  onClose: () => void;
  onMetricClick: (metricId: Id<"metrics">) => void;
}

export function ActivityDetailPanel({
  activity,
  derivedMetrics,
  onClose,
  onMetricClick,
}: ActivityDetailPanelProps) {
  if (!activity) return null;

  return (
    <aside
      role="complementary"
      className="w-96 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{activity.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{activity.entityName}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content placeholder for now */}
      <div className="p-4">
        {/* Derived metrics section added in next task */}
      </div>
    </aside>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/measurement/ActivityDetailPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/measurement/ActivityDetailPanel.tsx src/components/measurement/ActivityDetailPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(measurement): add ActivityDetailPanel with header and close button

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add derived metrics list with empty state

**Files:**
- Modify: `src/components/measurement/ActivityDetailPanel.test.tsx`
- Modify: `src/components/measurement/ActivityDetailPanel.tsx`

**Step 1: Write the failing tests**

Add to `src/components/measurement/ActivityDetailPanel.test.tsx`:

```typescript
test("renders empty state when no derived metrics", () => {
  setup({ derivedMetrics: [] });

  expect(screen.getByText(/no metrics derived/i)).toBeInTheDocument();
});

test("renders derived metrics list", () => {
  const derivedMetrics = [
    { id: "m1" as Id<"metrics">, name: "Activation Rate", category: "value_delivery" },
    { id: "m2" as Id<"metrics">, name: "Signup Rate", category: "reach" },
  ];
  setup({ derivedMetrics });

  expect(screen.getByText("Activation Rate")).toBeInTheDocument();
  expect(screen.getByText("Signup Rate")).toBeInTheDocument();
});

test("renders metric category badges", () => {
  const derivedMetrics = [
    { id: "m1" as Id<"metrics">, name: "Activation Rate", category: "value_delivery" },
  ];
  setup({ derivedMetrics });

  expect(screen.getByText("Value Delivery")).toBeInTheDocument();
});
```

Also add the import at the top:
```typescript
import type { Id } from "../../../convex/_generated/dataModel";
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/measurement/ActivityDetailPanel.test.tsx`
Expected: FAIL with "Unable to find an element with the text: /no metrics derived/i"

**Step 3: Update implementation**

Update `src/components/measurement/ActivityDetailPanel.tsx`:

```typescript
import { X, ChevronRight } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { CategoryBadge, type MetricCategory } from "../metrics/CategoryBadge";

interface DerivedMetric {
  id: Id<"metrics">;
  name: string;
  category: string;
}

interface ActivityDetailPanelProps {
  activity: {
    name: string;
    entityName: string;
    lifecycleSlot: string;
  } | null;
  derivedMetrics: DerivedMetric[];
  onClose: () => void;
  onMetricClick: (metricId: Id<"metrics">) => void;
}

export function ActivityDetailPanel({
  activity,
  derivedMetrics,
  onClose,
  onMetricClick,
}: ActivityDetailPanelProps) {
  if (!activity) return null;

  return (
    <aside
      role="complementary"
      className="w-96 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{activity.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{activity.entityName}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Derived Metrics
        </h3>

        {derivedMetrics.length === 0 ? (
          <p className="text-sm text-gray-500">
            No metrics derived from this activity yet. Metrics are generated when you complete the journey setup.
          </p>
        ) : (
          <ul className="space-y-2">
            {derivedMetrics.map((metric) => (
              <li key={metric.id}>
                <button
                  onClick={() => onMetricClick(metric.id)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900 block">
                      {metric.name}
                    </span>
                    <CategoryBadge
                      category={metric.category as MetricCategory}
                      className="mt-1"
                    />
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/measurement/ActivityDetailPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/measurement/ActivityDetailPanel.tsx src/components/measurement/ActivityDetailPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(measurement): add derived metrics list with empty state to ActivityDetailPanel

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add onMetricClick callback test

**Files:**
- Modify: `src/components/measurement/ActivityDetailPanel.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/measurement/ActivityDetailPanel.test.tsx`:

```typescript
test("calls onMetricClick when metric is clicked", async () => {
  const onMetricClick = vi.fn();
  const derivedMetrics = [
    { id: "m1" as Id<"metrics">, name: "Activation Rate", category: "value_delivery" },
  ];
  const { user } = setup({ derivedMetrics, onMetricClick });

  await user.click(screen.getByRole("button", { name: /activation rate/i }));

  expect(onMetricClick).toHaveBeenCalledWith("m1");
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- src/components/measurement/ActivityDetailPanel.test.tsx`
Expected: PASS (implementation already handles this)

**Step 3: Commit**

```bash
git add src/components/measurement/ActivityDetailPanel.test.tsx
git commit -m "$(cat <<'EOF'
test(measurement): add onMetricClick callback test for ActivityDetailPanel

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrate ActivityDetailPanel into MeasurementPlanPage

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`
- Modify: `src/routes/MeasurementPlanPage.test.tsx`

**Step 1: Write the failing test**

Add to `src/routes/MeasurementPlanPage.test.tsx`:

First, add the mock at the top with other mocks:

```typescript
vi.mock("@/components/measurement/ActivityDetailPanel", () => ({
  ActivityDetailPanel: ({
    activity,
    onClose,
  }: {
    activity: unknown;
    onClose: () => void;
  }) =>
    activity ? (
      <div data-testid="activity-detail-panel">
        Activity Detail Panel
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));
```

Then add the test:

```typescript
test("opens activity detail panel when activity is clicked", async () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          lifecycleSlot: "account_creation",
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // First expand the entity card
  await userEvent.click(screen.getByText("Account"));

  // Click the activity to open detail panel
  await userEvent.click(screen.getByText("Account Created"));

  expect(screen.getByTestId("activity-detail-panel")).toBeInTheDocument();
});
```

Also add the import at the top:
```typescript
import userEvent from "@testing-library/user-event";
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/routes/MeasurementPlanPage.test.tsx`
Expected: FAIL with "Unable to find an element by: [data-testid="activity-detail-panel"]"

**Step 3: Update implementation**

Update `src/routes/MeasurementPlanPage.tsx`. Add to imports:

```typescript
import { useNavigate } from "react-router-dom";
import { ActivityDetailPanel } from "@/components/measurement/ActivityDetailPanel";
```

Add new state and queries (after existing state declarations):

```typescript
const navigate = useNavigate();
const [selectedActivity, setSelectedActivity] = useState<{
  name: string;
  entityName: string;
  lifecycleSlot: string;
} | null>(null);

// Get stages and metrics for derived metrics lookup
const stages = useQuery(
  api.stages.listByJourney,
  journeyId ? { journeyId } : "skip"
);
const metrics = useQuery(api.metrics.list, {});

// Helper: get derived metrics for an activity name
const getDerivedMetrics = (activityName: string) => {
  if (!stages || !metrics) return [];

  // Find stage(s) matching this activity name
  const matchingStages = stages.filter((s) => s.name === activityName);
  const stageIds = new Set(matchingStages.map((s) => s._id));

  // Find metrics referencing these stages
  return metrics
    .filter((m) => m.relatedActivityId && stageIds.has(m.relatedActivityId))
    .map((m) => ({
      id: m._id,
      name: m.name,
      category: m.category,
    }));
};

const handleMetricClick = (metricId: string) => {
  navigate(`/setup/metric-catalog?metric=${metricId}`);
};
```

Update the activity button in the activities map (around line 193, change from EditActivityModal opener to panel opener):

Find this section:
```typescript
<button
  type="button"
  onClick={() => setEditActivity(activity)}
  className="flex items-center gap-2 text-left flex-1"
>
```

Replace with:
```typescript
<button
  type="button"
  onClick={() =>
    setSelectedActivity({
      name: activity.name,
      entityName: entity.name,
      lifecycleSlot: activity.lifecycleSlot ?? "",
    })
  }
  className="flex items-center gap-2 text-left flex-1"
>
```

Add the panel before the closing `</div>` of the main container (before the modals section):

```typescript
{/* Activity Detail Panel */}
{selectedActivity && (
  <div className="fixed inset-y-0 right-0 z-40">
    <ActivityDetailPanel
      activity={selectedActivity}
      derivedMetrics={getDerivedMetrics(selectedActivity.name)}
      onClose={() => setSelectedActivity(null)}
      onMetricClick={handleMetricClick}
    />
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/routes/MeasurementPlanPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(measurement): integrate ActivityDetailPanel into MeasurementPlanPage

- Add selectedActivity state to track which activity panel is open
- Add stages and metrics queries for derived metrics lookup
- Add getDerivedMetrics helper using name-based matching
- Replace activity click handler to open panel instead of edit modal

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add edit activity button to panel header

**Files:**
- Modify: `src/components/measurement/ActivityDetailPanel.tsx`
- Modify: `src/components/measurement/ActivityDetailPanel.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/measurement/ActivityDetailPanel.test.tsx`:

```typescript
test("calls onEdit when edit button is clicked", async () => {
  const onEdit = vi.fn();
  const { user } = setup({ onEdit });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(onEdit).toHaveBeenCalledOnce();
});
```

Update the setup function to include onEdit:
```typescript
function setup(props: Partial<Parameters<typeof ActivityDetailPanel>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const onMetricClick = props.onMetricClick ?? vi.fn();
  const onEdit = props.onEdit ?? vi.fn();
  const defaultProps = {
    activity: mockActivity,
    derivedMetrics: [],
    onClose,
    onMetricClick,
    onEdit,
    ...props,
  };
  render(<ActivityDetailPanel {...defaultProps} />);
  return { user, onClose, onMetricClick, onEdit };
}
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/measurement/ActivityDetailPanel.test.tsx`
Expected: FAIL with "Unable to find an accessible element with the role "button" and name /edit/i"

**Step 3: Update implementation**

Update `src/components/measurement/ActivityDetailPanel.tsx`:

Add `Pencil` to imports:
```typescript
import { X, ChevronRight, Pencil } from "lucide-react";
```

Update the interface:
```typescript
interface ActivityDetailPanelProps {
  activity: {
    name: string;
    entityName: string;
    lifecycleSlot: string;
  } | null;
  derivedMetrics: DerivedMetric[];
  onClose: () => void;
  onMetricClick: (metricId: Id<"metrics">) => void;
  onEdit?: () => void;
}
```

Update the function signature:
```typescript
export function ActivityDetailPanel({
  activity,
  derivedMetrics,
  onClose,
  onMetricClick,
  onEdit,
}: ActivityDetailPanelProps) {
```

Add edit button in header (after close button):
```typescript
<div className="flex gap-1">
  {onEdit && (
    <button
      onClick={onEdit}
      aria-label="Edit activity"
      className="p-1 text-gray-400 hover:text-gray-600"
    >
      <Pencil className="w-5 h-5" />
    </button>
  )}
  <button
    onClick={onClose}
    aria-label="Close panel"
    className="p-1 text-gray-400 hover:text-gray-600"
  >
    <X className="w-5 h-5" />
  </button>
</div>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/measurement/ActivityDetailPanel.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/measurement/ActivityDetailPanel.tsx src/components/measurement/ActivityDetailPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(measurement): add edit button to ActivityDetailPanel header

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire up edit button in MeasurementPlanPage

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`
- Modify: `src/routes/MeasurementPlanPage.test.tsx`

**Step 1: Write the failing test**

Add to `src/routes/MeasurementPlanPage.test.tsx`:

Update the ActivityDetailPanel mock to include onEdit:
```typescript
vi.mock("@/components/measurement/ActivityDetailPanel", () => ({
  ActivityDetailPanel: ({
    activity,
    onClose,
    onEdit,
  }: {
    activity: unknown;
    onClose: () => void;
    onEdit?: () => void;
  }) =>
    activity ? (
      <div data-testid="activity-detail-panel">
        Activity Detail Panel
        <button onClick={onClose}>Close</button>
        {onEdit && <button onClick={onEdit}>Edit</button>}
      </div>
    ) : null,
}));
```

Add test:
```typescript
test("opens edit modal from activity detail panel edit button", async () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          lifecycleSlot: "account_creation",
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Expand entity and open panel
  await userEvent.click(screen.getByText("Account"));
  await userEvent.click(screen.getByText("Account Created"));

  // Click edit in the panel
  await userEvent.click(screen.getByRole("button", { name: /edit/i }));

  expect(screen.getByTestId("edit-activity-modal")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/routes/MeasurementPlanPage.test.tsx`
Expected: FAIL with "Unable to find an element by: [data-testid="edit-activity-modal"]"

**Step 3: Update implementation**

In `src/routes/MeasurementPlanPage.tsx`, update the selectedActivity state to also store the activity object for editing:

```typescript
const [selectedActivityForPanel, setSelectedActivityForPanel] = useState<{
  name: string;
  entityName: string;
  lifecycleSlot: string;
  activityDoc: Doc<"measurementActivities">;
} | null>(null);
```

Update the click handler:
```typescript
onClick={() =>
  setSelectedActivityForPanel({
    name: activity.name,
    entityName: entity.name,
    lifecycleSlot: activity.lifecycleSlot ?? "",
    activityDoc: activity,
  })
}
```

Update the panel to pass onEdit:
```typescript
{selectedActivityForPanel && (
  <div className="fixed inset-y-0 right-0 z-40">
    <ActivityDetailPanel
      activity={{
        name: selectedActivityForPanel.name,
        entityName: selectedActivityForPanel.entityName,
        lifecycleSlot: selectedActivityForPanel.lifecycleSlot,
      }}
      derivedMetrics={getDerivedMetrics(selectedActivityForPanel.name)}
      onClose={() => setSelectedActivityForPanel(null)}
      onMetricClick={handleMetricClick}
      onEdit={() => {
        setEditActivity(selectedActivityForPanel.activityDoc);
        setSelectedActivityForPanel(null);
      }}
    />
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/routes/MeasurementPlanPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(measurement): wire up edit button from ActivityDetailPanel to edit modal

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add metric query param to MetricCatalogPage

**Files:**
- Modify: `src/routes/MetricCatalogPage.tsx`
- Modify: `src/routes/MetricCatalogPage.test.tsx`

**Step 1: Write the failing test**

Add to `src/routes/MetricCatalogPage.test.tsx`:

First, check if there's a setup function or add appropriate test. Add imports:
```typescript
import { MemoryRouter } from "react-router-dom";
```

Add test:
```typescript
test("auto-selects metric from URL query param", () => {
  mockMetrics = [
    {
      _id: "m1" as Id<"metrics">,
      name: "Activation Rate",
      definition: "Test definition",
      formula: "Test formula",
      category: "value_delivery",
      whyItMatters: "Test why",
      howToImprove: "Test how",
      userId: "u1" as Id<"users">,
      metricType: "generated",
      order: 1,
      createdAt: Date.now(),
    },
  ];

  render(
    <MemoryRouter initialEntries={["/setup/metric-catalog?metric=m1"]}>
      <MetricCatalogPage />
    </MemoryRouter>
  );

  // The MetricDetailPanel should be visible with the selected metric
  expect(screen.getByText("Activation Rate")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/routes/MetricCatalogPage.test.tsx`
Expected: May pass or fail depending on current implementation - check behavior

**Step 3: Update implementation**

In `src/routes/MetricCatalogPage.tsx`, add import:
```typescript
import { useSearchParams } from "react-router-dom";
```

Add after `useState` for selectedMetricId:
```typescript
const [searchParams] = useSearchParams();

// Initialize selected metric from URL param if present
const metricParam = searchParams.get("metric");
const [selectedMetricId, setSelectedMetricId] = useState<string | null>(
  metricParam
);
```

Note: If the state initialization from URL param isn't working correctly because metrics haven't loaded yet, use useEffect:

```typescript
const [searchParams] = useSearchParams();
const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

// Initialize from URL param when metrics load
useEffect(() => {
  const metricParam = searchParams.get("metric");
  if (metricParam && metrics?.some((m) => m._id === metricParam)) {
    setSelectedMetricId(metricParam);
  }
}, [searchParams, metrics]);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/routes/MetricCatalogPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx src/routes/MetricCatalogPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(metrics): auto-select metric from URL query param on MetricCatalogPage

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add backdrop/overlay for panel dismiss

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`
- Modify: `src/routes/MeasurementPlanPage.test.tsx`

**Step 1: Write the failing test**

Add to `src/routes/MeasurementPlanPage.test.tsx`:

```typescript
test("closes activity detail panel when backdrop is clicked", async () => {
  mockGetFullPlan = [
    {
      entity: {
        _id: "e1" as Id<"measurementEntities">,
        _creationTime: Date.now(),
        userId: "u1" as Id<"users">,
        name: "Account",
        createdAt: Date.now(),
      },
      activities: [
        {
          _id: "a1" as Id<"measurementActivities">,
          _creationTime: Date.now(),
          userId: "u1" as Id<"users">,
          entityId: "e1" as Id<"measurementEntities">,
          name: "Account Created",
          action: "Created",
          isFirstValue: false,
          lifecycleSlot: "account_creation",
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Expand entity and open panel
  await userEvent.click(screen.getByText("Account"));
  await userEvent.click(screen.getByText("Account Created"));

  expect(screen.getByTestId("activity-detail-panel")).toBeInTheDocument();

  // Click backdrop
  await userEvent.click(screen.getByTestId("panel-backdrop"));

  expect(screen.queryByTestId("activity-detail-panel")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/routes/MeasurementPlanPage.test.tsx`
Expected: FAIL with "Unable to find an element by: [data-testid="panel-backdrop"]"

**Step 3: Update implementation**

In `src/routes/MeasurementPlanPage.tsx`, update the panel section:

```typescript
{/* Activity Detail Panel */}
{selectedActivityForPanel && (
  <>
    {/* Backdrop */}
    <div
      data-testid="panel-backdrop"
      className="fixed inset-0 bg-black/20 z-30"
      onClick={() => setSelectedActivityForPanel(null)}
    />
    <div className="fixed inset-y-0 right-0 z-40">
      <ActivityDetailPanel
        activity={{
          name: selectedActivityForPanel.name,
          entityName: selectedActivityForPanel.entityName,
          lifecycleSlot: selectedActivityForPanel.lifecycleSlot,
        }}
        derivedMetrics={getDerivedMetrics(selectedActivityForPanel.name)}
        onClose={() => setSelectedActivityForPanel(null)}
        onMetricClick={handleMetricClick}
        onEdit={() => {
          setEditActivity(selectedActivityForPanel.activityDoc);
          setSelectedActivityForPanel(null);
        }}
      />
    </div>
  </>
)}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/routes/MeasurementPlanPage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(measurement): add backdrop to dismiss activity detail panel

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Run full test suite and verify

**Files:**
- All test files

**Step 1: Run full test suite**

Run: `npm test -- --run`

**Step 2: Fix any failing tests**

Review output and fix any regressions.

**Step 3: Commit if fixes needed**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: address test regressions from event detail panel feature

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

This plan implements:

1. **ActivityDetailPanel component** - A slide-over panel showing activity name and derived metrics list with empty state
2. **Name-based metric bridging** - Client-side matching from measurementActivities.name → stages.name → metrics.relatedActivityId
3. **MeasurementPlanPage integration** - Activity clicks open the detail panel, with backdrop dismiss and edit button
4. **MetricCatalogPage integration** - Reads `?metric=id` query param to auto-select a metric
5. **Navigation flow** - Clicking a metric in the panel navigates to MetricCatalogPage with the metric pre-selected

**Files modified:**
- `src/components/measurement/ActivityDetailPanel.tsx` (new)
- `src/components/measurement/ActivityDetailPanel.test.tsx` (new)
- `src/routes/MeasurementPlanPage.tsx`
- `src/routes/MeasurementPlanPage.test.tsx`
- `src/routes/MetricCatalogPage.tsx`
- `src/routes/MetricCatalogPage.test.tsx`

**Testing strategy:**
- Component-level tests for ActivityDetailPanel (header, close, empty state, metrics list, click handlers)
- Integration tests in MeasurementPlanPage for panel open/close/edit flows
- Integration test in MetricCatalogPage for query param selection
