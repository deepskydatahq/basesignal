# Cross-Reference Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable bidirectional navigation between Measurement Plan and Metric Catalog with URL query params that preserve selection context.

**Architecture:** URL query parameters enable cross-page navigation. Each page reads its own params on mount and highlights/selects the relevant item. Primary flow is Metric Catalog → Measurement Plan (via MetricDetailPanel). Secondary flow is Measurement Plan → Metric Catalog (via inline action on activity rows).

**Tech Stack:** React Router (useSearchParams), Tailwind CSS (cn utility), existing component patterns

---

## Task 1: Add URL Param Reading to MeasurementPlanPage

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx:1-20` (imports) and `16-45` (component body)

**Step 1: Write failing test for highlight param**

Add to `src/routes/MeasurementPlanPage.test.tsx`:

```tsx
test("highlights activity when URL has highlight param", () => {
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
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter initialEntries={["/measurement-plan?highlight=Account%20Created"]}>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // The activity row should have highlight styling
  const activityRow = screen.getByText("Account Created").closest("div");
  expect(activityRow).toHaveClass("ring-2");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/routes/MeasurementPlanPage.test.tsx`

Expected: FAIL - no highlight styling applied

**Step 3: Add useSearchParams import**

In `src/routes/MeasurementPlanPage.tsx`, add `useSearchParams` to imports:

```tsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
```

**Step 4: Read highlight param in component**

After the existing state declarations (around line 27), add:

```tsx
const [searchParams] = useSearchParams();
const highlightedActivity = searchParams.get("highlight");
```

**Step 5: Apply highlight styling to activity rows**

Find the activity row div (around line 189-228). Replace the className:

```tsx
<div
  key={activity._id}
  className={cn(
    "w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors",
    activity.name === highlightedActivity && "ring-2 ring-blue-500 bg-blue-50"
  )}
>
```

Add the cn import at the top:

```tsx
import { cn } from "@/lib/utils";
```

**Step 6: Run test to verify it passes**

Run: `npm test -- --run src/routes/MeasurementPlanPage.test.tsx`

Expected: PASS

**Step 7: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: highlight activity from URL param in MeasurementPlanPage

Read ?highlight=ActivityName from URL and apply ring styling
to matching activity row.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Auto-Expand EntityCard When Contains Highlighted Activity

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx:155-260` (entity card rendering)

**Step 1: Write failing test for auto-expand**

Add to `src/routes/MeasurementPlanPage.test.tsx`:

```tsx
test("auto-expands entity card containing highlighted activity", async () => {
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
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  render(
    <MemoryRouter initialEntries={["/measurement-plan?highlight=Account%20Created"]}>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Activity should be visible (entity expanded)
  expect(screen.getByText("Account Created")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/routes/MeasurementPlanPage.test.tsx`

Expected: FAIL - activity not visible because entity card collapsed by default

**Step 3: Add defaultExpanded prop to EntityCard**

In the EntityCard render (around line 158), add the defaultExpanded prop:

```tsx
<EntityCard
  key={entity._id}
  id={entity._id}
  name={entity.name}
  description={entity.description}
  suggestedFrom={entity.suggestedFrom}
  activityCount={activities.length}
  propertyCount={properties.length}
  defaultExpanded={activities.some((a) => a.name === highlightedActivity)}
>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/routes/MeasurementPlanPage.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: auto-expand entity card containing highlighted activity

When navigating with ?highlight=ActivityName, automatically expand
the entity card that contains the matching activity.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Source Activity Link to MetricDetailPanel

**Files:**
- Modify: `src/components/metrics/MetricDetailPanel.tsx:1-70`
- Modify: `src/routes/MetricCatalogPage.tsx:130-145` (prop passing)

**Step 1: Write failing test for source activity link**

Add to `src/components/metrics/MetricDetailPanel.test.tsx`:

```tsx
import { MemoryRouter } from "react-router-dom";

// Update setup function to wrap in MemoryRouter
function setup(props: Partial<Parameters<typeof MetricDetailPanel>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const defaultProps = {
    metric: mockMetric,
    onClose,
    ...props,
  };
  render(
    <MemoryRouter>
      <MetricDetailPanel {...defaultProps} />
    </MemoryRouter>
  );
  return { user, onClose };
}

test("renders source activity link when provided", () => {
  setup({ sourceActivityName: "Account Created" });

  expect(screen.getByText("Source Activity")).toBeInTheDocument();
  const link = screen.getByRole("link", { name: /account created/i });
  expect(link).toHaveAttribute(
    "href",
    "/measurement-plan?highlight=Account%20Created"
  );
});

test("does not render source activity section when not provided", () => {
  setup();

  expect(screen.queryByText("Source Activity")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/metrics/MetricDetailPanel.test.tsx`

Expected: FAIL - Source Activity section doesn't exist

**Step 3: Update MetricDetailPanel interface**

In `src/components/metrics/MetricDetailPanel.tsx`, update the props interface:

```tsx
interface MetricDetailPanelProps {
  metric: MetricData;
  onClose: () => void;
  sourceActivityName?: string;
}
```

**Step 4: Add Link import and render source activity section**

Add imports at the top:

```tsx
import { Link } from "react-router-dom";
import { X, ArrowRight } from "lucide-react";
```

Before the closing `</div>` of the content section (around line 65), add:

```tsx
{/* Source Activity */}
{sourceActivityName && (
  <section className="pt-4 border-t">
    <h3 className="text-sm font-medium text-gray-700 mb-1">Source Activity</h3>
    <Link
      to={`/measurement-plan?highlight=${encodeURIComponent(sourceActivityName)}`}
      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
    >
      {sourceActivityName}
      <ArrowRight className="w-3 h-3" />
    </Link>
  </section>
)}
```

Update the function signature:

```tsx
export function MetricDetailPanel({ metric, onClose, sourceActivityName }: MetricDetailPanelProps) {
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --run src/components/metrics/MetricDetailPanel.test.tsx`

Expected: PASS

**Step 6: Commit**

```bash
git add src/components/metrics/MetricDetailPanel.tsx src/components/metrics/MetricDetailPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat: add source activity link to MetricDetailPanel

Show "Source Activity" section with link to measurement plan
when sourceActivityName prop is provided.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Pass Source Activity Name from MetricCatalogPage

**Files:**
- Modify: `src/routes/MetricCatalogPage.tsx:1-160`

**Step 1: Write failing test for source activity integration**

Add to `src/routes/MetricCatalogPage.test.tsx`:

```tsx
import { MemoryRouter } from "react-router-dom";

// Update setup to wrap in MemoryRouter
function setup() {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MetricCatalogPage />
    </MemoryRouter>
  );
  return { user };
}

test("shows source activity link in detail panel when metric has related stage", async () => {
  // Mock metrics with relatedActivityId
  const metricsWithStage = [
    {
      _id: "metric1",
      name: "Activation Rate",
      definition: "Users who activated",
      formula: "Activated / Signed up",
      category: "value_delivery",
      whyItMatters: "Shows activation health",
      howToImprove: "Improve onboarding",
      order: 1,
      relatedActivityId: "stage1",
    },
  ];

  // Mock stages query
  const mockStages = [
    {
      _id: "stage1",
      journeyId: "journey1",
      name: "Account Created",
      type: "activity",
    },
  ];

  mockUseQuery.mockImplementation((query: string) => {
    if (query === "metrics:list") return metricsWithStage;
    if (query === "setupProgress:foundationStatus") return mockFoundationStatus;
    if (query === "stages:listByJourney") return mockStages;
    return undefined;
  });

  const { user } = setup();

  await user.click(screen.getByText("Activation Rate"));

  // Source activity section should show
  expect(screen.getByText("Source Activity")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /account created/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: FAIL - Source Activity not shown

**Step 3: Fetch stages and compute source activity name**

In `src/routes/MetricCatalogPage.tsx`, add stages query:

```tsx
const stages = useQuery(
  api.stages.listByJourney,
  journeyId ? { journeyId } : "skip"
);
```

Add helper function to get source activity name:

```tsx
function getSourceActivityName(relatedActivityId: string | undefined): string | undefined {
  if (!relatedActivityId || !stages) return undefined;
  const stage = stages.find((s) => s._id === relatedActivityId);
  return stage?.name;
}
```

**Step 4: Pass sourceActivityName to MetricDetailPanel**

Update the MetricDetailPanel render:

```tsx
<MetricDetailPanel
  metric={{
    name: selectedMetric.name,
    definition: selectedMetric.definition,
    formula: selectedMetric.formula,
    category: selectedMetric.category as MetricCategory,
    whyItMatters: selectedMetric.whyItMatters,
    howToImprove: selectedMetric.howToImprove,
  }}
  sourceActivityName={getSourceActivityName(selectedMetric.relatedActivityId)}
  onClose={() => setSelectedMetricId(null)}
/>
```

**Step 5: Update mock for api**

In the test file, add stages to the api mock:

```tsx
vi.mock("../../convex/_generated/api", () => ({
  api: {
    metrics: {
      list: "metrics:list",
    },
    setupProgress: {
      foundationStatus: "setupProgress:foundationStatus",
    },
    metricCatalog: {
      generateFromOverview: "metricCatalog:generateFromOverview",
      generateFromFirstValue: "metricCatalog:generateFromFirstValue",
      deleteAll: "metricCatalog:deleteAll",
    },
    stages: {
      listByJourney: "stages:listByJourney",
    },
  },
}));
```

**Step 6: Run test to verify it passes**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: PASS

**Step 7: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx src/routes/MetricCatalogPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: pass source activity name from MetricCatalogPage to detail panel

Lookup stage name from metric's relatedActivityId and pass
to MetricDetailPanel for cross-reference navigation.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add Activity Filter to MetricCatalogPage

**Files:**
- Modify: `src/routes/MetricCatalogPage.tsx:1-160`

**Step 1: Write failing test for activity filter**

Add to `src/routes/MetricCatalogPage.test.tsx`:

```tsx
test("filters metrics by activity when URL has activity param", async () => {
  const metricsWithStage = [
    {
      _id: "metric1",
      name: "Activation Rate",
      definition: "Users who activated",
      formula: "Activated / Signed up",
      category: "value_delivery",
      whyItMatters: "Shows activation health",
      howToImprove: "Improve onboarding",
      order: 1,
      relatedActivityId: "stage1",
    },
    {
      _id: "metric2",
      name: "DAU",
      definition: "Daily active users",
      formula: "Count active",
      category: "engagement",
      whyItMatters: "Core engagement",
      howToImprove: "Add features",
      order: 2,
      // No relatedActivityId - different activity
    },
  ];

  const mockStages = [
    {
      _id: "stage1",
      journeyId: "journey1",
      name: "Account Created",
      type: "activity",
    },
  ];

  mockUseQuery.mockImplementation((query: string) => {
    if (query === "metrics:list") return metricsWithStage;
    if (query === "setupProgress:foundationStatus") return mockFoundationStatus;
    if (query === "stages:listByJourney") return mockStages;
    return undefined;
  });

  render(
    <MemoryRouter initialEntries={["/metric-catalog?activity=Account%20Created"]}>
      <MetricCatalogPage />
    </MemoryRouter>
  );

  // Only matching metric should show
  expect(screen.getByText("Activation Rate")).toBeInTheDocument();
  expect(screen.queryByText("DAU")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: FAIL - both metrics shown

**Step 3: Add useSearchParams and filter logic**

In `src/routes/MetricCatalogPage.tsx`, add import:

```tsx
import { useSearchParams } from "react-router-dom";
```

Add URL param reading after queries:

```tsx
const [searchParams] = useSearchParams();
const activityFilter = searchParams.get("activity");
```

Add filtering logic before the metrics.map:

```tsx
// Filter metrics by activity if URL param present
const filteredMetrics = activityFilter
  ? metrics.filter((m) => {
      if (!m.relatedActivityId || !stages) return false;
      const stage = stages.find((s) => s._id === m.relatedActivityId);
      return stage?.name === activityFilter;
    })
  : metrics;
```

Update the map to use filteredMetrics:

```tsx
{filteredMetrics.map((metric) => (
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx src/routes/MetricCatalogPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: filter metrics by activity from URL param

Read ?activity=ActivityName from URL and filter metric grid
to show only metrics related to that activity.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add "View Metrics" Action to MeasurementPlanPage Activities

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx:185-230` (activity row)

**Step 1: Write failing test for View Metrics link**

Add to `src/routes/MeasurementPlanPage.test.tsx`:

```tsx
import userEvent from "@testing-library/user-event";

test("activity row has View Metrics link", async () => {
  const user = userEvent.setup();

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

  // Expand entity card
  await user.click(screen.getByText("Account"));

  // Should have View Metrics link
  const link = screen.getByRole("link", { name: /view metrics/i });
  expect(link).toHaveAttribute("href", "/metric-catalog?activity=Account%20Created");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/routes/MeasurementPlanPage.test.tsx`

Expected: FAIL - View Metrics link doesn't exist

**Step 3: Add Link import and View Metrics action**

In `src/routes/MeasurementPlanPage.tsx`, add Link import:

```tsx
import { Link } from "react-router-dom";
```

Add the View Metrics link in the activity row (around line 207, in the flex container with the Target button):

```tsx
<div className="flex items-center gap-2">
  {activity.lifecycleSlot && (
    <span className="text-xs text-gray-500">
      {activity.lifecycleSlot.replace(/_/g, " ")}
    </span>
  )}
  <Link
    to={`/metric-catalog?activity=${encodeURIComponent(activity.name)}`}
    className="text-xs text-blue-600 hover:text-blue-800"
    onClick={(e) => e.stopPropagation()}
  >
    View Metrics
  </Link>
  {!activity.isFirstValue && (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={(e) => {
        e.stopPropagation();
        setFirstValue({ activityId: activity._id });
      }}
      title="Mark as First Value"
    >
      <Target className="w-3.5 h-3.5 text-gray-400 hover:text-green-600" />
    </Button>
  )}
</div>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/routes/MeasurementPlanPage.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: add View Metrics link to activity rows

Each activity in the measurement plan now has a "View Metrics"
link that navigates to the metric catalog filtered by that activity.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Clear Filter UI to MetricCatalogPage

**Files:**
- Modify: `src/routes/MetricCatalogPage.tsx:94-130`

**Step 1: Write failing test for clear filter**

Add to `src/routes/MetricCatalogPage.test.tsx`:

```tsx
test("shows filter indicator and clear button when activity filter is active", async () => {
  const metricsWithStage = [
    {
      _id: "metric1",
      name: "Activation Rate",
      definition: "Users who activated",
      formula: "Activated / Signed up",
      category: "value_delivery",
      whyItMatters: "Shows activation health",
      howToImprove: "Improve onboarding",
      order: 1,
      relatedActivityId: "stage1",
    },
  ];

  const mockStages = [
    {
      _id: "stage1",
      journeyId: "journey1",
      name: "Account Created",
      type: "activity",
    },
  ];

  mockUseQuery.mockImplementation((query: string) => {
    if (query === "metrics:list") return metricsWithStage;
    if (query === "setupProgress:foundationStatus") return mockFoundationStatus;
    if (query === "stages:listByJourney") return mockStages;
    return undefined;
  });

  const { user } = setup();
  // Navigate with activity param
  // (Note: for this test we need to re-render with the param)

  render(
    <MemoryRouter initialEntries={["/metric-catalog?activity=Account%20Created"]}>
      <MetricCatalogPage />
    </MemoryRouter>
  );

  // Should show filter indicator
  expect(screen.getByText(/filtered by.*account created/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /clear filter/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: FAIL - no filter indicator

**Step 3: Add filter indicator UI**

In `src/routes/MetricCatalogPage.tsx`, add the filter indicator after the header div and before the flex gap-6 div:

```tsx
{activityFilter && (
  <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-md">
    <span>Filtered by: <strong>{activityFilter}</strong></span>
    <Button
      variant="ghost"
      size="sm"
      className="h-6 px-2"
      onClick={() => {
        searchParams.delete("activity");
        setSearchParams(searchParams);
      }}
    >
      Clear filter
    </Button>
  </div>
)}
```

Add setSearchParams to the destructured hook:

```tsx
const [searchParams, setSearchParams] = useSearchParams();
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx src/routes/MetricCatalogPage.test.tsx
git commit -m "$(cat <<'EOF'
feat: add filter indicator and clear button to MetricCatalogPage

When viewing filtered metrics via ?activity param, show a
filter indicator with the activity name and a clear button.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Handle Graceful Degradation for Invalid Params

**Files:**
- Modify: `src/routes/MeasurementPlanPage.test.tsx`
- Modify: `src/routes/MetricCatalogPage.test.tsx`

**Step 1: Write test for non-existent activity in MeasurementPlanPage**

Add to `src/routes/MeasurementPlanPage.test.tsx`:

```tsx
test("handles non-existent activity in highlight param gracefully", () => {
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
          createdAt: Date.now(),
        },
      ],
      properties: [],
    },
  ];

  // Should not throw when highlight param doesn't match any activity
  render(
    <MemoryRouter initialEntries={["/measurement-plan?highlight=NonExistent%20Activity"]}>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // Page should render normally
  expect(screen.getByRole("heading", { level: 1, name: /measurement plan/i })).toBeInTheDocument();
  // Entity card should NOT be expanded (no match)
  expect(screen.queryByText("Account Created")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --run src/routes/MeasurementPlanPage.test.tsx`

Expected: PASS (implementation already handles this gracefully)

**Step 3: Write test for non-existent activity in MetricCatalogPage**

Add to `src/routes/MetricCatalogPage.test.tsx`:

```tsx
test("shows empty state when activity filter matches no metrics", () => {
  setupMocks(mockMetrics);

  render(
    <MemoryRouter initialEntries={["/metric-catalog?activity=NonExistent%20Activity"]}>
      <MetricCatalogPage />
    </MemoryRouter>
  );

  // Should show filter indicator but no metrics
  expect(screen.getByText(/filtered by.*nonexistent activity/i)).toBeInTheDocument();
  // Metrics should not appear
  expect(screen.queryByText("New Users")).not.toBeInTheDocument();
  expect(screen.queryByText("DAU")).not.toBeInTheDocument();
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/routes/MetricCatalogPage.test.tsx`

Expected: PASS (implementation filters to empty list gracefully)

**Step 5: Commit**

```bash
git add src/routes/MeasurementPlanPage.test.tsx src/routes/MetricCatalogPage.test.tsx
git commit -m "$(cat <<'EOF'
test: verify graceful handling of invalid URL params

Add tests confirming that non-existent activity names in URL
params don't cause errors - pages render normally with no matches.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test -- --run`

Expected: All tests pass

**Step 2: Commit if any fixes needed**

If any tests fail, fix them and commit.

---

## Summary

This plan implements cross-reference navigation between Measurement Plan and Metric Catalog:

1. **MeasurementPlanPage** reads `?highlight=X` param to highlight and auto-expand matching activity
2. **MetricDetailPanel** shows source activity link when available
3. **MetricCatalogPage** reads `?activity=X` param to filter metrics
4. **Bidirectional links**: Metric detail → Measurement Plan, Activity row → Metric Catalog
5. **Graceful degradation**: Invalid params cause no errors, just empty/no matches

**Total: 9 TDD tasks with ~25 steps**
