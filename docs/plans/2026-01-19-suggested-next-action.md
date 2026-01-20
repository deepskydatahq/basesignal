# SuggestedNextAction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a SuggestedNextAction component that displays the recommended next step based on profile completion state, positioned after the last completed section.

**Architecture:** Pure presentational component receiving completion state from ProfilePage. Three hard-coded cases for the navigable sections (journey_map, metric_catalog, measurement_plan). Returns null when all sections complete.

**Tech Stack:** React, TypeScript, react-router-dom (useNavigate), Tailwind CSS, @/components/ui/button

---

## Task 1: Create SuggestedNextAction Component Tests

**Files:**
- Create: `src/components/profile/SuggestedNextAction.test.tsx`

**Step 1: Write the failing tests**

Create the test file with tests covering all completion states:

```typescript
import { beforeEach, expect, test, vi } from "vitest";
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

type NextSection = "journey_map" | "metric_catalog" | "measurement_plan" | null;

function setup(props: {
  nextSection: NextSection;
  lastCompleted: string | null;
}) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <SuggestedNextAction {...props} />
    </MemoryRouter>
  );
  return { user };
}

beforeEach(() => {
  mockNavigate.mockReset();
});

test("returns null when nextSection is null", () => {
  const { container } = render(
    <MemoryRouter>
      <SuggestedNextAction nextSection={null} lastCompleted="measurement_plan" />
    </MemoryRouter>
  );

  expect(container).toBeEmptyDOMElement();
});

test("renders journey_map suggestion with contextual heading after core_identity", () => {
  setup({ nextSection: "journey_map", lastCompleted: "core_identity" });

  expect(screen.getByText("Now let's map your user journey")).toBeInTheDocument();
  expect(screen.getByText(/10-minute conversation/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start Overview Interview" })).toBeInTheDocument();
});

test("renders journey_map suggestion with default heading when no lastCompleted", () => {
  setup({ nextSection: "journey_map", lastCompleted: null });

  expect(screen.getByText("Map your user journey")).toBeInTheDocument();
});

test("navigates to /setup/interview when journey_map CTA clicked", async () => {
  const { user } = setup({ nextSection: "journey_map", lastCompleted: null });

  await user.click(screen.getByRole("button", { name: "Start Overview Interview" }));

  expect(mockNavigate).toHaveBeenCalledWith("/setup/interview");
});

test("renders metric_catalog suggestion with contextual heading after first_value", () => {
  setup({ nextSection: "metric_catalog", lastCompleted: "first_value" });

  expect(screen.getByText("Turn your first value moment into metrics")).toBeInTheDocument();
  expect(screen.getByText(/complete set of product metrics/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Metrics" })).toBeInTheDocument();
});

test("renders metric_catalog suggestion with default heading when lastCompleted is not first_value", () => {
  setup({ nextSection: "metric_catalog", lastCompleted: "journey_map" });

  expect(screen.getByText("Generate your metric catalog")).toBeInTheDocument();
});

test("navigates to /metric-catalog when metric_catalog CTA clicked", async () => {
  const { user } = setup({ nextSection: "metric_catalog", lastCompleted: null });

  await user.click(screen.getByRole("button", { name: "Generate Metrics" }));

  expect(mockNavigate).toHaveBeenCalledWith("/metric-catalog");
});

test("renders measurement_plan suggestion", () => {
  setup({ nextSection: "measurement_plan", lastCompleted: "metric_catalog" });

  expect(screen.getByText("Connect metrics to your data")).toBeInTheDocument();
  expect(screen.getByText(/Map your metrics to events/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Build Measurement Plan" })).toBeInTheDocument();
});

test("navigates to /measurement-plan when measurement_plan CTA clicked", async () => {
  const { user } = setup({ nextSection: "measurement_plan", lastCompleted: null });

  await user.click(screen.getByRole("button", { name: "Build Measurement Plan" }));

  expect(mockNavigate).toHaveBeenCalledWith("/measurement-plan");
});

test("renders with blue background styling", () => {
  setup({ nextSection: "journey_map", lastCompleted: null });

  const container = screen.getByText("Map your user journey").closest("div");
  expect(container).toHaveClass("bg-blue-50");
  expect(container).toHaveClass("border-blue-200");
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/profile/SuggestedNextAction.test.tsx --run`

Expected: FAIL with "Cannot find module './SuggestedNextAction'"

---

## Task 2: Create SuggestedNextAction Component

**Files:**
- Create: `src/components/profile/SuggestedNextAction.tsx`

**Step 1: Write minimal implementation**

```typescript
// src/components/profile/SuggestedNextAction.tsx

import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

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

  // Inline the 3 cases - no abstraction needed
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

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/components/profile/SuggestedNextAction.test.tsx --run`

Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/components/profile/SuggestedNextAction.tsx src/components/profile/SuggestedNextAction.test.tsx
git commit -m "$(cat <<'EOF'
feat: add SuggestedNextAction component

Creates a component that displays recommended next steps based on profile
completion state. Supports three navigable sections with contextual headings.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Export SuggestedNextAction from index

**Files:**
- Modify: `src/components/profile/index.ts`

**Step 1: Add export**

Add to `src/components/profile/index.ts`:

```typescript
export { SuggestedNextAction } from "./SuggestedNextAction";
```

**Step 2: Run tests to verify nothing broke**

