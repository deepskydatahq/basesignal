# ProfileHeader Wiring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace inline header code in ProfilePage with the ProfileHeader component, wiring real profile data.

**Architecture:** Straightforward component wiring. The ProfileHeader component already accepts `identity` and `completeness` props that match the shape returned by `api.profile.getProfileData`. No transformation layer needed.

**Tech Stack:** React, Convex, Vitest, React Testing Library

---

## Current State

- `ProfilePage.tsx` (lines 39-47) has inline header showing product name and completeness count
- `ProfileHeader.tsx` is a full-featured component with B2B/B2C badges, revenue model tags, and progress bar
- Profile API already returns all fields ProfileHeader needs
- ProfilePage tests assert `"4/11"` format but ProfileHeader uses `"4 of 11"` format

## Tasks

### Task 1: Update ProfilePage test for new completeness format

**Files:**
- Modify: `src/components/profile/ProfilePage.test.tsx:83-99`

**Step 1: Write the updated test**

Update the "displays completeness indicator" test to expect the new format from ProfileHeader:

```typescript
test("displays completeness indicator", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 4,
      total: 11,
      percentage: 36,
    },
  });

  expect(screen.getByText("4 of 11")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: FAIL - "4/11" is found instead of "4 of 11"

---

### Task 2: Replace inline header with ProfileHeader component

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx:1-10,37-47`

**Step 1: Add ProfileHeader import**

Add to imports at the top of the file:

```typescript
import { ProfileHeader } from "./ProfileHeader";
```

**Step 2: Replace inline header with ProfileHeader**

Replace lines 39-47:

```tsx
      {/* Header with completeness */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {profileData.identity.productName || "Your Product"}
        </h1>
        <div className="mt-2 text-sm text-gray-500">
          {profileData.completeness.completed}/{profileData.completeness.total}
        </div>
      </div>
```

With:

```tsx
      <ProfileHeader
        identity={profileData.identity}
        completeness={profileData.completeness}
      />
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: PASS - all tests should pass including the updated completeness format test

---

### Task 3: Remove section placeholder test assertions

The test "renders section placeholders" (lines 101-121) asserts child component presence. These components have their own tests. Remove these assertions since ProfilePage's responsibility is wiring, not verifying child rendering.

**Files:**
- Modify: `src/components/profile/ProfilePage.test.tsx:101-121`

**Step 1: Remove the test**

Delete the entire "renders section placeholders" test block (lines 101-121).

**Step 2: Run tests to verify**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: PASS - 4 tests (loading, redirect, product name, default name, completeness)

---

### Task 4: Run full test suite

**Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

**Step 2: Commit changes**

```bash
git add src/components/profile/ProfilePage.tsx src/components/profile/ProfilePage.test.tsx
git commit -m "feat: wire ProfileHeader component to ProfilePage

- Replace inline header with ProfileHeader component
- Update completeness format test (4/11 → 4 of 11)
- Remove redundant section placeholder assertions

Closes #69"
```

---

## Verification Checklist

- [ ] ProfilePage uses ProfileHeader component (not inline header)
- [ ] All ProfileHeader features receive real data (name, badges, progress)
- [ ] No duplicate header code in ProfilePage
- [ ] ProfilePage tests pass with updated format
- [ ] Full test suite passes
