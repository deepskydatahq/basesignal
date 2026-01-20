# ProfilePage Container and Routing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the ProfilePage container component that serves as the new home page, aggregating all user profile data through a single Convex query.

**Architecture:** The ProfilePage container calls a single `getProfileData` query that aggregates identity, journey map, first value, metric catalog, measurement plan, and completeness data. The page renders at `/` replacing the current HomePage. Child section components are placeholders for separate issues.

**Tech Stack:** React 19, Convex, TypeScript, Tailwind CSS, React Router v7, convex-test, RTL

---

## Task 1: Create profile.ts with getProfileData query - Test

**Files:**
- Create: `convex/profile.test.ts`

**Step 1: Write the failing test**

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("profile.getProfileData", () => {
  it("returns null for unauthenticated users", async () => {
    const t = convexTest(schema);

    const result = await t.query(api.profile.getProfileData, {});

    expect(result).toBeNull();
  });

  it("returns profile data for authenticated user with empty data", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "test-clerk-id",
        email: "test@example.com",
        name: "Test User",
        productName: "My Product",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-clerk-id",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-clerk-id",
    });

    const result = await asUser.query(api.profile.getProfileData, {});

    expect(result).not.toBeNull();
    expect(result?.identity.productName).toBe("My Product");
    expect(result?.journeyMap.stages).toEqual([]);
    expect(result?.firstValue).toBeNull();
    expect(result?.metricCatalog.metrics).toEqual({});
    expect(result?.metricCatalog.totalCount).toBe(0);
    expect(result?.measurementPlan.entities).toEqual([]);
    expect(result?.measurementPlan.activityCount).toBe(0);
    expect(result?.measurementPlan.propertyCount).toBe(0);
    expect(result?.completeness.completed).toBe(0);
    expect(result?.completeness.total).toBe(11);
  });

  it("returns complete profile data for user with all sections populated", async () => {
    const t = convexTest(schema);

    const { userId, journeyId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "full-profile-user",
        email: "full@example.com",
        productName: "Full Product",
        websiteUrl: "https://example.com",
        hasMultiUserAccounts: true,
        businessType: "b2b",
        revenueModels: ["seat_subscription"],
        createdAt: Date.now(),
      });

      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId,
        name: "Account Created",
        type: "activity",
        entity: "Account",
        action: "Created",
        lifecycleSlot: "account_creation",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Account Created",
        reasoning: "First value moment",
        expectedTimeframe: "3 days",
        confirmedAt: Date.now(),
        source: "interview",
      });

      await ctx.db.insert("metrics", {
        userId,
        name: "Activation Rate",
        definition: "Rate of activation",
        formula: "activated / signed_up",
        whyItMatters: "Shows health",
        howToImprove: "Improve onboarding",
        category: "engagement",
        metricType: "default",
        order: 0,
        createdAt: Date.now(),
      });

      const entityId = await ctx.db.insert("measurementEntities", {
        userId,
        name: "Account",
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Account Created",
        action: "Created",
        isFirstValue: true,
        createdAt: Date.now(),
      });

      await ctx.db.insert("measurementProperties", {
        userId,
        entityId,
        name: "plan",
        dataType: "string",
        isRequired: true,
        createdAt: Date.now(),
      });

      return { userId, journeyId };
    });

    const asUser = t.withIdentity({
      subject: "full-profile-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|full-profile-user",
    });

    const result = await asUser.query(api.profile.getProfileData, {});

    expect(result).not.toBeNull();
    expect(result?.identity.productName).toBe("Full Product");
    expect(result?.identity.websiteUrl).toBe("https://example.com");
    expect(result?.journeyMap.stages).toHaveLength(1);
    expect(result?.journeyMap.journeyId).toBe(journeyId);
    expect(result?.firstValue).not.toBeNull();
    expect(result?.firstValue?.activityName).toBe("Account Created");
    expect(result?.metricCatalog.totalCount).toBe(1);
    expect(result?.measurementPlan.entities).toHaveLength(1);
    expect(result?.measurementPlan.activityCount).toBe(1);
    expect(result?.measurementPlan.propertyCount).toBe(1);
    expect(result?.completeness.completed).toBe(5);
  });

  it("calculates completeness correctly for partial data", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        clerkId: "partial-user",
        productName: "Partial Product",
        createdAt: Date.now(),
      });

      // Only add journey stages - no first value, metrics, or measurement plan
      const journeyId = await ctx.db.insert("journeys", {
        userId,
        type: "overview",
        name: "Overview",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await ctx.db.insert("stages", {
        journeyId,
        name: "Signed Up",
        type: "activity",
        position: { x: 0, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "partial-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|partial-user",
    });

    const result = await asUser.query(api.profile.getProfileData, {});

    // core_identity (has productName) + journey_map (has stages) = 2
    expect(result?.completeness.completed).toBe(2);
    expect(result?.completeness.percentage).toBe(18); // 2/11 = 18%
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/profile.test.ts`
Expected: FAIL with "Cannot find module" or similar (file doesn't exist yet)

---

## Task 2: Create profile.ts with getProfileData query - Implementation

**Files:**
- Create: `convex/profile.ts`

**Step 1: Implement the query**

```typescript
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Helper to get current authenticated user
async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// Completeness section definition
interface CompletenessSection {
  id: string;
  name: string;
  complete: boolean;
}

interface CompletenessInfo {
  sections: CompletenessSection[];
  completed: number;
  total: number;
  percentage: number;
}

function calculateCompleteness(data: {
  identity: { productName?: string };
  stages: Doc<"stages">[];
  firstValue: Doc<"firstValueDefinitions"> | null;
  metrics: Doc<"metrics">[];
  entities: Doc<"measurementEntities">[];
}): CompletenessInfo {
  const sections: CompletenessSection[] = [
    { id: "core_identity", name: "Core Identity", complete: !!data.identity.productName },
    { id: "journey_map", name: "User Journey Map", complete: data.stages.length > 0 },
    { id: "first_value", name: "First Value Moment", complete: !!data.firstValue },
    { id: "metric_catalog", name: "Metric Catalog", complete: data.metrics.length > 0 },
    { id: "measurement_plan", name: "Measurement Plan", complete: data.entities.length > 0 },
    // Future sections (always incomplete for now)
    { id: "heartbeat", name: "Heartbeat Event", complete: false },
    { id: "activation", name: "Activation Definition", complete: false },
    { id: "active", name: "Active Definition", complete: false },
    { id: "at_risk", name: "At-Risk Signals", complete: false },
    { id: "churn", name: "Churn Definition", complete: false },
    { id: "expansion", name: "Expansion Triggers", complete: false },
  ];

  const completed = sections.filter((s) => s.complete).length;
  const total = sections.length;

  return {
    sections,
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

// Group metrics by category
function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export const getProfileData = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    // Get overview journey
    const overviewJourney = await ctx.db
      .query("journeys")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", user._id).eq("type", "overview")
      )
      .first();

    // Get stages from overview journey
    const stages = overviewJourney
      ? await ctx.db
          .query("stages")
          .withIndex("by_journey", (q) => q.eq("journeyId", overviewJourney._id))
          .collect()
      : [];

    // Get first value definition
    const firstValue = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Get metrics
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get measurement entities
    const entities = await ctx.db
      .query("measurementEntities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get activity count
    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Get property count
    const properties = await ctx.db
      .query("measurementProperties")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Calculate completeness
    const completeness = calculateCompleteness({
      identity: user,
      stages,
      firstValue,
      metrics,
      entities,
    });

    return {
      identity: {
        productName: user.productName,
        websiteUrl: user.websiteUrl,
        hasMultiUserAccounts: user.hasMultiUserAccounts,
        businessType: user.businessType,
        revenueModels: user.revenueModels,
      },
      journeyMap: {
        stages,
        journeyId: overviewJourney?._id ?? null,
      },
      firstValue,
      metricCatalog: {
        metrics: groupBy(metrics, "category"),
        totalCount: metrics.length,
      },
      measurementPlan: {
        entities,
        activityCount: activities.length,
        propertyCount: properties.length,
      },
      completeness,
    };
  },
});
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- convex/profile.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add convex/profile.ts convex/profile.test.ts
git commit -m "$(cat <<'EOF'
feat: add profile.getProfileData query

Aggregates identity, journey map, first value, metric catalog,
measurement plan, and completeness data into a single query for
the ProfilePage container.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create ProfilePage component - Test

**Files:**
- Create: `src/components/profile/ProfilePage.test.tsx`

**Step 1: Write the failing test**

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProfilePage } from "./ProfilePage";
import { MemoryRouter } from "react-router-dom";

// Mock Convex hooks
const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Mock Navigate component
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

  expect(screen.getByText("My Awesome Product")).toBeInTheDocument();
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

  expect(screen.getByText("Your Product")).toBeInTheDocument();
});

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

  expect(screen.getByText("4/11")).toBeInTheDocument();
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

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: FAIL with "Cannot find module" or similar

