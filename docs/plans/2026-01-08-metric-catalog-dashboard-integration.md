# Metric Catalog: Dashboard Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate Metric Catalog with the Measurement Foundation dashboard - update status calculation, add navigation, and support progress badge.

**Architecture:** Update the `foundationStatus` query to calculate metric catalog status based on overview completion and metrics count. Extend StageCard to support badge/count display. Add navigation from the card to `/metric-catalog` route. Create placeholder page for the route.

**Tech Stack:** Convex (backend), convex-test (testing), React + React Router v7, Vitest + RTL (component testing)

---

## Dependencies

**Prerequisite issues:**
- Issue #24 (Metric Catalog Schema) MUST be completed first - provides the `metrics` table and `metrics.count` query

**Assumption:** The `metrics` table and `convex/metrics.ts` with `list` and `count` queries exist before starting this plan.

---

## Task 1: Update foundationStatus Query for Metric Catalog Status

**Files:**
- Modify: `convex/setupProgress.ts:246-321`
- Test: `convex/setupProgress.test.ts`

**Step 1: Write failing test for metric catalog status**

Add to `convex/setupProgress.test.ts`:

```typescript
it("returns locked for metricCatalog when overview is not complete", async () => {
  const t = convexTest(schema);

  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user",
  });

  const status = await asUser.query(api.setupProgress.foundationStatus, {});

  expect(status.metricCatalog.status).toBe("locked");
  expect(status.metricCatalog.metricsCount).toBe(0);
});

it("returns in_progress for metricCatalog when overview complete but no metrics", async () => {
  const t = convexTest(schema);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });

  const journeyId = await t.run(async (ctx) => {
    return await ctx.db.insert("journeys", {
      userId,
      type: "overview",
      name: "My Overview",
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("setupProgress", {
      userId,
      currentStep: "review_save",
      status: "completed",
      stepsCompleted: ["onboarding", "overview_interview", "review_save"],
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      completedAt: Date.now(),
      remindersSent: 0,
      overviewJourneyId: journeyId,
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user",
  });

  const status = await asUser.query(api.setupProgress.foundationStatus, {});

  expect(status.metricCatalog.status).toBe("in_progress");
  expect(status.metricCatalog.metricsCount).toBe(0);
});

it("returns complete for metricCatalog when metrics exist", async () => {
  const t = convexTest(schema);

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });

  const journeyId = await t.run(async (ctx) => {
    return await ctx.db.insert("journeys", {
      userId,
      type: "overview",
      name: "My Overview",
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  await t.run(async (ctx) => {
    await ctx.db.insert("setupProgress", {
      userId,
      currentStep: "review_save",
      status: "completed",
      stepsCompleted: ["onboarding", "overview_interview", "review_save"],
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      completedAt: Date.now(),
      remindersSent: 0,
      overviewJourneyId: journeyId,
    });
  });

  // Add some metrics
  await t.run(async (ctx) => {
    await ctx.db.insert("metrics", {
      userId,
      name: "New Users",
      definition: "Test",
      formula: "Test",
      whyItMatters: "Test",
      howToImprove: "Test",
      metricType: "default",
      templateKey: "new_users",
      order: 1,
      createdAt: Date.now(),
    });
    await ctx.db.insert("metrics", {
      userId,
      name: "DAU",
      definition: "Test",
      formula: "Test",
      whyItMatters: "Test",
      howToImprove: "Test",
      metricType: "default",
      templateKey: "dau",
      order: 2,
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user",
  });

  const status = await asUser.query(api.setupProgress.foundationStatus, {});

  expect(status.metricCatalog.status).toBe("complete");
  expect(status.metricCatalog.metricsCount).toBe(2);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/setupProgress.test.ts`
Expected: FAIL (metricsCount property missing)

**Step 3: Update foundationStatus query implementation**

In `convex/setupProgress.ts`, modify the `foundationStatus` query handler. Replace the hardcoded `metricCatalog: { status: "locked" as const }` with dynamic calculation:

```typescript
// Get foundation status for homepage progress card
export const foundationStatus = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        overviewInterview: { status: "not_started" as const, journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
        firstValue: { status: "not_defined" as const, journeyId: null },
        measurementPlan: { status: "locked" as const },
        metricCatalog: { status: "locked" as const, metricsCount: 0 },
      };
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return {
        overviewInterview: { status: "not_started" as const, journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
        firstValue: { status: "not_defined" as const, journeyId: null },
        measurementPlan: { status: "locked" as const },
        metricCatalog: { status: "locked" as const, metricsCount: 0 },
      };
    }

    // Get setup progress
    const progress = await ctx.db
      .query("setupProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    // Get user's journeys
    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const overviewJourney = journeys.find((j) => j.type === "overview") ?? null;
    const firstValueJourney = journeys.find((j) => j.type === "first_value") ?? null;

    // Calculate slots completed for overview journey
    let slotsCompleted = 0;
    if (overviewJourney) {
      const stages = await ctx.db
        .query("stages")
        .withIndex("by_journey", (q) => q.eq("journeyId", overviewJourney._id))
        .collect();
      const filledSlots = new Set(stages.map((s) => s.lifecycleSlot).filter(Boolean));
      slotsCompleted = filledSlots.size;
    }

    // Derive overview interview status
    let overviewStatus: "not_started" | "in_progress" | "complete" = "not_started";
    const overviewComplete = progress?.status === "completed";
    if (overviewComplete) {
      overviewStatus = "complete";
    } else if (progress?.currentStep === "overview_interview") {
      overviewStatus = "in_progress";
    }

    // Calculate metric catalog status
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const metricsCount = metrics.length;

    let metricCatalogStatus: "locked" | "in_progress" | "complete" = "locked";
    if (metricsCount > 0) {
      metricCatalogStatus = "complete";
    } else if (overviewComplete) {
      metricCatalogStatus = "in_progress";
    }

    return {
      overviewInterview: {
        status: overviewStatus,
        journeyId: overviewJourney?._id ?? null,
        slotsCompleted,
        slotsTotal: 5,
      },
      firstValue: {
        status: firstValueJourney ? ("defined" as const) : ("not_defined" as const),
        journeyId: firstValueJourney?._id ?? null,
      },
      measurementPlan: { status: "locked" as const },
      metricCatalog: { status: metricCatalogStatus, metricsCount },
    };
  },
});
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- convex/setupProgress.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add convex/setupProgress.ts convex/setupProgress.test.ts
git commit -m "feat: add dynamic metric catalog status to foundationStatus"
```

---

## Task 2: Update FoundationStatus TypeScript Interface

**Files:**
- Modify: `src/components/home/MeasurementFoundationCard.tsx:6-19`
- Test: `src/components/home/MeasurementFoundationCard.test.tsx`

**Step 1: Update the FoundationStatus interface**

In `src/components/home/MeasurementFoundationCard.tsx`, update the interface:

```typescript
interface FoundationStatus {
  overviewInterview: {
    status: "not_started" | "in_progress" | "complete";
    journeyId: Id<"journeys"> | null;
    slotsCompleted: number;
    slotsTotal: number;
  };
  firstValue: {
    status: "defined" | "not_defined";
    journeyId: Id<"journeys"> | null;
  };
  measurementPlan: { status: "locked" };
  metricCatalog: {
    status: "locked" | "in_progress" | "complete";
    metricsCount: number;
  };
}
```

**Step 2: Run existing tests to verify interface change doesn't break anything**

Run: `npm run test:run -- src/components/home/MeasurementFoundationCard.test.tsx`
Expected: Tests may fail due to missing metricsCount in test setup - continue to next step

**Step 3: Update test setup function to include metricsCount**

In `src/components/home/MeasurementFoundationCard.test.tsx`, update the `setup` function:

```typescript
function setup(status: Partial<FoundationStatus> = {}) {
  const user = userEvent.setup();
  const defaultStatus: FoundationStatus = {
    overviewInterview: { status: "not_started", journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
    firstValue: { status: "not_defined", journeyId: null },
    measurementPlan: { status: "locked" },
    metricCatalog: { status: "locked", metricsCount: 0 },
    ...status,
  };
  render(
    <MemoryRouter>
      <MeasurementFoundationCard status={defaultStatus} />
    </MemoryRouter>
  );
  return { user };
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/home/MeasurementFoundationCard.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/components/home/MeasurementFoundationCard.tsx src/components/home/MeasurementFoundationCard.test.tsx
git commit -m "feat: update FoundationStatus interface for metric catalog"
```

---

## Task 3: Add Badge Support to StageCard

**Files:**
- Modify: `src/components/home/StageCard.tsx`
- Test: `src/components/home/StageCard.test.tsx` (create)

**Step 1: Write failing test for badge rendering**

Create `src/components/home/StageCard.test.tsx`:

```typescript
import { expect, test } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageCard } from "./StageCard";

test("renders badge text when provided", () => {
  render(
    <StageCard
      title="Metric Catalog"
      description="Generate your product metrics"
      icon="BarChart3"
      status="in_progress"
      badgeText="5/8 metrics"
    />
  );

  expect(screen.getByText("5/8 metrics")).toBeInTheDocument();
});

test("does not render badge when not provided", () => {
  render(
    <StageCard
      title="Metric Catalog"
      description="Generate your product metrics"
      icon="BarChart3"
      status="in_progress"
    />
  );

  expect(screen.queryByText(/metrics/)).not.toBeInTheDocument();
});

test("renders badge text for complete status", () => {
  render(
    <StageCard
      title="Metric Catalog"
      description="Generate your product metrics"
      icon="BarChart3"
      status="complete"
      badgeText="8 metrics"
    />
  );

  expect(screen.getByText("8 metrics")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/home/StageCard.test.tsx`
Expected: FAIL (badgeText prop not recognized)

**Step 3: Add badgeText prop to StageCard**

In `src/components/home/StageCard.tsx`, add the prop and render logic:

```typescript
interface StageCardProps {
  title: string;
  description: string;
  icon: IconName;
  status: StageStatus;
  progressText?: string;
  badgeText?: string;
  onClick?: () => void;
}

export function StageCard({
  title,
  description,
  icon,
  status,
  progressText,
  badgeText,
  onClick,
}: StageCardProps) {
  const Icon = ICONS[icon];
  const config = STATUS_CONFIG[status];
  const isLocked = status === "locked";

  return (
    <div
      className={cn(
        "flex flex-col p-4 rounded-lg border border-gray-200 bg-white",
        config.opacity,
        !isLocked && "hover:border-gray-300 transition-colors"
      )}
    >
      {/* Header row: icon + badge */}
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5 text-gray-600" />
        <div className="flex items-center gap-2">
          {badgeText && (
            <span className="text-xs text-gray-500">{badgeText}</span>
          )}
          {config.badge}
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-gray-900 mb-1">{title}</h3>

      {/* Description */}
      <p className="text-xs text-gray-500 mb-3 flex-1">{description}</p>

      {/* Progress text (if provided) */}
      {progressText && (
        <p className="text-xs text-blue-600 mb-2">{progressText}</p>
      )}

      {/* CTA or locked text */}
      {isLocked ? (
        <span className="text-xs text-gray-400">Coming soon</span>
      ) : (
        <Button
          size="sm"
          variant={config.buttonVariant}
          onClick={onClick}
          className="w-full"
        >
          {config.buttonLabel}
        </Button>
      )}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/home/StageCard.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/components/home/StageCard.tsx src/components/home/StageCard.test.tsx
git commit -m "feat: add badgeText prop to StageCard for metrics count"
```

---

## Task 4: Wire Up Metric Catalog Status in MeasurementFoundationCard

**Files:**
- Modify: `src/components/home/MeasurementFoundationCard.tsx`
- Test: `src/components/home/MeasurementFoundationCard.test.tsx`

**Step 1: Write failing test for metric catalog click handler**

Add to `src/components/home/MeasurementFoundationCard.test.tsx`:

```typescript
test("navigates to metric-catalog when clicking on in_progress metric catalog", async () => {
  const { user } = setup({
    overviewInterview: { status: "complete", journeyId: "journey123" as Id<"journeys">, slotsCompleted: 5, slotsTotal: 5 },
    metricCatalog: { status: "in_progress", metricsCount: 5 },
  });

  const continueButton = screen.getAllByRole("button", { name: /continue/i })[0];
  await user.click(continueButton);

  expect(mockNavigate).toHaveBeenCalledWith("/metric-catalog");
});

test("navigates to metric-catalog when clicking on complete metric catalog", async () => {
  const { user } = setup({
    overviewInterview: { status: "complete", journeyId: "journey123" as Id<"journeys">, slotsCompleted: 5, slotsTotal: 5 },
    metricCatalog: { status: "complete", metricsCount: 8 },
  });

  const viewButtons = screen.getAllByRole("button", { name: /view/i });
  // Second view button should be for metric catalog (first is overview)
  await user.click(viewButtons[1]);

  expect(mockNavigate).toHaveBeenCalledWith("/metric-catalog");
});

test("shows badge text for in_progress metric catalog", () => {
  setup({
    overviewInterview: { status: "complete", journeyId: "journey123" as Id<"journeys">, slotsCompleted: 5, slotsTotal: 5 },
    metricCatalog: { status: "in_progress", metricsCount: 5 },
  });

  expect(screen.getByText("5 metrics")).toBeInTheDocument();
});

test("shows badge text for complete metric catalog", () => {
  setup({
    overviewInterview: { status: "complete", journeyId: "journey123" as Id<"journeys">, slotsCompleted: 5, slotsTotal: 5 },
    metricCatalog: { status: "complete", metricsCount: 8 },
  });

  expect(screen.getByText("8 metrics")).toBeInTheDocument();
});

test("metric catalog card is locked when overview not complete", () => {
  setup({
    overviewInterview: { status: "in_progress", journeyId: null, slotsCompleted: 2, slotsTotal: 5 },
    metricCatalog: { status: "locked", metricsCount: 0 },
  });

  // Should still show "Coming soon" for locked metric catalog
  const comingSoonTexts = screen.getAllByText(/coming soon/i);
  expect(comingSoonTexts).toHaveLength(2); // Measurement Plan + Metric Catalog
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/home/MeasurementFoundationCard.test.tsx`
Expected: FAIL (navigation not implemented)

