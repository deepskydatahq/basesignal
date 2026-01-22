# Activity Timeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible "Recent Activity" section to ProfilePage showing profile evolution (profile created, interviews completed, stages added).

**Architecture:** Create a `getRecentActivity` query that derives activity from existing timestamps across `users`, `interviewSessions`, and `stages` tables. Build a simple `ActivityTimeline` component using the existing Collapsible UI primitive. Integrate into ProfilePage after other sections.

**Tech Stack:** Convex queries, React, Radix UI Collapsible, Tailwind CSS

---

## Summary

| Files to Create | Files to Modify |
|-----------------|-----------------|
| `convex/activity.ts` | `src/components/profile/ProfilePage.tsx` |
| `convex/activity.test.ts` | |
| `src/components/profile/ActivityTimeline.tsx` | |
| `src/components/profile/ActivityTimeline.test.tsx` | |

---

## Task 1: Create getRecentActivity Query

**Files:**
- Create: `convex/activity.ts`
- Test: `convex/activity.test.ts`

**Step 1: Write the failing test**

Create `convex/activity.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("getRecentActivity", () => {
  it("returns empty array when user has no activity", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const activities = await t.query(
      api.activity.getRecentActivity,
      {},
      { identity: { subject: "test-user" } }
    );

    expect(activities).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/activity.test.ts`
Expected: FAIL with "Cannot find module" or similar

**Step 3: Write minimal implementation**

Create `convex/activity.ts`:

```typescript
import { query } from "./_generated/server";

export const getRecentActivity = query({
  args: {},
  handler: async () => {
    return [];
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/activity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/activity.ts convex/activity.test.ts
git commit -m "$(cat <<'EOF'
feat(activity): scaffold getRecentActivity query

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Profile Created Activity

**Files:**
- Modify: `convex/activity.ts`
- Modify: `convex/activity.test.ts`

**Step 1: Write the failing test**

Add to `convex/activity.test.ts`:

```typescript
it("returns profile_created activity from user createdAt", async () => {
  const t = convexTest(schema);
  const now = Date.now();

  await t.run(async (ctx) => {
    await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: now,
    });
  });

  const activities = await t.query(
    api.activity.getRecentActivity,
    {},
    { identity: { subject: "test-user" } }
  );

  expect(activities).toHaveLength(1);
  expect(activities[0]).toMatchObject({
    type: "profile_created",
    description: "Created product profile",
  });
  expect(activities[0].timestamp).toBe(now);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/activity.test.ts`
Expected: FAIL - activities is empty

**Step 3: Write minimal implementation**

Update `convex/activity.ts`:

```typescript
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";

async function getCurrentUser(ctx: QueryCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();
}

export interface Activity {
  type: "profile_created" | "interview_completed" | "stage_added";
  timestamp: number;
  description: string;
}

