# Logo Placeholder with Colored Initials Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a colored initial avatar to ProfileHeader that provides instant visual product identification.

**Architecture:** Create pure utility functions for color/initial extraction, then integrate a 48x48px circular avatar into ProfileHeader. Finally, consolidate ProfilePage to use ProfileHeader instead of its inline header.

**Tech Stack:** React, Tailwind CSS, Vitest

---

## Task 1: Create productColor utility with tests

**Files:**
- Create: `src/lib/productColor.ts`
- Create: `src/lib/productColor.test.ts`

**Step 1: Write the failing tests for getProductInitial**

```typescript
// src/lib/productColor.test.ts
import { describe, expect, test } from "vitest";
import { getProductInitial, getProductColor } from "./productColor";

describe("getProductInitial", () => {
  test("returns uppercase first letter of product name", () => {
    expect(getProductInitial("Basesignal")).toBe("B");
  });

  test("handles lowercase names", () => {
    expect(getProductInitial("acme corp")).toBe("A");
  });

  test("returns ? for empty string", () => {
    expect(getProductInitial("")).toBe("?");
  });

  test("returns ? for undefined", () => {
    expect(getProductInitial(undefined)).toBe("?");
  });

  test("trims whitespace before extracting", () => {
    expect(getProductInitial("  hello")).toBe("H");
  });
});

describe("getProductColor", () => {
  test("returns a hex color from the palette", () => {
    const color = getProductColor("Basesignal");
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("returns same color for same name (deterministic)", () => {
    const color1 = getProductColor("My Product");
    const color2 = getProductColor("My Product");
    expect(color1).toBe(color2);
  });

  test("returns different colors for different names", () => {
    const color1 = getProductColor("Product A");
    const color2 = getProductColor("Product B");
    // High probability they differ, but not guaranteed
    // At least verify both are valid
    expect(color1).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(color2).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("returns a color for empty string", () => {
    const color = getProductColor("");
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  test("returns a color for undefined", () => {
    const color = getProductColor(undefined);
    expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/productColor.test.ts`
Expected: FAIL with "Cannot find module './productColor'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/productColor.ts

// 12 curated colors that work well with white text
const COLOR_PALETTE = [
  "#3B82F6", // Blue
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#22C55E", // Green
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#6366F1", // Indigo
  "#A855F7", // Purple
  "#0EA5E9", // Sky
];

/**
 * Simple hash function to convert a string to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Returns the first letter of the product name, uppercase.
 * Returns "?" if no valid name is provided.
 */
export function getProductInitial(name: string | undefined): string {
  const trimmed = (name ?? "").trim();
  if (trimmed.length === 0) return "?";
  return trimmed[0].toUpperCase();
}

/**
 * Returns a deterministic color from a curated palette based on product name.
 */
