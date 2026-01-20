# ProfileHeader Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the header component that displays product identity and completion progress at the top of the Profile page.

**Architecture:** ProfileHeader is a purely presentational component that receives `identity` and `completeness` props from ProfilePage. It displays product name/description, business model badges (B2B/B2C + revenue models), and a collapsed completeness indicator with progress bar. All logic is inline - no separate components or constants files.

**Tech Stack:** React, TypeScript, Tailwind CSS

---

## Task 1: Create ProfileHeader with Product Name Display

**Files:**
- Create: `src/components/profile/ProfileHeader.tsx`
- Create: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/profile/ProfileHeader.test.tsx
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfileHeader } from "./ProfileHeader";

function setup(props: Partial<Parameters<typeof ProfileHeader>[0]> = {}) {
  const defaultProps = {
    identity: {
      productName: "Test Product",
    },
    completeness: {
      completed: 0,
      total: 11,
    },
    ...props,
  };
  render(<ProfileHeader {...defaultProps} />);
}

test("renders product name", () => {
  setup({ identity: { productName: "My Awesome App" } });

  expect(
    screen.getByRole("heading", { name: "My Awesome App" })
  ).toBeInTheDocument();
});

test("shows fallback when product name is missing", () => {
  setup({ identity: {} });

  expect(
    screen.getByRole("heading", { name: "Your Product" })
  ).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfileHeader`
Expected: FAIL with "Cannot find module './ProfileHeader'"

**Step 3: Write minimal implementation**

```typescript
// src/components/profile/ProfileHeader.tsx
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
}

export function ProfileHeader({ identity, completeness }: ProfileHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {identity.productName || "Your Product"}
      </h1>
    </header>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ProfileHeader`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "feat(profile): add ProfileHeader with product name display"
```

---

## Task 2: Add Product Description Display

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing test**

Add to `ProfileHeader.test.tsx`:

```typescript
test("renders product description when provided", () => {
  setup({
    identity: {
      productName: "My App",
      productDescription: "A tool for measuring product metrics",
    },
  });

  expect(
    screen.getByText("A tool for measuring product metrics")
  ).toBeInTheDocument();
});

test("omits description when not provided", () => {
  setup({ identity: { productName: "My App" } });

  // Should only have the heading, no paragraph
  expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfileHeader`
Expected: FAIL - description text not found

**Step 3: Update implementation**

Update the return in `ProfileHeader.tsx`:

```typescript
return (
  <header className="mb-8">
    <h1 className="text-2xl font-bold text-gray-900">
      {identity.productName || "Your Product"}
    </h1>

    {identity.productDescription && (
      <p className="mt-1 text-gray-600">{identity.productDescription}</p>
    )}
  </header>
);
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ProfileHeader`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "feat(profile): add product description to ProfileHeader"
```

---

## Task 3: Add Business Type Badge

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing tests**

Add to `ProfileHeader.test.tsx`:

```typescript
test("shows B2B badge when hasMultiUserAccounts is true", () => {
  setup({ identity: { productName: "My App", hasMultiUserAccounts: true } });

  expect(screen.getByText("B2B")).toBeInTheDocument();
});

test("shows B2B badge when businessType is b2b", () => {
  setup({
    identity: {
      productName: "My App",
      hasMultiUserAccounts: false,
      businessType: "b2b",
    },
  });

  expect(screen.getByText("B2B")).toBeInTheDocument();
});

test("shows B2C badge when single-user and businessType is b2c", () => {
  setup({
    identity: {
      productName: "My App",
      hasMultiUserAccounts: false,
      businessType: "b2c",
    },
  });

  expect(screen.getByText("B2C")).toBeInTheDocument();
});

test("shows B2C badge when hasMultiUserAccounts is false and no businessType", () => {
  setup({
    identity: {
      productName: "My App",
      hasMultiUserAccounts: false,
    },
  });

  expect(screen.getByText("B2C")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfileHeader`
Expected: FAIL - "B2B"/"B2C" text not found

**Step 3: Update implementation**

Update `ProfileHeader.tsx`:

```typescript
export function ProfileHeader({ identity, completeness }: ProfileHeaderProps) {
  // Derive business type badge - B2B if multi-user OR explicit b2b
  const businessTypeBadge = identity.hasMultiUserAccounts
    ? "B2B"
    : identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {identity.productName || "Your Product"}
      </h1>

      {identity.productDescription && (
        <p className="mt-1 text-gray-600">{identity.productDescription}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        {/* Business model badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
            {businessTypeBadge}
          </span>
        </div>
      </div>
    </header>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ProfileHeader`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "feat(profile): add business type badge to ProfileHeader"
```

---

## Task 4: Add Revenue Model Badges

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing tests**

Add to `ProfileHeader.test.tsx`:

```typescript
test("renders revenue model badges with formatted labels", () => {
  setup({
    identity: {
      productName: "My App",
      revenueModels: ["seat_subscription", "transactions"],
    },
  });

  expect(screen.getByText("Seat Subscription")).toBeInTheDocument();
  expect(screen.getByText("Transactions")).toBeInTheDocument();
});

test("handles empty revenueModels array", () => {
  setup({
    identity: {
      productName: "My App",
      revenueModels: [],
    },
  });

  // Should still render without errors, just no revenue badges
  expect(
    screen.getByRole("heading", { name: "My App" })
  ).toBeInTheDocument();
});

test("handles unknown revenue model gracefully", () => {
  setup({
    identity: {
      productName: "My App",
      revenueModels: ["unknown_model"],
    },
  });

  // Falls back to displaying the raw value
  expect(screen.getByText("unknown_model")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfileHeader`
Expected: FAIL - "Seat Subscription" text not found

**Step 3: Update implementation**

Update `ProfileHeader.tsx` - add the label mapping and render revenue badges:

```typescript
const REVENUE_MODEL_LABELS: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier Subscription",
  seat_subscription: "Seat Subscription",
  volume_based: "Volume Based",
};

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
}

export function ProfileHeader({ identity, completeness }: ProfileHeaderProps) {
  // Derive business type badge - B2B if multi-user OR explicit b2b
  const businessTypeBadge = identity.hasMultiUserAccounts
    ? "B2B"
    : identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {identity.productName || "Your Product"}
      </h1>

      {identity.productDescription && (
        <p className="mt-1 text-gray-600">{identity.productDescription}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        {/* Business model badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
            {businessTypeBadge}
          </span>
          {identity.revenueModels?.map((model) => (
            <span
              key={model}
              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {REVENUE_MODEL_LABELS[model] ?? model}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ProfileHeader`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "feat(profile): add revenue model badges to ProfileHeader"
```

---

## Task 5: Add Completeness Indicator with Progress Bar

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing tests**

Add to `ProfileHeader.test.tsx`:

```typescript
test("shows correct count text", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 4, total: 11 },
  });

  expect(screen.getByText("4 of 11")).toBeInTheDocument();
});

test("shows progress bar with correct width for percentage", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 5, total: 10 },
  });

  // 5/10 = 50%
  const progressBar = screen.getByTestId("progress-bar-fill");
  expect(progressBar).toHaveStyle({ width: "50%" });
});

test("handles 0% completeness", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 0, total: 11 },
  });

  expect(screen.getByText("0 of 11")).toBeInTheDocument();
  const progressBar = screen.getByTestId("progress-bar-fill");
  expect(progressBar).toHaveStyle({ width: "0%" });
});

test("handles 100% completeness", () => {
  setup({
    identity: { productName: "My App" },
    completeness: { completed: 11, total: 11 },
  });

  expect(screen.getByText("11 of 11")).toBeInTheDocument();
  const progressBar = screen.getByTestId("progress-bar-fill");
  expect(progressBar).toHaveStyle({ width: "100%" });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- ProfileHeader`
Expected: FAIL - "4 of 11" text not found

**Step 3: Update implementation**

Update the return in `ProfileHeader.tsx` to add the completeness indicator:

```typescript
export function ProfileHeader({ identity, completeness }: ProfileHeaderProps) {
  // Derive business type badge - B2B if multi-user OR explicit b2b
  const businessTypeBadge = identity.hasMultiUserAccounts
    ? "B2B"
    : identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  const percentage = Math.round(
    (completeness.completed / completeness.total) * 100
  );

  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {identity.productName || "Your Product"}
      </h1>

      {identity.productDescription && (
        <p className="mt-1 text-gray-600">{identity.productDescription}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        {/* Business model badges */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
            {businessTypeBadge}
          </span>
          {identity.revenueModels?.map((model) => (
            <span
              key={model}
              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {REVENUE_MODEL_LABELS[model] ?? model}
            </span>
          ))}
        </div>

        {/* Collapsed completeness indicator */}
        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              data-testid="progress-bar-fill"
              className="h-full bg-black rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completeness.completed} of {completeness.total}
          </span>
        </div>
      </div>
    </header>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- ProfileHeader`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "feat(profile): add completeness indicator to ProfileHeader"
```

---

## Task 6: Final Verification and Cleanup

**Files:**
- Review: `src/components/profile/ProfileHeader.tsx`
- Review: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

**Step 3: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore(profile): cleanup ProfileHeader implementation"
```

---

## Final Component Reference

The complete `ProfileHeader.tsx` should look like:

```typescript
const REVENUE_MODEL_LABELS: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier Subscription",
  seat_subscription: "Seat Subscription",
  volume_based: "Volume Based",
};

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
}

export function ProfileHeader({ identity, completeness }: ProfileHeaderProps) {
  const businessTypeBadge = identity.hasMultiUserAccounts
    ? "B2B"
    : identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  const percentage = Math.round(
    (completeness.completed / completeness.total) * 100
  );

  return (
    <header className="mb-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {identity.productName || "Your Product"}
      </h1>

      {identity.productDescription && (
        <p className="mt-1 text-gray-600">{identity.productDescription}</p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-0.5 text-xs font-medium text-white">
            {businessTypeBadge}
          </span>
          {identity.revenueModels?.map((model) => (
            <span
              key={model}
              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
            >
              {REVENUE_MODEL_LABELS[model] ?? model}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              data-testid="progress-bar-fill"
              className="h-full bg-black rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-sm text-gray-600">
            {completeness.completed} of {completeness.total}
          </span>
        </div>
      </div>
    </header>
  );
}
```

## Test Coverage Summary

| Feature | Tests |
|---------|-------|
| Product name | renders, fallback when missing |
| Description | renders when provided, omits when not |
| Business type badge | B2B (multi-user), B2B (explicit), B2C (default) |
| Revenue model badges | formatted labels, empty array, unknown model fallback |
| Completeness indicator | count text, progress bar width, 0%, 100% |