**Step 3: Implement metric catalog click handler and status mapping**

In `src/components/home/MeasurementFoundationCard.tsx`:

```typescript
import { useNavigate } from "react-router-dom";
import { Layers } from "lucide-react";
import { StageCard, type StageStatus } from "./StageCard";
import type { Id } from "../../../convex/_generated/dataModel";

interface FoundationStatus {
  overviewInterview: {
    status: "not_started" | "in_progress" | "complete";
    journeyId: Id<"journeys"> | null;
    slotsCompleted: number;
    slotsTotal: number;
  };
  firstValue: {
    status: "defined" | "not_defined";
    journeyId: Id<"journeys"> | null;
  };
  measurementPlan: { status: "locked" };
  metricCatalog: {
    status: "locked" | "in_progress" | "complete";
    metricsCount: number;
  };
}

interface MeasurementFoundationCardProps {
  status: FoundationStatus;
}

export function MeasurementFoundationCard({ status }: MeasurementFoundationCardProps) {
  const navigate = useNavigate();

  const handleOverviewClick = () => {
    if (status.overviewInterview.status === "complete" && status.overviewInterview.journeyId) {
      navigate(`/journeys/${status.overviewInterview.journeyId}`);
    } else {
      navigate("/setup/interview");
    }
  };

  const handleFirstValueClick = () => {
    if (status.firstValue.status === "defined" && status.firstValue.journeyId) {
      navigate(`/journeys/${status.firstValue.journeyId}`);
    } else {
      navigate("/interviews/first_value");
    }
  };

  const handleMetricCatalogClick = () => {
    navigate("/metric-catalog");
  };

  // Map overview status to StageStatus
  const overviewStageStatus: StageStatus = status.overviewInterview.status;

  // Map firstValue status to StageStatus
  const firstValueStageStatus: StageStatus = status.firstValue.status;

  // Map metricCatalog status to StageStatus
  const metricCatalogStageStatus: StageStatus = status.metricCatalog.status;

  // Generate badge text for metric catalog
  const metricCatalogBadgeText =
    status.metricCatalog.metricsCount > 0
      ? `${status.metricCatalog.metricsCount} metrics`
      : undefined;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-gray-500" />
        <h2 className="text-sm font-medium text-gray-500">Measurement Foundation</h2>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StageCard
          title="Overview Interview"
          description="Map your product's user lifecycle"
          icon="Users"
          status={overviewStageStatus}
          progressText={
            status.overviewInterview.status === "in_progress"
              ? `${status.overviewInterview.slotsCompleted} of ${status.overviewInterview.slotsTotal} lifecycle slots`
              : undefined
          }
          onClick={handleOverviewClick}
        />

        <StageCard
          title="First Value"
          description="Define when users find value"
          icon="Target"
          status={firstValueStageStatus}
          onClick={handleFirstValueClick}
        />

        <StageCard
          title="Measurement Plan"
          description="Connect your analytics data"
          icon="FileText"
          status="locked"
        />

        <StageCard
          title="Metric Catalog"
          description="Generate your product metrics"
          icon="BarChart3"
          status={metricCatalogStageStatus}
          badgeText={metricCatalogBadgeText}
          onClick={status.metricCatalog.status !== "locked" ? handleMetricCatalogClick : undefined}
        />
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/components/home/MeasurementFoundationCard.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/components/home/MeasurementFoundationCard.tsx src/components/home/MeasurementFoundationCard.test.tsx
git commit -m "feat: wire up metric catalog status and navigation"
```

---

## Task 5: Create Placeholder MetricCatalogPage Component

**Files:**
- Create: `src/routes/MetricCatalogPage.tsx`
- Test: `src/routes/MetricCatalogPage.test.tsx`

**Step 1: Write failing test for placeholder page**

