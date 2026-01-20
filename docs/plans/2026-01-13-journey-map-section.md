# JourneyMapSection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create JourneyMapSection and JourneyDiagram components to display a static horizontal visualization of the user's journey stages grouped by lifecycle slot.

**Architecture:** JourneyMapSection fetches stages via `api.stages.listByJourney`, computes status based on required slots filled, wraps content in ProfileSection with "Edit Journey" action. JourneyDiagram is a pure presentation component that renders all 5 lifecycle slots with filled/empty states and connecting arrows.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Convex, React Router v7, RTL for testing

---

## Dependencies

This issue depends on:
- **ProfileSection** component (Issue #37) - must exist at `src/components/profile/ProfileSection.tsx`
- **ProfilePage container** (Issue #36) - provides routing context

If ProfileSection doesn't exist, create it first per `docs/plans/2026-01-13-profile-section.md`.

---

## Task 1: Create JourneyDiagram Component - Test

**Files:**
- Create: `src/components/profile/JourneyDiagram.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/profile/JourneyDiagram.test.tsx

import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { JourneyDiagram } from "./JourneyDiagram";
import type { LifecycleSlot } from "../../shared/lifecycleSlots";

interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
}

function setup(stages: Stage[] = []) {
  render(<JourneyDiagram stages={stages} />);
}

test("renders all 5 lifecycle slots as empty placeholders when no stages", () => {
  setup([]);

  expect(screen.getByText("Account Creation")).toBeInTheDocument();
  expect(screen.getByText("Activation")).toBeInTheDocument();
  expect(screen.getByText("Core Usage")).toBeInTheDocument();
  expect(screen.getByText("Revenue")).toBeInTheDocument();
  expect(screen.getByText("Churn")).toBeInTheDocument();
});

test("renders filled slot with stage name", () => {
  setup([
    { _id: "s1", name: "Account Created", lifecycleSlot: "account_creation" },
  ]);

  expect(screen.getByText("Account Creation")).toBeInTheDocument();
  expect(screen.getByText("Account Created")).toBeInTheDocument();
});

test("renders mix of filled and empty slots", () => {
  setup([
    { _id: "s1", name: "Account Created", lifecycleSlot: "account_creation" },
    { _id: "s2", name: "Project Published", lifecycleSlot: "activation" },
  ]);

  // Filled slots show stage name
  expect(screen.getByText("Account Created")).toBeInTheDocument();
  expect(screen.getByText("Project Published")).toBeInTheDocument();

  // All slot labels present
  expect(screen.getByText("Account Creation")).toBeInTheDocument();
  expect(screen.getByText("Activation")).toBeInTheDocument();
  expect(screen.getByText("Core Usage")).toBeInTheDocument();
  expect(screen.getByText("Revenue")).toBeInTheDocument();
  expect(screen.getByText("Churn")).toBeInTheDocument();
});

test("renders slots in LIFECYCLE_SLOTS order", () => {
  setup([
    { _id: "s1", name: "Churned", lifecycleSlot: "churn" },
    { _id: "s2", name: "Account Created", lifecycleSlot: "account_creation" },
  ]);

  const container = screen.getByTestId("journey-diagram");
  const slots = container.querySelectorAll("[data-slot]");

  // Should be in canonical order regardless of input order
  expect(slots[0]).toHaveAttribute("data-slot", "account_creation");
  expect(slots[4]).toHaveAttribute("data-slot", "churn");
});

test("uses first stage when multiple stages have same slot", () => {
  setup([
    { _id: "s1", name: "First Activity", lifecycleSlot: "account_creation" },
    { _id: "s2", name: "Second Activity", lifecycleSlot: "account_creation" },
  ]);

  expect(screen.getByText("First Activity")).toBeInTheDocument();
  expect(screen.queryByText("Second Activity")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/profile/JourneyDiagram.test.tsx`
Expected: FAIL with "Cannot find module './JourneyDiagram'"

---

## Task 2: Create JourneyDiagram Component - Implementation

**Files:**
- Create: `src/components/profile/JourneyDiagram.tsx`

**Step 1: Implement the component**

```typescript
// src/components/profile/JourneyDiagram.tsx

import { LIFECYCLE_SLOTS, SLOT_INFO, type LifecycleSlot } from "../../shared/lifecycleSlots";

interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
}

interface JourneyDiagramProps {
  stages: Stage[];
}

export function JourneyDiagram({ stages }: JourneyDiagramProps) {
  // Group stages by slot (first stage per slot wins)
  const stageBySlot = new Map<LifecycleSlot, Stage>();
  stages.forEach((stage) => {
    if (stage.lifecycleSlot && !stageBySlot.has(stage.lifecycleSlot)) {
      stageBySlot.set(stage.lifecycleSlot, stage);
    }
  });

  return (
    <div
      data-testid="journey-diagram"
      className="flex items-center gap-1 overflow-x-auto py-2"
    >
      {LIFECYCLE_SLOTS.map((slot, index) => {
        const stage = stageBySlot.get(slot);
        const isEmpty = !stage;
        const isLast = index === LIFECYCLE_SLOTS.length - 1;

        return (
          <div key={slot} className="flex items-center" data-slot={slot}>
            {/* Slot box */}
            <div
              className={`
                flex flex-col items-center justify-center
                w-28 h-20 rounded-lg border-2 px-2
                ${isEmpty
                  ? "border-dashed border-gray-300 bg-gray-50"
                  : "border-solid border-blue-500 bg-blue-50"
                }
              `}
            >
              <span
                className={`text-xs font-medium ${isEmpty ? "text-gray-400" : "text-blue-600"}`}
              >
                {SLOT_INFO[slot].name}
              </span>
              {stage && (
                <span className="text-sm font-semibold text-gray-900 text-center truncate w-full mt-1">
                  {stage.name}
                </span>
              )}
            </div>

            {/* Arrow */}
            {!isLast && (
              <svg
                className="w-6 h-6 text-gray-400 mx-1"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run src/components/profile/JourneyDiagram.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/JourneyDiagram.tsx src/components/profile/JourneyDiagram.test.tsx
git commit -m "$(cat <<'EOF'
feat: add JourneyDiagram component

Pure presentation component that renders a horizontal flow of all 5
lifecycle slots with arrows. Shows stage names in filled slots,
placeholder styling in empty slots.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create JourneyMapSection Component - Test

**Files:**
- Create: `src/components/profile/JourneyMapSection.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/profile/JourneyMapSection.test.tsx

import { expect, test, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JourneyMapSection } from "./JourneyMapSection";
import { MemoryRouter } from "react-router-dom";
import type { Id } from "../../../convex/_generated/dataModel";

const mockUseQuery = vi.fn();
const mockNavigate = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("react-router", () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  mockUseQuery.mockReset();
  mockNavigate.mockReset();
});

interface SetupOptions {
  journeyId?: Id<"journeys"> | null;
  stages?: Array<{
    _id: Id<"stages">;
    name: string;
    lifecycleSlot?: string;
  }>;
}

function setup(options: SetupOptions = {}) {
  const { journeyId = null, stages = [] } = options;
  const user = userEvent.setup();

  // Mock query returns stages
  mockUseQuery.mockReturnValue(stages);

  render(
    <MemoryRouter>
      <JourneyMapSection journeyId={journeyId} />
    </MemoryRouter>
  );

  return { user };
}

test("renders with not_started status when no journeyId", () => {
  setup({ journeyId: null });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("Not Started")).toBeInTheDocument();
  // No Edit Journey button when no journey exists
  expect(screen.queryByRole("button", { name: /edit journey/i })).not.toBeInTheDocument();
});

