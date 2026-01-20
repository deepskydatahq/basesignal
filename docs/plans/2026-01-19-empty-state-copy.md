# Empty State Copy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update all 5 profile section empty states with discovery-oriented copy (hook + insight)

**Architecture:** Replace task-oriented empty state copy with two-line structure: bold hook (creates curiosity) + regular insight (explains why it matters). Styling uses `font-medium text-gray-900` for hook and `text-gray-600 text-sm mt-1` for insight.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library

---

## Copy Reference

| Section | Hook | Insight |
|---------|------|---------|
| Core Identity | Your product's P&L starts here. | How you monetize and who you serve determines which metrics matter most. |
| First Value | What moment turns a visitor into a believer? | Finding your first value reveals whether you're activating users fast enough. |
| Journey Map | See where users thrive—and where they vanish. | Mapping your journey reveals the critical transitions where growth happens or stalls. |
| Metric Catalog | Your product's vital signs, waiting to be measured. | Discover which numbers actually matter for your business. |
| Measurement Plan | The blueprint for understanding user behavior. | Entities and activities reveal what users do and how they move through your product. |

---

## Task 1: Update CoreIdentitySection Empty State

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx:326-331`
- Test: `src/components/profile/CoreIdentitySection.test.tsx:65-69`

**Step 1: Update test to expect new copy**

In `src/components/profile/CoreIdentitySection.test.tsx`, update test at line 65:

```typescript
test("renders empty state when no data provided", () => {
  setup({});

  expect(screen.getByText("Your product's P&L starts here.")).toBeInTheDocument();
  expect(
    screen.getByText("How you monetize and who you serve determines which metrics matter most.")
  ).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- CoreIdentitySection.test.tsx`
Expected: FAIL - "No profile information yet" found instead of new copy

**Step 3: Update component with new empty state**

In `src/components/profile/CoreIdentitySection.tsx`, replace lines 326-331:

```typescript
        {!data.productName &&
          !data.websiteUrl &&
          !businessLine &&
          !revenueLine && (
            <div>
              <p className="font-medium text-gray-900">Your product's P&L starts here.</p>
              <p className="text-gray-600 text-sm mt-1">
                How you monetize and who you serve determines which metrics matter most.
              </p>
            </div>
          )}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- CoreIdentitySection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx src/components/profile/CoreIdentitySection.test.tsx
git commit -m "feat: update CoreIdentitySection empty state copy

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Update FirstValueSection Empty State

**Files:**
- Modify: `src/components/profile/FirstValueSection.tsx:164-166`
- Test: `src/components/profile/FirstValueSection.test.tsx:27-39`

**Step 1: Update test to expect new copy**

In `src/components/profile/FirstValueSection.test.tsx`, update the "undefined state" test (around line 29):

```typescript
  describe("undefined state", () => {
    test("shows Not Started badge and Define button", () => {
      mockDefinition = null;
      setup();

      expect(screen.getByText("First Value Moment")).toBeInTheDocument();
      expect(screen.getByText("Not Started")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /define/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText("What moment turns a visitor into a believer?")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Finding your first value reveals whether you're activating users fast enough.")
      ).toBeInTheDocument();
    });
  });
```

**Step 2: Run test to verify it fails**

Run: `npm test -- FirstValueSection.test.tsx`
Expected: FAIL - old copy found instead of new copy

**Step 3: Update component with new empty state**

In `src/components/profile/FirstValueSection.tsx`, replace lines 163-167:

```typescript
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
        </div>
      </ProfileSection>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- FirstValueSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/FirstValueSection.tsx src/components/profile/FirstValueSection.test.tsx
git commit -m "feat: update FirstValueSection empty state copy

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Update JourneyMapSection Empty State

**Files:**
- Modify: `src/components/profile/JourneyMapSection.tsx:62-64`
- Test: `src/components/profile/JourneyMapSection.test.tsx`

**Step 1: Add test for empty state copy**

In `src/components/profile/JourneyMapSection.test.tsx`, add a new test after line 70:

```typescript
test("renders discovery-oriented empty state copy when no stages", () => {
  setup({ journeyId: "j1" as Id<"journeys">, stages: [] });

  expect(
    screen.getByText("See where users thrive—and where they vanish.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Mapping your journey reveals the critical transitions where growth happens or stalls.")
  ).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: FAIL - old copy found instead of new copy

**Step 3: Update component with new empty state**

In `src/components/profile/JourneyMapSection.tsx`, replace lines 61-65:

```typescript
      ) : (
        <div>
          <p className="font-medium text-gray-900">See where users thrive—and where they vanish.</p>
          <p className="text-gray-600 text-sm mt-1">
            Mapping your journey reveals the critical transitions where growth happens or stalls.
          </p>
        </div>
      )}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- JourneyMapSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/JourneyMapSection.tsx src/components/profile/JourneyMapSection.test.tsx
git commit -m "feat: update JourneyMapSection empty state copy

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Update MetricCatalogSection Empty State

**Files:**
- Modify: `src/components/profile/MetricCatalogSection.tsx:72-76`
- Test: `src/components/profile/MetricCatalogSection.test.tsx:37-45`

**Step 1: Update test to expect new copy**

In `src/components/profile/MetricCatalogSection.test.tsx`, update the empty state test at line 37:

```typescript
test("renders empty state when no metrics provided", () => {
  setup([]);

  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
  expect(screen.getByText("0 metrics")).toBeInTheDocument();
  expect(
    screen.getByText("Your product's vital signs, waiting to be measured.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Discover which numbers actually matter for your business.")
  ).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- MetricCatalogSection.test.tsx`
Expected: FAIL - old copy found instead of new copy

**Step 3: Update component with new empty state**

In `src/components/profile/MetricCatalogSection.tsx`, replace lines 72-77:

```typescript
      ) : (
        <div>
          <p className="font-medium text-gray-900">Your product's vital signs, waiting to be measured.</p>
          <p className="text-gray-600 text-sm mt-1">
            Discover which numbers actually matter for your business.
          </p>
        </div>
      )}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- MetricCatalogSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/MetricCatalogSection.tsx src/components/profile/MetricCatalogSection.test.tsx
git commit -m "feat: update MetricCatalogSection empty state copy

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update MeasurementPlanSection Empty State

**Files:**
- Modify: `src/components/profile/MeasurementPlanSection.tsx:79-84`
- Test: `src/components/profile/MeasurementPlanSection.test.tsx:40-48`

**Step 1: Update test to expect new copy**

In `src/components/profile/MeasurementPlanSection.test.tsx`, update the empty state test at line 40:

```typescript
test("renders empty state when no plan provided", () => {
  setup([]);

  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("Not started")).toBeInTheDocument();
  expect(
    screen.getByText("The blueprint for understanding user behavior.")
  ).toBeInTheDocument();
  expect(
    screen.getByText("Entities and activities reveal what users do and how they move through your product.")
  ).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- MeasurementPlanSection.test.tsx`
Expected: FAIL - old copy found instead of new copy

**Step 3: Update component with new empty state**

In `src/components/profile/MeasurementPlanSection.tsx`, replace lines 79-84:

```typescript
      ) : (
        <div>
          <p className="font-medium text-gray-900">The blueprint for understanding user behavior.</p>
          <p className="text-gray-600 text-sm mt-1">
            Entities and activities reveal what users do and how they move through your product.
          </p>
        </div>
      )}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- MeasurementPlanSection.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/MeasurementPlanSection.tsx src/components/profile/MeasurementPlanSection.test.tsx
git commit -m "feat: update MeasurementPlanSection empty state copy

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Final Verification

**Step 1: Run all profile section tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Build to verify TypeScript**

Run: `npm run build`
Expected: Build succeeds with no type errors

**Step 3: Visual verification (manual)**

Start dev server and navigate to profile page to visually verify each section's empty state displays correctly.

---

## Summary

- **5 tasks** update empty state copy (one per section)
- **1 task** for final verification
- Each task follows TDD: update test → verify fail → update component → verify pass → commit
- Consistent styling across all sections: `font-medium text-gray-900` for hook, `text-gray-600 text-sm mt-1` for insight