Create `src/routes/MetricCatalogPage.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import MetricCatalogPage from "./MetricCatalogPage";
import { ConvexProvider } from "convex/react";

// Mock useQuery to return empty metrics
vi.mock("convex/react", async () => {
  const actual = await vi.importActual("convex/react");
  return {
    ...actual,
    useQuery: () => [],
  };
});

test("renders Metric Catalog heading", () => {
  render(
    <MetricCatalogPage />
  );

  expect(screen.getByRole("heading", { name: /metric catalog/i })).toBeInTheDocument();
});

test("shows empty state message when no metrics", () => {
  render(
    <MetricCatalogPage />
  );

  expect(screen.getByText(/no metrics yet/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/routes/MetricCatalogPage.test.tsx`
Expected: FAIL (module not found)

**Step 3: Create MetricCatalogPage placeholder component**

Create `src/routes/MetricCatalogPage.tsx`:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function MetricCatalogPage() {
  const metrics = useQuery(api.metrics.list);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Metric Catalog</h1>

      {metrics === undefined ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900" />
        </div>
      ) : metrics.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No metrics yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Complete the Overview Interview to generate your Metric Catalog.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Placeholder for future metric cards */}
          {metrics.map((metric) => (
            <div
              key={metric._id}
              className="p-4 border border-gray-200 rounded-lg"
            >
              <h3 className="font-medium text-gray-900">{metric.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{metric.definition}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/routes/MetricCatalogPage.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add src/routes/MetricCatalogPage.tsx src/routes/MetricCatalogPage.test.tsx
git commit -m "feat: add placeholder MetricCatalogPage component"
```

---

## Task 6: Add /metric-catalog Route to App.tsx

**Files:**
- Modify: `src/App.tsx:127-138`
- Test: Manual verification

**Step 1: Import MetricCatalogPage**

Add import at top of `src/App.tsx`:

```typescript
import MetricCatalogPage from './routes/MetricCatalogPage'
```

**Step 2: Add route for /metric-catalog**

In `src/App.tsx`, add the route inside the DashboardLayout routes (after journeys route):

```typescript
<Route path="/" element={<DashboardLayout />}>
  <Route index element={<HomePage />} />
  <Route path="settings" element={<SettingsPage />} />
  <Route path="sources/amplitude/connect" element={<AmplitudeConnectPage />} />
  <Route path="sources/amplitude/:connectionId/events" element={<AmplitudeEventsPage />} />
  <Route path="sources/amplitude/:connectionId/confirm" element={<AmplitudeConfirmPage />} />
  <Route path="sources/amplitude/:connectionId/account-mapping" element={<AccountMappingPage />} />
  <Route path="sources/amplitude/:connectionId/activities" element={<ActivityDefinitionsPage />} />
  <Route path="sources/amplitude/:connectionId/activities/synthetic" element={<SyntheticEventPage />} />
  <Route path="sources/amplitude/:connectionId/value-rules" element={<ValueRulesPage />} />
  <Route path="journeys" element={<JourneysListPage />} />
  <Route path="journeys/:journeyId" element={<JourneyEditorPage />} />
  <Route path="metric-catalog" element={<MetricCatalogPage />} />
</Route>
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /metric-catalog route"
```

---

## Task 7: Final Verification

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests pass

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

**Step 3: Manual smoke test (if dev server available)**

1. Start dev server: `npm run dev`
2. Complete overview interview (or use existing completed account)
3. Verify Metric Catalog card shows correct status
4. Click Metric Catalog card → navigates to `/metric-catalog`
5. Verify placeholder page renders

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues from verification"
```

---

## Testing Summary

| What | Tool | File |
|------|------|------|
| foundationStatus query | convex-test | `convex/setupProgress.test.ts` |
| StageCard badge | RTL | `src/components/home/StageCard.test.tsx` |
| MeasurementFoundationCard | RTL | `src/components/home/MeasurementFoundationCard.test.tsx` |
| MetricCatalogPage | RTL | `src/routes/MetricCatalogPage.test.tsx` |

Run: `npm run test:run` to verify all tests pass.

---

## Design Notes

### Status Mapping

| Metric Catalog Status | Condition | Card Behavior |
|----------------------|-----------|---------------|
| `locked` | Overview not complete | Gray, disabled, "Coming soon" |
| `in_progress` | Overview complete, no metrics | Clickable, "Continue" button |
| `complete` | Has metrics | Clickable, "View" button, badge shows count |

### Nice-to-have (Deferred)

- Toast notification "Your Metric Catalog is ready" after generation
- Badge showing "X/8 metrics" progress format (requires knowing total)

These can be added when the metric generation logic is implemented (Issues #26, #27).