---

## Task 4: Create ProfilePage component - Implementation

**Files:**
- Create: `src/components/profile/ProfilePage.tsx`

**Step 1: Implement the component**

```typescript
import { useQuery } from "convex/react";
import { Navigate } from "react-router-dom";
import { api } from "../../../convex/_generated/api";

export function ProfilePage() {
  const profileData = useQuery(api.profile.getProfileData);

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

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header with completeness */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          {profileData.identity.productName || "Your Product"}
        </h1>
        <div className="mt-2 text-sm text-gray-500">
          {profileData.completeness.completed}/{profileData.completeness.total}
        </div>
      </div>

      {/* Section placeholders - each will be a separate component in future issues */}
      <div className="space-y-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">Core Identity Section</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">Journey Map Section</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">First Value Section</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">Metric Catalog Section</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="text-gray-500">Measurement Plan Section</div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/profile/ProfilePage.tsx src/components/profile/ProfilePage.test.tsx
git commit -m "$(cat <<'EOF'
feat: add ProfilePage container component

Creates the ProfilePage component with:
- Loading state while data fetches
- Redirect to sign-in when not authenticated
- Header with product name and completeness indicator
- Placeholder sections for future child components

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update routing to serve ProfilePage at /

**Files:**
- Modify: `src/App.tsx:129` (change HomePage to ProfilePage in route)

**Step 1: Update the import and route**

In `src/App.tsx`, add the import at the top:

```typescript
import { ProfilePage } from './components/profile/ProfilePage'
```

Then change line 129 from:

```typescript
<Route index element={<HomePage />} />
```

to:

```typescript
<Route index element={<ProfilePage />} />
```

**Step 2: Verify the build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Run all tests to ensure nothing broke**

Run: `npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "$(cat <<'EOF'
feat: route / to ProfilePage instead of HomePage

