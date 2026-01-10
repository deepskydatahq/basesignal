# Metric Catalog: Catalog View UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the Metric Catalog page with card grid layout, category badges, and slide-in detail panel.

**Architecture:** Page component fetches metrics via `useQuery`, renders 2-column card grid. Clicking a card opens a slide-in panel showing full metric details. Empty state prompts users to complete the Overview Interview.

**Tech Stack:** React 19, React Router v7, Tailwind CSS, Convex (useQuery), RTL + Vitest (testing)

---

## Prerequisites

This plan assumes Issue #24 (Metric Catalog Schema) has been completed and the following exist:
- `convex/schema.ts` has the `metrics` table
- `convex/metrics.ts` has `list`, `get`, `count` queries

If not complete, run that plan first.

---

## Task 1: Add CategoryBadge Component

**Files:**
- Create: `src/components/metrics/CategoryBadge.tsx`
- Test: `src/components/metrics/CategoryBadge.test.tsx`

**Step 1: Write failing test**

Create `src/components/metrics/CategoryBadge.test.tsx`:

```tsx
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryBadge } from "./CategoryBadge";

test("renders reach category with blue styling", () => {
  render(<CategoryBadge category="reach" />);

  const badge = screen.getByText("Reach");
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass("bg-blue-100", "text-blue-700");
});

test("renders engagement category with green styling", () => {
  render(<CategoryBadge category="engagement" />);

  const badge = screen.getByText("Engagement");
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass("bg-green-100", "text-green-700");
});

test("renders value_delivery category with purple styling", () => {
  render(<CategoryBadge category="value_delivery" />);

  const badge = screen.getByText("Value Delivery");
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass("bg-purple-100", "text-purple-700");
});

test("renders value_capture category with orange styling", () => {
  render(<CategoryBadge category="value_capture" />);

  const badge = screen.getByText("Value Capture");
  expect(badge).toBeInTheDocument();
  expect(badge).toHaveClass("bg-orange-100", "text-orange-700");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/metrics/CategoryBadge.test.tsx`
Expected: FAIL (module not found)

**Step 3: Write implementation**

Create `src/components/metrics/CategoryBadge.tsx`:

```tsx
import { cn } from "@/lib/utils";

export type MetricCategory = "reach" | "engagement" | "value_delivery" | "value_capture";

const categoryConfig: Record<MetricCategory, { label: string; className: string }> = {
  reach: {
    label: "Reach",
    className: "bg-blue-100 text-blue-700",
  },
  engagement: {
    label: "Engagement",
    className: "bg-green-100 text-green-700",
  },
  value_delivery: {
    label: "Value Delivery",
    className: "bg-purple-100 text-purple-700",
  },
  value_capture: {
    label: "Value Capture",
    className: "bg-orange-100 text-orange-700",
  },
};

interface CategoryBadgeProps {
  category: MetricCategory;
  className?: string;
}

export function CategoryBadge({ category, className }: CategoryBadgeProps) {
  const config = categoryConfig[category];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/metrics/CategoryBadge.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/components/metrics/CategoryBadge.tsx src/components/metrics/CategoryBadge.test.tsx
git commit -m "feat: add CategoryBadge component for metric categories"
```

---

## Task 2: Add MetricCard Component

**Files:**
- Create: `src/components/metrics/MetricCard.tsx`
- Test: `src/components/metrics/MetricCard.test.tsx`

**Step 1: Write failing test**

Create `src/components/metrics/MetricCard.test.tsx`:

```tsx
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricCard } from "./MetricCard";

function setup(props: Partial<Parameters<typeof MetricCard>[0]> = {}) {
  const user = userEvent.setup();
  const onClick = props.onClick ?? vi.fn();
  const defaultProps = {
    name: "Activation Rate",
    definition: "Percentage of users who complete their first value action",
    category: "value_delivery" as const,
    selected: false,
    onClick,
    ...props,
  };
  render(<MetricCard {...defaultProps} />);
  return { user, onClick };
}

test("renders metric name and definition", () => {
  setup({
    name: "Daily Active Users",
    definition: "Users who performed any action in the last 24 hours",
  });

  expect(screen.getByText("Daily Active Users")).toBeInTheDocument();
  expect(screen.getByText("Users who performed any action in the last 24 hours")).toBeInTheDocument();
});

test("renders category badge", () => {
  setup({ category: "engagement" });

  expect(screen.getByText("Engagement")).toBeInTheDocument();
});

test("truncates long definitions", () => {
  const longDefinition = "This is a very long definition that should be truncated after two lines because we want to keep the card compact and easy to scan in the grid layout.";
  setup({ definition: longDefinition });

  const definitionElement = screen.getByText(longDefinition);
  expect(definitionElement).toHaveClass("line-clamp-2");
});

test("calls onClick when card is clicked", async () => {
  const onClick = vi.fn();
  const { user } = setup({ onClick });

  await user.click(screen.getByRole("button"));

  expect(onClick).toHaveBeenCalledOnce();
});

test("shows selected state with ring", () => {
  setup({ selected: true });

  const card = screen.getByRole("button");
  expect(card).toHaveClass("ring-2", "ring-black");
});

test("does not show ring when not selected", () => {
  setup({ selected: false });

  const card = screen.getByRole("button");
  expect(card).not.toHaveClass("ring-2");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/metrics/MetricCard.test.tsx`
