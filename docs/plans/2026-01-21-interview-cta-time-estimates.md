# Interview CTA Time Estimates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add time estimates (e.g., "~5 min") to interview start buttons to reduce friction and set expectations.

**Architecture:** Modify ProfileSection to accept an optional `timeEstimate` prop, then pass time estimates from interviewTypes.ts to FirstValueSection and JourneyMapSection when showing "not_started" state. Follow existing pattern of placing time estimate in muted gray text near the action button.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library

---

## Existing Patterns Reference

The codebase already shows time estimates in several places:
- `FutureSectionCard.tsx:18-20` - Inline in button text: `"Start Interview  ~7 min"`
- `StageCard.tsx:131-133` - Separate span: `<span className="text-xs text-gray-400">{timeEstimate}</span>`
- `InterviewCard.tsx:63` - With margin: `<span className="text-xs text-gray-400 ml-2">~{config.estimatedMinutes} min</span>`

The ProfileSection already has a similar pattern with `prerequisiteText` that displays text near the button.

**Interview times from `interviewTypes.ts`:**
- `overview`: 15 min (used by JourneyMapSection)
- `first_value`: 7 min (used by FirstValueSection)

---

## Task 1: Add timeEstimate prop to ProfileSection

**Files:**
- Modify: `src/components/profile/ProfileSection.tsx:11-19`
- Test: `src/components/profile/ProfileSection.test.tsx`

**Step 1: Write the failing test**

Add to `ProfileSection.test.tsx`:

```typescript
test("renders time estimate when provided", () => {
  setup({
    title: "Test Section",
    status: "not_started",
    statusLabel: "Not Started",
    actionLabel: "Start",
    timeEstimate: "~5 min",
  });

  expect(screen.getByText("~5 min")).toBeInTheDocument();
});

test("does not render time estimate when not provided", () => {
  setup({
    title: "Test Section",
    status: "not_started",
    statusLabel: "Not Started",
    actionLabel: "Start",
  });

  expect(screen.queryByText(/min/)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfileSection.test.tsx`
Expected: FAIL - setup function doesn't accept `timeEstimate`

**Step 3: Update setup function and props type**

Update the setup function in `ProfileSection.test.tsx` to include `timeEstimate`:

```typescript
function setup(props: Partial<{
  title: string;
  status: ProfileSectionStatus;
  statusLabel: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  prerequisiteText?: string;
  timeEstimate?: string;
}> = {}) {
```

**Step 4: Run test to verify it still fails**

Run: `npm test -- ProfileSection.test.tsx`
Expected: FAIL - ProfileSection component doesn't accept `timeEstimate`

**Step 5: Add timeEstimate prop to ProfileSection interface**

In `ProfileSection.tsx`, update the interface (around line 11-19):

```typescript
interface ProfileSectionProps {
  title: string;
  status: ProfileSectionStatus;
  statusLabel: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  prerequisiteText?: string;
  timeEstimate?: string;
}
```

**Step 6: Destructure timeEstimate in component**

Update the component function parameters (around line 46-54):

```typescript
export function ProfileSection({
  title,
  status,
  statusLabel,
  children,
  actionLabel,
  onAction,
  prerequisiteText,
  timeEstimate,
}: ProfileSectionProps) {
```

**Step 7: Render timeEstimate near the button**

Update the action section (around line 87-100) to show time estimate:

```typescript
{/* Action */}
{actionLabel && (
  <div className="flex justify-end items-center gap-2">
    {isLocked && prerequisiteText && (
      <span className="text-xs text-gray-400">{prerequisiteText}</span>
    )}
    {!isLocked && timeEstimate && (
      <span className="text-xs text-gray-400">{timeEstimate}</span>
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
```

**Step 8: Run test to verify it passes**

Run: `npm test -- ProfileSection.test.tsx`
Expected: PASS

**Step 9: Commit**

```bash
git add src/components/profile/ProfileSection.tsx src/components/profile/ProfileSection.test.tsx
git commit -m "feat(ProfileSection): add timeEstimate prop for interview CTAs"
```

---

## Task 2: Add time estimate to FirstValueSection

