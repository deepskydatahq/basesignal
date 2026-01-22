# CompletenessIndicator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an expandable completeness indicator showing profile progress with popover checklist and "Complete Next Section" CTA.

**Architecture:** A self-contained React component that receives pre-calculated section data from the Convex backend. Uses Radix UI Popover for expand/collapse behavior. Progress bar + count as trigger, full checklist in popover content. Scroll-to-section via convention-based DOM IDs.

**Tech Stack:** React 19, Radix UI Popover, Tailwind CSS, lucide-react icons, Vitest + RTL for testing.

---

## Task 1: Install @radix-ui/react-popover Dependency

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

Run:
```bash
npm install @radix-ui/react-popover
```

**Step 2: Verify installation**

Run:
```bash
grep "react-popover" package.json
```
Expected: Line showing `"@radix-ui/react-popover": "^X.X.X"`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: add @radix-ui/react-popover dependency

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create Popover UI Component

**Files:**
- Create: `src/components/ui/popover.tsx`

**Step 1: Create the popover component**

Create `src/components/ui/popover.tsx`:

```tsx
import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-white p-4 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent }
```

**Step 2: Verify no TypeScript errors**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/popover.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add Popover component from Radix UI

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create CompletenessIndicator Test File with First Test

**Files:**
- Create: `src/components/profile/CompletenessIndicator.test.tsx`

**Step 1: Write failing test for collapsed state rendering**

Create `src/components/profile/CompletenessIndicator.test.tsx`:

```tsx
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompletenessIndicator } from "./CompletenessIndicator";

const ALL_SECTIONS = [
  { id: "core_identity", label: "Core Identity", isComplete: false },
  { id: "journey_map", label: "User Journey Map", isComplete: false },
  { id: "first_value", label: "First Value Moment", isComplete: false },
  { id: "metric_catalog", label: "Metric Catalog", isComplete: false },
  { id: "measurement_plan", label: "Measurement Plan", isComplete: false },
  { id: "heartbeat", label: "Heartbeat Event", isComplete: false },
  { id: "activation", label: "Activation Definition", isComplete: false },
  { id: "active", label: "Active Definition", isComplete: false },
  { id: "at_risk", label: "At-Risk Signals", isComplete: false },
  { id: "churn", label: "Churn Definition", isComplete: false },
  { id: "expansion", label: "Expansion Triggers", isComplete: false },
];

function setup(sections = ALL_SECTIONS) {
  const user = userEvent.setup();
  render(<CompletenessIndicator sections={sections} />);
  return { user };
}

test("renders collapsed state with progress bar and count", () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 4, // 4 complete
  }));
  setup(sections);

  expect(screen.getByRole("progressbar")).toBeInTheDocument();
  expect(screen.getByText("4 of 11")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: FAIL - Module not found / Component not defined

**Step 3: Commit failing test**

```bash
git add src/components/profile/CompletenessIndicator.test.tsx
git commit -m "$(cat <<'EOF'
test(CompletenessIndicator): add failing test for collapsed state

Red phase of TDD - component not yet implemented.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Implement CompletenessIndicator Collapsed State

**Files:**
- Create: `src/components/profile/CompletenessIndicator.tsx`

**Step 1: Create minimal component to pass test**

Create `src/components/profile/CompletenessIndicator.tsx`:

```tsx
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";

interface Section {
  id: string;
  label: string;
  isComplete: boolean;
}

interface CompletenessIndicatorProps {
  sections: Section[];
}

export function CompletenessIndicator({ sections }: CompletenessIndicatorProps) {
  const completed = sections.filter((s) => s.isComplete).length;
  const total = sections.length;
  const percentage = Math.round((completed / total) * 100);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto py-1 px-2">
          <div
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-black rounded-full transition-[width] duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completed} of {total}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {/* Placeholder - will implement expanded state */}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Run test to verify it passes**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/CompletenessIndicator.tsx
git commit -m "$(cat <<'EOF'
feat(CompletenessIndicator): implement collapsed state with progress bar

Shows progress bar and "X of Y" count in a clickable trigger.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Add Test for Status Label Thresholds

**Files:**
- Modify: `src/components/profile/CompletenessIndicator.test.tsx`

**Step 1: Write failing tests for status labels**

Add to `CompletenessIndicator.test.tsx`:

```tsx
test('shows "Getting Started" status for 0-3 sections', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 3, // 3 complete
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Getting Started")).toBeInTheDocument();
});