Expected: FAIL (module not found)

**Step 3: Write implementation**

Create `src/components/metrics/MetricCard.tsx`:

```tsx
import { cn } from "@/lib/utils";
import { CategoryBadge, type MetricCategory } from "./CategoryBadge";

interface MetricCardProps {
  name: string;
  definition: string;
  category: MetricCategory;
  selected?: boolean;
  onClick?: () => void;
}

export function MetricCard({
  name,
  definition,
  category,
  selected = false,
  onClick,
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
    </button>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/metrics/MetricCard.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/components/metrics/MetricCard.tsx src/components/metrics/MetricCard.test.tsx
git commit -m "feat: add MetricCard component for metric grid"
```

---

## Task 3: Add MetricDetailPanel Component

**Files:**
- Create: `src/components/metrics/MetricDetailPanel.tsx`
- Test: `src/components/metrics/MetricDetailPanel.test.tsx`

**Step 1: Write failing test**

Create `src/components/metrics/MetricDetailPanel.test.tsx`:

```tsx
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricDetailPanel } from "./MetricDetailPanel";

const mockMetric = {
  name: "Activation Rate",
  definition: "Percentage of users who complete their first value action within 7 days of signup",
  formula: "Users who completed First Project / Users who signed up",
  category: "value_delivery" as const,
  whyItMatters: "Activation rate measures how well you deliver initial value. A low rate signals friction in your onboarding flow.",
  howToImprove: "Simplify onboarding steps, add progress indicators, send reminder emails for incomplete setups.",
};

function setup(props: Partial<Parameters<typeof MetricDetailPanel>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const defaultProps = {
    metric: mockMetric,
    onClose,
    ...props,
  };
  render(<MetricDetailPanel {...defaultProps} />);
  return { user, onClose };
}

test("renders metric name and category badge", () => {
  setup();

  expect(screen.getByText("Activation Rate")).toBeInTheDocument();
  expect(screen.getByText("Value Delivery")).toBeInTheDocument();
});

test("renders full definition", () => {
  setup();

  expect(screen.getByText(mockMetric.definition)).toBeInTheDocument();
});

test("renders formula in monospace", () => {
  setup();

  const formula = screen.getByText(mockMetric.formula);
  expect(formula).toBeInTheDocument();
  expect(formula).toHaveClass("font-mono");
});

test("renders Why It Matters section", () => {
  setup();

  expect(screen.getByText("Why It Matters")).toBeInTheDocument();
  expect(screen.getByText(mockMetric.whyItMatters)).toBeInTheDocument();
});

test("renders How to Improve section", () => {
  setup();

  expect(screen.getByText("How to Improve")).toBeInTheDocument();
  expect(screen.getByText(mockMetric.howToImprove)).toBeInTheDocument();
});

test("calls onClose when close button is clicked", async () => {
  const onClose = vi.fn();
  const { user } = setup({ onClose });

  await user.click(screen.getByRole("button", { name: /close/i }));

  expect(onClose).toHaveBeenCalledOnce();
});

test("has correct width and positioning classes", () => {
  setup();

  const panel = screen.getByRole("complementary");
  expect(panel).toHaveClass("w-96", "absolute", "right-0");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/metrics/MetricDetailPanel.test.tsx`
Expected: FAIL (module not found)

**Step 3: Write implementation**

Create `src/components/metrics/MetricDetailPanel.tsx`:

```tsx
import { X } from "lucide-react";
import { CategoryBadge, type MetricCategory } from "./CategoryBadge";

interface MetricData {
  name: string;
  definition: string;
  formula: string;
  category: MetricCategory;
  whyItMatters: string;
  howToImprove: string;
}

interface MetricDetailPanelProps {
  metric: MetricData;
  onClose: () => void;
}

export function MetricDetailPanel({ metric, onClose }: MetricDetailPanelProps) {
  return (
    <aside
      role="complementary"
      className="absolute top-0 right-0 w-96 h-full bg-white border-l border-gray-200 shadow-lg z-10 overflow-y-auto"
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
      </div>
    </aside>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/metrics/MetricDetailPanel.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/components/metrics/MetricDetailPanel.tsx src/components/metrics/MetricDetailPanel.test.tsx
git commit -m "feat: add MetricDetailPanel component for metric details"
```

---

## Task 4: Add MetricCatalogPage Component

**Files:**
- Create: `src/routes/MetricCatalogPage.tsx`
- Test: `src/routes/MetricCatalogPage.test.tsx`

**Step 1: Write failing test**

Create `src/routes/MetricCatalogPage.test.tsx`:

```tsx
import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MetricCatalogPage from "./MetricCatalogPage";

// Mock Convex
const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Mock the api import
vi.mock("../../convex/_generated/api", () => ({
  api: {
    metrics: {
      list: "metrics:list",
    },
  },
}));

const mockMetrics = [
  {
    _id: "metric1",
    name: "New Users",
    definition: "Count of new signups per period",
    formula: "Count(signups)",
    category: "reach",
    whyItMatters: "Shows acquisition health",
    howToImprove: "Improve marketing",
    order: 1,
  },
  {
    _id: "metric2",
    name: "DAU",
    definition: "Daily active users count",
    formula: "Count(active users per day)",
    category: "engagement",
    whyItMatters: "Core engagement metric",
    howToImprove: "Add sticky features",
    order: 2,
  },
];

function setup() {
  const user = userEvent.setup();
  render(<MetricCatalogPage />);
  return { user };
}

beforeEach(() => {
  mockUseQuery.mockReset();
});

test("shows loading state while metrics are loading", () => {
  mockUseQuery.mockReturnValue(undefined);
  setup();

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test("shows empty state when no metrics exist", () => {
  mockUseQuery.mockReturnValue([]);
  setup();

  expect(screen.getByText(/complete the overview interview/i)).toBeInTheDocument();
});

test("renders page title and subtitle", () => {
  mockUseQuery.mockReturnValue(mockMetrics);
  setup();

  expect(screen.getByRole("heading", { name: "Metric Catalog" })).toBeInTheDocument();
  expect(screen.getByText(/your personalized metrics/i)).toBeInTheDocument();
});

test("renders metric cards in grid", () => {
  mockUseQuery.mockReturnValue(mockMetrics);
  setup();

  expect(screen.getByText("New Users")).toBeInTheDocument();
  expect(screen.getByText("DAU")).toBeInTheDocument();
});

test("opens detail panel when metric card is clicked", async () => {
  mockUseQuery.mockReturnValue(mockMetrics);
  const { user } = setup();

  await user.click(screen.getByText("New Users"));

  // Panel should now be visible
  const panel = screen.getByRole("complementary");
  expect(within(panel).getByText("New Users")).toBeInTheDocument();
  expect(within(panel).getByText("Shows acquisition health")).toBeInTheDocument();
});

test("closes detail panel when close button is clicked", async () => {
  mockUseQuery.mockReturnValue(mockMetrics);
  const { user } = setup();

  // Open panel
  await user.click(screen.getByText("New Users"));
  expect(screen.getByRole("complementary")).toBeInTheDocument();

  // Close panel
  await user.click(screen.getByRole("button", { name: /close/i }));
  expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
});

test("switches selected metric when different card is clicked", async () => {
  mockUseQuery.mockReturnValue(mockMetrics);
  const { user } = setup();

  // Open first metric
  await user.click(screen.getByText("New Users"));
  expect(within(screen.getByRole("complementary")).getByText("New Users")).toBeInTheDocument();

  // Click second metric
  await user.click(screen.getByText("DAU"));
  expect(within(screen.getByRole("complementary")).getByText("DAU")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/routes/MetricCatalogPage.test.tsx`
Expected: FAIL (module not found)

**Step 3: Write implementation**

Create `src/routes/MetricCatalogPage.tsx`:

