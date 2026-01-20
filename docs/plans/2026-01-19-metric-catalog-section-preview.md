# MetricCatalogSection Preview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the verbose metric list with a compact visual summary showing category distribution via a segmented bar and legend.

**Architecture:** Refactor MetricCatalogSection to display a horizontal segmented progress bar where each segment represents a P&L category (reach, engagement, value_delivery, value_capture) with proportional widths. Below the bar, show a legend with colored dots and "Category: N" counts. Keep the existing "View Full Catalog" action.

**Tech Stack:** React, Tailwind CSS, existing CATEGORY_INFO from metricTemplates.ts

---

## Task 1: Add CATEGORY_COLORS constant

**Files:**
- Modify: `src/shared/metricTemplates.ts:286-294`

**Step 1: Add the CATEGORY_COLORS constant**

Add a new constant mapping each category to its Tailwind background color class for the segmented bar:

```typescript
// Category colors for visual indicators (Tailwind background classes)
export const CATEGORY_COLORS: Record<MetricCategory, string> = {
  reach: "bg-blue-500",
  engagement: "bg-green-500",
  value_delivery: "bg-purple-500",
  value_capture: "bg-orange-500",
};
```

Add this after the existing `CATEGORY_INFO` constant (around line 294).

**Step 2: Verify it exports correctly**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/shared/metricTemplates.ts
git commit -m "feat: add CATEGORY_COLORS constant for metric distribution bar"
```

---

## Task 2: Write failing test for distribution bar rendering

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Write the failing test**

Add a new test that verifies the distribution bar renders with category segments:

```typescript
test("renders distribution bar with category segments", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Trial Starts", category: "reach" },
    { _id: "3", name: "Daily Active Users", category: "engagement" },
    { _id: "4", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Distribution bar should exist
  const distributionBar = screen.getByTestId("metric-distribution-bar");
  expect(distributionBar).toBeInTheDocument();

  // Should have segments for each populated category
  expect(screen.getByTestId("segment-reach")).toBeInTheDocument();
  expect(screen.getByTestId("segment-engagement")).toBeInTheDocument();
  expect(screen.getByTestId("segment-value_delivery")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- MetricCatalogSection.test.tsx`
Expected: FAIL with "Unable to find an element by: [data-testid="metric-distribution-bar"]"

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add failing test for metric distribution bar"
```

---

## Task 3: Write failing test for legend with category counts

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Write the failing test**

Add a test that verifies the legend shows category labels with counts:

```typescript
test("renders legend with category counts", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Trial Starts", category: "reach" },
    { _id: "3", name: "Daily Active Users", category: "engagement" },
    { _id: "4", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Legend should show category names with counts
  expect(screen.getByText("Reach: 2")).toBeInTheDocument();
  expect(screen.getByText("Engagement: 1")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery: 1")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- MetricCatalogSection.test.tsx`
Expected: FAIL with "Unable to find an element with the text: Reach: 2"

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add failing test for metric legend with counts"
```

---

## Task 4: Write failing test that metric names are NOT shown in preview

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Write the failing test**

Add a test verifying individual metric names are no longer displayed (they belong in full catalog):

```typescript
test("does not display individual metric names in preview", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Trial Starts", category: "reach" },
    { _id: "3", name: "Daily Active Users", category: "engagement" },
  ]);

  // Individual metric names should NOT appear in the preview
  expect(screen.queryByText("New Users")).not.toBeInTheDocument();
  expect(screen.queryByText("Trial Starts")).not.toBeInTheDocument();
  expect(screen.queryByText("Daily Active Users")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- MetricCatalogSection.test.tsx`
Expected: FAIL (metric names currently DO appear)

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add failing test verifying metric names hidden in preview"
```

---

## Task 5: Implement distribution bar and legend

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.tsx`

**Step 1: Update imports**

Update the imports to include CATEGORY_COLORS:

```typescript
import { useNavigate } from "react-router-dom";
import { ProfileSection } from "./ProfileSection";
import {
  CATEGORY_INFO,
  CATEGORY_COLORS,
  METRIC_CATEGORIES,
  type MetricCategory,
} from "../../shared/metricTemplates";
```

**Step 2: Replace the metric list with distribution bar and legend**

Replace the entire component with this implementation:

```typescript
interface Metric {
  _id: string;
  name: string;
  category: string;
}

interface MetricCatalogSectionProps {
  metrics: Metric[];
}

export function MetricCatalogSection({ metrics }: MetricCatalogSectionProps) {
  const navigate = useNavigate();

  // Group metrics by category
  const grouped = METRIC_CATEGORIES.reduce(
    (acc, category) => {
      acc[category] = metrics.filter((m) => m.category === category);
      return acc;
    },
    {} as Record<MetricCategory, Metric[]>
  );

  // Only show categories that have metrics
  const populatedCategories = METRIC_CATEGORIES.filter(
    (cat) => grouped[cat].length > 0
  );

  const hasMetrics = metrics.length > 0;
  const statusLabel = hasMetrics ? `${metrics.length} metrics` : "0 metrics";

  return (
    <ProfileSection
      title="Metric Catalog"
      status={hasMetrics ? "complete" : "not_started"}
      statusLabel={statusLabel}
      actionLabel="View Full Catalog"
      onAction={() => navigate("/metric-catalog")}
    >
      {hasMetrics ? (
        <div className="space-y-3">
          {/* Distribution bar */}
          <div
            data-testid="metric-distribution-bar"
            className="h-3 rounded-full overflow-hidden flex"
          >
            {populatedCategories.map((category) => {
              const count = grouped[category].length;
              const widthPercent = (count / metrics.length) * 100;
              return (
                <div
                  key={category}
                  data-testid={`segment-${category}`}
                  className={`${CATEGORY_COLORS[category]} first:rounded-l-full last:rounded-r-full`}
                  style={{ width: `${widthPercent}%` }}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {populatedCategories.map((category) => {
              const info = CATEGORY_INFO[category];
              const count = grouped[category].length;
              return (
                <div
                  key={category}
                  className="flex items-center gap-1.5 text-sm text-gray-600"
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${CATEGORY_COLORS[category]}`}
                  />
                  <span>
                    {info.label}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">
          No metrics in your catalog yet. Complete the Overview Interview to
          generate your first metrics.
        </p>
      )}
    </ProfileSection>
  );
}
```

**Step 3: Run all tests to verify they pass**

Run: `npm test -- MetricCatalogSection.test.tsx`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/profile/MetricCatalogSection.tsx
git commit -m "feat: replace metric list with distribution bar and legend"
```

---

## Task 6: Update existing tests to match new behavior

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Remove or update tests that check for removed behavior**

The test "groups metrics by category with category headers" checks for the old behavior. Update it to verify the new legend behavior instead. Find and replace this test:

Old test to remove:
```typescript
test("groups metrics by category with category headers", () => {
  // ... old implementation
});
```

The new tests from Tasks 2-4 cover this functionality. Simply remove the old test.

Also update the test "hides categories that have no metrics" to verify legend behavior:

```typescript
test("hides empty categories from legend", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Only populated categories should appear in legend
  expect(screen.getByText("Reach: 1")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery: 1")).toBeInTheDocument();

  // Empty categories should not appear
  expect(screen.queryByText(/Engagement:/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Value Capture:/)).not.toBeInTheDocument();
});
```

**Step 2: Run all tests to verify they pass**

Run: `npm test -- MetricCatalogSection.test.tsx`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: update tests to match new preview behavior"
```

---

## Task 7: Write test for single-category edge case

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Write the test**

Add a test verifying the bar works correctly with only one category:

```typescript
test("renders full-width bar when all metrics are in one category", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Trial Starts", category: "reach" },
    { _id: "3", name: "Signups", category: "reach" },
  ]);

  const segment = screen.getByTestId("segment-reach");
  expect(segment).toBeInTheDocument();
  expect(segment).toHaveStyle({ width: "100%" });

  // Only reach should appear in legend
  expect(screen.getByText("Reach: 3")).toBeInTheDocument();
  expect(screen.queryByText(/Engagement:/)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- MetricCatalogSection.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add single-category edge case test"
```

---

## Task 8: Run full test suite and verify build

**Files:** None (verification only)

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Final commit if any cleanup needed**

If any fixes were required, commit them:
```bash
git add -A
git commit -m "fix: address test/build issues"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add CATEGORY_COLORS constant to metricTemplates.ts |
| 2 | Write failing test for distribution bar rendering |
| 3 | Write failing test for legend with category counts |
| 4 | Write failing test that metric names are hidden |
| 5 | Implement distribution bar and legend |
| 6 | Update existing tests to match new behavior |
| 7 | Write test for single-category edge case |
| 8 | Run full test suite and verify build |

**Total:** 8 TDD tasks