export function getProductColor(name: string | undefined): string {
  const hash = hashString(name ?? "");
  return COLOR_PALETTE[hash % COLOR_PALETTE.length];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/productColor.test.ts`
Expected: PASS (all 10 tests)

**Step 5: Commit**

```bash
git add src/lib/productColor.ts src/lib/productColor.test.ts
git commit -m "$(cat <<'EOF'
feat: add productColor utility for logo avatar

Add getProductInitial() and getProductColor() functions that derive
a display initial and deterministic background color from product name.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add logo avatar to ProfileHeader

**Files:**
- Modify: `src/components/profile/ProfileHeader.tsx`
- Modify: `src/components/profile/ProfileHeader.test.tsx`

**Step 1: Write the failing tests for logo avatar**

Add these tests to `src/components/profile/ProfileHeader.test.tsx`:

```typescript
// Add import at top
import { getProductColor } from "../../lib/productColor";

// Add these tests at the end of the file

test("renders logo avatar with product initial", () => {
  setup({ identity: { productName: "Basesignal" } });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("B");
});

test("renders logo avatar with ? for missing product name", () => {
  setup({ identity: {} });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("?");
});

test("applies deterministic background color to avatar", () => {
  setup({ identity: { productName: "Basesignal" } });

  const avatar = screen.getByLabelText("Product avatar");
  const expectedColor = getProductColor("Basesignal");
  expect(avatar).toHaveStyle({ backgroundColor: expectedColor });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ProfileHeader.test.tsx`
Expected: FAIL with "Unable to find an accessible element with the role"

**Step 3: Update ProfileHeader implementation**

Update `src/components/profile/ProfileHeader.tsx`:

```typescript
import { getProductInitial, getProductColor } from "../../lib/productColor";

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

export function ProfileHeader({
  identity,
  completeness,
}: ProfileHeaderProps) {
  // Derive business type badge - B2B if multi-user OR explicit b2b
  const businessTypeBadge = identity.hasMultiUserAccounts
    ? "B2B"
    : identity.businessType === "b2b"
      ? "B2B"
      : "B2C";

  const percentage = Math.round(
    (completeness.completed / completeness.total) * 100
  );

  const initial = getProductInitial(identity.productName);
  const backgroundColor = getProductColor(identity.productName);

  return (
    <header className="mb-8">
      <div className="flex items-start gap-4">
        {/* Logo avatar */}
        <div
          aria-label="Product avatar"
          className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-semibold"
          style={{ backgroundColor }}
        >
          {initial}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            {identity.productName || "Your Product"}
          </h1>

          {identity.productDescription && (
            <p className="mt-1 text-gray-600">{identity.productDescription}</p>
          )}
        </div>
      </div>

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

Run: `npm test -- src/components/profile/ProfileHeader.test.tsx`
Expected: PASS (all 18 tests including 3 new avatar tests)

**Step 5: Commit**

```bash
git add src/components/profile/ProfileHeader.tsx src/components/profile/ProfileHeader.test.tsx
git commit -m "$(cat <<'EOF'
feat: add logo avatar to ProfileHeader

Display a 48x48px circular avatar with the product's first initial
on a deterministic background color derived from the product name.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Consolidate ProfilePage to use ProfileHeader

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx`
- Modify: `src/components/profile/ProfilePage.test.tsx`

**Step 1: Update ProfilePage to use ProfileHeader**

Replace the inline header in `src/components/profile/ProfilePage.tsx`:

```typescript
import { useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";
import { CoreIdentitySection } from "./CoreIdentitySection";
import { FirstValueSection } from "./FirstValueSection";
import { MetricCatalogSection } from "./MetricCatalogSection";
import { MeasurementPlanSection } from "./MeasurementPlanSection";
import { JourneyMapSection } from "./JourneyMapSection";
import { ProfileHeader } from "./ProfileHeader";

export function ProfilePage() {
  const profileData = useQuery(api.profile.getProfileData);
  const measurementPlan = useQuery(api.measurementPlan.getFullPlan);

  // Loading state
  if (profileData === undefined) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse text-gray-500">Loading profile...</div>
      </div>
    );
  }

  // Not authenticated
  if (profileData === null) {
    return <Navigate to="/sign-in" />;
  }

  // Flatten metrics from grouped structure
  const flatMetrics = Object.values(profileData.metricCatalog.metrics)
    .flat()
    .map((m) => ({
      _id: m._id,
      name: m.name,
      category: m.category,
    }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <ProfileHeader
        identity={profileData.identity}
        completeness={profileData.completeness}
      />

      <div className="space-y-6">
        <CoreIdentitySection data={profileData.identity} />

        <JourneyMapSection journeyId={profileData.journeyMap.journeyId} />

        <FirstValueSection />

        <MetricCatalogSection metrics={flatMetrics} />

        <MeasurementPlanSection plan={measurementPlan ?? []} />
      </div>
    </div>
  );
}
```

**Step 2: Update ProfilePage tests**

Update `src/components/profile/ProfilePage.test.tsx` to reflect new header structure:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfilePage } from "./ProfilePage";
import { MemoryRouter } from "react-router-dom";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  };
});

function setup(queryResult: unknown) {
  mockUseQuery.mockReturnValue(queryResult);
  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );
}

test("shows loading state when data is undefined", () => {
  setup(undefined);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});

test("redirects to sign-in when data is null", () => {
  setup(null);

  const navigate = screen.getByTestId("navigate");
  expect(navigate).toHaveAttribute("data-to", "/sign-in");
});

test("renders product name from profile data", () => {
  setup({
    identity: {
      productName: "My Awesome Product",
      websiteUrl: "https://example.com",
    },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 2,
      total: 11,
      percentage: 18,
    },
  });

  expect(screen.getByRole("heading", { name: "My Awesome Product" })).toBeInTheDocument();
});

test("shows default product name when not set", () => {
  setup({
    identity: {
      productName: undefined,
    },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 0,
      total: 11,
      percentage: 0,
    },
  });

  expect(screen.getByRole("heading", { name: "Your Product" })).toBeInTheDocument();
});

test("displays completeness indicator via ProfileHeader", () => {
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

test("renders logo avatar with product initial", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 0,
      total: 11,
      percentage: 0,
    },
  });

  const avatar = screen.getByLabelText("Product avatar");
  expect(avatar).toHaveTextContent("T");
});

test("renders section placeholders", () => {
  setup({
    identity: { productName: "Test Product" },
    journeyMap: { stages: [], journeyId: null },
    firstValue: null,
    metricCatalog: { metrics: {}, totalCount: 0 },
    measurementPlan: { entities: [], activityCount: 0, propertyCount: 0 },
    completeness: {
      sections: [],
      completed: 0,
      total: 11,
      percentage: 0,
    },
  });

  expect(screen.getByText("Core Identity Section")).toBeInTheDocument();
  expect(screen.getByText("Journey Map Section")).toBeInTheDocument();
  expect(screen.getByText("First Value Section")).toBeInTheDocument();
  expect(screen.getByText("Metric Catalog Section")).toBeInTheDocument();
  expect(screen.getByText("Measurement Plan Section")).toBeInTheDocument();
});
```

**Step 3: Run tests to verify they pass**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: PASS (all 7 tests)

**Step 4: Run full test suite**

Run: `npm run test:run`
Expected: All tests pass

**Step 5: Commit**

```bash
git add src/components/profile/ProfilePage.tsx src/components/profile/ProfilePage.test.tsx
git commit -m "$(cat <<'EOF'
refactor: consolidate ProfilePage to use ProfileHeader

Remove duplicate inline header and use ProfileHeader as single source
of truth for product name, avatar, and completeness indicator.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Description | Tests |
|------|-------------|-------|
| 1 | Create productColor utility | 10 tests |
| 2 | Add logo avatar to ProfileHeader | 3 new tests |
| 3 | Consolidate ProfilePage | 7 tests (1 new) |

**Total:** 3 tasks, ~20 tests covering utility functions and component integration.
