# CoreIdentitySection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a component that displays core product identity (product name, website, business model, revenue models) with inline edit capability, wrapped in ProfileSection for consistent styling.

**Architecture:** Single component following ProductProfileCard pattern - co-located display/edit logic, useState for edit mode toggle, editValues state object for form inputs, api.users.updateOnboarding mutation for saving. Data passed as props from parent. ProfileSection wrapper provides consistent status badge.

**Tech Stack:** React, Convex (useMutation), Tailwind CSS, lucide-react icons, shadcn/ui components (Input, Label, Checkbox, Button)

**Dependency:** Requires `ProfileSection` component from issue #38. If not yet implemented, run that plan first.

---

## Task 1: Create CoreIdentitySection Display Mode

**Files:**
- Create: `src/components/profile/CoreIdentitySection.tsx`
- Create: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Write the failing test for display mode**

```typescript
// src/components/profile/CoreIdentitySection.test.tsx

import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoreIdentitySection } from "./CoreIdentitySection";

// Mock Convex
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
}));

interface CoreIdentityData {
  productName?: string;
  websiteUrl?: string;
  hasMultiUserAccounts?: boolean;
  businessType?: string;
  revenueModels?: string[];
}

function setup(data: CoreIdentityData = {}) {
  const user = userEvent.setup();
  render(<CoreIdentitySection data={data} />);
  return { user };
}

test("renders product name when provided", () => {
  setup({ productName: "Acme App" });

  expect(screen.getByText("Acme App")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: FAIL with "Cannot find module"

**Step 3: Create the component with display mode**

```typescript
// src/components/profile/CoreIdentitySection.tsx

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Pencil, Check, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ProfileSection } from "./ProfileSection";

export interface CoreIdentityData {
  productName?: string;
  websiteUrl?: string;
  hasMultiUserAccounts?: boolean;
  businessType?: string;
  revenueModels?: string[];
}

interface CoreIdentitySectionProps {
  data: CoreIdentityData;
}

const revenueModelDisplayLabels: Record<string, string> = {
  transactions: "Transactions",
  tier_subscription: "Tier subscription",
  seat_subscription: "Seat-based",
  volume_based: "Usage-based",
};

function formatBusinessLine(
  hasMultiUserAccounts?: boolean,
  businessType?: string
): string | null {
  if (hasMultiUserAccounts === undefined) return null;

  if (hasMultiUserAccounts) {
    return "B2B · Multi-user accounts";
  } else if (businessType === "b2c") {
    return "B2C · Single-user accounts";
  } else if (businessType === "b2b") {
    return "B2B · Single-user accounts";
  }
  return null;
}

function formatRevenueModels(revenueModels?: string[]): string | null {
  if (!revenueModels || revenueModels.length === 0) return null;
  return revenueModels
    .map((model) => revenueModelDisplayLabels[model] || model)
    .join(", ");
}

