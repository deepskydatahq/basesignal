# ProfileSection Wrapper Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable ProfileSection wrapper component that provides consistent styling for all profile page sections with four visual states.

**Architecture:** Single component file with STATUS_CONFIG for mapping status to visual treatment. Uses structured props (title, status, statusLabel, children, actionLabel, onAction, prerequisiteText). Wrapper pattern - wraps children, doesn't prescribe content structure.

**Tech Stack:** React, Tailwind CSS, lucide-react icons, Button from @/components/ui/button

---

## Task 1: Create ProfileSection Component Skeleton

**Files:**
- Create: `src/components/profile/ProfileSection.tsx`

**Step 1: Create the profile directory and component file**

```bash
mkdir -p src/components/profile
```

**Step 2: Write the component skeleton with types**

```typescript
// src/components/profile/ProfileSection.tsx

import { Check, Circle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProfileSectionStatus =
  | "complete"
  | "in_progress"
  | "not_started"
  | "locked";

interface ProfileSectionProps {
  title: string;
  status: ProfileSectionStatus;
  statusLabel: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  prerequisiteText?: string;
}

const STATUS_CONFIG: Record<
  ProfileSectionStatus,
  {
    icon: React.ReactNode;
    badgeClass: string;
  }
> = {
  complete: {
    icon: <Check className="w-4 h-4" />,
    badgeClass: "text-green-700",
  },
  in_progress: {
    icon: <Circle className="w-4 h-4 fill-current" />,
    badgeClass: "text-blue-600",
  },
  not_started: {
    icon: <Circle className="w-4 h-4" />,
    badgeClass: "text-gray-500",
  },
  locked: {
    icon: <Lock className="w-4 h-4" />,
    badgeClass: "text-gray-400",
  },
};

export function ProfileSection({
  title,
  status,
  statusLabel,
  children,
  actionLabel,
  onAction,
  prerequisiteText,
}: ProfileSectionProps) {
  const config = STATUS_CONFIG[status];
  const isLocked = status === "locked";

  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-6 mb-6",
        isLocked
          ? "border-dashed border-gray-300 opacity-50"
          : "border-gray-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            config.badgeClass
          )}
        >
          <span>{statusLabel}</span>
          {config.icon}
        </div>
      </div>

      <hr className="border-gray-200 mb-4" />

      {/* Content */}
      <div className="mb-4">{children}</div>

      {/* Action */}
      {actionLabel && (
        <div className="flex justify-end items-center gap-2">
          {isLocked && prerequisiteText && (
            <span className="text-xs text-gray-400">{prerequisiteText}</span>
          )}
          <Button
            variant={isLocked ? "outline" : "secondary"}
            onClick={onAction}
            disabled={isLocked}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Commit the skeleton**

```bash
git add src/components/profile/ProfileSection.tsx
git commit -m "feat: add ProfileSection component skeleton

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Write Test for Complete Status

**Files:**
- Create: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Write the failing test for complete status**