test("renders with not_started status when journeyId exists but no stages", () => {
  setup({ journeyId: "j1" as Id<"journeys">, stages: [] });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("Not Started")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /edit journey/i })).toBeInTheDocument();
});

test("renders with in_progress status when some required slots filled", () => {
  setup({
    journeyId: "j1" as Id<"journeys">,
    stages: [
      { _id: "s1" as Id<"stages">, name: "Account Created", lifecycleSlot: "account_creation" },
      { _id: "s2" as Id<"stages">, name: "Activated", lifecycleSlot: "activation" },
    ],
  });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("In Progress")).toBeInTheDocument();
});

test("renders with complete status when all required slots filled", () => {
  setup({
    journeyId: "j1" as Id<"journeys">,
    stages: [
      { _id: "s1" as Id<"stages">, name: "Account Created", lifecycleSlot: "account_creation" },
      { _id: "s2" as Id<"stages">, name: "Activated", lifecycleSlot: "activation" },
      { _id: "s3" as Id<"stages">, name: "Using Daily", lifecycleSlot: "core_usage" },
    ],
  });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("Complete")).toBeInTheDocument();
});

test("navigates to journey editor when Edit Journey clicked", async () => {
  const { user } = setup({
    journeyId: "test-journey-id" as Id<"journeys">,
    stages: [],
  });

  await user.click(screen.getByRole("button", { name: /edit journey/i }));

  expect(mockNavigate).toHaveBeenCalledWith("/journeys/test-journey-id");
});

