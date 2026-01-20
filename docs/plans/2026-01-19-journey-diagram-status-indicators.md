# Journey Diagram Status Indicators Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show definition completeness status for each journey stage slot using visual indicators (empty/partial/complete).

**Architecture:** Extend the JourneyDiagram component to accept optional entity/action fields per stage, then compute status inline and apply conditional Tailwind classes for three visual states: empty (gray dashed), partial (amber solid), complete (blue solid).

**Tech Stack:** React, Tailwind CSS, Vitest, React Testing Library

---

## Task 1: Add Test for Complete Status (has both entity AND action)

**Files:**
- Modify: `src/components/profile/JourneyDiagram.test.tsx`

**Step 1: Write the failing test**

Add to `JourneyDiagram.test.tsx`:

```typescript
test("renders complete status when stage has both entity and action", () => {
  setup([
    {
      _id: "s1",
      name: "Account Created",
      lifecycleSlot: "account_creation",
      entity: "Account",
      action: "Created",
    },
  ]);

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Complete: solid blue border, blue-50 background
  expect(box).toHaveClass("border-solid", "border-blue-500", "bg-blue-50");
});
```

**Step 2: Update Stage interface in test file**

Update the Stage interface at the top of the test file:

```typescript
interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
  entity?: string;
  action?: string;
}
```

**Step 3: Run test to verify it fails**

Run: `npm test -- JourneyDiagram.test.tsx`
Expected: FAIL - TypeScript error because Stage interface in component doesn't have entity/action

---

## Task 2: Extend Stage Interface in JourneyDiagram Component

**Files:**
- Modify: `src/components/profile/JourneyDiagram.tsx:9-13`

**Step 1: Update Stage interface**

Change lines 9-13 from:

```typescript
interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
}
```

To:

```typescript
interface Stage {
  _id: string;
  name: string;
  lifecycleSlot: LifecycleSlot;
  entity?: string;
  action?: string;
}
```

**Step 2: Run test to verify it still fails**

Run: `npm test -- JourneyDiagram.test.tsx`
Expected: FAIL - Test passes at runtime but assertion fails (class check fails because component doesn't use entity/action yet)

---

## Task 3: Implement Status Logic and Styling

**Files:**
- Modify: `src/components/profile/JourneyDiagram.tsx:33-50`

**Step 1: Add status computation and conditional classes**

Replace the slot rendering block (lines 33-61) with status-aware version:

```typescript
      {LIFECYCLE_SLOTS.map((slot, index) => {
        const stage = stageBySlot.get(slot);
        const isLast = index === LIFECYCLE_SLOTS.length - 1;

        // Compute status: empty, partial, complete
        const isEmpty = !stage;
        const isComplete = stage?.entity && stage?.action;
        const isPartial = stage && !isComplete;

        // Status-based styling
        let borderClass = "border-dashed border-gray-300";
        let bgClass = "bg-gray-50";
        let textClass = "text-gray-400";

        if (isComplete) {
          borderClass = "border-solid border-blue-500";
          bgClass = "bg-blue-50";
          textClass = "text-blue-600";
        } else if (isPartial) {
          borderClass = "border-solid border-amber-500";
          bgClass = "bg-amber-50";
          textClass = "text-amber-600";
        }

        return (
          <div key={slot} className="flex items-center" data-slot={slot}>
            {/* Slot box */}
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
```

**Step 2: Run test to verify it passes**

Run: `npm test -- JourneyDiagram.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/JourneyDiagram.tsx src/components/profile/JourneyDiagram.test.tsx
git commit -m "feat: add complete status indicator to JourneyDiagram"
```

---

## Task 4: Add Test for Partial Status (has stage but missing entity or action)

**Files:**
- Modify: `src/components/profile/JourneyDiagram.test.tsx`

**Step 1: Write the test for partial status with only entity**

```typescript
test("renders partial status when stage has entity but no action", () => {
  setup([
    {
      _id: "s1",
      name: "Account Created",
      lifecycleSlot: "account_creation",
      entity: "Account",
    },
  ]);

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Partial: solid amber border, amber-50 background
  expect(box).toHaveClass("border-solid", "border-amber-500", "bg-amber-50");
});
```

**Step 2: Write the test for partial status with only action**

```typescript
test("renders partial status when stage has action but no entity", () => {
  setup([
    {
      _id: "s1",
      name: "Account Created",
      lifecycleSlot: "account_creation",
      action: "Created",
    },
  ]);

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Partial: solid amber border, amber-50 background
  expect(box).toHaveClass("border-solid", "border-amber-500", "bg-amber-50");
});
```

**Step 3: Write the test for partial status with neither entity nor action**

```typescript
test("renders partial status when stage has neither entity nor action", () => {
  setup([
    {
      _id: "s1",
      name: "Account Created",
      lifecycleSlot: "account_creation",
    },
  ]);

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Partial: solid amber border, amber-50 background (stage exists but incomplete)
  expect(box).toHaveClass("border-solid", "border-amber-500", "bg-amber-50");
});
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- JourneyDiagram.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/JourneyDiagram.test.tsx
git commit -m "test: add partial status indicator tests"
```

---

## Task 5: Add Test for Empty Status (no stage assigned to slot)

**Files:**
- Modify: `src/components/profile/JourneyDiagram.test.tsx`

**Step 1: Write the test for empty status**

```typescript
test("renders empty status for slots with no stage assigned", () => {
  setup([]); // No stages

  const slot = screen.getByTestId("journey-diagram").querySelector('[data-slot="account_creation"]');
  const box = slot?.querySelector("div > div");

  // Empty: dashed gray border, gray-50 background
  expect(box).toHaveClass("border-dashed", "border-gray-300", "bg-gray-50");
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- JourneyDiagram.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/JourneyDiagram.test.tsx
git commit -m "test: add empty status indicator test"
```

---

## Task 6: Update JourneyMapSection to Pass entity/action

**Files:**
- Modify: `src/components/profile/JourneyMapSection.tsx:53-59`

**Step 1: Update the stages mapping to include entity/action**

Change lines 53-59 from:

```typescript
        <JourneyDiagram
          stages={stages.map((s) => ({
            _id: s._id,
            name: s.name,
            lifecycleSlot: s.lifecycleSlot as LifecycleSlot,
          }))}
        />
```

To:

```typescript
        <JourneyDiagram
          stages={stages.map((s) => ({
            _id: s._id,
            name: s.name,
            lifecycleSlot: s.lifecycleSlot as LifecycleSlot,
            entity: s.entity,
            action: s.action,
          }))}
        />
```

**Step 2: Run all tests to verify nothing broke**

Run: `npm test`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/JourneyMapSection.tsx
git commit -m "feat: pass entity/action from JourneyMapSection to JourneyDiagram"
```

---

## Task 7: Final Verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests PASS

**Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual verification (optional)**

Start dev server and verify:
- Empty slots show gray dashed border
- Stages with only entity or only action show amber solid border
- Stages with both entity AND action show blue solid border

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add test for complete status |
| 2 | Extend Stage interface |
| 3 | Implement status logic and styling |
| 4 | Add tests for partial status |
| 5 | Add test for empty status |
| 6 | Update JourneyMapSection to pass entity/action |
| 7 | Final verification |

**Total:** 7 TDD tasks

**Visual States:**
- **Empty**: dashed gray border, gray-50 background (no stage assigned)
- **Partial**: solid amber border, amber-50 background (has stage but missing entity or action)
- **Complete**: solid blue border, blue-50 background (has both entity AND action)