```typescript
// src/components/profile/ProfileSection.test.tsx

import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileSection, ProfileSectionStatus } from "./ProfileSection";

function setup(props: Partial<{
  title: string;
  status: ProfileSectionStatus;
  statusLabel: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  prerequisiteText?: string;
}> = {}) {
  const user = userEvent.setup();
  const onAction = props.onAction ?? vi.fn();
  const defaultProps = {
    title: "Test Section",
    status: "not_started" as ProfileSectionStatus,
    statusLabel: "Not Started",
    children: <p>Test content</p>,
    onAction,
    ...props,
  };
  render(<ProfileSection {...defaultProps} />);
  return { user, onAction };
}

test("renders complete state with green check icon", () => {
  setup({
    title: "Core Identity",
    status: "complete",
    statusLabel: "Complete",
  });

  expect(screen.getByText("Core Identity")).toBeInTheDocument();
  expect(screen.getByText("Complete")).toBeInTheDocument();
  // Check icon should be present (we verify the badge has the green class)
  const badge = screen.getByText("Complete").closest("div");
  expect(badge).toHaveClass("text-green-700");
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit the test**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection complete status test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Write Test for In Progress Status

**Files:**
- Modify: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Add test for in_progress status**

Add this test to the test file:

```typescript
test("renders in_progress state with blue indicator", () => {
  setup({
    title: "User Journey",
    status: "in_progress",
    statusLabel: "In Progress",
  });

  expect(screen.getByText("User Journey")).toBeInTheDocument();
  expect(screen.getByText("In Progress")).toBeInTheDocument();
  const badge = screen.getByText("In Progress").closest("div");
  expect(badge).toHaveClass("text-blue-600");
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection in_progress status test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Write Test for Not Started Status

**Files:**
- Modify: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Add test for not_started status**

```typescript
test("renders not_started state with gray circle", () => {
  setup({
    title: "Metric Catalog",
    status: "not_started",
    statusLabel: "0 metrics",
  });

  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("0 metrics")).toBeInTheDocument();
  const badge = screen.getByText("0 metrics").closest("div");
  expect(badge).toHaveClass("text-gray-500");
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection not_started status test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Write Test for Locked Status with Dashed Border and Disabled Action

**Files:**
- Modify: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Add test for locked status**

```typescript
test("renders locked state with dashed border and disabled action", () => {
  setup({
    title: "Heartbeat Event",
    status: "locked",
    statusLabel: "Not Defined",
    actionLabel: "Define with Interview",
    prerequisiteText: "Requires: Overview Interview",
  });

  expect(screen.getByText("Heartbeat Event")).toBeInTheDocument();
  expect(screen.getByText("Not Defined")).toBeInTheDocument();

  // Badge should have gray styling
  const badge = screen.getByText("Not Defined").closest("div");
  expect(badge).toHaveClass("text-gray-400");

  // Action button should be disabled
  const button = screen.getByRole("button", { name: "Define with Interview" });
  expect(button).toBeDisabled();

  // Prerequisite text should be visible
  expect(screen.getByText("Requires: Overview Interview")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection locked status test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Write Test for Informational Status Label

**Files:**
- Modify: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Add test for informational status label**

```typescript
test("displays informational status label like metric counts", () => {
  setup({
    title: "Metric Catalog",
    status: "complete",
    statusLabel: "12 metrics",
  });

  expect(screen.getByText("12 metrics")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection informational status label test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Write Test for Action Button Click

**Files:**
- Modify: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Add test for action button click**

```typescript
test("calls onAction when button is clicked", async () => {
  const onAction = vi.fn();
  const { user } = setup({
    status: "complete",
    statusLabel: "Complete",
    actionLabel: "View Full Catalog",
    onAction,
  });

  await user.click(screen.getByRole("button", { name: "View Full Catalog" }));

  expect(onAction).toHaveBeenCalledOnce();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection action button click test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Write Test for Disabled Action Button in Locked State

**Files:**
- Modify: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Add test for disabled action button**

```typescript
test("does not call onAction when button is clicked in locked state", async () => {
  const onAction = vi.fn();
  const { user } = setup({
    status: "locked",
    statusLabel: "Not Defined",
    actionLabel: "Define",
    onAction,
  });

  const button = screen.getByRole("button", { name: "Define" });
  expect(button).toBeDisabled();

  // Attempting to click should not trigger onAction
  await user.click(button);
  expect(onAction).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection disabled action button test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Write Test for Children Content Rendering

**Files:**
- Modify: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Add test for children rendering**

```typescript
test("renders children content", () => {
  setup({
    status: "complete",
    statusLabel: "Complete",
    children: <div data-testid="custom-content">Custom child content</div>,
  });

  expect(screen.getByTestId("custom-content")).toBeInTheDocument();
  expect(screen.getByText("Custom child content")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection children rendering test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Write Test for No Action Button When actionLabel Not Provided

**Files:**
- Modify: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Add test for no action button**

```typescript
test("does not render action button when actionLabel is not provided", () => {
  setup({
    status: "complete",
    statusLabel: "Complete",
    // No actionLabel provided
  });

  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfileSection.test.tsx
git commit -m "test: add ProfileSection no action button test

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Run Full Test Suite and Verify

**Step 1: Run all ProfileSection tests**

```bash
npm test -- --run src/components/profile/ProfileSection.test.tsx
```

Expected: All tests pass

**Step 2: Run full test suite to ensure no regressions**

```bash
npm test -- --run
```

Expected: All tests pass

**Step 3: Final commit if any cleanup needed**

If tests pass without changes, skip this step.

---

## Task 12: Verify Build Passes

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

This plan creates `ProfileSection.tsx` with:
- Four status types: `complete`, `in_progress`, `not_started`, `locked`
- STATUS_CONFIG mapping for icon and badge colors
- Structured props: `title`, `status`, `statusLabel`, `children`, `actionLabel`, `onAction`, `prerequisiteText`
- Locked state: dashed border, 50% opacity, disabled button, prerequisite text
- 9 tests covering all states and behaviors

**Files created:**
- `src/components/profile/ProfileSection.tsx`
- `src/components/profile/ProfileSection.test.tsx`
