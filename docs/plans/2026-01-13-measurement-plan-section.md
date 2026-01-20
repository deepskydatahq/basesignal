# MeasurementPlanSection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a profile section component that displays a summary of the user's measurement plan (entities with activity lists) with a link to the full plan page.

**Architecture:** Pure view component receiving `plan` prop from parent (ProfilePage). Renders entity cards in a responsive grid with activity bullet lists. Summary counts (activities, properties) shown at top. Uses ProfileSection wrapper for consistent styling. Internal `PlanEntityCard` subcomponent for entity display (distinct from the full-featured `measurement/EntityCard`).

**Tech Stack:** React, Tailwind CSS, react-router-dom (useNavigate), ProfileSection wrapper, Id types from Convex

**Prerequisite:** ProfileSection component must exist (see `docs/plans/2026-01-13-profile-section.md`). If not yet implemented, complete that plan first.

---

## Task 1: Create MeasurementPlanSection Component Skeleton

**Files:**
- Create: `src/components/profile/MeasurementPlanSection.tsx`

**Step 1: Create the component file with types**

```typescript
// src/components/profile/MeasurementPlanSection.tsx

import { useNavigate } from "react-router-dom";
import { ProfileSection } from "./ProfileSection";
import type { Id } from "../../../convex/_generated/dataModel";

interface MeasurementPlanSectionProps {
  plan: Array<{
    entity: { _id: Id<"measurementEntities">; name: string };
    activities: Array<{ _id: Id<"measurementActivities">; name: string }>;
    properties: Array<{ _id: Id<"measurementProperties">; name: string }>;
  }>;
}

function PlanEntityCard({
  name,
  activities,
}: {
  name: string;
  activities: string[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h4 className="font-medium text-gray-900 mb-2">{name}</h4>
      {activities.length > 0 ? (
        <ul className="space-y-1">
          {activities.map((activity, i) => (
            <li key={i} className="text-sm text-gray-600 flex items-start">
              <span className="mr-2">•</span>
              <span>{activity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400 italic">No activities</p>
      )}
    </div>
  );
}

export function MeasurementPlanSection({
  plan,
}: MeasurementPlanSectionProps) {
  const navigate = useNavigate();

  const entityCount = plan.length;
  const activityCount = plan.reduce((sum, e) => sum + e.activities.length, 0);
  const propertyCount = plan.reduce((sum, e) => sum + e.properties.length, 0);

  const hasEntities = entityCount > 0;
  const statusLabel = hasEntities
    ? `${entityCount} ${entityCount === 1 ? "entity" : "entities"}`
    : "Not started";

  return (
    <ProfileSection
      title="Measurement Plan"
      status={hasEntities ? "complete" : "not_started"}
      statusLabel={statusLabel}
      actionLabel="View Full Plan"
      onAction={() => navigate("/measurement-plan")}
    >
      {hasEntities ? (
        <>
          <p className="text-sm text-gray-600 mb-4">
            {activityCount} {activityCount === 1 ? "activity" : "activities"} ·{" "}
            {propertyCount} {propertyCount === 1 ? "property" : "properties"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plan.map(({ entity, activities }) => (
              <PlanEntityCard
                key={entity._id}
                name={entity.name}
                activities={activities.map((a) => a.name)}
              />
            ))}
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">
          No measurement plan yet. Complete the Overview Interview to generate
          your first entities and activities.
        </p>
      )}
    </ProfileSection>
  );
}
```

**Step 2: Commit the skeleton**

```bash
git add src/components/profile/MeasurementPlanSection.tsx
git commit -m "feat: add MeasurementPlanSection component skeleton

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Write Test for Empty State

**Files:**
- Create: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Write the test for empty state**

```typescript
// src/components/profile/MeasurementPlanSection.test.tsx

import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MeasurementPlanSection } from "./MeasurementPlanSection";
import type { Id } from "../../../convex/_generated/dataModel";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

type PlanItem = {
  entity: { _id: Id<"measurementEntities">; name: string };
  activities: Array<{ _id: Id<"measurementActivities">; name: string }>;
  properties: Array<{ _id: Id<"measurementProperties">; name: string }>;
};

function setup(plan: PlanItem[] = []) {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <MeasurementPlanSection plan={plan} />
    </MemoryRouter>
  );
  return { user };
}

beforeEach(() => {
  mockNavigate.mockReset();
});