test("renders JourneyDiagram with stages", () => {
  setup({
    journeyId: "j1" as Id<"journeys">,
    stages: [
      { _id: "s1" as Id<"stages">, name: "Account Created", lifecycleSlot: "account_creation" },
    ],
  });

  // JourneyDiagram should render the stage name
  expect(screen.getByText("Account Created")).toBeInTheDocument();
  // And all lifecycle slot labels
  expect(screen.getByText("Account Creation")).toBeInTheDocument();
  expect(screen.getByText("Activation")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/profile/JourneyMapSection.test.tsx`
Expected: FAIL with "Cannot find module './JourneyMapSection'"

---

## Task 4: Create JourneyMapSection Component - Implementation

**Files:**
- Create: `src/components/profile/JourneyMapSection.tsx`

**Step 1: Implement the component**

```typescript
// src/components/profile/JourneyMapSection.tsx

import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ProfileSection } from "./ProfileSection";
import { JourneyDiagram } from "./JourneyDiagram";
import { REQUIRED_SLOTS } from "../../shared/lifecycleSlots";

interface JourneyMapSectionProps {
  journeyId: Id<"journeys"> | null;
}

export function JourneyMapSection({ journeyId }: JourneyMapSectionProps) {
  const navigate = useNavigate();

  const stages = useQuery(
    api.stages.listByJourney,
    journeyId ? { journeyId } : "skip"
  );

  // Compute status from stages
  const status = (() => {
    if (!stages || stages.length === 0) return "not_started" as const;
    const filledSlots = new Set(stages.map((s) => s.lifecycleSlot).filter(Boolean));
    const allRequired = REQUIRED_SLOTS.every((slot) => filledSlots.has(slot));
    return allRequired ? ("complete" as const) : ("in_progress" as const);
  })();

  // Status label for display
  const statusLabel = status === "complete"
    ? "Complete"
    : status === "in_progress"
      ? "In Progress"
      : "Not Started";

  const handleEditJourney = () => {
    if (journeyId) {
      navigate(`/journeys/${journeyId}`);
    }
  };

  // Filter stages to only those with valid lifecycleSlot
  const validStages = (stages ?? [])
    .filter((s): s is typeof s & { lifecycleSlot: NonNullable<typeof s.lifecycleSlot> } =>
      !!s.lifecycleSlot
    )
    .map((s) => ({
      _id: s._id as string,
      name: s.name,
      lifecycleSlot: s.lifecycleSlot,
    }));

  return (
    <ProfileSection
      title="Journey Map"
      status={status}
      statusLabel={statusLabel}
      actionLabel={journeyId ? "Edit Journey" : undefined}
      onAction={handleEditJourney}
    >
      <JourneyDiagram stages={validStages} />
    </ProfileSection>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run src/components/profile/JourneyMapSection.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/JourneyMapSection.tsx src/components/profile/JourneyMapSection.test.tsx
git commit -m "$(cat <<'EOF'
feat: add JourneyMapSection component

Container component that:
- Fetches stages via api.stages.listByJourney
- Computes status based on required slots (account_creation, activation, core_usage)
- Wraps JourneyDiagram in ProfileSection
- Provides Edit Journey action navigating to /journeys/{journeyId}

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Export Components from Index

**Files:**
- Create or modify: `src/components/profile/index.ts`

**Step 1: Create or update the index file**

```typescript
// src/components/profile/index.ts

export { JourneyDiagram } from "./JourneyDiagram";
export { JourneyMapSection } from "./JourneyMapSection";
export { ProfileSection } from "./ProfileSection";
export type { ProfileSectionStatus } from "./ProfileSection";
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/profile/index.ts
git commit -m "$(cat <<'EOF'
chore: add profile components index exports

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

---

## Summary

This plan implements Issue #40 with:

**4 new files:**
- `src/components/profile/JourneyDiagram.tsx` - Pure presentation component
- `src/components/profile/JourneyDiagram.test.tsx` - 5 tests for diagram
- `src/components/profile/JourneyMapSection.tsx` - Container component
- `src/components/profile/JourneyMapSection.test.tsx` - 6 tests for section

**1 modified file:**
- `src/components/profile/index.ts` - Export new components

**Key design decisions:**
- Uses LIFECYCLE_SLOTS constant for canonical order
- Uses REQUIRED_SLOTS for completion check
- Status: not_started (0 stages), in_progress (some required), complete (all required)
- JourneyDiagram takes journeyId as prop (not via context) for flexibility
- First stage per slot wins when multiple exist
- Edit Journey button only shows when journeyId exists

**Testing strategy:**
- JourneyDiagram: Empty state, filled state, mixed state, order verification, duplicate handling
- JourneyMapSection: No journey, empty journey, partial, complete, navigation

---

## Checklist

- [ ] `src/components/profile/JourneyDiagram.tsx` exists
- [ ] `src/components/profile/JourneyDiagram.test.tsx` has 5 tests
- [ ] `src/components/profile/JourneyMapSection.tsx` exists
- [ ] `src/components/profile/JourneyMapSection.test.tsx` has 6 tests
- [ ] Components exported from index
- [ ] All tests pass (`npm test -- --run`)
- [ ] Build succeeds (`npm run build`)
