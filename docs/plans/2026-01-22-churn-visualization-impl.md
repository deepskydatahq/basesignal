# Churn Visualization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure JourneyDiagram to show churn as a terminal state below the main lifecycle flow, with distinct red-tinted styling.

**Architecture:** Filter churn from the main 4-stage horizontal flow and render it in a second row below, centered. Apply red-tinted styling to churn to visually distinguish it as a terminal/exit state. The spatial separation alone communicates that users can churn from any stage.

**Tech Stack:** React, Tailwind CSS, Vitest + RTL for testing

---

## Task 1: Add lifecycleSlots helper for main slots

**Files:**
- Modify: `src/shared/lifecycleSlots.ts`
- Test: `src/shared/lifecycleSlots.test.ts` (create)

**Step 1: Write the failing test**

Create `src/shared/lifecycleSlots.test.ts`:

```typescript
// src/shared/lifecycleSlots.test.ts

import { expect, test } from "vitest";
import { LIFECYCLE_SLOTS, MAIN_LIFECYCLE_SLOTS } from "./lifecycleSlots";

test("MAIN_LIFECYCLE_SLOTS excludes churn", () => {
  expect(MAIN_LIFECYCLE_SLOTS).toEqual([
    "account_creation",
    "activation",
    "core_usage",
    "revenue",
  ]);
  expect(MAIN_LIFECYCLE_SLOTS).not.toContain("churn");
});

test("LIFECYCLE_SLOTS includes all 5 slots", () => {
  expect(LIFECYCLE_SLOTS).toHaveLength(5);
  expect(LIFECYCLE_SLOTS).toContain("churn");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/shared/lifecycleSlots.test.ts`
Expected: FAIL with "MAIN_LIFECYCLE_SLOTS is not exported"

**Step 3: Write minimal implementation**

Add to `src/shared/lifecycleSlots.ts` after the LIFECYCLE_SLOTS export:

```typescript
// Main lifecycle slots (excludes churn - used for primary flow)
export const MAIN_LIFECYCLE_SLOTS = [
  "account_creation",
  "activation",
  "core_usage",
  "revenue",
] as const;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/shared/lifecycleSlots.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/shared/lifecycleSlots.ts src/shared/lifecycleSlots.test.ts
git commit -m "feat: add MAIN_LIFECYCLE_SLOTS constant for churn separation"
```

---

## Task 2: Update JourneyDiagram test for two-row layout

**Files:**
- Modify: `src/components/profile/JourneyDiagram.test.tsx`

**Step 1: Write the failing test for churn in separate row**

Add new test to `JourneyDiagram.test.tsx`:

```typescript
test("renders churn in separate row below main stages", () => {
  setup([]);

  const diagram = screen.getByTestId("journey-diagram");
  const mainRow = screen.getByTestId("main-stages-row");
  const churnRow = screen.getByTestId("churn-row");

  // Main row should have 4 slots (not churn)
  expect(mainRow).toBeInTheDocument();
  expect(churnRow).toBeInTheDocument();

  // Churn should be in the churn row, not main row
  const churnSlot = screen.getByText("Churn").closest("[data-slot]");
  expect(churnSlot).toHaveAttribute("data-slot", "churn");
  expect(churnRow).toContainElement(churnSlot);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/JourneyDiagram.test.tsx`
Expected: FAIL with "Unable to find an element by: [data-testid="main-stages-row"]"

**Step 3: No implementation yet - proceed to next task**

---

## Task 3: Update JourneyDiagram test for churn red styling

**Files:**
- Modify: `src/components/profile/JourneyDiagram.test.tsx`

**Step 1: Write the failing test for churn styling**

Add new test to `JourneyDiagram.test.tsx`:

```typescript
test("renders churn slot with red-tinted styling", () => {
  setup([
    {
      _id: "s1",
      name: "User Churned",
      lifecycleSlot: "churn",
      entity: "User",
      action: "Churned",
    },
  ]);

  const churnLabel = screen.getByText("Churn");
  // Churn uses red styling instead of blue for complete status
  expect(churnLabel).toHaveClass("text-red-600");
});

test("renders empty churn slot with red-tinted dashed styling", () => {
  setup([]); // No stages

  const churnLabel = screen.getByText("Churn");
  // Empty churn uses red styling instead of gray
  expect(churnLabel).toHaveClass("text-red-400");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/JourneyDiagram.test.tsx`
Expected: FAIL - churn currently uses gray/blue/amber, not red

---

## Task 4: Implement two-row layout with churn styling

**Files:**
- Modify: `src/components/profile/JourneyDiagram.tsx`

**Step 1: Update implementation**

Replace the entire JourneyDiagram component in `src/components/profile/JourneyDiagram.tsx`:

