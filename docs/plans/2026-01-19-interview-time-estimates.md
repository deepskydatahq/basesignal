# Interview Time Estimates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add time estimates to all interview CTAs so users know the commitment before starting

**Architecture:** Add `estimatedMinutes` to `INTERVIEW_TYPES` config (single source of truth), then display `~X min` at the 4 CTA locations where users decide to start interviews

**Tech Stack:** React, TypeScript, Vitest, React Testing Library

---

## Task 1: Add estimatedMinutes to INTERVIEW_TYPES Config

**Files:**
- Modify: `src/shared/interviewTypes.ts:3-47`

**Step 1: Add estimatedMinutes to each interview type**

Update the config to add the `estimatedMinutes` field to each interview type:

```typescript
export const INTERVIEW_TYPES = {
  overview: {
    id: "overview",
    name: "Overview Journey",
    description: "Map your product's key lifecycle moments from signup to churn",
    dependencies: [] as string[],
    outputs: { stages: true, rules: [] },
    isSetupInterview: true,
    estimatedMinutes: 15,
  },
  first_value: {
    id: "first_value",
    name: "Find First Value",
    description: "Identify the activation moment - when users first experience value",
    dependencies: [] as string[],
    outputs: { stages: true, rules: ["activation"] },
    estimatedMinutes: 7,
  },
  retention: {
    id: "retention",
    name: "Define Retention",
    description: "Define what 'coming back' looks like for your product",
    dependencies: ["first_value"],
    outputs: { stages: false, rules: ["active"] },
    estimatedMinutes: 5,
  },
  value_outcomes: {
    id: "value_outcomes",
    name: "Define Value Outcomes",
    description: "Map the behaviors that create value",
    dependencies: ["first_value"],
    outputs: { stages: true, rules: ["value"] },
    estimatedMinutes: 7,
  },
  value_capture: {
    id: "value_capture",
    name: "Value Capture",
    description: "Link behaviors to revenue and business metrics",
    dependencies: ["value_outcomes"],
    outputs: { stages: false, rules: ["revenue"] },
    estimatedMinutes: 5,
  },
  churn: {
    id: "churn",
    name: "Churn",
    description: "Define inactivity and cancellation signals",
    dependencies: ["first_value", "value_outcomes"],
    outputs: { stages: true, rules: ["at_risk", "churn"] },
    estimatedMinutes: 5,
  },
} as const;
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/shared/interviewTypes.ts
git commit -m "feat: add estimatedMinutes to INTERVIEW_TYPES config

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update BriefingScreen to Use Config Values

**Files:**
- Modify: `src/components/onboarding/screens/BriefingScreen.tsx:1-115`
- Modify: `src/components/onboarding/screens/BriefingScreen.test.tsx:1-57`

**Step 1: Write failing test**

Add test to `BriefingScreen.test.tsx`:

```typescript
test("displays time estimate from config, not hardcoded", () => {
  setup({ productName: "Acme" });

  // Should show "~15 min" format from config
  expect(screen.getByText(/~15 min/)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/onboarding/screens/BriefingScreen.test.tsx`
Expected: FAIL - cannot find text matching /~15 min/

**Step 3: Update BriefingScreen to import config and use dynamic values**

Add import at top of `BriefingScreen.tsx`:

```typescript
import { INTERVIEW_TYPES } from "../../../shared/interviewTypes";
```

Update line 35 (the "15 minutes of focused time" text):

```typescript
<span className="text-sm text-gray-600">~{INTERVIEW_TYPES.overview.estimatedMinutes} min of focused time</span>
```

Update line 58 (the "after 15m" heading):

```typescript
<h2 className="text-sm font-medium text-gray-700">What you'll walk away with after ~{INTERVIEW_TYPES.overview.estimatedMinutes}m</h2>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/onboarding/screens/BriefingScreen.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/onboarding/screens/BriefingScreen.tsx src/components/onboarding/screens/BriefingScreen.test.tsx
git commit -m "feat: use config time estimates in BriefingScreen

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Time Estimate to StageCard

**Files:**
- Modify: `src/components/home/StageCard.tsx:16-131`
- Modify: `src/components/home/StageCard.test.tsx:1-117`

**Step 1: Write failing test**

Add test to `StageCard.test.tsx`:

```typescript
test("shows time estimate when provided and status is not_started", () => {
  setup({ status: "not_started", timeEstimate: "~15 min" });

  expect(screen.getByText("~15 min")).toBeInTheDocument();
});

test("does not show time estimate when status is complete", () => {
  setup({ status: "complete", timeEstimate: "~15 min" });

  expect(screen.queryByText("~15 min")).not.toBeInTheDocument();
});

test("does not show time estimate when status is locked", () => {
  setup({ status: "locked", timeEstimate: "~15 min" });

  expect(screen.queryByText("~15 min")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/home/StageCard.test.tsx`
Expected: FAIL - timeEstimate prop not recognized / text not found

**Step 3: Add timeEstimate prop and display logic**

Update `StageCardProps` interface (around line 16):

```typescript
interface StageCardProps {
  title: string;
  description: string;
  icon: IconName;
  status: StageStatus;
  progressText?: string;
  badgeText?: string;
  timeEstimate?: string;
  onClick?: () => void;
}
```

Update function signature (around line 73):

```typescript
export function StageCard({
  title,
  description,
  icon,
  status,
  progressText,
  badgeText,
  timeEstimate,
  onClick,
}: StageCardProps) {
```

Update the CTA section (around line 116-128). Replace the existing button block:

```typescript
{isLocked ? (
  <span className="text-xs text-gray-400">Coming soon</span>
) : (
  <div className="flex items-center gap-2">
    <Button
      size="sm"
      variant={config.buttonVariant}
      onClick={onClick}
      className="flex-1"
    >
      {config.buttonLabel}
    </Button>
    {timeEstimate && (status === "not_started" || status === "not_defined") && (
      <span className="text-xs text-gray-400">{timeEstimate}</span>
    )}
  </div>
)}
```

**Step 4: Update setup function in test file**

Update the `setup` function in `StageCard.test.tsx` to include `timeEstimate`:

```typescript
function setup(props: Partial<Parameters<typeof StageCard>[0]> = {}) {
  const user = userEvent.setup();
  const onClick = props.onClick ?? vi.fn();
  const defaultProps = {
    title: "Test Stage",
    description: "Test description",
    icon: "Users" as const,
    status: "not_started" as const,
    onClick,
    ...props,
  };
  render(<StageCard {...defaultProps} />);
  return { user, onClick };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --run src/components/home/StageCard.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/home/StageCard.tsx src/components/home/StageCard.test.tsx
git commit -m "feat: add timeEstimate prop to StageCard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Wire Time Estimates to MeasurementFoundationCard

**Files:**
- Modify: `src/components/home/MeasurementFoundationCard.tsx:1-119`
- Modify: `src/components/home/MeasurementFoundationCard.test.tsx` (if it exists)

**Step 1: Add import for INTERVIEW_TYPES**

Add to imports in `MeasurementFoundationCard.tsx`:

```typescript
import { INTERVIEW_TYPES } from "../../shared/interviewTypes";
```

**Step 2: Pass timeEstimate to StageCard for Overview Interview**

Update the first StageCard (around line 79-90):

```typescript
<StageCard
  title="Overview Interview"
  description="Map your product's user lifecycle"
  icon="Users"
  status={overviewStageStatus}
  progressText={
    status.overviewInterview.status === "in_progress"
      ? `${status.overviewInterview.slotsCompleted} of ${status.overviewInterview.slotsTotal} lifecycle slots`
      : undefined
  }
  timeEstimate={`~${INTERVIEW_TYPES.overview.estimatedMinutes} min`}
  onClick={handleOverviewClick}
/>
```

**Step 3: Pass timeEstimate to StageCard for First Value**

Update the second StageCard (around line 92-98):

```typescript
<StageCard
  title="First Value"
  description="Define when users find value"
  icon="Target"
  status={firstValueStageStatus}
  timeEstimate={`~${INTERVIEW_TYPES.first_value.estimatedMinutes} min`}
  onClick={handleFirstValueClick}
/>
```

**Step 4: Run tests to verify no regressions**

Run: `npm test -- --run src/components/home/`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/home/MeasurementFoundationCard.tsx
git commit -m "feat: wire time estimates to MeasurementFoundationCard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Time Estimate to InterviewCard

**Files:**
- Modify: `src/components/interview/InterviewCard.tsx:1-67`
- Create: `src/components/interview/InterviewCard.test.tsx`

**Step 1: Write failing test**

Create `src/components/interview/InterviewCard.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InterviewCard from "./InterviewCard";

function setup(
  props: Partial<{
    type: "first_value" | "retention" | "value_outcomes" | "value_capture" | "churn";
    status: "locked" | "available" | "in_progress" | "complete";
    missingDeps: string[];
    isSelected: boolean;
  }> = {}
) {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const defaultProps = {
    type: "first_value" as const,
    status: "available" as const,
    missingDeps: [],
    onSelect,
    isSelected: false,
    ...props,
  };
  render(<InterviewCard {...defaultProps} />);
  return { user, onSelect };
}

test("shows time estimate for available status", () => {
  setup({ type: "first_value", status: "available" });

  expect(screen.getByText("~7 min")).toBeInTheDocument();
});

test("does not show time estimate for locked status", () => {
  setup({ type: "first_value", status: "locked", missingDeps: ["overview"] });

  expect(screen.queryByText("~7 min")).not.toBeInTheDocument();
});

test("does not show time estimate for complete status", () => {
  setup({ type: "first_value", status: "complete" });

  expect(screen.queryByText("~7 min")).not.toBeInTheDocument();
});

test("renders interview name and description", () => {
  setup({ type: "first_value", status: "available" });

  expect(screen.getByText("Find First Value")).toBeInTheDocument();
  expect(screen.getByText(/activation moment/i)).toBeInTheDocument();
});

test("calls onSelect when clicked for available status", async () => {
  const { user, onSelect } = setup({ type: "first_value", status: "available" });

  await user.click(screen.getByText("Find First Value"));

  expect(onSelect).toHaveBeenCalledOnce();
});

test("does not call onSelect when clicked for locked status", async () => {
  const { user, onSelect } = setup({
    type: "first_value",
    status: "locked",
    missingDeps: ["overview"],
  });

  await user.click(screen.getByText("Find First Value"));

  expect(onSelect).not.toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/interview/InterviewCard.test.tsx`
Expected: FAIL - cannot find "~7 min" text

**Step 3: Update InterviewCard to show time estimate**

In `InterviewCard.tsx`, update the JSX to show time estimate for available status (around line 61, after the description paragraph):

Replace the conditional rendering block (lines 52-62) with:

```typescript
{status === "locked" ? (
  <p className="text-xs text-gray-400 mt-0.5">
    Needs: {missingDeps.map(d => INTERVIEW_TYPES[d as InterviewType]?.name).join(", ")}
  </p>
) : status === "in_progress" ? (
  <p className="text-xs text-blue-600 mt-0.5">Continue conversation...</p>
) : status === "complete" ? (
  <p className="text-xs text-green-600 mt-0.5">Completed</p>
) : (
  <div className="flex items-center justify-between mt-0.5">
    <p className="text-xs text-gray-500">{config.description}</p>
    <span className="text-xs text-gray-400 ml-2">~{config.estimatedMinutes} min</span>
  </div>
)}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/interview/InterviewCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/interview/InterviewCard.tsx src/components/interview/InterviewCard.test.tsx
git commit -m "feat: add time estimate to InterviewCard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Time Estimate to FutureSectionCard

**Files:**
- Modify: `src/components/profile/FutureSectionCard.tsx:1-27`
- Modify: `src/components/profile/FutureSectionCard.test.tsx:1-69`

**Step 1: Write failing test**

Add test to `FutureSectionCard.test.tsx`:

```typescript
test("shows time estimate when isReady is true", () => {
  setup({ isReady: true, timeEstimate: "~7 min" });

  expect(screen.getByText("~7 min")).toBeInTheDocument();
});

test("does not show time estimate when isReady is false", () => {
  setup({ isReady: false, timeEstimate: "~7 min" });

  expect(screen.queryByText("~7 min")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/profile/FutureSectionCard.test.tsx`
Expected: FAIL - timeEstimate prop not recognized

**Step 3: Update setup function in test file**

Update setup function to include `timeEstimate`:

```typescript
function setup(
  props: Partial<{
    title: string;
    description: string;
    prerequisite: string;
    isReady: boolean;
    timeEstimate: string;
  }> = {}
) {
  const defaultProps = {
    title: "Heartbeat Event",
    description: "The single event that indicates a user is active.",
    prerequisite: "Requires: Overview Interview",
    isReady: false,
    ...props,
  };
  render(<FutureSectionCard {...defaultProps} />);
}
```

**Step 4: Add timeEstimate prop to FutureSectionCard**

Update `FutureSectionCard.tsx`:

```typescript
import { ProfileSection } from "./ProfileSection";

interface FutureSectionCardProps {
  title: string;
  description: string;
  prerequisite: string;
  isReady: boolean;
  timeEstimate?: string;
}

export function FutureSectionCard({
  title,
  description,
  prerequisite,
  isReady,
  timeEstimate,
}: FutureSectionCardProps) {
  const actionLabel = isReady && timeEstimate
    ? `Start Interview  ${timeEstimate}`
    : "Start Interview";

  return (
    <ProfileSection
      title={title}
      status={isReady ? "not_started" : "locked"}
      statusLabel="Not Defined"
      actionLabel={actionLabel}
      prerequisiteText={!isReady ? prerequisite : undefined}
    >
      <p className="text-sm text-gray-500">{description}</p>
    </ProfileSection>
  );
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- --run src/components/profile/FutureSectionCard.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/profile/FutureSectionCard.tsx src/components/profile/FutureSectionCard.test.tsx
git commit -m "feat: add time estimate to FutureSectionCard

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Wire Time Estimates to Profile Page FutureSectionCards

**Files:**
- Modify: Wherever FutureSectionCard is used (likely ProfilePage or similar)

**Step 1: Find where FutureSectionCard is used**

Run: `grep -r "FutureSectionCard" src/`

Expected: Find the parent component(s) that render FutureSectionCard

**Step 2: Add import for INTERVIEW_TYPES and pass timeEstimate**

For each location where FutureSectionCard is rendered, add the import and pass the appropriate time estimate:

```typescript
import { INTERVIEW_TYPES } from "../../shared/interviewTypes";

// Then for each FutureSectionCard:
<FutureSectionCard
  title="..."
  description="..."
  prerequisite="..."
  isReady={...}
  timeEstimate={`~${INTERVIEW_TYPES.first_value.estimatedMinutes} min`}
/>
```

**Step 3: Run all tests**

Run: `npm test -- --run`
Expected: PASS

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire time estimates to FutureSectionCard usage

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Final Verification

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors (or only pre-existing ones)

**Step 4: Manual verification checklist**

- [ ] BriefingScreen shows "~15 min" instead of hardcoded "15 minutes"
- [ ] StageCard shows time estimate for not_started and not_defined statuses
- [ ] InterviewCard shows time estimate for available status
- [ ] FutureSectionCard shows time estimate when ready

---

## Summary

| Interview Type | Estimate | Display Locations |
|---------------|----------|-------------------|
| Overview Journey | ~15 min | BriefingScreen, StageCard (MeasurementFoundationCard) |
| First Value | ~7 min | StageCard, InterviewCard, FutureSectionCard |
| Retention | ~5 min | InterviewCard |
| Value Outcomes | ~7 min | InterviewCard |
| Value Capture | ~5 min | InterviewCard |
| Churn | ~5 min | InterviewCard |
