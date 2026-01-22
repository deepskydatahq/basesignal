# "What you'll define" Previews Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "What you'll define:" preview lists to empty state cards in FirstValueSection and JourneyMapSection, showing users what completing each section will create.

**Architecture:** Inline preview markup in each component's empty state. Use ✦ character for bullet points (aspirational vs checkmark = completed). Time estimate only on JourneyMapSection (interview-based).

**Tech Stack:** React, Tailwind CSS, Vitest + React Testing Library

---

## Task 1: Add preview list to FirstValueSection empty state

**Files:**
- Modify: `src/components/profile/FirstValueSection.tsx:155-171` (empty state block)
- Test: `src/components/profile/FirstValueSection.test.tsx`

### Step 1: Write the failing test

Add to `src/components/profile/FirstValueSection.test.tsx` in the "undefined state" describe block:

```typescript
test("shows 'What you'll define' preview list in empty state", () => {
  mockDefinition = null;
  setup();

  expect(screen.getByText("What you'll define:")).toBeInTheDocument();
  expect(screen.getByText(/Your product's key entities/)).toBeInTheDocument();
  expect(screen.getByText(/The moment a user becomes "activated"/)).toBeInTheDocument();
  expect(screen.getByText(/What makes a user "active"/)).toBeInTheDocument();
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- FirstValueSection.test.tsx`
Expected: FAIL with "Unable to find an element with the text: What you'll define:"

### Step 3: Write minimal implementation

Update the empty state block in `src/components/profile/FirstValueSection.tsx` (lines 155-171):

```tsx
if (!definition) {
  return (
    <ProfileSection
      title="First Value Moment"
      status={status}
      statusLabel={statusLabel}
      actionLabel={actionLabel}
      onAction={handleEditClick}
    >
      <div>
        <p className="font-medium text-gray-900">What moment turns a visitor into a believer?</p>
        <p className="text-gray-600 text-sm mt-1">
          Finding your first value reveals whether you're activating users fast enough.
        </p>
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700">What you'll define:</p>
          <ul className="mt-2 space-y-1">
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-primary mt-0.5">✦</span>
              <span>Your product's key entities (users, accounts, workspaces)</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-primary mt-0.5">✦</span>
              <span>The moment a user becomes "activated"</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-primary mt-0.5">✦</span>
              <span>What makes a user "active" in your product</span>
            </li>
          </ul>
        </div>
      </div>
    </ProfileSection>
  );
}
```

### Step 4: Run test to verify it passes

Run: `npm test -- FirstValueSection.test.tsx`
Expected: All tests PASS

### Step 5: Commit

```bash
git add src/components/profile/FirstValueSection.tsx src/components/profile/FirstValueSection.test.tsx
git commit -m "$(cat <<'EOF'
feat: add preview list to FirstValueSection empty state

Shows "What you'll define:" with ✦ bullets listing the outcomes:
- Key entities
- Activation moment
- Active user definition

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add preview list with time estimate to JourneyMapSection empty state

**Files:**
- Modify: `src/components/profile/JourneyMapSection.tsx:63-69` (empty state block)
- Test: `src/components/profile/JourneyMapSection.test.tsx`

### Step 1: Write the failing test

Add to `src/components/profile/JourneyMapSection.test.tsx`:

```typescript
test("shows 'What you'll define' preview list with time estimate in empty state", () => {
  setup({ journeyId: "j1" as Id<"journeys">, stages: [] });

  expect(screen.getByText("What you'll define:")).toBeInTheDocument();
  expect(screen.getByText(/How users discover your product/)).toBeInTheDocument();
  expect(screen.getByText(/Key actions in the trial experience/)).toBeInTheDocument();
  expect(screen.getByText(/Conversion and retention milestones/)).toBeInTheDocument();
  expect(screen.getByText("~5 min")).toBeInTheDocument();
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: FAIL with "Unable to find an element with the text: What you'll define:"

### Step 3: Write minimal implementation

Update the empty state block in `src/components/profile/JourneyMapSection.tsx` (lines 63-69):

```tsx
) : (
  <div>
    <p className="font-medium text-gray-900">See where users thrive—and where they vanish.</p>
    <p className="text-gray-600 text-sm mt-1">
      Mapping your journey reveals the critical transitions where growth happens or stalls.
    </p>
    <div className="mt-4 flex justify-between items-end">
      <div>
        <p className="text-sm font-medium text-gray-700">What you'll define:</p>
        <ul className="mt-2 space-y-1">
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-primary mt-0.5">✦</span>
            <span>How users discover your product</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-primary mt-0.5">✦</span>
            <span>Key actions in the trial experience</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-gray-600">
            <span className="text-primary mt-0.5">✦</span>
            <span>Conversion and retention milestones</span>
          </li>
        </ul>
      </div>
      <span className="text-sm text-gray-500">~5 min</span>
    </div>
  </div>
)}
```

### Step 4: Run test to verify it passes

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: All tests PASS

### Step 5: Commit

```bash
git add src/components/profile/JourneyMapSection.tsx src/components/profile/JourneyMapSection.test.tsx
git commit -m "$(cat <<'EOF'
feat: add preview list with time estimate to JourneyMapSection empty state

Shows "What you'll define:" with ✦ bullets listing the outcomes:
- Discovery channels
- Trial experience actions
- Conversion/retention milestones

Includes ~5 min time estimate since this section triggers an interview.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Run full test suite and verify

**Files:**
- None (verification only)

### Step 1: Run the full test suite

Run: `npm test`
Expected: All tests PASS

### Step 2: Commit if any additional fixes needed

If fixes were needed, commit them with appropriate message.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add preview list to FirstValueSection | FirstValueSection.tsx, FirstValueSection.test.tsx |
| 2 | Add preview list + time estimate to JourneyMapSection | JourneyMapSection.tsx, JourneyMapSection.test.tsx |
| 3 | Verify full test suite passes | - |

**Total: 3 tasks**