export const getRecentActivity = query({
  args: {},
  handler: async (ctx): Promise<Activity[]> => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const activities: Activity[] = [];

    // Profile created
    if (user.createdAt) {
      activities.push({
        type: "profile_created",
        timestamp: user.createdAt,
        description: "Created product profile",
      });
    }

    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/activity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/activity.ts convex/activity.test.ts
git commit -m "$(cat <<'EOF'
feat(activity): add profile_created activity type

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Interview Completed Activity

**Files:**
- Modify: `convex/activity.ts`
- Modify: `convex/activity.test.ts`

**Step 1: Write the failing test**

Add to `convex/activity.test.ts`:

```typescript
it("returns interview_completed activities from completed sessions", async () => {
  const t = convexTest(schema);
  const now = Date.now();
  const hourAgo = now - 3600000;

  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: hourAgo - 1000,
    });

    const journeyId = await ctx.db.insert("journeys", {
      userId,
      type: "overview",
      name: "Overview Journey",
      isDefault: true,
      createdAt: hourAgo,
      updatedAt: hourAgo,
    });

    await ctx.db.insert("interviewSessions", {
      journeyId,
      interviewType: "first_value",
      status: "completed",
      startedAt: hourAgo,
      completedAt: now,
    });
  });

  const activities = await t.query(
    api.activity.getRecentActivity,
    {},
    { identity: { subject: "test-user" } }
  );

  expect(activities).toHaveLength(2);
  expect(activities[0]).toMatchObject({
    type: "interview_completed",
    timestamp: now,
    description: "Completed first_value interview",
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/activity.test.ts`
Expected: FAIL - only 1 activity (profile_created)

**Step 3: Write minimal implementation**

Update `convex/activity.ts` handler:

```typescript
export const getRecentActivity = query({
  args: {},
  handler: async (ctx): Promise<Activity[]> => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const activities: Activity[] = [];

    // Profile created
    if (user.createdAt) {
      activities.push({
        type: "profile_created",
        timestamp: user.createdAt,
        description: "Created product profile",
      });
    }

    // Get user's journeys to find interview sessions
    const journeys = await ctx.db
      .query("journeys")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Interview completed
    for (const journey of journeys) {
      const sessions = await ctx.db
        .query("interviewSessions")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      for (const session of sessions) {
        if (session.status === "completed" && session.completedAt) {
          activities.push({
            type: "interview_completed",
            timestamp: session.completedAt,
            description: `Completed ${session.interviewType ?? "overview"} interview`,
          });
        }
      }
    }

    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5);
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/activity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/activity.ts convex/activity.test.ts
git commit -m "$(cat <<'EOF'
feat(activity): add interview_completed activity type

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add Stage Added Activity

**Files:**
- Modify: `convex/activity.ts`
- Modify: `convex/activity.test.ts`

**Step 1: Write the failing test**

Add to `convex/activity.test.ts`:

```typescript
it("returns stage_added activities from stages", async () => {
  const t = convexTest(schema);
  const now = Date.now();
  const hourAgo = now - 3600000;

  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: hourAgo - 1000,
    });

    const journeyId = await ctx.db.insert("journeys", {
      userId,
      type: "overview",
      name: "Overview Journey",
      isDefault: true,
      createdAt: hourAgo,
      updatedAt: hourAgo,
    });

    await ctx.db.insert("stages", {
      journeyId,
      name: "Account Created",
      type: "activity",
      position: { x: 0, y: 0 },
      createdAt: now,
      updatedAt: now,
    });
  });

  const activities = await t.query(
    api.activity.getRecentActivity,
    {},
    { identity: { subject: "test-user" } }
  );

  expect(activities).toHaveLength(2);
  expect(activities[0]).toMatchObject({
    type: "stage_added",
    timestamp: now,
    description: "Added Account Created stage",
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- convex/activity.test.ts`
Expected: FAIL - only 1 activity (profile_created)

**Step 3: Write minimal implementation**

Update `convex/activity.ts` handler to add after interview section:

```typescript
    // Stage added
    for (const journey of journeys) {
      const stages = await ctx.db
        .query("stages")
        .withIndex("by_journey", (q) => q.eq("journeyId", journey._id))
        .collect();

      for (const stage of stages) {
        activities.push({
          type: "stage_added",
          timestamp: stage.createdAt,
          description: `Added ${stage.name} stage`,
        });
      }
    }
```

**Step 4: Run test to verify it passes**

Run: `npm test -- convex/activity.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/activity.ts convex/activity.test.ts
git commit -m "$(cat <<'EOF'
feat(activity): add stage_added activity type

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Test Activity Sorting and Limit

**Files:**
- Modify: `convex/activity.test.ts`

**Step 1: Write the test**

Add to `convex/activity.test.ts`:

```typescript
it("returns activities sorted by timestamp descending, limited to 5", async () => {
  const t = convexTest(schema);
  const now = Date.now();

  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkId: "test-user",
      email: "test@example.com",
      createdAt: now - 6000, // oldest, should be excluded
    });

    const journeyId = await ctx.db.insert("journeys", {
      userId,
      type: "overview",
      name: "Overview Journey",
      isDefault: true,
      createdAt: now - 5000,
      updatedAt: now - 5000,
    });

    // Add 6 stages to test the limit
    for (let i = 0; i < 6; i++) {
      await ctx.db.insert("stages", {
        journeyId,
        name: `Stage ${i + 1}`,
        type: "activity",
        position: { x: 0, y: i * 100 },
        createdAt: now - (5 - i) * 1000, // Stage 6 is newest
        updatedAt: now - (5 - i) * 1000,
      });
    }
  });

  const activities = await t.query(
    api.activity.getRecentActivity,
    {},
    { identity: { subject: "test-user" } }
  );

  expect(activities).toHaveLength(5);
  expect(activities[0].description).toBe("Added Stage 6 stage");
  expect(activities[4].description).toBe("Added Stage 2 stage");
});
```

**Step 2: Run test to verify it passes**

Run: `npm test -- convex/activity.test.ts`
Expected: PASS (implementation already handles this)

**Step 3: Commit**

```bash
git add convex/activity.test.ts
git commit -m "$(cat <<'EOF'
test(activity): verify sorting and 5-item limit

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create ActivityTimeline Component

**Files:**
- Create: `src/components/profile/ActivityTimeline.tsx`
- Create: `src/components/profile/ActivityTimeline.test.tsx`

**Step 1: Write the failing test**

Create `src/components/profile/ActivityTimeline.test.tsx`:

```typescript
import { expect, test, vi, describe, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityTimeline } from "./ActivityTimeline";

let mockActivities: unknown[] | undefined = undefined;

vi.mock("convex/react", () => ({
  useQuery: () => mockActivities,
}));

function setup() {
  render(<ActivityTimeline />);
}

beforeEach(() => {
  mockActivities = undefined;
});

describe("ActivityTimeline", () => {
  test("renders nothing when no activities", () => {
    mockActivities = [];
    setup();

    expect(screen.queryByText("Recent Activity")).not.toBeInTheDocument();
  });

  test("renders timeline with activities", () => {
    mockActivities = [
      { type: "profile_created", timestamp: Date.now(), description: "Created product profile" },
    ];
    setup();

    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    expect(screen.getByText("Created product profile")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ActivityTimeline.test.tsx`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/components/profile/ActivityTimeline.tsx`:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function ActivityTimeline() {
  const activities = useQuery(api.activity.getRecentActivity);

  if (!activities?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
      <ul className="space-y-3">
        {activities.map((activity, i) => (
          <li key={i} className="text-sm text-gray-700">
            {activity.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/ActivityTimeline.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ActivityTimeline.tsx src/components/profile/ActivityTimeline.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): scaffold ActivityTimeline component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add Timestamp Display to ActivityTimeline

**Files:**
- Modify: `src/components/profile/ActivityTimeline.tsx`
- Modify: `src/components/profile/ActivityTimeline.test.tsx`

**Step 1: Write the failing test**

Add to `ActivityTimeline.test.tsx`:

```typescript
test("displays formatted timestamp for each activity", () => {
  const jan15 = new Date("2026-01-15T14:30:00").getTime();
  mockActivities = [
    { type: "profile_created", timestamp: jan15, description: "Created product profile" },
  ];
  setup();

  expect(screen.getByText("Jan 15, 2026")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ActivityTimeline.test.tsx`
Expected: FAIL - no date displayed

**Step 3: Write minimal implementation**

Update `src/components/profile/ActivityTimeline.tsx`:

```typescript
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ActivityTimeline() {
  const activities = useQuery(api.activity.getRecentActivity);

  if (!activities?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
      <ul className="space-y-3">
        {activities.map((activity, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="text-gray-400 shrink-0">{formatDate(activity.timestamp)}</span>
            <span className="text-gray-700">{activity.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/ActivityTimeline.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ActivityTimeline.tsx src/components/profile/ActivityTimeline.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add timestamp display to ActivityTimeline

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Add Collapsible Behavior to ActivityTimeline

**Files:**
- Modify: `src/components/profile/ActivityTimeline.tsx`
- Modify: `src/components/profile/ActivityTimeline.test.tsx`

**Step 1: Write the failing test**

Add to `ActivityTimeline.test.tsx`:

```typescript
import userEvent from "@testing-library/user-event";

// Update setup function
function setup() {
  const user = userEvent.setup();
  render(<ActivityTimeline />);
  return { user };
}

test("is collapsed by default, shows content when expanded", async () => {
  mockActivities = [
    { type: "profile_created", timestamp: Date.now(), description: "Created product profile" },
  ];
  const { user } = setup();

  // Title visible, content hidden
  expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  expect(screen.queryByText("Created product profile")).not.toBeInTheDocument();

  // Click to expand
  await user.click(screen.getByRole("button", { name: /recent activity/i }));

  // Content now visible
  expect(screen.getByText("Created product profile")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ActivityTimeline.test.tsx`
Expected: FAIL - content always visible

**Step 3: Write minimal implementation**

Update `src/components/profile/ActivityTimeline.tsx`:

```typescript
import { useState } from "react";
import { useQuery } from "convex/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ActivityTimeline() {
  const [isOpen, setIsOpen] = useState(false);
  const activities = useQuery(api.activity.getRecentActivity);

  if (!activities?.length) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full text-left">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="mt-4 space-y-3">
            {activities.map((activity, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="text-gray-400 shrink-0">{formatDate(activity.timestamp)}</span>
                <span className="text-gray-700">{activity.description}</span>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/ActivityTimeline.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ActivityTimeline.tsx src/components/profile/ActivityTimeline.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): add collapsible behavior to ActivityTimeline

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Integrate ActivityTimeline into ProfilePage

**Files:**
- Modify: `src/components/profile/ProfilePage.tsx`
- Modify: `src/components/profile/ProfilePage.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/profile/ProfilePage.test.tsx`:

```typescript
test("renders ActivityTimeline section", async () => {
  // Mock profile data is already set up in this test file
  render(<ProfilePage />);

  await waitFor(() => {
    expect(screen.getByText("Recent Activity")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: FAIL - "Recent Activity" not found

**Step 3: Write minimal implementation**

Update `src/components/profile/ProfilePage.tsx`:

Add import at top:
```typescript
import { ActivityTimeline } from "./ActivityTimeline";
```

Add component after `<MeasurementPlanSection>` (around line 97):
```typescript
        <MeasurementPlanSection plan={measurementPlan ?? []} />

        <ActivityTimeline />
      </div>
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/profile/ProfilePage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/profile/ProfilePage.tsx src/components/profile/ProfilePage.test.tsx
git commit -m "$(cat <<'EOF'
feat(profile): integrate ActivityTimeline into ProfilePage

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Run Full Test Suite

**Files:** None (verification only)

**Step 1: Run full test suite**

Run: `npm test -- --run`
Expected: All tests PASS

**Step 2: Verify no linting errors**

Run: `npm run lint`
Expected: No errors

**Step 3: Commit any fixes if needed**

If there are issues, fix and commit:

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: address lint and test issues

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Manual Verification

**Steps:**

1. Start dev server: `npm run dev` + `npx convex dev`
2. Navigate to profile page
3. Verify "Recent Activity" section appears (collapsed)
4. Click to expand and verify activities are shown
5. Verify timestamps and descriptions display correctly

---

## Summary

| Task | Description | Type |
|------|-------------|------|
| 1 | Scaffold getRecentActivity query | Backend |
| 2 | Add profile_created activity | Backend |
| 3 | Add interview_completed activity | Backend |
| 4 | Add stage_added activity | Backend |
| 5 | Test sorting and limit | Backend |
| 6 | Scaffold ActivityTimeline component | Frontend |
| 7 | Add timestamp display | Frontend |
| 8 | Add collapsible behavior | Frontend |
| 9 | Integrate into ProfilePage | Integration |
| 10 | Run full test suite | Verification |
| 11 | Manual verification | Verification |

**Total:** 11 TDD tasks