```typescript
// src/components/profile/JourneyDiagram.tsx

import {
  MAIN_LIFECYCLE_SLOTS,
  SLOT_INFO,
  type LifecycleSlot,
} from "../../shared/lifecycleSlots";

interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
  entity?: string;
  action?: string;
}

interface JourneyDiagramProps {
  stages: Stage[];
}

function SlotBox({
  slot,
  stage,
  isChurn = false,
}: {
  slot: LifecycleSlot;
  stage?: Stage;
  isChurn?: boolean;
}) {
  // Compute status: empty, partial, complete
  const isComplete = stage?.entity && stage?.action;
  const isPartial = stage && !isComplete;

  // Status-based styling - churn uses red palette
  let borderClass: string;
  let bgClass: string;
  let textClass: string;

  if (isChurn) {
    if (isComplete) {
      borderClass = "border-solid border-red-500";
      bgClass = "bg-red-50";
      textClass = "text-red-600";
    } else if (isPartial) {
      borderClass = "border-solid border-red-400";
      bgClass = "bg-red-50";
      textClass = "text-red-500";
    } else {
      borderClass = "border-dashed border-red-300";
      bgClass = "bg-red-50";
      textClass = "text-red-400";
    }
  } else {
    if (isComplete) {
      borderClass = "border-solid border-blue-500";
      bgClass = "bg-blue-50";
      textClass = "text-blue-600";
    } else if (isPartial) {
      borderClass = "border-solid border-amber-500";
      bgClass = "bg-amber-50";
      textClass = "text-amber-600";
    } else {
      borderClass = "border-dashed border-gray-300";
      bgClass = "bg-gray-50";
      textClass = "text-gray-400";
    }
  }

  return (
    <div data-slot={slot}>
      <div
        className={`
          flex flex-col items-center justify-center
          w-28 h-20 rounded-lg border-2 px-2
          ${borderClass} ${bgClass}
        `}
      >
        <span className={`text-xs font-medium ${textClass}`}>
          {SLOT_INFO[slot].name}
        </span>
        {stage && (
          <span className="text-sm font-semibold text-gray-900 text-center truncate w-full mt-1">
            {stage.name}
          </span>
        )}
      </div>
    </div>
  );
}

export function JourneyDiagram({ stages }: JourneyDiagramProps) {
  // Group stages by slot (first stage per slot wins)
  const stageBySlot = new Map<LifecycleSlot, Stage>();
  stages.forEach((stage) => {
    if (stage.lifecycleSlot && !stageBySlot.has(stage.lifecycleSlot)) {
      stageBySlot.set(stage.lifecycleSlot, stage);
    }
  });

  const churnStage = stageBySlot.get("churn");

  return (
    <div data-testid="journey-diagram" className="flex flex-col gap-3 py-2">
      {/* Main lifecycle row */}
      <div
        data-testid="main-stages-row"
        className="flex items-center gap-1 overflow-x-auto"
      >
        {MAIN_LIFECYCLE_SLOTS.map((slot, index) => {
          const stage = stageBySlot.get(slot);
          const isLast = index === MAIN_LIFECYCLE_SLOTS.length - 1;

          return (
            <div key={slot} className="flex items-center">
              <SlotBox slot={slot} stage={stage} />

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

      {/* Churn row - terminal state below */}
      <div
        data-testid="churn-row"
        className="flex justify-center"
      >
        <SlotBox slot="churn" stage={churnStage} isChurn />
      </div>
    </div>
  );
}
```

**Step 2: Run all tests to verify they pass**

Run: `npm test -- src/components/profile/JourneyDiagram.test.tsx`
Expected: Some tests may need updates for the new structure

**Step 3: Update existing tests if needed**

The existing tests should still pass since they test for text content and styling classes, which remain the same. However, verify and fix any that fail.

**Step 4: Run full test suite**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/JourneyDiagram.tsx src/components/profile/JourneyDiagram.test.tsx
git commit -m "feat: move churn to separate row with red-tinted styling

Restructures JourneyDiagram to show churn as a terminal state:
- Main row: Account Creation → Activation → Core Usage → Revenue
- Churn row: centered below with red-tinted styling
- Spatial separation communicates churn is reachable from any stage"
```

---

## Task 5: Verify integration and visual appearance

**Files:**
- None (manual verification)

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Navigate to a profile with journey stages**

Verify:
- Main 4 stages render horizontally with arrows
- Churn renders below, centered
- Empty churn has red dashed border with red-50 background
- Filled churn has red solid border

**Step 3: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 4: Final commit if any adjustments needed**

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add MAIN_LIFECYCLE_SLOTS constant | lifecycleSlots.ts |
| 2-3 | Write failing tests for new layout | JourneyDiagram.test.tsx |
| 4 | Implement two-row layout with churn styling | JourneyDiagram.tsx |
| 5 | Verify integration | Manual |

**Total: 5 tasks**

**Testing strategy:**
- Unit tests for new constant export
- Component tests for layout structure (data-testid attributes)
- Component tests for churn-specific styling (red palette)
- Existing tests verify backward compatibility
