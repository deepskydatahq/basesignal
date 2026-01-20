# FutureSectionCard Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a thin convenience wrapper around ProfileSection for rendering placeholder sections that aren't yet available.

**Architecture:** FutureSectionCard is a ~15-line component that maps its props to ProfileSection props. It uses `status="locked"` when `isReady=false` (50% opacity, dashed border, disabled button) and `status="not_started"` when `isReady=true` (full opacity, enabled button).

**Tech Stack:** React, ProfileSection component (from `src/components/profile/ProfileSection.tsx`)

**Dependency:** Issue #38 (ProfileSection) must be implemented first.

---

## Task 1: Write Failing Test for Locked State

**Files:**
- Create: `src/components/profile/FutureSectionCard.test.tsx`

**Step 1: Write the failing test for locked state (isReady=false)**

```typescript
// src/components/profile/FutureSectionCard.test.tsx

import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FutureSectionCard } from "./FutureSectionCard";

function setup(props: Partial<{
  title: string;
  description: string;
  prerequisite: string;
  isReady: boolean;
}> = {}) {
  const defaultProps = {
    title: "Heartbeat Event",
    description: "The single event that indicates a user is active.",
    prerequisite: "Requires: Overview Interview",
    isReady: false,
    ...props,
  };
  render(<FutureSectionCard {...defaultProps} />);
}

test("renders locked state with 50% opacity and dashed border when isReady is false", () => {
  setup({ isReady: false });

  expect(screen.getByText("Heartbeat Event")).toBeInTheDocument();
  expect(screen.getByText("The single event that indicates a user is active.")).toBeInTheDocument();

  // Button should be disabled
  const button = screen.getByRole("button", { name: "Start Interview" });
  expect(button).toBeDisabled();

  // Prerequisite text should be visible
  expect(screen.getByText("Requires: Overview Interview")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --run src/components/profile/FutureSectionCard.test.tsx
```

Expected: FAIL with "Cannot find module './FutureSectionCard'"

---

## Task 2: Write Minimal Implementation to Pass Locked State Test

**Files:**
- Create: `src/components/profile/FutureSectionCard.tsx`

**Step 1: Write the component implementation**

```typescript
// src/components/profile/FutureSectionCard.tsx

import { ProfileSection } from "./ProfileSection";

interface FutureSectionCardProps {
  title: string;
  description: string;
  prerequisite: string;
  isReady: boolean;
}

export function FutureSectionCard({
  title,
  description,
  prerequisite,
  isReady,
}: FutureSectionCardProps) {
  return (
    <ProfileSection
      title={title}
      status={isReady ? "not_started" : "locked"}
      statusLabel="Not Defined"
      actionLabel="Start Interview"
      prerequisiteText={!isReady ? prerequisite : undefined}
    >
      <p className="text-sm text-gray-500">{description}</p>
    </ProfileSection>
  );
}
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/FutureSectionCard.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/FutureSectionCard.tsx src/components/profile/FutureSectionCard.test.tsx
git commit -m "feat: add FutureSectionCard with locked state test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Write Test for Ready State (isReady=true)

**Files:**
- Modify: `src/components/profile/FutureSectionCard.test.tsx`

**Step 1: Add test for ready state**

Add this test to the test file:

```typescript
test("renders ready state with enabled button when isReady is true", () => {
  setup({ isReady: true });

  expect(screen.getByText("Heartbeat Event")).toBeInTheDocument();

  // Button should be enabled
  const button = screen.getByRole("button", { name: "Start Interview" });
  expect(button).not.toBeDisabled();

  // Prerequisite text should NOT be visible
  expect(screen.queryByText("Requires: Overview Interview")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/FutureSectionCard.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/FutureSectionCard.test.tsx
git commit -m "test: add FutureSectionCard ready state test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Write Test for Custom Title and Description

**Files:**
- Modify: `src/components/profile/FutureSectionCard.test.tsx`

**Step 1: Add test for custom props**

```typescript
test("renders custom title, description, and prerequisite", () => {
  setup({
    title: "Activation Definition",
    description: "Define what it means for a user to be activated.",
    prerequisite: "Requires: First Value definition",
    isReady: false,
  });

  expect(screen.getByText("Activation Definition")).toBeInTheDocument();
  expect(screen.getByText("Define what it means for a user to be activated.")).toBeInTheDocument();
  expect(screen.getByText("Requires: First Value definition")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/FutureSectionCard.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/FutureSectionCard.test.tsx
git commit -m "test: add FutureSectionCard custom props test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Run Full Test Suite and Verify Build

**Step 1: Run all FutureSectionCard tests**

```bash
npm test -- --run src/components/profile/FutureSectionCard.test.tsx
```

Expected: All 3 tests pass

**Step 2: Run full test suite to ensure no regressions**

```bash
npm test -- --run
```

Expected: All tests pass

**Step 3: Run TypeScript compiler check**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 4: Run build**

```bash
npm run build
```

Expected: Build succeeds

---

## Summary

This plan creates `FutureSectionCard.tsx` with:
- ~15 lines of prop mapping to ProfileSection
- Locked state when `isReady=false`: 50% opacity, dashed border, disabled button, prerequisite text
- Ready state when `isReady=true`: full opacity, enabled button, no prerequisite text
- 3 tests covering locked state, ready state, and custom props

**Files created:**
- `src/components/profile/FutureSectionCard.tsx`
- `src/components/profile/FutureSectionCard.test.tsx`

**Dependency:**
- Issue #38 (ProfileSection) must be implemented first