test('shows "Taking Shape" status for 4-6 sections', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 5, // 5 complete
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Taking Shape")).toBeInTheDocument();
});

test('shows "Well Defined" status for 7-9 sections', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 8, // 8 complete
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Well Defined")).toBeInTheDocument();
});

test('shows "Complete" status for 10-11 sections', async () => {
  const sections = ALL_SECTIONS.map((s) => ({
    ...s,
    isComplete: true, // 11 complete
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Complete")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: FAIL - Status labels not found

**Step 3: Commit failing tests**

```bash
git add src/components/profile/CompletenessIndicator.test.tsx
git commit -m "$(cat <<'EOF'
test(CompletenessIndicator): add failing tests for status label thresholds

Tests for Getting Started (0-3), Taking Shape (4-6), Well Defined (7-9), Complete (10-11).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Implement Status Label Logic

**Files:**
- Modify: `src/components/profile/CompletenessIndicator.tsx`

**Step 1: Add status label helper and render in popover**

Update `src/components/profile/CompletenessIndicator.tsx`:

```tsx
import { CheckCircle2, Circle, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface Section {
  id: string;
  label: string;
  isComplete: boolean;
}

interface CompletenessIndicatorProps {
  sections: Section[];
}

function getStatusLabel(completed: number): { label: string; className: string } {
  if (completed >= 10) {
    return { label: "Complete", className: "bg-green-100 text-green-800" };
  }
  if (completed >= 7) {
    return { label: "Well Defined", className: "bg-amber-100 text-amber-800" };
  }
  if (completed >= 4) {
    return { label: "Taking Shape", className: "bg-blue-100 text-blue-800" };
  }
  return { label: "Getting Started", className: "bg-gray-100 text-gray-800" };
}

export function CompletenessIndicator({ sections }: CompletenessIndicatorProps) {
  const completed = sections.filter((s) => s.isComplete).length;
  const total = sections.length;
  const percentage = Math.round((completed / total) * 100);
  const status = getStatusLabel(completed);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto py-1 px-2">
          <div
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-black rounded-full transition-[width] duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completed} of {total}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <Badge className={status.className}>{status.label}</Badge>
          {/* Checklist will be added next */}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Run tests to verify they pass**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: PASS (all 5 tests)

**Step 3: Commit**

```bash
git add src/components/profile/CompletenessIndicator.tsx
git commit -m "$(cat <<'EOF'
feat(CompletenessIndicator): add status label with threshold logic

Status badges: Getting Started (0-3), Taking Shape (4-6),
Well Defined (7-9), Complete (10-11).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Test for Section Checklist

**Files:**
- Modify: `src/components/profile/CompletenessIndicator.test.tsx`

**Step 1: Write failing test for checklist rendering**

Add to `CompletenessIndicator.test.tsx`:

```tsx
test("renders all 11 sections in checklist when expanded", async () => {
  const { user } = setup();

  await user.click(screen.getByRole("button"));

  expect(screen.getByText("Core Identity")).toBeInTheDocument();
  expect(screen.getByText("User Journey Map")).toBeInTheDocument();
  expect(screen.getByText("First Value Moment")).toBeInTheDocument();
  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("Heartbeat Event")).toBeInTheDocument();
  expect(screen.getByText("Activation Definition")).toBeInTheDocument();
  expect(screen.getByText("Active Definition")).toBeInTheDocument();
  expect(screen.getByText("At-Risk Signals")).toBeInTheDocument();
  expect(screen.getByText("Churn Definition")).toBeInTheDocument();
  expect(screen.getByText("Expansion Triggers")).toBeInTheDocument();
});

test("shows check icon for complete sections and circle for incomplete", async () => {
  const sections = [
    { id: "core_identity", label: "Core Identity", isComplete: true },
    { id: "journey_map", label: "User Journey Map", isComplete: false },
  ];
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));

  // Check for aria-labels on the list items
  const coreIdentityItem = screen.getByText("Core Identity").closest("li");
  const journeyMapItem = screen.getByText("User Journey Map").closest("li");

  expect(coreIdentityItem).toHaveAttribute("data-complete", "true");
  expect(journeyMapItem).toHaveAttribute("data-complete", "false");
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: FAIL - Sections not found in DOM

**Step 3: Commit failing tests**

```bash
git add src/components/profile/CompletenessIndicator.test.tsx
git commit -m "$(cat <<'EOF'
test(CompletenessIndicator): add failing tests for section checklist

Tests that all sections render and have correct completion indicators.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Implement Section Checklist

**Files:**
- Modify: `src/components/profile/CompletenessIndicator.tsx`

**Step 1: Add checklist to popover content**

Update the PopoverContent in `CompletenessIndicator.tsx`:

```tsx
import { CheckCircle2, Circle, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface Section {
  id: string;
  label: string;
  isComplete: boolean;
}

interface CompletenessIndicatorProps {
  sections: Section[];
}

function getStatusLabel(completed: number): { label: string; className: string } {
  if (completed >= 10) {
    return { label: "Complete", className: "bg-green-100 text-green-800" };
  }
  if (completed >= 7) {
    return { label: "Well Defined", className: "bg-amber-100 text-amber-800" };
  }
  if (completed >= 4) {
    return { label: "Taking Shape", className: "bg-blue-100 text-blue-800" };
  }
  return { label: "Getting Started", className: "bg-gray-100 text-gray-800" };
}

export function CompletenessIndicator({ sections }: CompletenessIndicatorProps) {
  const completed = sections.filter((s) => s.isComplete).length;
  const total = sections.length;
  const percentage = Math.round((completed / total) * 100);
  const status = getStatusLabel(completed);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto py-1 px-2">
          <div
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-black rounded-full transition-[width] duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completed} of {total}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <Badge className={status.className}>{status.label}</Badge>

          <ul className="space-y-2">
            {sections.map((section) => (
              <li
                key={section.id}
                data-complete={section.isComplete}
                className="flex items-center gap-2 text-sm"
              >
                {section.isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
                <span className={section.isComplete ? "text-gray-900" : "text-gray-500"}>
                  {section.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Run tests to verify they pass**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: PASS (all 7 tests)

**Step 3: Commit**

```bash
git add src/components/profile/CompletenessIndicator.tsx
git commit -m "$(cat <<'EOF'
feat(CompletenessIndicator): add section checklist with completion icons

Shows all sections with CheckCircle2 (complete) or Circle (incomplete) icons.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Add Test for CTA Button

**Files:**
- Modify: `src/components/profile/CompletenessIndicator.test.tsx`

**Step 1: Write failing test for CTA**

Add to `CompletenessIndicator.test.tsx`:

```tsx
test("shows CTA button with first incomplete section name", async () => {
  const sections = [
    { id: "core_identity", label: "Core Identity", isComplete: true },
    { id: "journey_map", label: "User Journey Map", isComplete: true },
    { id: "first_value", label: "First Value Moment", isComplete: false },
    { id: "metric_catalog", label: "Metric Catalog", isComplete: false },
  ];
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));

  expect(
    screen.getByRole("button", { name: /Complete First Value Moment/i })
  ).toBeInTheDocument();
});

test("hides CTA when all sections are complete", async () => {
  const sections = ALL_SECTIONS.map((s) => ({ ...s, isComplete: true }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));

  expect(
    screen.queryByRole("button", { name: /Complete/i })
  ).not.toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: FAIL - CTA button not found

**Step 3: Commit failing tests**

```bash
git add src/components/profile/CompletenessIndicator.test.tsx
git commit -m "$(cat <<'EOF'
test(CompletenessIndicator): add failing tests for CTA button

Tests for showing next incomplete section in CTA and hiding when all complete.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Implement CTA Button

**Files:**
- Modify: `src/components/profile/CompletenessIndicator.tsx`

**Step 1: Add CTA button logic**

Update `CompletenessIndicator.tsx` to add CTA after the checklist:

```tsx
import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface Section {
  id: string;
  label: string;
  isComplete: boolean;
}

interface CompletenessIndicatorProps {
  sections: Section[];
}

function getStatusLabel(completed: number): { label: string; className: string } {
  if (completed >= 10) {
    return { label: "Complete", className: "bg-green-100 text-green-800" };
  }
  if (completed >= 7) {
    return { label: "Well Defined", className: "bg-amber-100 text-amber-800" };
  }
  if (completed >= 4) {
    return { label: "Taking Shape", className: "bg-blue-100 text-blue-800" };
  }
  return { label: "Getting Started", className: "bg-gray-100 text-gray-800" };
}

export function CompletenessIndicator({ sections }: CompletenessIndicatorProps) {
  const [open, setOpen] = useState(false);
  const completed = sections.filter((s) => s.isComplete).length;
  const total = sections.length;
  const percentage = Math.round((completed / total) * 100);
  const status = getStatusLabel(completed);
  const firstIncomplete = sections.find((s) => !s.isComplete);

  const handleCTAClick = () => {
    if (firstIncomplete) {
      const element = document.getElementById(`section-${firstIncomplete.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 h-auto py-1 px-2">
          <div
            role="progressbar"
            aria-valuenow={percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-black rounded-full transition-[width] duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completed} of {total}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-4">
          <Badge className={status.className}>{status.label}</Badge>

          <ul className="space-y-2">
            {sections.map((section) => (
              <li
                key={section.id}
                data-complete={section.isComplete}
                className="flex items-center gap-2 text-sm"
              >
                {section.isComplete ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Circle className="w-4 h-4 text-gray-300" />
                )}
                <span className={section.isComplete ? "text-gray-900" : "text-gray-500"}>
                  {section.label}
                </span>
              </li>
            ))}
          </ul>

          {firstIncomplete && (
            <Button onClick={handleCTAClick} className="w-full">
              Complete {firstIncomplete.label}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**Step 2: Run tests to verify they pass**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: PASS (all 9 tests)

**Step 3: Commit**

```bash
git add src/components/profile/CompletenessIndicator.tsx
git commit -m "$(cat <<'EOF'
feat(CompletenessIndicator): add CTA button for next incomplete section

Button shows "Complete [Section Name]" and scrolls to section on click.
Hidden when all sections are complete.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Add Test for Scroll Behavior

**Files:**
- Modify: `src/components/profile/CompletenessIndicator.test.tsx`

**Step 1: Write failing test for scroll behavior**

Add to `CompletenessIndicator.test.tsx`:

```tsx
test("CTA scrolls to first incomplete section and closes popover", async () => {
  const sections = [
    { id: "core_identity", label: "Core Identity", isComplete: true },
    { id: "journey_map", label: "User Journey Map", isComplete: false },
  ];

  // Create a mock element for the scroll target
  const mockElement = document.createElement("div");
  mockElement.id = "section-journey_map";
  mockElement.scrollIntoView = vi.fn();
  document.body.appendChild(mockElement);

  const { user } = setup(sections);

  // Open popover
  await user.click(screen.getByRole("button"));
  expect(screen.getByText("User Journey Map")).toBeInTheDocument();

  // Click CTA
  await user.click(screen.getByRole("button", { name: /Complete User Journey Map/i }));

  // Verify scroll was called
  expect(mockElement.scrollIntoView).toHaveBeenCalledWith({
    behavior: "smooth",
    block: "start",
  });

  // Verify popover closes (checklist no longer visible)
  expect(screen.queryByText("Getting Started")).not.toBeInTheDocument();

  // Cleanup
  document.body.removeChild(mockElement);
});
```

Also add `vi` to the imports:

```tsx
import { expect, test, vi } from "vitest";
```

**Step 2: Run tests to verify they pass**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: PASS (all 10 tests)

**Step 3: Commit**

```bash
git add src/components/profile/CompletenessIndicator.test.tsx
git commit -m "$(cat <<'EOF'
test(CompletenessIndicator): add test for scroll behavior and popover close

Verifies CTA calls scrollIntoView with correct options and closes popover.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Add Test for Boundary Thresholds

**Files:**
- Modify: `src/components/profile/CompletenessIndicator.test.tsx`

**Step 1: Write tests for exact boundary values**

Add to `CompletenessIndicator.test.tsx`:

```tsx
test('boundary: 3 sections shows "Getting Started"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 3,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Getting Started")).toBeInTheDocument();
});

test('boundary: 4 sections shows "Taking Shape"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 4,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Taking Shape")).toBeInTheDocument();
});

test('boundary: 6 sections shows "Taking Shape"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 6,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Taking Shape")).toBeInTheDocument();
});

test('boundary: 7 sections shows "Well Defined"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 7,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Well Defined")).toBeInTheDocument();
});

test('boundary: 9 sections shows "Well Defined"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 9,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Well Defined")).toBeInTheDocument();
});

test('boundary: 10 sections shows "Complete"', async () => {
  const sections = ALL_SECTIONS.map((s, i) => ({
    ...s,
    isComplete: i < 10,
  }));
  const { user } = setup(sections);

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Complete")).toBeInTheDocument();
});

test("handles 0 sections complete", async () => {
  const { user } = setup(); // All false by default

  await user.click(screen.getByRole("button"));
  expect(screen.getByText("Getting Started")).toBeInTheDocument();
  expect(screen.getByText("0 of 11")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they pass**

Run:
```bash
npm test -- --run CompletenessIndicator
```
Expected: PASS (all 17 tests)

**Step 3: Commit**

```bash
git add src/components/profile/CompletenessIndicator.test.tsx
git commit -m "$(cat <<'EOF'
test(CompletenessIndicator): add boundary threshold tests

Tests exact boundaries: 3→4, 6→7, 9→10 and edge case of 0 complete.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: Add Section DOM IDs to ProfilePage

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx`

**Step 1: Add id attributes to section wrappers**

Update `ProfilePage.tsx` to wrap sections with IDs. Add `id` attributes to the section containers:

```tsx
<div className="space-y-6">
  <div id="section-core_identity">
    <CoreIdentitySection data={profileData.identity} />
  </div>

  {nextSection === "journey_map" && (
    <SuggestedNextAction
      nextSection={nextSection}
      lastCompleted={lastCompleted}
    />
  )}

  <div id="section-journey_map">
    <JourneyMapSection journeyId={profileData.journeyMap.journeyId} />
  </div>

  {nextSection === "metric_catalog" && (
    <SuggestedNextAction
      nextSection={nextSection}
      lastCompleted={lastCompleted}
    />
  )}

  <div id="section-first_value">
    <FirstValueSection />
  </div>

  <div id="section-metric_catalog">
    <MetricCatalogSection metrics={flatMetrics} />
  </div>

  {nextSection === "measurement_plan" && (
    <SuggestedNextAction
      nextSection={nextSection}
      lastCompleted={lastCompleted}
    />
  )}

  <div id="section-measurement_plan">
    <MeasurementPlanSection plan={measurementPlan ?? []} />
  </div>
</div>
```

**Step 2: Verify no TypeScript errors**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Run all tests**

Run:
```bash
npm test -- --run
```
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/components/profile/ProfilePage.tsx
git commit -m "$(cat <<'EOF'
feat(ProfilePage): add convention-based DOM IDs for scroll targeting

Sections have id="section-{sectionId}" for CompletenessIndicator scrolling.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Integrate CompletenessIndicator into ProfileHeader

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx`

**Step 1: Update ProfileHeader to accept sections prop**

First, update the props interface and add conditional rendering:

```tsx
import { getProductInitial, getProductColor } from "../../lib/productColor";
import { CompletenessIndicator } from "./CompletenessIndicator";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}

const REVENUE_MODEL_LABELS: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier Subscription",
  seat_subscription: "Seat Subscription",
  volume_based: "Volume Based",
};

interface Section {
  id: string;
  label: string;
  isComplete: boolean;
}

interface ProfileHeaderProps {
  identity: {
    productName?: string;
    productDescription?: string;
    hasMultiUserAccounts?: boolean;
    businessType?: "b2b" | "b2c";
    revenueModels?: string[];
  };
  completeness: {
    completed: number;
    total: number;
    sections?: Section[];
  };
  stats?: {
    metricsCount: number;
    entitiesCount: number;
    activitiesCount: number;
  };
}

export function ProfileHeader({
  identity,
  completeness,
  stats,
}: ProfileHeaderProps) {
  // ... existing business type badge logic ...

  const percentage = Math.round(
    (completeness.completed / completeness.total) * 100
  );

  const initial = getProductInitial(identity.productName);
  const backgroundColor = getProductColor(identity.productName);

  return (
    <header className="mb-8">
      {/* ... existing avatar and name section ... */}

      <div className="mt-3 flex items-center justify-between">
        {/* Business model badges */}
        <div className="flex items-center gap-2">
          {/* ... existing badges ... */}
        </div>

        {/* Completeness indicator */}
        <div className="flex items-center gap-2">
          {completeness.sections ? (
            <CompletenessIndicator
              sections={completeness.sections.map((s) => ({
                id: s.id,
                label: s.label,
                isComplete: s.isComplete,
              }))}
            />
          ) : (
            <>
              <div
                role="progressbar"
                aria-valuenow={percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"
              >
                <div
                  data-testid="progress-bar-fill"
                  className="h-full bg-black rounded-full transition-[width] duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {stats ? (
                <span className="text-sm text-gray-600">
                  {pluralize(stats.metricsCount, "Metric", "Metrics")} · {pluralize(stats.entitiesCount, "Entity", "Entities")} · {pluralize(stats.activitiesCount, "Activity", "Activities")}
                </span>
              ) : (
                <span className="text-sm text-gray-600">
                  {completeness.completed} of {completeness.total}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

**Step 2: Run existing ProfileHeader tests**

Run:
```bash
npm test -- --run ProfileHeader
```
Expected: All existing tests pass (backward compatible)

**Step 3: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx
git commit -m "$(cat <<'EOF'
feat(ProfileHeader): integrate CompletenessIndicator with sections prop

Shows CompletenessIndicator when sections array provided, falls back to
simple progress bar otherwise. Backward compatible with existing usage.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: Update ProfilePage to Pass Sections to ProfileHeader

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx`

**Step 1: Pass sections data to ProfileHeader**

Update the ProfileHeader usage in `ProfilePage.tsx`:

```tsx
<ProfileHeader
  identity={{
    ...profileData.identity,
    businessType: profileData.identity.businessType as "b2b" | "b2c" | undefined,
  }}
  completeness={{
    completed: profileData.completeness.completed,
    total: profileData.completeness.total,
    sections: profileData.completeness.sections.map((s) => ({
      id: s.id,
      label: s.name,
      isComplete: s.complete,
    })),
  }}
  stats={{
    metricsCount: profileData.metricCatalog.totalCount,
    entitiesCount: profileData.measurementPlan.entities.length,
    activitiesCount: profileData.measurementPlan.activityCount,
  }}
/>
```

**Step 2: Run all tests**

Run:
```bash
npm test -- --run
```
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/profile/ProfilePage.tsx
git commit -m "$(cat <<'EOF'
feat(ProfilePage): pass sections data to ProfileHeader for CompletenessIndicator

Maps Convex completeness.sections to ProfileHeader's expected format.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: Add Integration Test for ProfileHeader with CompletenessIndicator

**Files:**
- Modify: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Add test for CompletenessIndicator rendering**

Add to `ProfileHeader.test.tsx`:

```tsx
test("renders CompletenessIndicator when sections provided", () => {
  setup({
    identity: { productName: "My App" },
    completeness: {
      completed: 3,
      total: 11,
      sections: [
        { id: "core_identity", label: "Core Identity", isComplete: true },
        { id: "journey_map", label: "User Journey Map", isComplete: true },
        { id: "first_value", label: "First Value Moment", isComplete: true },
        { id: "metric_catalog", label: "Metric Catalog", isComplete: false },
      ],
    },
  });

  // Should show the count in the trigger button
  expect(screen.getByText("3 of 4")).toBeInTheDocument();
  // Should have a button that can be clicked to expand
  expect(screen.getByRole("button", { name: /3 of 4/i })).toBeInTheDocument();
});

test("falls back to simple progress bar when sections not provided", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 5, total: 11 },
  });

  // Should show the simple text, not a button
  expect(screen.getByText("5 of 11")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toBeInTheDocument();
});
```

**Step 2: Run tests**

Run:
```bash
npm test -- --run ProfileHeader
```
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/profile/ProfileHeader.test.tsx
git commit -m "$(cat <<'EOF'
test(ProfileHeader): add integration tests for CompletenessIndicator

Tests both new sections prop behavior and backward compatibility.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Final Verification

**Step 1: Run full test suite**

Run:
```bash
npm test -- --run
```
Expected: All tests pass

**Step 2: Run TypeScript check**

Run:
```bash
npx tsc --noEmit
```
Expected: No errors

**Step 3: Run linter**

Run:
```bash
npm run lint
```
Expected: No errors (or only pre-existing warnings)

**Step 4: Manual verification (optional)**

Start dev server and verify:
```bash
npm run dev
```
- Navigate to profile page
- Click progress bar to expand popover
- Verify status label matches completion count
- Verify all sections show with correct icons
- Click CTA and verify scroll behavior

**Step 5: Final commit (if any fixes needed)**

If any fixes were required, commit them with appropriate message.

---

## Summary

This plan creates the CompletenessIndicator component with:

1. **17 TDD tasks** covering:
   - Popover UI component setup
   - Collapsed state (progress bar + count)
   - Status label thresholds (4 states)
   - Section checklist with completion icons
   - CTA button with scroll-to-section behavior
   - Boundary threshold tests
   - ProfilePage DOM IDs for scroll targeting
   - ProfileHeader integration

2. **Testing approach:**
   - Unit tests for CompletenessIndicator (17+ test cases)
   - Integration tests for ProfileHeader
   - Boundary threshold tests at 3→4, 6→7, 9→10
   - Scroll behavior mocking

3. **Files created/modified:**
   - Create: `src/components/ui/popover.tsx`
   - Create: `src/components/profile/CompletenessIndicator.tsx`
   - Create: `src/components/profile/CompletenessIndicator.test.tsx`
   - Modify: `src/components/profile/ProfileHeader.tsx`
   - Modify: `src/components/profile/ProfileHeader.test.tsx`
   - Modify: `src/components/profile/ProfilePage.tsx`
   - Modify: `package.json` (add dependency)