test("renders empty state when no plan provided", () => {
  setup([]);

  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("Not started")).toBeInTheDocument();
  expect(
    screen.getByText(/No measurement plan yet/)
  ).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit the test**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection empty state test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Write Test for Entity Count in Status Label

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for entity count**

Add this test after the empty state test:

```typescript
test("renders entity count in status label when plan has entities", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
      ],
      properties: [],
    },
    {
      entity: { _id: "entity2" as Id<"measurementEntities">, name: "Account" },
      activities: [],
      properties: [],
    },
    {
      entity: { _id: "entity3" as Id<"measurementEntities">, name: "Feature" },
      activities: [],
      properties: [],
    },
  ]);

  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("3 entities")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection entity count test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Write Test for Singular Entity Label

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for singular entity**

```typescript
test("uses singular 'entity' for single entity", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [],
      properties: [],
    },
  ]);

  expect(screen.getByText("1 entity")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection singular entity label test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Write Test for Summary Counts

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for summary counts**

```typescript
test("displays summary counts for activities and properties", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
        { _id: "act2" as Id<"measurementActivities">, name: "Logged In" },
      ],
      properties: [
        { _id: "prop1" as Id<"measurementProperties">, name: "email" },
      ],
    },
    {
      entity: { _id: "entity2" as Id<"measurementEntities">, name: "Account" },
      activities: [
        { _id: "act3" as Id<"measurementActivities">, name: "Created" },
      ],
      properties: [
        { _id: "prop2" as Id<"measurementProperties">, name: "plan" },
        { _id: "prop3" as Id<"measurementProperties">, name: "seats" },
      ],
    },
  ]);

  expect(screen.getByText(/3 activities/)).toBeInTheDocument();
  expect(screen.getByText(/3 properties/)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection summary counts test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Write Test for Singular Activity/Property Labels

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for singular labels**

```typescript
test("uses singular forms for single activity and property", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
      ],
      properties: [
        { _id: "prop1" as Id<"measurementProperties">, name: "email" },
      ],
    },
  ]);

  expect(screen.getByText(/1 activity/)).toBeInTheDocument();
  expect(screen.getByText(/1 property/)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection singular activity/property test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Write Test for Entity Cards with Activities

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for entity cards**

```typescript
test("renders entity cards with activity lists", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [
        { _id: "act1" as Id<"measurementActivities">, name: "Signed Up" },
        { _id: "act2" as Id<"measurementActivities">, name: "Logged In" },
      ],
      properties: [],
    },
    {
      entity: { _id: "entity2" as Id<"measurementEntities">, name: "Account" },
      activities: [
        { _id: "act3" as Id<"measurementActivities">, name: "Created" },
      ],
      properties: [],
    },
  ]);

  // Entity names should be visible
  expect(screen.getByText("User")).toBeInTheDocument();
  expect(screen.getByText("Account")).toBeInTheDocument();

  // Activity names should be visible
  expect(screen.getByText("Signed Up")).toBeInTheDocument();
  expect(screen.getByText("Logged In")).toBeInTheDocument();
  expect(screen.getByText("Created")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection entity cards test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Write Test for Entity with No Activities

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for entity with no activities**

```typescript
test("shows 'No activities' for entity with empty activities", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "Workspace" },
      activities: [],
      properties: [
        { _id: "prop1" as Id<"measurementProperties">, name: "name" },
      ],
    },
  ]);

  expect(screen.getByText("Workspace")).toBeInTheDocument();
  expect(screen.getByText("No activities")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection no activities test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Write Test for View Full Plan Navigation

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for navigation**

```typescript
test("navigates to /measurement-plan when View Full Plan is clicked", async () => {
  const { user } = setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [],
      properties: [],
    },
  ]);

  await user.click(screen.getByRole("button", { name: "View Full Plan" }));

  expect(mockNavigate).toHaveBeenCalledWith("/measurement-plan");
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection navigation test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Write Test for Complete Status When Plan Has Entities

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for complete status**

```typescript
test("shows complete status when plan has entities", () => {
  setup([
    {
      entity: { _id: "entity1" as Id<"measurementEntities">, name: "User" },
      activities: [],
      properties: [],
    },
  ]);

  // The status badge should indicate complete (green styling)
  const statusBadge = screen.getByText("1 entity").closest("div");
  expect(statusBadge).toHaveClass("text-green-700");
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection complete status test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Write Test for Not Started Status When Empty

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.test.tsx`

**Step 1: Add test for not_started status**

```typescript
test("shows not_started status when plan is empty", () => {
  setup([]);

  // The status badge should indicate not_started (gray styling)
  const statusBadge = screen.getByText("Not started").closest("div");
  expect(statusBadge).toHaveClass("text-gray-500");
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "test: add MeasurementPlanSection not_started status test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Run Full Test Suite

**Step 1: Run all MeasurementPlanSection tests**

```bash
npm test -- --run src/components/profile/MeasurementPlanSection.test.tsx
```

Expected: All 10 tests pass

**Step 2: Run full test suite to check for regressions**

```bash
npm test -- --run
```

Expected: All tests pass

---

## Task 13: Verify Build Passes

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

This plan creates `MeasurementPlanSection.tsx` with:
- Props interface accepting `plan` array from parent (matches `getFullPlan` return type)
- Summary counts: entity count in status label, activity/property counts in body
- Entity cards in responsive 3-column grid showing entity name and activity list
- Empty state with helpful guidance message
- "View Full Plan" navigation to `/measurement-plan`
- Internal `PlanEntityCard` subcomponent (simpler than the full `measurement/EntityCard`)
- 10 tests covering empty state, populated state, singular/plural labels, entity cards, navigation, and status states

**Files created:**
- `src/components/profile/MeasurementPlanSection.tsx`
- `src/components/profile/MeasurementPlanSection.test.tsx`

**Dependencies:**
- Requires `ProfileSection` component to exist first
- Uses Convex Id types for type safety