Updates routing so ProfilePage serves as the new home page.
The old HomePage remains in the codebase for now (cleanup in
Task 11 of epic #35).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification and cleanup

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Run lint**

Run: `npm run lint`
Expected: No lint errors

**Step 4: Verify dev server works**

Run: `npm run dev`
Expected: Application starts, navigate to `/` shows ProfilePage with loading then content

---

## Summary

This plan implements issue #36 with:

- **4 new files:**
  - `convex/profile.ts` - getProfileData query
  - `convex/profile.test.ts` - query tests
  - `src/components/profile/ProfilePage.tsx` - container component
  - `src/components/profile/ProfilePage.test.tsx` - component tests

- **1 modified file:**
  - `src/App.tsx` - routing update

- **Key design decisions:**
  - Single aggregated query for clean API and unified loading state
  - Completeness calculation with all 11 sections (5 ready, 6 future)
  - Placeholder divs for child section components (separate issues)
  - Redirect to `/sign-in` when not authenticated

---

## Checklist

- [ ] `convex/profile.ts` has `getProfileData` query
- [ ] `convex/profile.test.ts` tests the query
- [ ] `src/components/profile/ProfilePage.tsx` exists with layout
- [ ] `src/components/profile/ProfilePage.test.tsx` tests the component
- [ ] Route `/` renders ProfilePage
- [ ] All tests pass (`npm test -- --run`)
- [ ] Build succeeds (`npm run build`)