Run: `npm test -- src/components/profile --run`

Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/components/profile/index.ts
git commit -m "$(cat <<'EOF'
chore: export SuggestedNextAction from profile index

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrate SuggestedNextAction into ProfilePage

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx`

**Step 1: Update ProfilePage to compute and render suggested actions**

Replace content of `src/components/profile/ProfilePage.tsx`:

```typescript
import { useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { CoreIdentitySection } from "./CoreIdentitySection";
import { FirstValueSection } from "./FirstValueSection";
import { MetricCatalogSection } from "./MetricCatalogSection";
import { MeasurementPlanSection } from "./MeasurementPlanSection";
import { JourneyMapSection } from "./JourneyMapSection";
import { SuggestedNextAction } from "./SuggestedNextAction";

export function ProfilePage() {
  const profileData = useQuery(api.profile.getProfileData);
  const measurementPlan = useQuery(api.measurementPlan.getFullPlan);

  // Loading state
  if (profileData === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse text-gray-500">Loading profile...</div>
      </div>
    );
  }

  // Not authenticated
  if (profileData === null) {
    return <Navigate to="/sign-in" />;
  }

  // Flatten metrics from grouped structure
  const flatMetrics = Object.values(profileData.metricCatalog.metrics)
    .flat()
    .map((m) => ({
      _id: m._id,
      name: m.name,
      category: m.category,
    }));

  // Compute next section to suggest
  const sections = profileData.completeness.sections.slice(0, 5);
  const completedIds = sections.filter((s) => s.complete).map((s) => s.id);
  const navigableSections = [
    "journey_map",
    "metric_catalog",
    "measurement_plan",
  ] as const;
  const nextSection =
    navigableSections.find((id) => !completedIds.includes(id)) ?? null;
  const lastCompleted =
    completedIds.length > 0 ? completedIds[completedIds.length - 1] : null;

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
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <JourneyMapSection journeyId={profileData.journeyMap.journeyId} />

        {nextSection === "metric_catalog" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <FirstValueSection />

        <MetricCatalogSection metrics={flatMetrics} />

        {nextSection === "measurement_plan" && (
          <SuggestedNextAction
            nextSection={nextSection}
            lastCompleted={lastCompleted}
          />
        )}

        <MeasurementPlanSection plan={measurementPlan ?? []} />
      </div>
    </div>
  );
}
```

**Step 2: Run tests to verify nothing broke**

Run: `npm test -- src/components/profile --run`

Expected: All tests PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfilePage.tsx
git commit -m "$(cat <<'EOF'
feat: integrate SuggestedNextAction into ProfilePage

Computes next section from completion state and renders SuggestedNextAction
at fixed positions after CoreIdentitySection, JourneyMapSection, and
MetricCatalogSection based on what the user should do next.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add ProfilePage integration tests for SuggestedNextAction

**Files:**
- Modify: `src/components/profile/ProfilePage.test.tsx`

**Step 1: Read current ProfilePage test file**

Read `src/components/profile/ProfilePage.test.tsx` to understand existing test structure.

**Step 2: Add tests for SuggestedNextAction integration**

Add the following tests to the existing test file:

```typescript
test("shows journey_map suggestion when core_identity complete but journey_map incomplete", () => {
  setup({
    identity: { productName: "My Product" },
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
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
  });

  expect(screen.getByText("Now let's map your user journey")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start Overview Interview" })).toBeInTheDocument();
});

test("shows metric_catalog suggestion when journey_map complete but metric_catalog incomplete", () => {
  setup({
    identity: { productName: "My Product" },
    completeness: {
      sections: [
        { id: "core_identity", name: "Core Identity", complete: true },
        { id: "journey_map", name: "Journey Map", complete: true },
        { id: "first_value", name: "First Value", complete: true },
        { id: "metric_catalog", name: "Metric Catalog", complete: false },
        { id: "measurement_plan", name: "Measurement Plan", complete: false },
      ],
      completed: 3,
      total: 5,
      percentage: 60,
    },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
  });

  expect(screen.getByText("Turn your first value moment into metrics")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate Metrics" })).toBeInTheDocument();
});

test("shows no suggestion when all navigable sections complete", () => {
  setup({
    identity: { productName: "My Product" },
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
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
  });

  expect(screen.queryByText("Map your user journey")).not.toBeInTheDocument();
  expect(screen.queryByText("Generate your metric catalog")).not.toBeInTheDocument();
  expect(screen.queryByText("Connect metrics to your data")).not.toBeInTheDocument();
});
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx --run`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add src/components/profile/ProfilePage.test.tsx
git commit -m "$(cat <<'EOF'
test: add ProfilePage integration tests for SuggestedNextAction

Tests verify correct suggestion appears based on completion state and that
no suggestion renders when all navigable sections are complete.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Run Full Test Suite and Verify Build

**Step 1: Run all tests**

Run: `npm test -- --run`

Expected: All tests PASS

**Step 2: Run TypeScript build**

Run: `npm run build`

Expected: Build succeeds with no errors

**Step 3: Final commit if any fixes needed**

If fixes were needed, commit them. Otherwise, skip.

---

## Summary

- **Total Tasks:** 6
- **Files Created:** 2 (SuggestedNextAction.tsx, SuggestedNextAction.test.tsx)
- **Files Modified:** 2 (ProfilePage.tsx, index.ts, ProfilePage.test.tsx)
- **Test Coverage:** Component tests + integration tests