export function CoreIdentitySection({ data }: CoreIdentitySectionProps) {
  const [isEditing, setIsEditing] = useState(false);

  const isComplete = Boolean(data.productName);
  const businessLine = formatBusinessLine(data.hasMultiUserAccounts, data.businessType);
  const revenueLine = formatRevenueModels(data.revenueModels);

  return (
    <ProfileSection
      title="Core Identity"
      status={isComplete ? "complete" : "not_started"}
      statusLabel={isComplete ? "Complete" : "Not Started"}
      actionLabel="Edit"
      onAction={() => setIsEditing(true)}
    >
      <div className="space-y-3">
        {data.productName && (
          <div>
            <span className="text-sm text-gray-500">Product</span>
            <p className="text-gray-900 font-medium">{data.productName}</p>
          </div>
        )}

        {data.websiteUrl && (
          <div>
            <span className="text-sm text-gray-500">Website</span>
            <p>
              <a
                href={data.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                {data.websiteUrl}
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        )}

        {businessLine && (
          <div>
            <span className="text-sm text-gray-500">Business Model</span>
            <p className="text-gray-900">{businessLine}</p>
          </div>
        )}

        {revenueLine && (
          <div>
            <span className="text-sm text-gray-500">Revenue Models</span>
            <p className="text-gray-900">{revenueLine}</p>
          </div>
        )}

        {!data.productName && !data.websiteUrl && !businessLine && !revenueLine && (
          <p className="text-gray-400 italic">No profile information yet</p>
        )}
      </div>
    </ProfileSection>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx src/components/profile/CoreIdentitySection.test.tsx
git commit -m "feat: add CoreIdentitySection display mode

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add Tests for Display Mode Data Fields

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Add tests for each display field**

Add these tests to the test file:

```typescript
test("renders website as clickable link", () => {
  setup({ websiteUrl: "https://acme.com" });

  const link = screen.getByRole("link", { name: /acme\.com/i });
  expect(link).toHaveAttribute("href", "https://acme.com");
  expect(link).toHaveAttribute("target", "_blank");
});

test("renders business model for multi-user B2B", () => {
  setup({ hasMultiUserAccounts: true });

  expect(screen.getByText("B2B · Multi-user accounts")).toBeInTheDocument();
});

test("renders business model for single-user B2C", () => {
  setup({ hasMultiUserAccounts: false, businessType: "b2c" });

  expect(screen.getByText("B2C · Single-user accounts")).toBeInTheDocument();
});

test("renders business model for single-user B2B", () => {
  setup({ hasMultiUserAccounts: false, businessType: "b2b" });

  expect(screen.getByText("B2B · Single-user accounts")).toBeInTheDocument();
});

test("renders revenue models as comma-separated list", () => {
  setup({ revenueModels: ["seat_subscription", "volume_based"] });

  expect(screen.getByText("Seat-based, Usage-based")).toBeInTheDocument();
});

test("renders empty state when no data provided", () => {
  setup({});

  expect(screen.getByText("No profile information yet")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.test.tsx
git commit -m "test: add CoreIdentitySection display mode tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Add Test for Complete/Incomplete Status

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Add tests for status badge**

```typescript
test("shows Complete status when productName is set", () => {
  setup({ productName: "Acme App" });

  expect(screen.getByText("Complete")).toBeInTheDocument();
});

test("shows Not Started status when productName is not set", () => {
  setup({});

  expect(screen.getByText("Not Started")).toBeInTheDocument();
});
```

**Step 2: Run tests to verify they pass**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.test.tsx
git commit -m "test: add CoreIdentitySection status badge tests

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add Edit Mode Toggle Test and Implementation

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx`
- Modify: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Write the failing test for edit mode toggle**

```typescript
test("shows edit form when Edit button is clicked", async () => {
  const { user } = setup({ productName: "Acme App" });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(screen.getByLabelText(/product name/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: FAIL - edit form not rendered

**Step 3: Add edit mode state and form rendering**

Update the component to add edit mode form. In `CoreIdentitySection.tsx`, add the edit form logic after the existing code:

```typescript
// Add editValues state after isEditing
const [editValues, setEditValues] = useState({
  productName: data.productName ?? "",
  websiteUrl: data.websiteUrl ?? "",
  hasMultiUserAccounts: data.hasMultiUserAccounts ?? null,
  businessType: data.businessType ?? undefined,
  revenueModels: data.revenueModels ?? [],
});

// Add before the return statement
if (isEditing) {
  return (
    <ProfileSection
      title="Core Identity"
      status={isComplete ? "complete" : "not_started"}
      statusLabel={isComplete ? "Complete" : "Not Started"}
    >
      <div className="space-y-5">
        {/* Product Name */}
        <div className="space-y-2">
          <Label htmlFor="productName">Product Name</Label>
          <Input
            id="productName"
            placeholder="e.g., Acme App"
            value={editValues.productName}
            onChange={(e) =>
              setEditValues({ ...editValues, productName: e.target.value })
            }
          />
        </div>

        {/* Website URL */}
        <div className="space-y-2">
          <Label htmlFor="websiteUrl">Website URL</Label>
          <Input
            id="websiteUrl"
            placeholder="https://example.com"
            value={editValues.websiteUrl}
            onChange={(e) =>
              setEditValues({ ...editValues, websiteUrl: e.target.value })
            }
          />
        </div>

        {/* Actions placeholder - will be added in next task */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    </ProfileSection>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx src/components/profile/CoreIdentitySection.test.tsx
git commit -m "feat: add CoreIdentitySection edit mode toggle

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Add Multi-User and Business Type Fields

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx`
- Modify: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Write the failing test**

```typescript
test("edit form shows multi-user account options", async () => {
  const { user } = setup({ productName: "Acme" });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(screen.getByText("Can an account have multiple users?")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: FAIL

**Step 3: Add multi-user and business type fields to edit form**

Add these constants at the top of the file (after imports):

```typescript
const multiUserOptions = [
  { label: "No", value: false },
  { label: "Yes", value: true },
];

const businessTypeOptions = [
  { label: "B2C", value: "b2c" },
  { label: "B2B", value: "b2b" },
];
```

Add these fields to the edit form (after Website URL field):

```typescript
{/* Multi-user accounts */}
<div className="space-y-2">
  <Label>Can an account have multiple users?</Label>
  <div className="flex flex-wrap gap-2">
    {multiUserOptions.map((option) => (
      <button
        key={String(option.value)}
        type="button"
        onClick={() => {
          setEditValues((prev) => ({
            ...prev,
            hasMultiUserAccounts: option.value,
            businessType:
              option.value === true ? undefined : prev.businessType,
          }));
        }}
        className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
          editValues.hasMultiUserAccounts === option.value
            ? "bg-black text-white border-black"
            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
</div>

{/* B2C/B2B (conditional) */}
<div
  className={`space-y-2 overflow-hidden transition-all duration-300 ease-in-out ${
    editValues.hasMultiUserAccounts === false
      ? "max-h-24 opacity-100"
      : "max-h-0 opacity-0"
  }`}
>
  <Label>B2C or B2B?</Label>
  <div className="flex flex-wrap gap-2">
    {businessTypeOptions.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() =>
          setEditValues({ ...editValues, businessType: option.value })
        }
        className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
          editValues.businessType === option.value
            ? "bg-black text-white border-black"
            : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
</div>
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx src/components/profile/CoreIdentitySection.test.tsx
git commit -m "feat: add multi-user and business type fields to edit form

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Revenue Models Field

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx`
- Modify: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Write the failing test**

```typescript
test("edit form shows revenue model checkboxes", async () => {
  const { user } = setup({ productName: "Acme" });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(screen.getByLabelText("One-time transactions")).toBeInTheDocument();
  expect(screen.getByLabelText("Tier subscription")).toBeInTheDocument();
  expect(screen.getByLabelText("Seat-based subscription")).toBeInTheDocument();
  expect(screen.getByLabelText("Usage/credit-based")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: FAIL

**Step 3: Add revenue models field**

Add this constant at the top of the file:

```typescript
const revenueModelOptions = [
  { label: "One-time transactions", value: "transactions" },
  { label: "Tier subscription", value: "tier_subscription" },
  { label: "Seat-based subscription", value: "seat_subscription" },
  { label: "Usage/credit-based", value: "volume_based" },
];
```

Add this helper function:

```typescript
function toggleRevenueModel(
  currentModels: string[],
  value: string
): string[] {
  return currentModels.includes(value)
    ? currentModels.filter((v) => v !== value)
    : [...currentModels, value];
}
```

Add the revenue models field to the edit form (after B2C/B2B field):

```typescript
{/* Revenue Models */}
<div className="space-y-2">
  <Label>Revenue Models</Label>
  <div className="space-y-2">
    {revenueModelOptions.map((option) => (
      <div key={option.value} className="flex items-center space-x-2">
        <Checkbox
          id={`revenue-${option.value}`}
          checked={editValues.revenueModels.includes(option.value)}
          onCheckedChange={() =>
            setEditValues((prev) => ({
              ...prev,
              revenueModels: toggleRevenueModel(prev.revenueModels, option.value),
            }))
          }
        />
        <label
          htmlFor={`revenue-${option.value}`}
          className="text-sm text-gray-700 cursor-pointer select-none"
        >
          {option.label}
        </label>
      </div>
    ))}
  </div>
</div>
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx src/components/profile/CoreIdentitySection.test.tsx
git commit -m "feat: add revenue models field to edit form

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Add Save Functionality

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx`
- Modify: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Write the failing test**

```typescript
test("Save button calls updateOnboarding mutation", async () => {
  const mockMutate = vi.fn();
  vi.mocked(vi.importActual("convex/react")).useMutation = () => mockMutate;

  const { user } = setup({ productName: "Acme" });

  await user.click(screen.getByRole("button", { name: /edit/i }));
  await user.clear(screen.getByLabelText(/product name/i));
  await user.type(screen.getByLabelText(/product name/i), "New Name");
  await user.click(screen.getByRole("button", { name: /save/i }));

  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({ productName: "New Name" })
  );
});
```

Note: The mock setup may need adjustment based on how Convex is mocked. Update the mock at the top of the test file:

```typescript
const mockMutate = vi.fn();
vi.mock("convex/react", () => ({
  useMutation: () => mockMutate,
}));
```

And update the setup function to reset the mock:

```typescript
function setup(data: CoreIdentityData = {}) {
  mockMutate.mockReset();
  const user = userEvent.setup();
  render(<CoreIdentitySection data={data} />);
  return { user, mockMutate };
}
```

**Step 2: Run test to verify it fails**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: FAIL - no Save button

**Step 3: Add save button and handler**

Add the mutation hook and handler in the component:

```typescript
const updateOnboarding = useMutation(api.users.updateOnboarding);

const handleSave = async () => {
  await updateOnboarding({
    productName: editValues.productName || undefined,
    websiteUrl: editValues.websiteUrl || undefined,
    hasMultiUserAccounts: editValues.hasMultiUserAccounts ?? undefined,
    businessType:
      editValues.hasMultiUserAccounts === true
        ? undefined
        : editValues.businessType,
    revenueModels: editValues.revenueModels.length > 0 ? editValues.revenueModels : undefined,
  });
  setIsEditing(false);
};
```

Update the action buttons in the edit form:

```typescript
<div className="flex justify-end gap-2 pt-2">
  <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
    <X className="w-4 h-4 mr-1" />
    Cancel
  </Button>
  <Button size="sm" onClick={handleSave}>
    <Check className="w-4 h-4 mr-1" />
    Save
  </Button>
</div>
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx src/components/profile/CoreIdentitySection.test.tsx
git commit -m "feat: add save functionality to CoreIdentitySection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Cancel Functionality

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx`
- Modify: `src/components/profile/CoreIdentitySection.test.tsx`

**Step 1: Write the test**

```typescript
test("Cancel button reverts changes and closes edit form", async () => {
  const { user } = setup({ productName: "Acme" });

  await user.click(screen.getByRole("button", { name: /edit/i }));
  await user.clear(screen.getByLabelText(/product name/i));
  await user.type(screen.getByLabelText(/product name/i), "Changed Name");
  await user.click(screen.getByRole("button", { name: /cancel/i }));

  // Should be back in display mode with original value
  expect(screen.getByText("Acme")).toBeInTheDocument();
  expect(screen.queryByLabelText(/product name/i)).not.toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails or passes**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

**Step 3: Add cancel handler**

```typescript
const handleCancel = () => {
  setEditValues({
    productName: data.productName ?? "",
    websiteUrl: data.websiteUrl ?? "",
    hasMultiUserAccounts: data.hasMultiUserAccounts ?? null,
    businessType: data.businessType ?? undefined,
    revenueModels: data.revenueModels ?? [],
  });
  setIsEditing(false);
};
```

Update the Cancel button:

```typescript
<Button variant="ghost" size="sm" onClick={handleCancel}>
```

**Step 4: Run test to verify it passes**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx src/components/profile/CoreIdentitySection.test.tsx
git commit -m "feat: add cancel functionality to CoreIdentitySection

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Sync editValues When Props Change

**Files:**
- Modify: `src/components/profile/CoreIdentitySection.tsx`

**Step 1: Add useEffect to sync editValues when data prop changes**

This ensures if the data is updated from outside (e.g., refetch), the edit form reflects the new values.

```typescript
import { useState, useEffect } from "react";

// Add after editValues state
useEffect(() => {
  setEditValues({
    productName: data.productName ?? "",
    websiteUrl: data.websiteUrl ?? "",
    hasMultiUserAccounts: data.hasMultiUserAccounts ?? null,
    businessType: data.businessType ?? undefined,
    revenueModels: data.revenueModels ?? [],
  });
}, [data.productName, data.websiteUrl, data.hasMultiUserAccounts, data.businessType, data.revenueModels]);
```

**Step 2: Run tests to verify no regressions**

```bash
npm test -- --run src/components/profile/CoreIdentitySection.test.tsx
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/CoreIdentitySection.tsx
git commit -m "fix: sync editValues when CoreIdentitySection props change

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Run Full Test Suite

**Step 1: Run all tests**

```bash
npm test -- --run
```

Expected: All tests pass

**Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds

---

## Summary

This plan creates `CoreIdentitySection.tsx` with:
- Display mode showing product name, website, business model, revenue models
- Edit mode with inline form following ProductProfileCard pattern
- ProfileSection wrapper with complete/incomplete status
- Save/Cancel functionality using api.users.updateOnboarding mutation
- Tests for display states, edit toggle, and save/cancel behavior

**Files created:**
- `src/components/profile/CoreIdentitySection.tsx`
- `src/components/profile/CoreIdentitySection.test.tsx`

**Dependency:** Requires ProfileSection component (issue #38) to be implemented first.
