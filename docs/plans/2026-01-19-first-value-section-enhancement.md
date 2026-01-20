# FirstValueSection Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance FirstValueSection to display activity name and timeframe with stronger visual hierarchy matching CoreIdentitySection's label:value pattern.

**Architecture:** Replace inline display with stacked label:value blocks using `space-y-3` spacing. Add explicit confirmation status display with Check icon for completed state.

**Tech Stack:** React, Tailwind CSS, Lucide icons (Check)

---

## Current State

The FirstValueSection (`src/components/profile/FirstValueSection.tsx`) currently displays:
- Activity name with `font-medium`
- Timeframe and confirmation date inline with `text-sm text-gray-500`

## Target State

Match CoreIdentitySection's pattern:
- Each field gets its own labeled block
- Labels: `text-sm text-gray-500`
- Values: `text-gray-900` (activity gets `font-medium` for prominence)
- Confirmation status: green text with Check icon

---

## Task 1: Add test for label:value pattern in defined state

**Files:**
- Modify: `src/components/profile/FirstValueSection.test.tsx`

**Step 1: Write the failing test**

Add this test to the "defined state (pending confirmation)" describe block:

```typescript
test("displays activity with 'Activity' label", () => {
  mockDefinition = {
    activityName: "Report Created",
    reasoning: "When users create their first report",
    expectedTimeframe: "Within 3 days",
    confirmedAt: null,
    source: "manual_edit",
  };
  setup();

  expect(screen.getByText("Activity")).toBeInTheDocument();
  expect(screen.getByText("Report Created")).toBeInTheDocument();
});

test("displays timeframe with 'Expected' label", () => {
  mockDefinition = {
    activityName: "Report Created",
    reasoning: "When users create their first report",
    expectedTimeframe: "Within 3 days",
    confirmedAt: null,
    source: "manual_edit",
  };
  setup();

  expect(screen.getByText("Expected")).toBeInTheDocument();
  expect(screen.getByText("Within 3 days")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run FirstValueSection.test.tsx`
Expected: FAIL - "Activity" and "Expected" labels not found

**Step 3: Commit test**

```bash
git add src/components/profile/FirstValueSection.test.tsx
git commit -m "test: add tests for FirstValueSection label:value pattern"
```

---

## Task 2: Implement label:value pattern for defined state

**Files:**
- Modify: `src/components/profile/FirstValueSection.tsx:171-188`

**Step 1: Update the return statement for defined state**

Replace lines 171-188:

```tsx
return (
  <ProfileSection
    title="First Value Moment"
    status={status}
    statusLabel={statusLabel}
    actionLabel={actionLabel}
    onAction={handleEditClick}
  >
    <div className="space-y-3">
      <div>
        <span className="text-sm text-gray-500">Activity</span>
        <p className="text-gray-900 font-medium">{definition.activityName}</p>
      </div>
      <div>
        <span className="text-sm text-gray-500">Expected</span>
        <p className="text-gray-900">{definition.expectedTimeframe}</p>
      </div>
      {definition.confirmedAt && (
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>Confirmed: {formatDate(definition.confirmedAt)}</span>
        </div>
      )}
    </div>
  </ProfileSection>
);
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run FirstValueSection.test.tsx`
Expected: All tests pass including new label:value tests

**Step 3: Commit implementation**

```bash
git add src/components/profile/FirstValueSection.tsx
git commit -m "feat: add label:value pattern to FirstValueSection"
```

---

## Task 3: Add test for confirmation status display

**Files:**
- Modify: `src/components/profile/FirstValueSection.test.tsx`

**Step 1: Write the failing test**

Add to the "confirmed state" describe block:

```typescript
test("shows Status label with check icon and confirmed date", () => {
  mockDefinition = {
    activityName: "Report Created",
    reasoning: "When users create their first report",
    expectedTimeframe: "Within 3 days",
    confirmedAt: 1736553600000, // Jan 11, 2025
    source: "interview",
  };
  setup();

  expect(screen.getByText("Status")).toBeInTheDocument();
  expect(screen.getByText(/confirmed jan 11, 2025/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run FirstValueSection.test.tsx`
Expected: FAIL - "Status" label not found

**Step 3: Commit test**

```bash
git add src/components/profile/FirstValueSection.test.tsx
git commit -m "test: add test for FirstValueSection confirmation status display"
```

---

## Task 4: Implement confirmation status display

**Files:**
- Modify: `src/components/profile/FirstValueSection.tsx`

**Step 1: Update the confirmation display**

Replace the confirmedAt conditional block with:

```tsx
{definition.confirmedAt && (
  <div>
    <span className="text-sm text-gray-500">Status</span>
    <p className="text-green-600 flex items-center gap-1">
      <Check className="w-4 h-4" />
      Confirmed {formatDate(definition.confirmedAt)}
    </p>
  </div>
)}
```

Note: The `Check` icon is already imported at line 15.

**Step 2: Run tests to verify they pass**

Run: `npm test -- --run FirstValueSection.test.tsx`
Expected: All tests pass

**Step 3: Commit implementation**

```bash
git add src/components/profile/FirstValueSection.tsx
git commit -m "feat: add confirmation status display to FirstValueSection"
```

---

## Task 5: Run full test suite and verify build

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 3: Final commit if any cleanup needed**

If any issues found, fix and commit with appropriate message.

---

## Summary

This plan transforms the FirstValueSection display from:

**Before:**
```
Report Created              (font-medium)
Expected: Within 3 days     (inline, text-sm text-gray-500)
Confirmed: Jan 11, 2025     (inline, text-sm text-gray-500)
```

**After:**
```
Activity                    (label)
Report Created              (font-medium)

Expected                    (label)
Within 3 days               (text-gray-900)

Status                      (label, only when confirmed)
✓ Confirmed Jan 11, 2025    (green text with check icon)
```

This matches CoreIdentitySection's visual hierarchy and makes the First Value Moment definition more prominent.
