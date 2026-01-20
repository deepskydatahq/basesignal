# Metric Source Event Reference Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display source event names on MetricCard and MetricDetailPanel, with clickable navigation to the Measurement Plan page.

**Architecture:** Add optional `sourceEventName` prop to MetricCard and MetricDetailPanel. MetricCatalogPage fetches stages and measurementActivities, performs inline lookup (stage ID → stage name → matching activity), and passes resolved names to child components. Clicking source event navigates to MeasurementPlanPage with route state that triggers scroll-into-view highlighting.

**Tech Stack:** React, React Router v7, Convex, Tailwind CSS

---

## Task 1: Add sourceEventName prop and display to MetricCard

**Files:**
- Modify: `src/components/metrics/MetricCard.tsx`
- Test: `src/components/metrics/MetricCard.test.tsx`

**Step 1: Write the failing test**

Add test to `src/components/metrics/MetricCard.test.tsx`:

```typescript
test("renders source event name when provided", () => {
  setup({ sourceEventName: "Account Created" });

  expect(screen.getByText("Source: Account Created")).toBeInTheDocument();
});

test("does not render source when sourceEventName is not provided", () => {
  setup();

  expect(screen.queryByText(/Source:/)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/metrics/MetricCard.test.tsx -t "renders source event name" --run`
Expected: FAIL with "Unable to find an element with the text: Source: Account Created"

**Step 3: Add sourceEventName prop to interface and render**

Edit `src/components/metrics/MetricCard.tsx`:

```typescript
interface MetricCardProps {
  name: string;
  definition: string;
  category: MetricCategory;
  selected?: boolean;
  onClick?: () => void;
  sourceEventName?: string;
}

export function MetricCard({
  name,
  definition,
  category,
  selected = false,
  onClick,
  sourceEventName,
}: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 bg-white border border-gray-200 rounded-lg",
        "hover:shadow-md transition-shadow cursor-pointer",
        selected && "ring-2 ring-black"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-medium text-gray-900">{name}</h3>
        <CategoryBadge category={category} />
      </div>
      <p className="text-sm text-gray-600 line-clamp-2">{definition}</p>
      {sourceEventName && (
        <p className="text-xs text-gray-500 mt-1">Source: {sourceEventName}</p>
      )}
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/metrics/MetricCard.test.tsx --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/metrics/MetricCard.tsx src/components/metrics/MetricCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(MetricCard): add sourceEventName prop and display

Display source event name below definition when provided.
Shows "Source: {name}" in muted gray text.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add sourceEventName and onSourceEventClick props to MetricDetailPanel

**Files:**
- Modify: `src/components/metrics/MetricDetailPanel.tsx`
- Test: `src/components/metrics/MetricDetailPanel.test.tsx`

**Step 1: Write the failing tests**

Add tests to `src/components/metrics/MetricDetailPanel.test.tsx`:

```typescript
test("renders Source Event section when sourceEventName is provided", () => {
  setup({ sourceEventName: "Account Created" });

  expect(screen.getByText("Source Event")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Account Created" })).toBeInTheDocument();
});

test("calls onSourceEventClick when source event is clicked", async () => {
  const onSourceEventClick = vi.fn();
  const { user } = setup({
    sourceEventName: "Account Created",
    onSourceEventClick,
  });

  await user.click(screen.getByRole("button", { name: "Account Created" }));

  expect(onSourceEventClick).toHaveBeenCalledOnce();
});

test("does not render Source Event section when sourceEventName is not provided", () => {
  setup();

  expect(screen.queryByText("Source Event")).not.toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/metrics/MetricDetailPanel.test.tsx -t "Source Event" --run`
Expected: FAIL with "Unable to find an element with the text: Source Event"

**Step 3: Update interface and add Source Event section**

Edit `src/components/metrics/MetricDetailPanel.tsx`:

```typescript
interface MetricDetailPanelProps {
  metric: MetricData;
  onClose: () => void;
  sourceEventName?: string;
  onSourceEventClick?: () => void;
}

export function MetricDetailPanel({
  metric,
  onClose,
  sourceEventName,
  onSourceEventClick,
}: MetricDetailPanelProps) {
  return (
    <aside
      role="complementary"
      className="w-96 h-full bg-white border-l border-gray-200 shadow-lg overflow-y-auto"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-gray-900">{metric.name}</h2>
          <CategoryBadge category={metric.category} className="mt-1" />
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
      <div className="p-4 space-y-6">
        {/* Definition */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Definition</h3>
          <p className="text-sm text-gray-900">{metric.definition}</p>
        </section>

        {/* Formula */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Formula</h3>
          <p className="text-sm text-gray-900 font-mono bg-gray-50 p-2 rounded">
            {metric.formula}
          </p>
        </section>

        {/* Why It Matters */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-1">Why It Matters</h3>
          <p className="text-sm text-gray-600">{metric.whyItMatters}</p>
        </section>

        {/* How to Improve */}
        <section>
          <h3 className="text-sm font-medium text-gray-700 mb-1">How to Improve</h3>
          <p className="text-sm text-gray-600">{metric.howToImprove}</p>
        </section>

        {/* Source Event */}
        {sourceEventName && (
          <section>
            <h3 className="text-sm font-medium text-gray-700 mb-1">Source Event</h3>
            <button
              onClick={onSourceEventClick}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              {sourceEventName}
            </button>
          </section>
        )}
      </div>
    </aside>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/metrics/MetricDetailPanel.test.tsx --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/metrics/MetricDetailPanel.tsx src/components/metrics/MetricDetailPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(MetricDetailPanel): add Source Event section with click handler

Add optional sourceEventName and onSourceEventClick props.
Renders clickable source event link after How to Improve section.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add stages query and source lookup to MetricCatalogPage

**Files:**
- Modify: `src/routes/MetricCatalogPage.tsx`

**Step 1: Import useNavigate and add stages query**

Add at top of file:

```typescript
import { useNavigate } from "react-router-dom";
```

Inside component, add after existing queries:

```typescript
const navigate = useNavigate();
const stages = useQuery(api.stages.listByJourney,
  journeyId ? { journeyId } : "skip"
);
const activities = useQuery(api.measurementPlan.listActivities);
```

**Step 2: Create inline lookup helper function**

Add inside component, after queries:

```typescript
// Lookup source activity name from metric's relatedActivityId
function getSourceEventName(relatedActivityId: string | undefined): string | undefined {
  if (!relatedActivityId || !stages || !activities) return undefined;
  const stage = stages.find((s) => s._id === relatedActivityId);
  if (!stage) return undefined;
  // Match by stage name to activity name
  return activities.find((a) => a.name === stage.name)?.name;
}
```

**Step 3: Create navigation handler**

Add inside component:

```typescript
const handleSourceEventClick = (activityName: string) => {
  navigate("/measurement-plan", {
    state: { highlightActivity: activityName },
  });
};
```

**Step 4: Update MetricCard rendering to pass sourceEventName**

Update the MetricCard in the grid:

```typescript
<MetricCard
  key={metric._id}
  name={metric.name}
  definition={metric.definition}
  category={metric.category as MetricCategory}
  selected={metric._id === selectedMetricId}
  onClick={() => setSelectedMetricId(metric._id)}
  sourceEventName={getSourceEventName(metric.relatedActivityId)}
/>
```

**Step 5: Update MetricDetailPanel rendering to pass props**

Update the MetricDetailPanel:

```typescript
{selectedMetric && (
  <div className="w-96 flex-shrink-0">
    <MetricDetailPanel
      metric={{
        name: selectedMetric.name,
        definition: selectedMetric.definition,
        formula: selectedMetric.formula,
        category: selectedMetric.category as MetricCategory,
        whyItMatters: selectedMetric.whyItMatters,
        howToImprove: selectedMetric.howToImprove,
      }}
      onClose={() => setSelectedMetricId(null)}
      sourceEventName={getSourceEventName(selectedMetric.relatedActivityId)}
      onSourceEventClick={() => {
        const name = getSourceEventName(selectedMetric.relatedActivityId);
        if (name) handleSourceEventClick(name);
      }}
    />
  </div>
)}
```

**Step 6: Update api import if needed**

Ensure `api.stages.listByJourney` exists. If not, add query to `convex/stages.ts`.

**Step 7: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 8: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx
git commit -m "$(cat <<'EOF'
feat(MetricCatalogPage): add source event lookup and navigation

Fetch stages and activities, perform inline lookup to resolve
source event names from relatedActivityId. Pass to child components.
Navigate to measurement plan with highlight state on click.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add stages.listByJourney query if missing

**Files:**
- Check/Modify: `convex/stages.ts`

**Step 1: Check if query exists**

Search for `listByJourney` in `convex/stages.ts`. If it exists, skip this task.

**Step 2: If missing, add the query**

```typescript
export const listByJourney = query({
  args: { journeyId: v.id("journeys") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("stages")
      .withIndex("by_journey", (q) => q.eq("journeyId", args.journeyId))
      .collect();
  },
});
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit if changes made**

```bash
git add convex/stages.ts
git commit -m "$(cat <<'EOF'
feat(stages): add listByJourney query

Query all stages for a given journey ID.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add highlight-on-nav behavior to MeasurementPlanPage

**Files:**
- Modify: `src/routes/MeasurementPlanPage.tsx`
- Test: `src/routes/MeasurementPlanPage.test.tsx`

**Step 1: Write the failing test**

Add test to `src/routes/MeasurementPlanPage.test.tsx`:

```typescript
import { MemoryRouter } from "react-router-dom";

test("scrolls to highlighted activity from navigation state", async () => {
  // Setup mock data with an activity
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

  // Render with navigation state
  render(
    <MemoryRouter initialEntries={[{ pathname: "/measurement-plan", state: { highlightActivity: "Account Created" } }]}>
      <MeasurementPlanPage />
    </MemoryRouter>
  );

  // The activity row should be in the document
  expect(await screen.findByText("Account Created")).toBeInTheDocument();
});
```

Note: Full scroll behavior is hard to test in JSDOM. The test verifies the component renders with state.

**Step 2: Add useLocation import and read state**

Add to imports in `src/routes/MeasurementPlanPage.tsx`:

```typescript
import { useLocation } from "react-router-dom";
```

Inside component, add:

```typescript
const location = useLocation();
const highlightActivity = (location.state as { highlightActivity?: string } | null)?.highlightActivity;
```

**Step 3: Add useEffect for scroll-into-view**

Add useEffect and useRef:

```typescript
import { useState, useEffect, useRef } from "react";

// Inside component
const activityRefs = useRef<Map<string, HTMLElement>>(new Map());

useEffect(() => {
  if (highlightActivity && activityRefs.current.has(highlightActivity)) {
    const element = activityRefs.current.get(highlightActivity);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Clear state to avoid re-highlighting on re-renders
    window.history.replaceState({}, document.title);
  }
}, [highlightActivity, fullPlan]);
```

**Step 4: Update activity row to set ref**

Find the activity row div and add ref callback:

```typescript
<div
  key={activity._id}
  ref={(el) => {
    if (el) activityRefs.current.set(activity.name, el);
  }}
  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
>
```

**Step 5: Run tests**

Run: `npm test -- src/routes/MeasurementPlanPage.test.tsx --run`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/routes/MeasurementPlanPage.tsx src/routes/MeasurementPlanPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(MeasurementPlanPage): scroll to activity from navigation state

Read highlightActivity from location.state, scroll to matching
activity row on mount. Clear state after scrolling.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Run full test suite and verify

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests PASS

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 4: Manual verification (if dev server available)**

1. Start dev server: `npm run dev`
2. Navigate to Metric Catalog
3. Verify MetricCard shows "Source: {name}" for metrics with source
4. Click a metric, verify detail panel shows "Source Event" section
5. Click source event link, verify navigation to Measurement Plan
6. Verify activity scrolls into view

---

## Summary

**Total Tasks:** 6

**Files Modified:**
- `src/components/metrics/MetricCard.tsx` - Add sourceEventName prop
- `src/components/metrics/MetricCard.test.tsx` - Add tests
- `src/components/metrics/MetricDetailPanel.tsx` - Add Source Event section
- `src/components/metrics/MetricDetailPanel.test.tsx` - Add tests
- `src/routes/MetricCatalogPage.tsx` - Add lookup and navigation
- `src/routes/MeasurementPlanPage.tsx` - Add scroll-to highlight
- `src/routes/MeasurementPlanPage.test.tsx` - Add test
- `convex/stages.ts` - Add listByJourney query (if missing)

**Testing Strategy:**
- Unit tests for MetricCard and MetricDetailPanel component changes
- Integration test for MeasurementPlanPage highlight behavior
- Full test suite run at end