**Files:**
- Modify: `src/components/profile/FirstValueSection.tsx:1-4, 155-171`
- Test: `src/components/profile/FirstValueSection.test.tsx`

**Step 1: Write the failing test**

Add to `FirstValueSection.test.tsx` in the "undefined state" describe block:

```typescript
test("shows time estimate in not_started state", () => {
  mockDefinition = null;
  setup();

  expect(screen.getByText("~7 min")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- FirstValueSection.test.tsx`
Expected: FAIL - "~7 min" not found

**Step 3: Import INTERVIEW_TYPES**

Add import at top of `FirstValueSection.tsx`:

```typescript
import { INTERVIEW_TYPES } from "@/shared/interviewTypes";
```

**Step 4: Add timeEstimate to the not_started ProfileSection**

Update the not_started state return (around line 155-171):

```typescript
if (!definition) {
  return (
    <ProfileSection
      title="First Value Moment"
      status={status}
      statusLabel={statusLabel}
      actionLabel={actionLabel}
      onAction={handleEditClick}
      timeEstimate={`~${INTERVIEW_TYPES.first_value.estimatedMinutes} min`}
    >
      <div>
        <p className="font-medium text-gray-900">What moment turns a visitor into a believer?</p>
        <p className="text-gray-600 text-sm mt-1">
          Finding your first value reveals whether you're activating users fast enough.
        </p>
      </div>
    </ProfileSection>
  );
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- FirstValueSection.test.tsx`
Expected: PASS

**Step 6: Verify no time estimate shows for other states**

Add test to ensure time estimate doesn't appear when definition exists:

```typescript
test("does not show time estimate when definition exists", () => {
  mockDefinition = {
    activityName: "Report Created",
    reasoning: "When users create their first report",
    expectedTimeframe: "Within 3 days",
    confirmedAt: null,
    source: "manual_edit",
  };
  setup();

  expect(screen.queryByText("~7 min")).not.toBeInTheDocument();
});
```

Run: `npm test -- FirstValueSection.test.tsx`
Expected: PASS (no changes needed - timeEstimate only passed in not_started block)

**Step 7: Commit**

```bash
git add src/components/profile/FirstValueSection.tsx src/components/profile/FirstValueSection.test.tsx
git commit -m "feat(FirstValueSection): show ~7 min time estimate for first value interview"
```

---

## Task 3: Add time estimate to JourneyMapSection

**Files:**
- Modify: `src/components/profile/JourneyMapSection.tsx:1-9, 45-71`
- Test: `src/components/profile/JourneyMapSection.test.tsx`

**Step 1: Write the failing test**

Add to `JourneyMapSection.test.tsx`:

```typescript
test("shows time estimate in not_started empty state", () => {
  setup({ journeyId: null });

  expect(screen.getByText("~15 min")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: FAIL - "~15 min" not found

**Step 3: Import INTERVIEW_TYPES**

Add import at top of `JourneyMapSection.tsx`:

```typescript
import { INTERVIEW_TYPES } from "@/shared/interviewTypes";
```

**Step 4: Add timeEstimate to ProfileSection**

The JourneyMapSection currently has no actionLabel for not_started state. We need to add both an action and the time estimate.

Looking at the issue description, the goal is to show time estimates on interview CTAs. For JourneyMapSection in not_started state, there is currently no button. We should add a "Start Interview" button with the time estimate.

Update the ProfileSection call (around line 45-71):

```typescript
// Determine actionLabel and onAction based on state
let actionLabel: string | undefined;
let actionHandler: (() => void) | undefined;
let timeEstimate: string | undefined;

if (!hasStages) {
  // Not started - show Start Interview with time estimate
  actionLabel = "Start Interview";
  actionHandler = () => navigate("/setup/interview");
  timeEstimate = `~${INTERVIEW_TYPES.overview.estimatedMinutes} min`;
} else if (journeyId) {
  // Has stages - show Edit Journey
  actionLabel = "Edit Journey";
  actionHandler = () => navigate(`/journeys/${journeyId}`);
}

