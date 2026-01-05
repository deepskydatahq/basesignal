# Measurement Foundation Card Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace JourneyRoadmap with a 2x2 grid showing setup progress across 4 stages (Overview Interview, First Value, Measurement Plan, Metric Catalog).

**Architecture:** New `foundationStatus` Convex query aggregates setup progress + journey data. React component consumes this query and renders a grid of StageCard components with state-dependent styling and navigation.

**Tech Stack:** Convex (backend query), React + TypeScript (components), Tailwind CSS (styling), Lucide icons, React Router (navigation)

---

## Task 1: Backend Query - foundationStatus

**Files:**
- Modify: `convex/setupProgress.ts` (add query at end of file)
- Test: `convex/setupProgress.test.ts` (create new file)

### Step 1: Write failing test for foundationStatus query

Create `convex/setupProgress.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("setupProgress.foundationStatus", () => {
  it("returns not_started status when no setup progress exists", async () => {
    const t = convexTest(schema);

    // Create a user
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

    expect(status.overviewInterview.status).toBe("not_started");
    expect(status.overviewInterview.journeyId).toBeNull();
    expect(status.firstValue.status).toBe("not_defined");
    expect(status.measurementPlan.status).toBe("locked");
    expect(status.metricCatalog.status).toBe("locked");
  });

  it("returns in_progress when setup is active on overview_interview step", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "overview_interview",
        status: "active",
        stepsCompleted: ["onboarding"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        remindersSent: 0,
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.overviewInterview.status).toBe("in_progress");
  });

  it("returns complete when setup is completed with overview journey", async () => {
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

    expect(status.overviewInterview.status).toBe("complete");
    expect(status.overviewInterview.journeyId).toBe(journeyId);
  });

  it("returns defined for firstValue when first_value journey exists", async () => {
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
        type: "first_value",
        name: "First Value Journey",
        isDefault: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.firstValue.status).toBe("defined");
    expect(status.firstValue.journeyId).toBe(journeyId);
  });

  it("includes slot completion count for in-progress overview", async () => {
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

    // Add some stages to different slots
    await t.run(async (ctx) => {
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
      await ctx.db.insert("stages", {
        journeyId,
        name: "User Activated",
        type: "activity",
        entity: "User",
        action: "Activated",
        lifecycleSlot: "activation",
        position: { x: 100, y: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("setupProgress", {
        userId,
        currentStep: "overview_interview",
        status: "active",
        stepsCompleted: ["onboarding"],
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
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

    expect(status.overviewInterview.slotsCompleted).toBe(2);
    expect(status.overviewInterview.slotsTotal).toBe(5);
  });
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- convex/setupProgress.test.ts`
Expected: FAIL - `api.setupProgress.foundationStatus` does not exist

### Step 3: Implement foundationStatus query

Add to end of `convex/setupProgress.ts`:

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
        metricCatalog: { status: "locked" as const },
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
        metricCatalog: { status: "locked" as const },
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
    if (progress?.status === "completed") {
      overviewStatus = "complete";
    } else if (progress?.currentStep === "overview_interview") {
      overviewStatus = "in_progress";
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
      metricCatalog: { status: "locked" as const },
    };
  },
});
```

### Step 4: Run tests to verify they pass

Run: `npm test -- convex/setupProgress.test.ts`
Expected: All 5 tests PASS

### Step 5: Commit

```bash
git add convex/setupProgress.ts convex/setupProgress.test.ts
git commit -m "feat: add foundationStatus query for homepage progress card"
```

---

## Task 2: StageCard Component

**Files:**
- Create: `src/components/home/StageCard.tsx`
- Test: `src/components/home/StageCard.test.tsx`

### Step 1: Write failing test for StageCard

Create `src/components/home/StageCard.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StageCard } from "./StageCard";

function setup(props: Partial<Parameters<typeof StageCard>[0]> = {}) {
  const user = userEvent.setup();
  const onClick = props.onClick ?? vi.fn();
  const defaultProps = {
    title: "Test Stage",
    description: "Test description",
    icon: "Users" as const,
    status: "not_started" as const,
    onClick,
    ...props,
  };
  render(<StageCard {...defaultProps} />);
  return { user, onClick };
}

test("renders stage title and description", () => {
  setup({ title: "Overview Interview", description: "Map your user journey" });

  expect(screen.getByText("Overview Interview")).toBeInTheDocument();
  expect(screen.getByText("Map your user journey")).toBeInTheDocument();
});

test("renders Start button for not_started status", () => {
  setup({ status: "not_started" });

  expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
});

test("renders Continue button for in_progress status", () => {
  setup({ status: "in_progress" });

  expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
});

test("renders View button for complete status", () => {
  setup({ status: "complete" });

  expect(screen.getByRole("button", { name: /view/i })).toBeInTheDocument();
});

test("renders Define button for not_defined status", () => {
  setup({ status: "not_defined" });

  expect(screen.getByRole("button", { name: /define/i })).toBeInTheDocument();
});

