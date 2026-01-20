# Profile Header Stats Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the "X of Y" completeness text in ProfileHeader with a stats bar showing key measurement counts: Metrics, Entities, and Activities.

**Architecture:** Add new `stats` prop to ProfileHeader containing counts from metricCatalog and measurementPlan. Replace the current "X of Y" text display with formatted stat labels. Keep progress bar unchanged.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## Task 1: Add stats prop type and render stats bar in ProfileHeader

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx:8-20` (props interface)
- Modify: `src/components/profile/ProfileHeader.tsx:72-74` (replace count text)
- Test: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing test for stats display**

Add this test to `src/components/profile/ProfileHeader.test.tsx`:

```typescript
test("renders stats bar with metrics, entities, and activities counts", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 4, total: 11 },
    stats: {
      metricsCount: 5,
      entitiesCount: 3,
      activitiesCount: 12,
    },
  });

  expect(screen.getByText("5 Metrics")).toBeInTheDocument();
  expect(screen.getByText("3 Entities")).toBeInTheDocument();
  expect(screen.getByText("12 Activities")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: FAIL - stats prop not recognized

**Step 3: Update ProfileHeader props interface**

In `src/components/profile/ProfileHeader.tsx`, update the interface:

```typescript
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
  };
  stats?: {
    metricsCount: number;
    entitiesCount: number;
    activitiesCount: number;
  };
}
```

**Step 4: Replace the "X of Y" text with stats display**

Replace lines 72-74 in `src/components/profile/ProfileHeader.tsx`:

```typescript
{/* Stats bar */}
{stats ? (
  <span className="text-sm text-gray-600">
    {stats.metricsCount} Metrics · {stats.entitiesCount} Entities · {stats.activitiesCount} Activities
  </span>
) : (
  <span className="text-sm text-gray-600">
    {completeness.completed} of {completeness.total}
  </span>
)}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: PASS

**Step 6: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "feat(ProfileHeader): add stats bar with metrics, entities, activities counts"
```

---

## Task 2: Add tests for singular forms and zero counts

**Files:**
- Test: `src/components/profile/ProfileHeader.test.tsx`
- Modify: `src/components/profile/ProfileHeader.tsx:72-78`

**Step 1: Write failing tests for singular forms**

Add these tests to `src/components/profile/ProfileHeader.test.tsx`:

```typescript
test("renders singular form for count of 1", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 1, total: 11 },
    stats: {
      metricsCount: 1,
      entitiesCount: 1,
      activitiesCount: 1,
    },
  });

  expect(screen.getByText("1 Metric")).toBeInTheDocument();
  expect(screen.getByText("1 Entity")).toBeInTheDocument();
  expect(screen.getByText("1 Activity")).toBeInTheDocument();
});

test("renders zero counts correctly", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 0, total: 11 },
    stats: {
      metricsCount: 0,
      entitiesCount: 0,
      activitiesCount: 0,
    },
  });

  expect(screen.getByText("0 Metrics")).toBeInTheDocument();
  expect(screen.getByText("0 Entities")).toBeInTheDocument();
  expect(screen.getByText("0 Activities")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: FAIL - singular forms not implemented

**Step 3: Add pluralization helper and update stats display**

Update `src/components/profile/ProfileHeader.tsx`:

```typescript
function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? `${count} ${singular}` : `${count} ${plural}`;
}
```

Then update the stats span:

```typescript
{stats ? (
  <span className="text-sm text-gray-600">
    {pluralize(stats.metricsCount, "Metric", "Metrics")} · {pluralize(stats.entitiesCount, "Entity", "Entities")} · {pluralize(stats.activitiesCount, "Activity", "Activities")}
  </span>
) : (
  <span className="text-sm text-gray-600">
    {completeness.completed} of {completeness.total}
  </span>
)}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "feat(ProfileHeader): add pluralization for stats labels"
```

---

## Task 3: Add test for fallback when stats not provided

**Files:**
- Test: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write test confirming fallback behavior**

Add this test to `src/components/profile/ProfileHeader.test.tsx`:

```typescript
test("falls back to completeness display when stats not provided", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 4, total: 11 },
    // No stats prop
  });

  expect(screen.getByText("4 of 11")).toBeInTheDocument();
  expect(screen.queryByText(/Metrics/)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- ProfileHeader.test.tsx`
Expected: PASS (already implemented in Task 1)

**Step 3: Commit**

```bash
git add src/components/profile/ProfileHeader.test.tsx
git commit -m "test(ProfileHeader): add test for stats fallback behavior"
```

---

## Task 4: Wire stats prop in ProfilePage

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx:40-47`
- Test: `src/components/profile/ProfilePage.test.tsx`

**Step 1: Write failing test for ProfilePage passing stats**

Add this test to `src/components/profile/ProfilePage.test.tsx`:

```typescript
test("displays stats bar with counts from profile data", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 8 },
    measurementPlan: { entities: [{}, {}, {}], activityCount: 15, propertyCount: 5 },
    completeness: {
      sections: [],
      completed: 3,
      total: 11,
      percentage: 27,
    },
  });

  expect(screen.getByText("8 Metrics")).toBeInTheDocument();
  expect(screen.getByText("3 Entities")).toBeInTheDocument();
  expect(screen.getByText("15 Activities")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfilePage.test.tsx`
Expected: FAIL - ProfilePage not passing stats to header

**Step 3: Import ProfileHeader and pass stats in ProfilePage**

Update `src/components/profile/ProfilePage.tsx`:

Add import at top:
```typescript
import { ProfileHeader } from "./ProfileHeader";
```

Replace the header div (lines 40-47) with:

```typescript
{/* Header with stats */}
<ProfileHeader
  identity={profileData.identity}
  completeness={profileData.completeness}
  stats={{
    metricsCount: profileData.metricCatalog.totalCount,
    entitiesCount: profileData.measurementPlan.entities.length,
    activitiesCount: profileData.measurementPlan.activityCount,
  }}
/>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ProfilePage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfilePage.tsx src/components/profile/ProfilePage.test.tsx
git commit -m "feat(ProfilePage): wire stats bar to ProfileHeader"
```

---

## Task 5: Run full test suite and verify build

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit any fixes if needed**

If any issues found, fix and commit with appropriate message.

---

## Summary

5 tasks total:
1. Add stats prop and basic stats bar display
2. Add pluralization for singular/plural forms
3. Test fallback behavior when stats not provided
4. Wire ProfilePage to pass stats to ProfileHeader
5. Verify full test suite and build
