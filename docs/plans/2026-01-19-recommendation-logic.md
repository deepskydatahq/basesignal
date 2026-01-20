# Recommendation Logic Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a SuggestedNextAction component that recommends the next step based on profile completion state.

**Architecture:** Self-contained presentational component that receives `nextSection` and `lastCompleted` props from ProfilePage. ProfilePage computes the recommendation by examining completeness data and determining the first incomplete navigable section in the sequence: journey_map → metric_catalog → measurement_plan.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, React Router v7, Vitest, React Testing Library

---

## Task 1: Create SuggestedNextAction test file with first test

**Files:**
- Create: `src/components/profile/SuggestedNextAction.test.tsx`

**Step 1: Write the failing test for rendering journey_map recommendation**

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SuggestedNextAction } from "./SuggestedNextAction";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function setup(
  nextSection: "journey_map" | "metric_catalog" | "measurement_plan" | null,
  lastCompleted: string | null = null
) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <SuggestedNextAction nextSection={nextSection} lastCompleted={lastCompleted} />
    </MemoryRouter>
  );
  return { user };
}

test("renders journey_map recommendation with correct content", () => {
  setup("journey_map", null);

  expect(screen.getByText("Map your user journey")).toBeInTheDocument();
  expect(
    screen.getByText("A 10-minute conversation to identify your product's key lifecycle moments.")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start Overview Interview/i })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run SuggestedNextAction.test.tsx`
Expected: FAIL with "Cannot find module './SuggestedNextAction'"

**Step 3: Commit test file**

```bash
git add src/components/profile/SuggestedNextAction.test.tsx
git commit -m "test: add first test for SuggestedNextAction component"
```

---

## Task 2: Create minimal SuggestedNextAction component

**Files:**
- Create: `src/components/profile/SuggestedNextAction.tsx`

**Step 1: Write minimal implementation to pass the test**

```typescript
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuggestedNextActionProps {
  nextSection: "journey_map" | "metric_catalog" | "measurement_plan" | null;
  lastCompleted: string | null;
}

export function SuggestedNextAction({
  nextSection,
  lastCompleted,
}: SuggestedNextActionProps) {
  const navigate = useNavigate();

  if (!nextSection) return null;

  let heading: string;
  let description: string;
  let buttonLabel: string;
  let route: string;

  if (nextSection === "journey_map") {
    heading =
      lastCompleted === "core_identity"
        ? "Now let's map your user journey"
        : "Map your user journey";
    description =
      "A 10-minute conversation to identify your product's key lifecycle moments.";
    buttonLabel = "Start Overview Interview";
    route = "/setup/interview";
  } else if (nextSection === "metric_catalog") {
    heading =
      lastCompleted === "first_value"
        ? "Turn your first value moment into metrics"
        : "Generate your metric catalog";
    description =
      "Create a complete set of product metrics based on your journey.";
    buttonLabel = "Generate Metrics";
    route = "/metric-catalog";
  } else {
    heading = "Connect metrics to your data";
    description = "Map your metrics to events from your analytics platform.";
    buttonLabel = "Build Measurement Plan";
    route = "/measurement-plan";
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
      <h3 className="font-semibold text-gray-900">{heading}</h3>
      <p className="mt-1 text-sm text-gray-600">{description}</p>
      <Button onClick={() => navigate(route)} className="mt-3" size="sm">
        {buttonLabel}
        <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Step 2: Run test to verify it passes**

Run: `npm test -- --run SuggestedNextAction.test.tsx`
Expected: PASS

**Step 3: Commit implementation**

```bash
git add src/components/profile/SuggestedNextAction.tsx
git commit -m "feat: add SuggestedNextAction component with journey_map case"
```

---

## Task 3: Add tests for all three section cases and null case

**Files:**
- Modify: `src/components/profile/SuggestedNextAction.test.tsx`

**Step 1: Add tests for remaining cases**

Add these tests to the existing test file:

```typescript
import { beforeEach } from "vitest";

// Add beforeEach after vi.mock block
beforeEach(() => {
  mockNavigate.mockReset();
});

test("renders contextual heading when lastCompleted is core_identity", () => {
  setup("journey_map", "core_identity");

  expect(screen.getByText("Now let's map your user journey")).toBeInTheDocument();
});

test("renders metric_catalog recommendation with correct content", () => {
  setup("metric_catalog", null);

  expect(screen.getByText("Generate your metric catalog")).toBeInTheDocument();
  expect(
    screen.getByText("Create a complete set of product metrics based on your journey.")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Generate Metrics/i })).toBeInTheDocument();
});

test("renders contextual heading when lastCompleted is first_value", () => {
  setup("metric_catalog", "first_value");

  expect(screen.getByText("Turn your first value moment into metrics")).toBeInTheDocument();
});

test("renders measurement_plan recommendation with correct content", () => {
  setup("measurement_plan", null);

  expect(screen.getByText("Connect metrics to your data")).toBeInTheDocument();
  expect(
    screen.getByText("Map your metrics to events from your analytics platform.")
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Build Measurement Plan/i })).toBeInTheDocument();
});

test("returns null when nextSection is null", () => {
  const { container } = render(
    <MemoryRouter>
      <SuggestedNextAction nextSection={null} lastCompleted={null} />
    </MemoryRouter>
  );

  expect(container).toBeEmptyDOMElement();
});
```

Note: Update the setup function to return container by modifying its return statement:

```typescript
function setup(
  nextSection: "journey_map" | "metric_catalog" | "measurement_plan" | null,
  lastCompleted: string | null = null
) {
  const user = userEvent.setup();
  const { container } = render(
    <MemoryRouter>
      <SuggestedNextAction nextSection={nextSection} lastCompleted={lastCompleted} />
    </MemoryRouter>
  );
  return { user, container };
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run SuggestedNextAction.test.tsx`
Expected: PASS (all tests)

**Step 3: Commit tests**

```bash
git add src/components/profile/SuggestedNextAction.test.tsx
git commit -m "test: add tests for all SuggestedNextAction cases"
```

---

## Task 4: Add navigation tests

**Files:**
- Modify: `src/components/profile/SuggestedNextAction.test.tsx`

**Step 1: Add navigation tests for each CTA button**

Add these tests to the existing test file:

```typescript
test("navigates to /setup/interview when journey_map CTA is clicked", async () => {
  const { user } = setup("journey_map", null);

  await user.click(screen.getByRole("button", { name: /Start Overview Interview/i }));

  expect(mockNavigate).toHaveBeenCalledWith("/setup/interview");
});

test("navigates to /metric-catalog when metric_catalog CTA is clicked", async () => {
  const { user } = setup("metric_catalog", null);

  await user.click(screen.getByRole("button", { name: /Generate Metrics/i }));

  expect(mockNavigate).toHaveBeenCalledWith("/metric-catalog");
});

test("navigates to /measurement-plan when measurement_plan CTA is clicked", async () => {
  const { user } = setup("measurement_plan", null);

  await user.click(screen.getByRole("button", { name: /Build Measurement Plan/i }));

  expect(mockNavigate).toHaveBeenCalledWith("/measurement-plan");
});
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run SuggestedNextAction.test.tsx`
Expected: PASS (all tests)

**Step 3: Commit tests**

```bash
git add src/components/profile/SuggestedNextAction.test.tsx
git commit -m "test: add navigation tests for SuggestedNextAction"
```

---

## Task 5: Export SuggestedNextAction from index

**Files:**
- Modify: `src/components/profile/index.ts`

**Step 1: Add export**

Add to `src/components/profile/index.ts`:

```typescript
export { SuggestedNextAction } from "./SuggestedNextAction";
```

The file should look like:

```typescript
// src/components/profile/index.ts

export { JourneyDiagram } from "./JourneyDiagram";
export { JourneyMapSection } from "./JourneyMapSection";
export { ProfileSection } from "./ProfileSection";
export type { ProfileSectionStatus } from "./ProfileSection";
export { SuggestedNextAction } from "./SuggestedNextAction";
```

**Step 2: Run tests to verify nothing broke**

Run: `npm test -- --run`
Expected: PASS (all tests)

**Step 3: Commit export**

```bash
git add src/components/profile/index.ts
git commit -m "feat: export SuggestedNextAction from profile index"
```

---

## Task 6: Add integration test for ProfilePage with SuggestedNextAction

**Files:**
- Modify: `src/components/profile/ProfilePage.test.tsx`

**Step 1: Add test for recommendation logic in ProfilePage**

Add these tests to `ProfilePage.test.tsx`:

```typescript
test("shows SuggestedNextAction for journey_map when journey incomplete", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [
        { id: "core_identity", name: "Core Identity", complete: true },
        { id: "journey_map", name: "Journey Map", complete: false },
        { id: "first_value", name: "First Value", complete: false },
        { id: "metric_catalog", name: "Metric Catalog", complete: false },
        { id: "measurement_plan", name: "Measurement Plan", complete: false },
      ],
      completed: 1,
      total: 5,
      percentage: 20,
    },
  });

  expect(screen.getByText("Now let's map your user journey")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start Overview Interview/i })).toBeInTheDocument();
});

test("shows SuggestedNextAction for metric_catalog when journey complete", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [{ id: "1" }], journeyId: "journey-1" },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [
        { id: "core_identity", name: "Core Identity", complete: true },
        { id: "journey_map", name: "Journey Map", complete: true },
        { id: "first_value", name: "First Value", complete: false },
        { id: "metric_catalog", name: "Metric Catalog", complete: false },
        { id: "measurement_plan", name: "Measurement Plan", complete: false },
      ],
      completed: 2,
      total: 5,
      percentage: 40,
    },
  });

  expect(screen.getByText("Generate your metric catalog")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Generate Metrics/i })).toBeInTheDocument();
});

test("shows SuggestedNextAction for measurement_plan when metrics complete", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [{ id: "1" }], journeyId: "journey-1" },
    firstValue: { confirmedAt: Date.now() },
    metricCatalog: { metrics: { reach: [{ _id: "1", name: "M1", category: "reach" }] }, totalCount: 1 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [
        { id: "core_identity", name: "Core Identity", complete: true },
        { id: "journey_map", name: "Journey Map", complete: true },
        { id: "first_value", name: "First Value", complete: true },
        { id: "metric_catalog", name: "Metric Catalog", complete: true },
        { id: "measurement_plan", name: "Measurement Plan", complete: false },
      ],
      completed: 4,
      total: 5,
      percentage: 80,
    },
  });

  expect(screen.getByText("Connect metrics to your data")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Build Measurement Plan/i })).toBeInTheDocument();
});

test("does not show SuggestedNextAction when all navigable sections complete", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [{ id: "1" }], journeyId: "journey-1" },
    firstValue: { confirmedAt: Date.now() },
    metricCatalog: { metrics: { reach: [{ _id: "1", name: "M1", category: "reach" }] }, totalCount: 1 },
    measurementPlan: { entities: [{ id: "e1" }], activityCount: 1, propertyCount: 1 },
    completeness: {
      sections: [
        { id: "core_identity", name: "Core Identity", complete: true },
        { id: "journey_map", name: "Journey Map", complete: true },
        { id: "first_value", name: "First Value", complete: true },
        { id: "metric_catalog", name: "Metric Catalog", complete: true },
        { id: "measurement_plan", name: "Measurement Plan", complete: true },
      ],
      completed: 5,
      total: 5,
      percentage: 100,
    },
  });

  // None of the SuggestedNextAction headings should be visible
  expect(screen.queryByText("Map your user journey")).not.toBeInTheDocument();
  expect(screen.queryByText("Now let's map your user journey")).not.toBeInTheDocument();
  expect(screen.queryByText("Generate your metric catalog")).not.toBeInTheDocument();
  expect(screen.queryByText("Connect metrics to your data")).not.toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail (component not integrated yet)**

Run: `npm test -- --run ProfilePage.test.tsx`
Expected: FAIL (SuggestedNextAction not rendered in ProfilePage yet)

**Step 3: Commit failing tests**

```bash
git add src/components/profile/ProfilePage.test.tsx
git commit -m "test: add ProfilePage integration tests for SuggestedNextAction"
```

---

## Task 7: Integrate SuggestedNextAction into ProfilePage

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx`

**Step 1: Add import and computation logic**

Add import at top of file:

```typescript
import { SuggestedNextAction } from "./SuggestedNextAction";
```

**Step 2: Add computation logic before return statement**

Add after the `flatMetrics` computation and before the `return` statement:

```typescript
// Compute recommendation for next action
const NAVIGABLE_SECTIONS = ["journey_map", "metric_catalog", "measurement_plan"] as const;
const sections = profileData.completeness.sections.slice(0, 5);
const completedIds = sections.filter((s) => s.complete).map((s) => s.id);
const nextSection = NAVIGABLE_SECTIONS.find((id) => !completedIds.includes(id)) ?? null;
const lastCompleted = completedIds.length > 0 ? completedIds[completedIds.length - 1] : null;
```

**Step 3: Add SuggestedNextAction renders in JSX**

Update the return statement to include SuggestedNextAction at three positions:

```typescript
return (
  <div className="max-w-4xl mx-auto px-6 py-8">
    {/* Header with completeness */}
    <div className="mb-8">
      <h1 className="text-2xl font-semibold text-gray-900">
        {profileData.identity.productName || "Your Product"}
      </h1>
      <div className="mt-2 text-sm text-gray-500">
        {profileData.completeness.completed}/{profileData.completeness.total}
      </div>
    </div>

    <div className="space-y-6">
      <CoreIdentitySection data={profileData.identity} />

      {nextSection === "journey_map" && (
        <SuggestedNextAction nextSection={nextSection} lastCompleted={lastCompleted} />
      )}

      <JourneyMapSection journeyId={profileData.journeyMap.journeyId} />

      {nextSection === "metric_catalog" && (
        <SuggestedNextAction nextSection={nextSection} lastCompleted={lastCompleted} />
      )}

      <FirstValueSection />

      <MetricCatalogSection metrics={flatMetrics} />

      {nextSection === "measurement_plan" && (
        <SuggestedNextAction nextSection={nextSection} lastCompleted={lastCompleted} />
      )}

      <MeasurementPlanSection plan={measurementPlan ?? []} />
    </div>
  </div>
);
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run ProfilePage.test.tsx`
Expected: PASS (all tests)

**Step 5: Commit integration**

```bash
git add src/components/profile/ProfilePage.tsx
git commit -m "feat: integrate SuggestedNextAction into ProfilePage"
```

---

## Task 8: Run full test suite and verify build

**Files:**
- None (verification only)

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: PASS (all tests)

**Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit any final fixes if needed**

If any issues are found, fix them and commit with appropriate message.

---

## Summary

**Files Created:**
- `src/components/profile/SuggestedNextAction.tsx` - Main component
- `src/components/profile/SuggestedNextAction.test.tsx` - Test suite

**Files Modified:**
- `src/components/profile/index.ts` - Added export
- `src/components/profile/ProfilePage.tsx` - Added computation and rendering
- `src/components/profile/ProfilePage.test.tsx` - Added integration tests

**Testing Strategy:**
- Unit tests for SuggestedNextAction component covering all 3 section cases, null case, and contextual headings
- Navigation tests verifying correct routes for each CTA
- Integration tests in ProfilePage verifying recommendation logic computation

**Edge Cases Covered:**
- None complete → recommend journey_map
- Core Identity only complete → recommend journey_map with contextual heading
- Journey complete → recommend metric_catalog
- First Value complete → recommend metric_catalog with contextual heading
- Metrics complete → recommend measurement_plan
- All navigable complete → don't render component