```tsx
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { MetricCard } from "@/components/metrics/MetricCard";
import { MetricDetailPanel } from "@/components/metrics/MetricDetailPanel";
import type { MetricCategory } from "@/components/metrics/CategoryBadge";

export default function MetricCatalogPage() {
  const metrics = useQuery(api.metrics.list, {});
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);

  const selectedMetric = metrics?.find((m) => m._id === selectedMetricId);

  if (metrics === undefined) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
        </div>
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
        </div>
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">
            Complete the Overview Interview to generate your Metric Catalog
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl relative">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Metric Catalog</h1>
        <p className="mt-1 text-sm text-gray-500">Your personalized metrics for measuring product performance</p>
      </div>

      <div className="flex gap-6">
        {/* Metric Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-2 gap-4">
            {metrics.map((metric) => (
              <MetricCard
                key={metric._id}
                name={metric.name}
                definition={metric.definition}
                category={metric.category as MetricCategory}
                selected={metric._id === selectedMetricId}
                onClick={() => setSelectedMetricId(metric._id)}
              />
            ))}
          </div>
        </div>

        {/* Detail Panel */}
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
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/routes/MetricCatalogPage.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx src/routes/MetricCatalogPage.test.tsx
git commit -m "feat: add MetricCatalogPage with grid and detail panel"
```

---

## Task 5: Add Route and Navigation

**Files:**
- Modify: `src/App.tsx:127` (add route)
- Modify: `src/components/Sidebar.tsx:20-23` (add nav item)

**Step 1: Add route to App.tsx**

In `src/App.tsx`, add import at top:

```tsx
import MetricCatalogPage from './routes/MetricCatalogPage'
```

Then add route after line 136 (after journeys route):

```tsx
<Route path="metric-catalog" element={<MetricCatalogPage />} />
```

**Step 2: Add navigation item to Sidebar**

In `src/components/Sidebar.tsx`, add import:

```tsx
import { Home, Route, Settings, Lock, BarChart3 } from 'lucide-react'
```

Then update `navItems` array (around line 20):

```tsx
const navItems: NavItemConfig[] = [
  { icon: Home, label: 'Home', to: '/', requiresSetupComplete: true },
  { icon: Route, label: 'Journeys', to: '/journeys', requiresSetupComplete: true },
  { icon: BarChart3, label: 'Metrics', to: '/metric-catalog', requiresSetupComplete: true },
]
```

**Step 3: Verify navigation works**

Run: `npm run dev`
- Navigate to the app
- Confirm "Metrics" appears in sidebar
- Click it to confirm route works

**Step 4: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx
git commit -m "feat: add metric catalog route and navigation"
```

---

## Task 6: Update Schema for Category Field

The current schema doesn't include `category`. We need to add it.

**Files:**
- Modify: `convex/schema.ts` (add category field)

**Step 1: Add category to metrics schema**

In `convex/schema.ts`, update the metrics table definition to include:

```typescript
category: v.string(),  // "reach" | "engagement" | "value_delivery" | "value_capture"
```

Add this after the `howToImprove` field.

**Step 2: Verify schema compiles**

Run: `npx convex dev` - confirm no errors

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add category field to metrics schema"
```

---

## Task 7: Final Verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Manual verification**

Run: `npm run dev` and `npx convex dev`
- Navigate to `/metric-catalog`
- Verify empty state appears (no metrics yet)
- Verify page title and layout

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from verification"
```

---

## Testing Summary

| What | Tool | File |
|------|------|------|
| CategoryBadge component | RTL + Vitest | `src/components/metrics/CategoryBadge.test.tsx` |
| MetricCard component | RTL + Vitest | `src/components/metrics/MetricCard.test.tsx` |
| MetricDetailPanel component | RTL + Vitest | `src/components/metrics/MetricDetailPanel.test.tsx` |
| MetricCatalogPage | RTL + Vitest | `src/routes/MetricCatalogPage.test.tsx` |

Run: `npm run test:run` to verify all tests pass.

---

## File Summary

| Action | Path |
|--------|------|
| Create | `src/components/metrics/CategoryBadge.tsx` |
| Create | `src/components/metrics/CategoryBadge.test.tsx` |
| Create | `src/components/metrics/MetricCard.tsx` |
| Create | `src/components/metrics/MetricCard.test.tsx` |
| Create | `src/components/metrics/MetricDetailPanel.tsx` |
| Create | `src/components/metrics/MetricDetailPanel.test.tsx` |
| Create | `src/routes/MetricCatalogPage.tsx` |
| Create | `src/routes/MetricCatalogPage.test.tsx` |
| Modify | `src/App.tsx` |
| Modify | `src/components/Sidebar.tsx` |
| Modify | `convex/schema.ts` |
