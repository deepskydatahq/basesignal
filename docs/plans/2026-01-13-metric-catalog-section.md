# MetricCatalogSection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a profile section component that displays metrics grouped by P&L category with a link to the full catalog.

**Architecture:** Pure view component receiving `metrics` prop from parent. Groups metrics by the 4 MetricCategory values (reach, engagement, value_delivery, value_capture). Uses ProfileSection wrapper for consistent styling. Renders stacked vertical list with category headers and "View Full Catalog" navigation.

**Tech Stack:** React, Tailwind CSS, react-router-dom (useNavigate), ProfileSection wrapper, CATEGORY_INFO from metricTemplates.ts

**Prerequisite:** ProfileSection component must exist (see `docs/plans/2026-01-13-profile-section.md`). If not yet implemented, complete that plan first.

---

## Task 1: Create MetricCatalogSection Component Skeleton

**Files:**
- Create: `src/components/profile/MetricCatalogSection.tsx`

**Step 1: Create the component file with types**

```typescript
// src/components/profile/MetricCatalogSection.tsx

import { useNavigate } from "react-router-dom";
import { ProfileSection } from "./ProfileSection";
import {
  CATEGORY_INFO,
  METRIC_CATEGORIES,
  type MetricCategory,
} from "../../shared/metricTemplates";

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
        <div className="space-y-4">
          {populatedCategories.map((category) => {
            const info = CATEGORY_INFO[category];
            const categoryMetrics = grouped[category];
            return (
              <div key={category}>
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {info.label}
                </h3>
                <ul className="space-y-1">
                  {categoryMetrics.map((metric) => (
                    <li
                      key={metric._id}
                      className="text-sm text-gray-600 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      {metric.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
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

**Step 2: Commit the skeleton**

```bash
git add src/components/profile/MetricCatalogSection.tsx
git commit -m "feat: add MetricCatalogSection component skeleton

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Write Test for Empty State

**Files:**
- Create: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Write the failing test for empty state**

```typescript
// src/components/profile/MetricCatalogSection.test.tsx

import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MetricCatalogSection } from "./MetricCatalogSection";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

interface Metric {
  _id: string;
  name: string;
  category: string;
}

function setup(metrics: Metric[] = []) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MetricCatalogSection metrics={metrics} />
    </MemoryRouter>
  );
  return { user };
}

test("renders empty state when no metrics provided", () => {
  setup([]);

  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("0 metrics")).toBeInTheDocument();
  expect(
    screen.getByText(/No metrics in your catalog yet/)
  ).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MetricCatalogSection.test.tsx
```

Expected: PASS

**Step 3: Commit the test**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add MetricCatalogSection empty state test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Write Test for Populated State with Metric Count

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Add test for populated state**

Add this test after the empty state test:

```typescript
test("renders metric count in status label when metrics exist", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Daily Active Users", category: "engagement" },
    { _id: "3", name: "Activation Rate", category: "value_delivery" },
  ]);

  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("3 metrics")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MetricCatalogSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add MetricCatalogSection populated state test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Write Test for Category Grouping

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Add test for category grouping**

```typescript
test("groups metrics by category with category headers", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Trial Starts", category: "reach" },
    { _id: "3", name: "Daily Active Users", category: "engagement" },
    { _id: "4", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Category headers should be visible
  expect(screen.getByText("Reach")).toBeInTheDocument();
  expect(screen.getByText("Engagement")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery")).toBeInTheDocument();

  // Metrics should be listed
  expect(screen.getByText("New Users")).toBeInTheDocument();
  expect(screen.getByText("Trial Starts")).toBeInTheDocument();
  expect(screen.getByText("Daily Active Users")).toBeInTheDocument();
  expect(screen.getByText("Activation Rate")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MetricCatalogSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add MetricCatalogSection category grouping test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Write Test for Hidden Empty Categories

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Add test for hidden empty categories**

```typescript
test("hides categories that have no metrics", () => {
  setup([
    { _id: "1", name: "New Users", category: "reach" },
    { _id: "2", name: "Activation Rate", category: "value_delivery" },
  ]);

  // Only populated categories should appear
  expect(screen.getByText("Reach")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery")).toBeInTheDocument();

  // Empty categories should not appear
  expect(screen.queryByText("Engagement")).not.toBeInTheDocument();
  expect(screen.queryByText("Value Capture")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MetricCatalogSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add MetricCatalogSection hidden empty categories test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Write Test for View Full Catalog Navigation

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Add beforeEach to reset mock**

Add at the top of the test file, after the setup function:

```typescript
beforeEach(() => {
  mockNavigate.mockReset();
});
```

**Step 2: Add test for navigation**

```typescript
test("navigates to /metric-catalog when View Full Catalog is clicked", async () => {
  const { user } = setup([
    { _id: "1", name: "New Users", category: "reach" },
  ]);

  await user.click(screen.getByRole("button", { name: "View Full Catalog" }));

  expect(mockNavigate).toHaveBeenCalledWith("/metric-catalog");
});
```

**Step 3: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MetricCatalogSection.test.tsx
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add MetricCatalogSection navigation test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Write Test for Complete Status When Metrics Exist

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Add test for complete status**

```typescript
test("shows complete status when metrics exist", () => {
  setup([{ _id: "1", name: "New Users", category: "reach" }]);

  // The status badge should indicate complete (green styling)
  const statusBadge = screen.getByText("1 metrics").closest("div");
  expect(statusBadge).toHaveClass("text-green-700");
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MetricCatalogSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add MetricCatalogSection complete status test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Write Test for Not Started Status When Empty

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.test.tsx`

**Step 1: Add test for not_started status**

```typescript
test("shows not_started status when no metrics exist", () => {
  setup([]);

  // The status badge should indicate not_started (gray styling)
  const statusBadge = screen.getByText("0 metrics").closest("div");
  expect(statusBadge).toHaveClass("text-gray-500");
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MetricCatalogSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MetricCatalogSection.test.tsx
git commit -m "test: add MetricCatalogSection not_started status test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Run Full Test Suite

**Step 1: Run all MetricCatalogSection tests**

```bash
npm test -- --run src/components/profile/MetricCatalogSection.test.tsx
```

Expected: All 7 tests pass

**Step 2: Run full test suite to check for regressions**

```bash
npm test -- --run
```

Expected: All tests pass

---

## Task 10: Verify Build Passes

**Step 1: Run TypeScript compiler check**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds

---

## Summary

This plan creates `MetricCatalogSection.tsx` with:
- Props interface accepting `metrics` array from parent
- Grouping logic using `METRIC_CATEGORIES` and `CATEGORY_INFO`
- Two visual states: empty (not_started) and populated (complete)
- Category headers with stacked bullet list of metric names
- "View Full Catalog" navigation to `/metric-catalog`
- 7 tests covering empty state, populated state, category grouping, hidden empty categories, navigation, and status states

**Files created:**
- `src/components/profile/MetricCatalogSection.tsx`
- `src/components/profile/MetricCatalogSection.test.tsx`

**Dependencies:**
- Requires `ProfileSection` component to exist first
- Uses existing `CATEGORY_INFO` and `METRIC_CATEGORIES` from `src/shared/metricTemplates.ts`
