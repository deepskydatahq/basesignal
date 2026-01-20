# CoreIdentitySection Revenue Tags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display revenue models as styled visual tag chips instead of plain comma-separated text.

**Architecture:** Add inline color mapping for revenue models in CoreIdentitySection. Replace the `<p>` text element with a flex-wrap container of styled `<span>` badges. Follow existing CategoryBadge pattern (color-100/color-700 Tailwind classes) without creating a separate component.

**Tech Stack:** React, Tailwind CSS

---

## Task 1: Add failing test for revenue model badges

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Write the failing test**

Add a new test that expects revenue models to render as individual badge elements rather than comma-separated text:

```typescript
test("renders revenue models as styled badges", () => {
  setup({ revenueModels: ["transactions", "tier_subscription"] });

  // Each revenue model should be a separate badge element
  const transactionsBadge = screen.getByText("Transactions");
  const tierBadge = screen.getByText("Tier subscription");

  // Badges should have badge styling classes
  expect(transactionsBadge).toHaveClass("rounded-full");
  expect(tierBadge).toHaveClass("rounded-full");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run CoreIdentitySection`

Expected: FAIL - "Transactions" won't have `rounded-full` class (currently rendered as plain text).

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.test.tsx
git commit -m "test: add failing test for revenue model badges"
```

---

## Task 2: Add revenue model color mapping

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx:23-28`

**Step 1: Add color mapping constant after revenueModelDisplayLabels**

Add this after line 28 (after `revenueModelDisplayLabels`):

```typescript
const revenueModelColors: Record<string, string> = {
  transactions: "bg-amber-100 text-amber-700",
  tier_subscription: "bg-indigo-100 text-indigo-700",
  seat_subscription: "bg-teal-100 text-teal-700",
  volume_based: "bg-rose-100 text-rose-700",
};
```

**Step 2: Run tests to verify nothing broke**

Run: `npm test -- --run CoreIdentitySection`

Expected: Same test failure as before (no behavior change yet).

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx
git commit -m "feat: add revenue model color mapping"
```

---

## Task 3: Replace text rendering with badge rendering

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx:319-324`

**Step 1: Replace the revenue models display**

Change lines 319-324 from:

```tsx
{revenueLine && (
  <div>
    <span className="text-sm text-gray-500">Revenue Models</span>
    <p className="text-gray-900">{revenueLine}</p>
  </div>
)}
```

To:

```tsx
{data.revenueModels && data.revenueModels.length > 0 && (
  <div>
    <span className="text-sm text-gray-500">Revenue Models</span>
    <div className="flex flex-wrap gap-1.5 mt-1">
      {data.revenueModels.map((model) => (
        <span
          key={model}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            revenueModelColors[model] || "bg-gray-100 text-gray-700"
          }`}
        >
          {revenueModelDisplayLabels[model] || model}
        </span>
      ))}
    </div>
  </div>
)}
```

**Step 2: Run tests to verify badge test passes**

Run: `npm test -- --run CoreIdentitySection`

Expected: All tests pass including new badge test.

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx
git commit -m "feat: render revenue models as styled badges"
```

---

## Task 4: Update existing test for new rendering

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.test.tsx:59-63`

**Step 1: Update the comma-separated test**

The test "renders revenue models as comma-separated list" on lines 59-63 will now fail because we render badges instead. Update it:

Change from:

```typescript
test("renders revenue models as comma-separated list", () => {
  setup({ revenueModels: ["seat_subscription", "volume_based"] });

  expect(screen.getByText("Seat-based, Usage-based")).toBeInTheDocument();
});
```

To:

```typescript
test("renders multiple revenue models as separate badges", () => {
  setup({ revenueModels: ["seat_subscription", "volume_based"] });

  // Each model renders as a separate badge, not comma-separated
  expect(screen.getByText("Seat-based")).toBeInTheDocument();
  expect(screen.getByText("Usage-based")).toBeInTheDocument();
});
```

**Step 2: Run all tests**

Run: `npm test -- --run CoreIdentitySection`

Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.test.tsx
git commit -m "test: update revenue models test for badge rendering"
```

---

## Task 5: Clean up unused formatRevenueModels function

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx`

**Step 1: Remove unused function and variable**

Remove the `formatRevenueModels` function (lines 72-77):

```typescript
function formatRevenueModels(revenueModels?: string[]): string | null {
  if (!revenueModels || revenueModels.length === 0) return null;
  return revenueModels
    .map((model) => revenueModelDisplayLabels[model] || model)
    .join(", ");
}
```

Also remove line 140:
```typescript
const revenueLine = formatRevenueModels(data.revenueModels);
```

And update line 329 to check `data.revenueModels` instead of `revenueLine`:

Change from:
```typescript
{!data.productName &&
  !data.websiteUrl &&
  !businessLine &&
  !revenueLine && (
```

To:
```typescript
{!data.productName &&
  !data.websiteUrl &&
  !businessLine &&
  (!data.revenueModels || data.revenueModels.length === 0) && (
```

**Step 2: Run all tests**

Run: `npm test -- --run CoreIdentitySection`

Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx
git commit -m "refactor: remove unused formatRevenueModels function"
```

---

## Task 6: Final verification

**Step 1: Run full test suite**

Run: `npm test -- --run`

Expected: All tests pass.

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

Expected: No type errors.

**Step 3: Run linter**

Run: `npm run lint`

Expected: No lint errors.

**Step 4: Final commit if any fixes needed**

If any fixes were required, commit them.