return (
  <ProfileSection
    title="Journey Map"
    status={status}
    statusLabel={statusLabel}
    actionLabel={actionLabel}
    onAction={actionHandler}
    timeEstimate={timeEstimate}
  >
    {hasStages ? (
      <JourneyDiagram
        stages={stages.map((s) => ({
          _id: s._id,
          name: s.name,
          lifecycleSlot: s.lifecycleSlot as LifecycleSlot,
          entity: s.entity,
          action: s.action,
        }))}
      />
    ) : (
      <div>
        <p className="font-medium text-gray-900">See where users thrive—and where they vanish.</p>
        <p className="text-gray-600 text-sm mt-1">
          Mapping your journey reveals the critical transitions where growth happens or stalls.
        </p>
      </div>
    )}
  </ProfileSection>
);
```

**Step 5: Run test to verify it passes**

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: PASS

**Step 6: Add test for "Start Interview" button**

Add test to verify the button appears in not_started state:

```typescript
test("shows Start Interview button when no journeyId and no stages", () => {
  setup({ journeyId: null });

  expect(
    screen.getByRole("button", { name: /start interview/i })
  ).toBeInTheDocument();
});

test("navigates to interview when Start Interview clicked", async () => {
  const { user } = setup({ journeyId: null });

  await user.click(screen.getByRole("button", { name: /start interview/i }));

  expect(mockNavigate).toHaveBeenCalledWith("/setup/interview");
});
```

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: PASS

**Step 7: Verify time estimate doesn't show when stages exist**

Add test:

```typescript
test("does not show time estimate when stages exist", () => {
  setup({
    journeyId: "j1" as Id<"journeys">,
    stages: [
      {
        _id: "s1" as Id<"stages">,
        name: "Account Created",
        lifecycleSlot: "account_creation",
      },
    ],
  });

  expect(screen.queryByText("~15 min")).not.toBeInTheDocument();
});
```

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: PASS

**Step 8: Update existing test that checks for no button**

The existing test "renders with not_started status when no journeyId" checks that there's no "Edit Journey" button. We need to update it to reflect the new "Start Interview" button:

Update the test:

```typescript
test("renders with not_started status when no journeyId", () => {
  setup({ journeyId: null });

  expect(screen.getByText("Journey Map")).toBeInTheDocument();
  expect(screen.getByText("Not Started")).toBeInTheDocument();
  // Now shows Start Interview instead of Edit Journey
  expect(
    screen.queryByRole("button", { name: /edit journey/i })
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /start interview/i })
  ).toBeInTheDocument();
});
```

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: PASS

**Step 9: Commit**

```bash
git add src/components/profile/JourneyMapSection.tsx src/components/profile/JourneyMapSection.test.tsx
git commit -m "feat(JourneyMapSection): add Start Interview button with ~15 min time estimate"
```

---

## Task 4: Final verification

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Manual verification checklist**

- [ ] FirstValueSection shows "~7 min" next to "Define" button in not_started state
- [ ] FirstValueSection does NOT show time estimate when definition exists
- [ ] JourneyMapSection shows "~15 min" next to "Start Interview" in not_started state
- [ ] JourneyMapSection shows "Edit Journey" (no time estimate) when stages exist
- [ ] Time estimates use consistent styling: `text-xs text-gray-400`

**Step 3: Commit any final adjustments**

If any adjustments needed, commit them.

---

## Summary

| Task | Description | Files Modified |
|------|-------------|----------------|
| 1 | Add timeEstimate prop to ProfileSection | ProfileSection.tsx, ProfileSection.test.tsx |
| 2 | Add time estimate to FirstValueSection | FirstValueSection.tsx, FirstValueSection.test.tsx |
| 3 | Add time estimate to JourneyMapSection | JourneyMapSection.tsx, JourneyMapSection.test.tsx |
| 4 | Final verification | - |

**Time estimates displayed:**
- FirstValueSection: "~7 min" (from `INTERVIEW_TYPES.first_value.estimatedMinutes`)
- JourneyMapSection: "~15 min" (from `INTERVIEW_TYPES.overview.estimatedMinutes`)

**Design decision:** Time estimates appear as muted gray text (`text-xs text-gray-400`) next to the action button, following the existing pattern in `StageCard.tsx` and `InterviewCard.tsx`. They only appear for `not_started` states where an interview is available.