test("renders Coming soon text for locked status", () => {
  setup({ status: "locked" });

  expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("shows progress text when provided", () => {
  setup({ status: "in_progress", progressText: "2 of 5 slots mapped" });

  expect(screen.getByText("2 of 5 slots mapped")).toBeInTheDocument();
});

test("calls onClick when button is clicked", async () => {
  const onClick = vi.fn();
  const { user } = setup({ status: "not_started", onClick });

  await user.click(screen.getByRole("button", { name: /start/i }));

  expect(onClick).toHaveBeenCalledOnce();
});

test("does not call onClick for locked status", async () => {
  const onClick = vi.fn();
  setup({ status: "locked", onClick });

  // Card should not be interactive
  expect(onClick).not.toHaveBeenCalled();
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/components/home/StageCard.test.tsx`
Expected: FAIL - Cannot find module './StageCard'

### Step 3: Implement StageCard component

Create `src/components/home/StageCard.tsx`:

```typescript
import { Users, Target, FileText, BarChart3, Check, Lock, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONS = {
  Users,
  Target,
  FileText,
  BarChart3,
} as const;

type IconName = keyof typeof ICONS;

export type StageStatus = "not_started" | "in_progress" | "complete" | "not_defined" | "locked";

interface StageCardProps {
  title: string;
  description: string;
  icon: IconName;
  status: StageStatus;
  progressText?: string;
  onClick?: () => void;
}

const STATUS_CONFIG: Record<
  StageStatus,
  {
    badge: React.ReactNode;
    buttonLabel: string | null;
    buttonVariant: "default" | "secondary" | "outline";
    opacity: string;
  }
> = {
  not_started: {
    badge: <Circle className="w-4 h-4 text-gray-300" />,
    buttonLabel: "Start",
    buttonVariant: "default",
    opacity: "opacity-100",
  },
  in_progress: {
    badge: <Circle className="w-4 h-4 text-blue-500 fill-blue-500" />,
    buttonLabel: "Continue",
    buttonVariant: "default",
    opacity: "opacity-100",
  },
  complete: {
    badge: <Check className="w-4 h-4 text-green-600" />,
    buttonLabel: "View",
    buttonVariant: "secondary",
    opacity: "opacity-100",
  },
  not_defined: {
    badge: <Circle className="w-4 h-4 text-gray-300" />,
    buttonLabel: "Define",
    buttonVariant: "default",
    opacity: "opacity-100",
  },
  locked: {
    badge: <Lock className="w-4 h-4 text-gray-300" />,
    buttonLabel: null,
    buttonVariant: "outline",
    opacity: "opacity-40",
  },
};

export function StageCard({
  title,
  description,
  icon,
  status,
  progressText,
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
        {config.badge}
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

### Step 4: Run tests to verify they pass

Run: `npm test -- src/components/home/StageCard.test.tsx`
Expected: All 9 tests PASS

### Step 5: Commit

```bash
git add src/components/home/StageCard.tsx src/components/home/StageCard.test.tsx
git commit -m "feat: add StageCard component for foundation progress"
```

---

## Task 3: MeasurementFoundationCard Component

**Files:**
- Create: `src/components/home/MeasurementFoundationCard.tsx`
- Test: `src/components/home/MeasurementFoundationCard.test.tsx`

### Step 1: Write failing test for MeasurementFoundationCard

Create `src/components/home/MeasurementFoundationCard.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MeasurementFoundationCard } from "./MeasurementFoundationCard";
import { MemoryRouter } from "react-router-dom";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

type FoundationStatus = Parameters<typeof MeasurementFoundationCard>[0]["status"];

function setup(status: Partial<FoundationStatus> = {}) {
  const user = userEvent.setup();
  const defaultStatus: FoundationStatus = {
    overviewInterview: { status: "not_started", journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
    firstValue: { status: "not_defined", journeyId: null },
    measurementPlan: { status: "locked" },
    metricCatalog: { status: "locked" },
    ...status,
  };
  render(
    <MemoryRouter>
      <MeasurementFoundationCard status={defaultStatus} />
    </MemoryRouter>
  );
  return { user };
}

test("renders header with Measurement Foundation title", () => {
  setup();

  expect(screen.getByText("Measurement Foundation")).toBeInTheDocument();
});

test("renders all four stage cards", () => {
  setup();

  expect(screen.getByText("Overview Interview")).toBeInTheDocument();
  expect(screen.getByText("First Value")).toBeInTheDocument();
  expect(screen.getByText("Measurement Plan")).toBeInTheDocument();
  expect(screen.getByText("Metric Catalog")).toBeInTheDocument();
});

test("shows Start button for not_started overview", () => {
  setup({
    overviewInterview: { status: "not_started", journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
  });

  const startButtons = screen.getAllByRole("button", { name: /start/i });
  expect(startButtons.length).toBeGreaterThanOrEqual(1);
});

test("shows progress text for in_progress overview", () => {
  setup({
    overviewInterview: { status: "in_progress", journeyId: null, slotsCompleted: 2, slotsTotal: 5 },
  });

  expect(screen.getByText("2 of 5 lifecycle slots")).toBeInTheDocument();
});

test("navigates to setup interview when clicking Start on overview", async () => {
  const { user } = setup({
    overviewInterview: { status: "not_started", journeyId: null, slotsCompleted: 0, slotsTotal: 5 },
  });

  // Find the Start button in the Overview Interview card
  const overviewCard = screen.getByText("Overview Interview").closest("div")?.parentElement;
  const startButton = overviewCard?.querySelector("button");

  if (startButton) {
    await user.click(startButton);
    expect(mockNavigate).toHaveBeenCalledWith("/setup/interview");
  }
});

test("navigates to journey when clicking View on complete overview", async () => {
  const { user } = setup({
    overviewInterview: { status: "complete", journeyId: "journey123" as any, slotsCompleted: 5, slotsTotal: 5 },
  });

  const viewButton = screen.getByRole("button", { name: /view/i });
  await user.click(viewButton);

  expect(mockNavigate).toHaveBeenCalledWith("/journeys/journey123");
});

test("shows Coming soon for locked stages", () => {
  setup();

  const comingSoonTexts = screen.getAllByText(/coming soon/i);
  expect(comingSoonTexts).toHaveLength(2); // Measurement Plan + Metric Catalog
});
```

### Step 2: Run test to verify it fails

Run: `npm test -- src/components/home/MeasurementFoundationCard.test.tsx`
Expected: FAIL - Cannot find module './MeasurementFoundationCard'

### Step 3: Implement MeasurementFoundationCard component

Create `src/components/home/MeasurementFoundationCard.tsx`:

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
  metricCatalog: { status: "locked" };
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

  // Map overview status to StageStatus
  const overviewStageStatus: StageStatus = status.overviewInterview.status;

  // Map firstValue status to StageStatus
  const firstValueStageStatus: StageStatus = status.firstValue.status;

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
          status="locked"
        />
      </div>
    </div>
  );
}
```

### Step 4: Run tests to verify they pass

Run: `npm test -- src/components/home/MeasurementFoundationCard.test.tsx`
Expected: All 7 tests PASS

### Step 5: Commit

```bash
git add src/components/home/MeasurementFoundationCard.tsx src/components/home/MeasurementFoundationCard.test.tsx
git commit -m "feat: add MeasurementFoundationCard component"
```

---

## Task 4: Integrate into HomePage

**Files:**
- Modify: `src/routes/HomePage.tsx`
- Delete: `src/components/home/JourneyRoadmap.tsx`

### Step 1: Update HomePage to use new component

Modify `src/routes/HomePage.tsx`:

Replace entire file with:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProductProfileCard } from "../components/home/ProductProfileCard";
import { MeasurementFoundationCard } from "../components/home/MeasurementFoundationCard";

export default function HomePage() {
  const user = useQuery(api.users.current);
  const foundationStatus = useQuery(api.setupProgress.foundationStatus);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Product Profile Card */}
      <ProductProfileCard
        productName={user.productName ?? "Your Product"}
        role={user.role ?? "Product Manager"}
        hasMultiUserAccounts={user.hasMultiUserAccounts}
        businessType={user.businessType}
        revenueModels={user.revenueModels}
      />

      {/* Measurement Foundation Card */}
      {foundationStatus && (
        <MeasurementFoundationCard status={foundationStatus} />
      )}
    </div>
  );
}
```

### Step 2: Run the app and verify it works

Run: `npm run dev`
Expected: Homepage shows ProductProfileCard and MeasurementFoundationCard with 2x2 grid

### Step 3: Delete JourneyRoadmap

```bash
rm src/components/home/JourneyRoadmap.tsx
```

### Step 4: Run all tests to ensure nothing broke

Run: `npm test`
Expected: All tests pass (JourneyRoadmap had no tests)

### Step 5: Commit

```bash
git add src/routes/HomePage.tsx
git rm src/components/home/JourneyRoadmap.tsx
git commit -m "feat: replace JourneyRoadmap with MeasurementFoundationCard on homepage"
```

---

## Task 5: Final verification

### Step 1: Run full test suite

Run: `npm test`
Expected: All tests pass

### Step 2: Run build

Run: `npm run build`
Expected: Build succeeds with no errors

### Step 3: Run lint

Run: `npm run lint`
Expected: No lint errors

### Step 4: Manual testing checklist

Test these scenarios in the browser:

1. **New user (no setup)**: All stages show appropriate initial states
2. **User in setup**: Overview Interview shows "Continue" with slot progress
3. **Completed setup**: Overview Interview shows "View", First Value shows "Define"
4. **With first_value journey**: First Value shows "View"
5. **Click navigation**: Each button navigates to correct route

### Step 5: Final commit (if any fixes needed)

```bash
git add .
git commit -m "fix: address review feedback"
```
