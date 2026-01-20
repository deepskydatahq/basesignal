# First Value: Dashboard Display & Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add First Value Definition card to the dashboard with view, edit, and refine capabilities.

**Architecture:** Create a new `firstValueDefinitions` table in Convex schema, add backend queries/mutations in `convex/firstValue.ts`, and build frontend components (`FirstValueDefinitionCard.tsx`, `EditFirstValueModal.tsx`). Integrate with homepage and existing interview flow.

**Tech Stack:** Convex (backend), React 19, TypeScript, Tailwind CSS, Radix Dialog

---

## Prerequisites

This issue depends on #33 (Follow-up Questions) which adds the `firstValueDefinitions` table to the schema. The schema should already include:

```typescript
firstValueDefinitions: defineTable({
  userId: v.id("users"),
  activityId: v.optional(v.id("measurementActivities")),
  activityName: v.string(),
  reasoning: v.string(),
  expectedTimeframe: v.string(),
  successCriteria: v.optional(v.string()),
  additionalContext: v.optional(v.string()),
  confirmedAt: v.number(),
  source: v.string(), // "interview" | "manual_edit"
})
  .index("by_user", ["userId"])
```

If #33 is not complete, first add the schema as Task 1.

---

## Task 1: Add firstValueDefinitions Schema (skip if #33 done)

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Write the failing test**

Create test file `convex/firstValue.test.ts`:

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import schema from "./schema";

describe("firstValueDefinitions schema", () => {
  it("allows inserting a first value definition", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user",
        email: "test@example.com",
        createdAt: Date.now(),
      });
    });

    const definitionId = await t.run(async (ctx) => {
      return await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Project Published",
        reasoning: "Users see their work live for the first time",
        expectedTimeframe: "Within first session",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    expect(definitionId).toBeDefined();

    const definition = await t.run(async (ctx) => {
      return await ctx.db.get(definitionId);
    });

    expect(definition?.activityName).toBe("Project Published");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - "firstValueDefinitions" table not found

**Step 3: Write minimal implementation**

Add to `convex/schema.ts` (after `interviewMessages` table):

```typescript
firstValueDefinitions: defineTable({
  userId: v.id("users"),
  activityId: v.optional(v.id("measurementActivities")),
  activityName: v.string(),
  reasoning: v.string(),
  expectedTimeframe: v.string(),
  successCriteria: v.optional(v.string()),
  additionalContext: v.optional(v.string()),
  confirmedAt: v.number(),
  source: v.string(),
})
  .index("by_user", ["userId"]),
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/schema.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add firstValueDefinitions table

Stores First Value definition with activity, reasoning, timeframe,
and success criteria. Supports both interview-derived and manual entries.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Backend - getDefinition Query

**Files:**
- Create: `convex/firstValue.ts`
- Test: `convex/firstValue.test.ts`

**Step 1: Write the failing test**

Add to `convex/firstValue.test.ts`:

```typescript
import { api } from "./_generated/api";

// Helper to set up authenticated user
async function setupUser(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: "test-user-fv",
      email: "fv-test@example.com",
      createdAt: Date.now(),
    });
  });

  const asUser = t.withIdentity({
    subject: "test-user-fv",
    issuer: "https://clerk.test",
    tokenIdentifier: "https://clerk.test|test-user-fv",
  });

  return { userId, asUser };
}

describe("firstValue.getDefinition", () => {
  it("returns null when no definition exists", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const definition = await asUser.query(api.firstValue.getDefinition, {});

    expect(definition).toBeNull();
  });

  it("returns the definition when it exists", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create definition directly in db
    await t.run(async (ctx) => {
      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Project Published",
        reasoning: "Users see their work live",
        expectedTimeframe: "Within first session",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    const definition = await asUser.query(api.firstValue.getDefinition, {});

    expect(definition).not.toBeNull();
    expect(definition?.activityName).toBe("Project Published");
    expect(definition?.reasoning).toBe("Users see their work live");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - api.firstValue.getDefinition not found

**Step 3: Write minimal implementation**

Create `convex/firstValue.ts`:

```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// Helper to get current authenticated user
async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

// Get the First Value definition for current user
export const getDefinition = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;

    const definition = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    return definition;
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/firstValue.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(firstValue): add getDefinition query

Returns the First Value definition for the current authenticated user,
or null if no definition exists.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Backend - updateDefinition Mutation

**Files:**
- Modify: `convex/firstValue.ts`
- Test: `convex/firstValue.test.ts`

**Step 1: Write the failing test**

Add to `convex/firstValue.test.ts`:

```typescript
describe("firstValue.updateDefinition", () => {
  it("updates existing definition and sets source to manual_edit", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create initial definition
    await t.run(async (ctx) => {
      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Project Published",
        reasoning: "Original reasoning",
        expectedTimeframe: "Within first session",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    await asUser.mutation(api.firstValue.updateDefinition, {
      activityName: "Report Generated",
      reasoning: "Updated reasoning",
      expectedTimeframe: "Within 24 hours",
      successCriteria: "User exports data",
    });

    const definition = await asUser.query(api.firstValue.getDefinition, {});

    expect(definition?.activityName).toBe("Report Generated");
    expect(definition?.reasoning).toBe("Updated reasoning");
    expect(definition?.expectedTimeframe).toBe("Within 24 hours");
    expect(definition?.successCriteria).toBe("User exports data");
    expect(definition?.source).toBe("manual_edit");
  });

  it("creates definition if none exists", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    await asUser.mutation(api.firstValue.updateDefinition, {
      activityName: "Project Published",
      reasoning: "Users see their work live",
      expectedTimeframe: "Within first session",
    });

    const definition = await asUser.query(api.firstValue.getDefinition, {});

    expect(definition).not.toBeNull();
    expect(definition?.activityName).toBe("Project Published");
    expect(definition?.source).toBe("manual_edit");
  });

  it("throws error for unauthenticated users", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.firstValue.updateDefinition, {
        activityName: "Project Published",
        reasoning: "Test",
        expectedTimeframe: "Test",
      })
    ).rejects.toThrow(/Not authenticated/i);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - api.firstValue.updateDefinition not found

**Step 3: Write minimal implementation**

Add to `convex/firstValue.ts`:

```typescript
// Update (or create) the First Value definition
export const updateDefinition = mutation({
  args: {
    activityId: v.optional(v.id("measurementActivities")),
    activityName: v.string(),
    reasoning: v.string(),
    expectedTimeframe: v.string(),
    successCriteria: v.optional(v.string()),
    additionalContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("firstValueDefinitions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    const now = Date.now();

    if (existing) {
      // Update existing definition
      await ctx.db.patch(existing._id, {
        activityId: args.activityId,
        activityName: args.activityName,
        reasoning: args.reasoning,
        expectedTimeframe: args.expectedTimeframe,
        successCriteria: args.successCriteria,
        additionalContext: args.additionalContext,
        source: "manual_edit",
        confirmedAt: now,
      });
      return existing._id;
    } else {
      // Create new definition
      return await ctx.db.insert("firstValueDefinitions", {
        userId: user._id,
        activityId: args.activityId,
        activityName: args.activityName,
        reasoning: args.reasoning,
        expectedTimeframe: args.expectedTimeframe,
        successCriteria: args.successCriteria,
        additionalContext: args.additionalContext,
        source: "manual_edit",
        confirmedAt: now,
      });
    }
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/firstValue.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(firstValue): add updateDefinition mutation

Allows users to manually edit their First Value definition.
Updates source to "manual_edit" and refreshes confirmedAt timestamp.
Creates new definition if none exists.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Backend - listActivities Query for Dropdown

**Files:**
- Modify: `convex/firstValue.ts`
- Test: `convex/firstValue.test.ts`

**Step 1: Write the failing test**

Add to `convex/firstValue.test.ts`:

```typescript
describe("firstValue.listActivities", () => {
  it("returns activities for dropdown selection", async () => {
    const t = convexTest(schema);
    const { userId, asUser } = await setupUser(t);

    // Create entity and activities
    const entityId = await t.run(async (ctx) => {
      return await ctx.db.insert("measurementEntities", {
        userId,
        name: "Project",
        createdAt: Date.now(),
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Created",
        action: "Created",
        isFirstValue: false,
        createdAt: Date.now(),
      });
      await ctx.db.insert("measurementActivities", {
        userId,
        entityId,
        name: "Project Published",
        action: "Published",
        isFirstValue: true,
        createdAt: Date.now(),
      });
    });

    const activities = await asUser.query(api.firstValue.listActivities, {});

    expect(activities).toHaveLength(2);
    expect(activities.map((a) => a.name).sort()).toEqual([
      "Project Created",
      "Project Published",
    ]);
  });

  it("returns empty array when no activities exist", async () => {
    const t = convexTest(schema);
    const { asUser } = await setupUser(t);

    const activities = await asUser.query(api.firstValue.listActivities, {});

    expect(activities).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: FAIL - api.firstValue.listActivities not found

**Step 3: Write minimal implementation**

Add to `convex/firstValue.ts`:

```typescript
// List all activities for dropdown selection
export const listActivities = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];

    const activities = await ctx.db
      .query("measurementActivities")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return activities.map((a) => ({
      _id: a._id,
      name: a.name,
      isFirstValue: a.isFirstValue,
    }));
  },
});
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/firstValue.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/firstValue.ts convex/firstValue.test.ts
git commit -m "$(cat <<'EOF'
feat(firstValue): add listActivities query

Returns simplified activity list for dropdown selection in edit modal.
Includes id, name, and isFirstValue flag.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Frontend - FirstValueDefinitionCard Component (Empty State)

**Files:**
- Create: `src/components/home/FirstValueDefinitionCard.tsx`
- Test: `src/components/home/FirstValueDefinitionCard.test.tsx`

**Step 1: Write the failing test**

Create `src/components/home/FirstValueDefinitionCard.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FirstValueDefinitionCard } from "./FirstValueDefinitionCard";

// Mock navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

function setup(props: Partial<Parameters<typeof FirstValueDefinitionCard>[0]> = {}) {
  const user = userEvent.setup();
  const defaultProps = {
    definition: null,
    onEdit: vi.fn(),
    ...props,
  };
  render(<FirstValueDefinitionCard {...defaultProps} />);
  return { user, onEdit: defaultProps.onEdit };
}

test("renders empty state when no definition", () => {
  setup({ definition: null });

  expect(screen.getByText("First Value Moment")).toBeInTheDocument();
  expect(screen.getByText("Not yet defined")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /define first value/i })).toBeInTheDocument();
});

test("clicking Define First Value navigates to interview", async () => {
  const { user } = setup({ definition: null });

  await user.click(screen.getByRole("button", { name: /define first value/i }));

  expect(mockNavigate).toHaveBeenCalledWith("/interviews/first_value");
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/home/FirstValueDefinitionCard.test.tsx`
Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `src/components/home/FirstValueDefinitionCard.tsx`:

```typescript
import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FirstValueDefinition {
  _id: string;
  activityName: string;
  reasoning: string;
  expectedTimeframe: string;
  successCriteria?: string;
  confirmedAt: number;
  source: string;
}

interface FirstValueDefinitionCardProps {
  definition: FirstValueDefinition | null;
  onEdit: () => void;
}

export function FirstValueDefinitionCard({
  definition,
  onEdit,
}: FirstValueDefinitionCardProps) {
  const navigate = useNavigate();

  if (!definition) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-gray-400" />
            First Value Moment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">Not yet defined</p>
          <Button onClick={() => navigate("/interviews/first_value")}>
            Define First Value
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Definition exists - render display (Task 6)
  return null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/home/FirstValueDefinitionCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/home/FirstValueDefinitionCard.tsx src/components/home/FirstValueDefinitionCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(FirstValueDefinitionCard): add empty state

Shows "Not yet defined" with button to start First Value interview
when user has no definition saved.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Frontend - FirstValueDefinitionCard Display State

**Files:**
- Modify: `src/components/home/FirstValueDefinitionCard.tsx`
- Test: `src/components/home/FirstValueDefinitionCard.test.tsx`

**Step 1: Write the failing test**

Add to `src/components/home/FirstValueDefinitionCard.test.tsx`:

```typescript
const mockDefinition = {
  _id: "def-123",
  activityName: "Project Published",
  reasoning: "Users see their work live for the first time",
  expectedTimeframe: "Within first session",
  successCriteria: "User shares published link",
  confirmedAt: 1704067200000, // Jan 1, 2024
  source: "interview",
};

test("renders definition when provided", () => {
  setup({ definition: mockDefinition });

  expect(screen.getByText("Project Published")).toBeInTheDocument();
  expect(screen.getByText("Users see their work live for the first time")).toBeInTheDocument();
  expect(screen.getByText(/within first session/i)).toBeInTheDocument();
  expect(screen.getByText(/user shares published link/i)).toBeInTheDocument();
});

test("shows Edit button when definition exists", () => {
  setup({ definition: mockDefinition });

  expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
});

test("shows Refine button when definition exists", () => {
  setup({ definition: mockDefinition });

  expect(screen.getByRole("button", { name: /refine/i })).toBeInTheDocument();
});

test("clicking Edit calls onEdit", async () => {
  const onEdit = vi.fn();
  const { user } = setup({ definition: mockDefinition, onEdit });

  await user.click(screen.getByRole("button", { name: /edit/i }));

  expect(onEdit).toHaveBeenCalled();
});

test("clicking Refine navigates to interview", async () => {
  const { user } = setup({ definition: mockDefinition });

  await user.click(screen.getByRole("button", { name: /refine/i }));

  expect(mockNavigate).toHaveBeenCalledWith("/interviews/first_value");
});

test("displays source badge for interview-derived definitions", () => {
  setup({ definition: mockDefinition });

  expect(screen.getByText(/interview/i)).toBeInTheDocument();
});

test("displays source badge for manually edited definitions", () => {
  setup({ definition: { ...mockDefinition, source: "manual_edit" } });

  expect(screen.getByText(/manual/i)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/home/FirstValueDefinitionCard.test.tsx`
Expected: FAIL - definition content not rendered

**Step 3: Write minimal implementation**

Update `src/components/home/FirstValueDefinitionCard.tsx`:

```typescript
import { useNavigate } from "react-router-dom";
import { Star, Pencil, RefreshCw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface FirstValueDefinition {
  _id: string;
  activityName: string;
  reasoning: string;
  expectedTimeframe: string;
  successCriteria?: string;
  confirmedAt: number;
  source: string;
}

interface FirstValueDefinitionCardProps {
  definition: FirstValueDefinition | null;
  onEdit: () => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FirstValueDefinitionCard({
  definition,
  onEdit,
}: FirstValueDefinitionCardProps) {
  const navigate = useNavigate();

  if (!definition) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-gray-400" />
            First Value Moment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">Not yet defined</p>
          <Button onClick={() => navigate("/interviews/first_value")}>
            Define First Value
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleRefine = () => {
    navigate("/interviews/first_value");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          First Value Moment
        </CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Edit">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleRefine} aria-label="Refine">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Activity Name */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">
              {definition.activityName}
            </span>
          </div>

          {/* Reasoning */}
          <p className="text-sm text-gray-600">{definition.reasoning}</p>

          {/* Details */}
          <div className="text-sm space-y-1">
            <p>
              <span className="text-gray-500">Timeframe:</span>{" "}
              <span className="text-gray-700">{definition.expectedTimeframe}</span>
            </p>
            {definition.successCriteria && (
              <p>
                <span className="text-gray-500">Success:</span>{" "}
                <span className="text-gray-700">{definition.successCriteria}</span>
              </p>
            )}
          </div>

          {/* Source & Date */}
          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline" className="text-xs">
              {definition.source === "interview" ? "Interview" : "Manual"}
            </Badge>
            <span className="text-xs text-gray-400">
              {formatDate(definition.confirmedAt)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/home/FirstValueDefinitionCard.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/home/FirstValueDefinitionCard.tsx src/components/home/FirstValueDefinitionCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(FirstValueDefinitionCard): add definition display

Shows activity name, reasoning, timeframe, and success criteria.
Includes Edit and Refine buttons with source badge and date.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend - EditFirstValueModal Component

**Files:**
- Create: `src/components/home/EditFirstValueModal.tsx`
- Test: `src/components/home/EditFirstValueModal.test.tsx`

**Step 1: Write the failing test**

Create `src/components/home/EditFirstValueModal.test.tsx`:

```typescript
import { expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditFirstValueModal } from "./EditFirstValueModal";

// Mock Convex
const mockUpdateDefinition = vi.fn();
vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateDefinition,
  useQuery: () => [
    { _id: "act-1", name: "Project Created", isFirstValue: false },
    { _id: "act-2", name: "Project Published", isFirstValue: true },
  ],
}));

const mockDefinition = {
  _id: "def-123",
  activityName: "Project Published",
  reasoning: "Users see their work live",
  expectedTimeframe: "Within first session",
  successCriteria: "User shares link",
  confirmedAt: Date.now(),
  source: "interview",
};

function setup(props: Partial<Parameters<typeof EditFirstValueModal>[0]> = {}) {
  const user = userEvent.setup();
  const onClose = props.onClose ?? vi.fn();
  const defaultProps = {
    open: true,
    onClose,
    definition: mockDefinition,
    ...props,
  };
  render(<EditFirstValueModal {...defaultProps} />);
  return { user, onClose };
}

beforeEach(() => {
  mockUpdateDefinition.mockClear();
});

test("renders modal with form fields", () => {
  setup();

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByText("Edit First Value")).toBeInTheDocument();
  expect(screen.getByLabelText(/activity/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/reasoning/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/timeframe/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/success criteria/i)).toBeInTheDocument();
});

test("pre-fills form with existing definition", () => {
  setup();

  expect(screen.getByDisplayValue("Users see their work live")).toBeInTheDocument();
  expect(screen.getByDisplayValue("User shares link")).toBeInTheDocument();
});

test("calls updateDefinition on save", async () => {
  mockUpdateDefinition.mockResolvedValue("def-123");
  const { user, onClose } = setup();

  // Change reasoning
  const reasoningInput = screen.getByLabelText(/reasoning/i);
  await user.clear(reasoningInput);
  await user.type(reasoningInput, "Updated reasoning");

  await user.click(screen.getByRole("button", { name: /save/i }));

  await waitFor(() => {
    expect(mockUpdateDefinition).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning: "Updated reasoning",
      })
    );
  });
  expect(onClose).toHaveBeenCalled();
});

test("closes modal on cancel", async () => {
  const { user, onClose } = setup();

  await user.click(screen.getByRole("button", { name: /cancel/i }));

  expect(onClose).toHaveBeenCalled();
});

test("disables save when required fields empty", async () => {
  const { user } = setup();

  const reasoningInput = screen.getByLabelText(/reasoning/i);
  await user.clear(reasoningInput);

  expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/home/EditFirstValueModal.test.tsx`
Expected: FAIL - Cannot find module

**Step 3: Write minimal implementation**

Create `src/components/home/EditFirstValueModal.tsx`:

```typescript
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEFRAME_OPTIONS = [
  { value: "Within first session", label: "Within first session" },
  { value: "Within 24 hours", label: "Within 24 hours" },
  { value: "Within first week", label: "Within first week" },
  { value: "Within first month", label: "Within first month" },
];

interface FirstValueDefinition {
  _id: string;
  activityId?: string;
  activityName: string;
  reasoning: string;
  expectedTimeframe: string;
  successCriteria?: string;
  confirmedAt: number;
  source: string;
}

interface EditFirstValueModalProps {
  open: boolean;
  onClose: () => void;
  definition: FirstValueDefinition | null;
}

export function EditFirstValueModal({
  open,
  onClose,
  definition,
}: EditFirstValueModalProps) {
  const updateDefinition = useMutation(api.firstValue.updateDefinition);
  const activities = useQuery(api.firstValue.listActivities) ?? [];

  const [activityName, setActivityName] = useState("");
  const [activityId, setActivityId] = useState<string | undefined>();
  const [reasoning, setReasoning] = useState("");
  const [expectedTimeframe, setExpectedTimeframe] = useState("");
  const [successCriteria, setSuccessCriteria] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form with definition
  useEffect(() => {
    if (definition) {
      setActivityName(definition.activityName);
      setActivityId(definition.activityId);
      setReasoning(definition.reasoning);
      setExpectedTimeframe(definition.expectedTimeframe);
      setSuccessCriteria(definition.successCriteria ?? "");
      setError(null);
    }
  }, [definition]);

  const handleActivityChange = (value: string) => {
    const activity = activities.find((a) => a._id === value);
    if (activity) {
      setActivityId(activity._id);
      setActivityName(activity.name);
    }
  };

  const handleSave = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await updateDefinition({
        activityId: activityId as any,
        activityName,
        reasoning,
        expectedTimeframe,
        successCriteria: successCriteria || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSave =
    activityName.trim() &&
    reasoning.trim() &&
    expectedTimeframe.trim() &&
    !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit First Value</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Activity Select */}
          <div className="space-y-2">
            <Label htmlFor="fv-activity">Activity</Label>
            <Select value={activityId} onValueChange={handleActivityChange}>
              <SelectTrigger id="fv-activity" aria-label="Activity">
                <SelectValue placeholder="Select activity" />
              </SelectTrigger>
              <SelectContent>
                {activities.map((activity) => (
                  <SelectItem key={activity._id} value={activity._id}>
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Manual input fallback */}
            {!activityId && (
              <Input
                placeholder="Or enter activity name manually"
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
              />
            )}
          </div>

          {/* Reasoning */}
          <div className="space-y-2">
            <Label htmlFor="fv-reasoning">Reasoning</Label>
            <Textarea
              id="fv-reasoning"
              placeholder="Why is this the First Value moment?"
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              rows={3}
            />
          </div>

          {/* Timeframe */}
          <div className="space-y-2">
            <Label htmlFor="fv-timeframe">Expected Timeframe</Label>
            <Select value={expectedTimeframe} onValueChange={setExpectedTimeframe}>
              <SelectTrigger id="fv-timeframe" aria-label="Timeframe">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Success Criteria */}
          <div className="space-y-2">
            <Label htmlFor="fv-success">Success Criteria (optional)</Label>
            <Textarea
              id="fv-success"
              placeholder="What does success look like?"
              value={successCriteria}
              onChange={(e) => setSuccessCriteria(e.target.value)}
              rows={2}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/components/home/EditFirstValueModal.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/home/EditFirstValueModal.tsx src/components/home/EditFirstValueModal.test.tsx
git commit -m "$(cat <<'EOF'
feat(EditFirstValueModal): add edit form for First Value

Modal with activity selector, reasoning textarea, timeframe dropdown,
and success criteria field. Calls updateDefinition mutation on save.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Integration - Add FirstValueDefinitionCard to HomePage

**Files:**
- Modify: `src/routes/HomePage.tsx`

**Step 1: Write the failing test**

Create `src/routes/HomePage.test.tsx`:

```typescript
import { expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock Convex
vi.mock("convex/react", () => ({
  useQuery: vi.fn((query) => {
    if (query.toString().includes("users.current")) {
      return { productName: "Test Product", role: "Product" };
    }
    if (query.toString().includes("setupProgress.foundationStatus")) {
      return {
        overviewInterview: { status: "complete", journeyId: "j-1", slotsCompleted: 5, slotsTotal: 5 },
        firstValue: { status: "defined", journeyId: "j-2" },
        measurementPlan: { status: "ready", entitiesCount: 3 },
        metricCatalog: { status: "complete", metricsCount: 5 },
      };
    }
    if (query.toString().includes("firstValue.getDefinition")) {
      return {
        _id: "def-1",
        activityName: "Project Published",
        reasoning: "Test reasoning",
        expectedTimeframe: "Within first session",
        confirmedAt: Date.now(),
        source: "interview",
      };
    }
    return null;
  }),
}));

test("renders FirstValueDefinitionCard on homepage", async () => {
  const HomePage = (await import("./HomePage")).default;

  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );

  expect(screen.getByText("First Value Moment")).toBeInTheDocument();
  expect(screen.getByText("Project Published")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/routes/HomePage.test.tsx`
Expected: FAIL - FirstValueDefinitionCard not rendered

**Step 3: Write minimal implementation**

Update `src/routes/HomePage.tsx`:

```typescript
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProductProfileCard } from "../components/home/ProductProfileCard";
import { MeasurementFoundationCard } from "../components/home/MeasurementFoundationCard";
import { FirstValueDefinitionCard } from "../components/home/FirstValueDefinitionCard";
import { EditFirstValueModal } from "../components/home/EditFirstValueModal";

export default function HomePage() {
  const user = useQuery(api.users.current);
  const foundationStatus = useQuery(api.setupProgress.foundationStatus);
  const firstValueDefinition = useQuery(api.firstValue.getDefinition);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

      {/* First Value Definition Card */}
      <FirstValueDefinitionCard
        definition={firstValueDefinition ?? null}
        onEdit={() => setIsEditModalOpen(true)}
      />

      {/* Measurement Foundation Card */}
      {foundationStatus && (
        <MeasurementFoundationCard status={foundationStatus} />
      )}

      {/* Edit Modal */}
      <EditFirstValueModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        definition={firstValueDefinition ?? null}
      />
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/routes/HomePage.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/HomePage.tsx src/routes/HomePage.test.tsx
git commit -m "$(cat <<'EOF'
feat(HomePage): integrate FirstValueDefinitionCard

Shows First Value definition on homepage with edit modal.
Card appears between ProductProfileCard and MeasurementFoundationCard.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Update foundationStatus to Check firstValueDefinitions

**Files:**
- Modify: `convex/setupProgress.ts`
- Test: `convex/setupProgress.test.ts`

**Step 1: Write the failing test**

Add to `convex/setupProgress.test.ts` (create if doesn't exist):

```typescript
import { convexTest } from "convex-test";
import { describe, it, expect } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("setupProgress.foundationStatus", () => {
  it("returns defined when firstValueDefinition exists", async () => {
    const t = convexTest(schema);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-fs",
        email: "fs-test@example.com",
        createdAt: Date.now(),
      });
    });

    // Create first value definition
    await t.run(async (ctx) => {
      await ctx.db.insert("firstValueDefinitions", {
        userId,
        activityName: "Project Published",
        reasoning: "Test",
        expectedTimeframe: "Test",
        confirmedAt: Date.now(),
        source: "interview",
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user-fs",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user-fs",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.firstValue.status).toBe("defined");
  });

  it("returns not_defined when no firstValueDefinition exists", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "test-user-empty",
        email: "empty-test@example.com",
        createdAt: Date.now(),
      });
    });

    const asUser = t.withIdentity({
      subject: "test-user-empty",
      issuer: "https://clerk.test",
      tokenIdentifier: "https://clerk.test|test-user-empty",
    });

    const status = await asUser.query(api.setupProgress.foundationStatus, {});

    expect(status.firstValue.status).toBe("not_defined");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test:run -- convex/setupProgress.test.ts`
Expected: FAIL - firstValue.status based on journey, not definition

**Step 3: Write minimal implementation**

Update `convex/setupProgress.ts` foundationStatus query to check firstValueDefinitions:

```typescript
// In foundationStatus query, replace the firstValue logic:

// Check for First Value definition
const firstValueDefinition = await ctx.db
  .query("firstValueDefinitions")
  .withIndex("by_user", (q) => q.eq("userId", user._id))
  .first();

// ... later in return:
return {
  // ... other fields
  firstValue: {
    status: firstValueDefinition ? ("defined" as const) : ("not_defined" as const),
    definitionId: firstValueDefinition?._id ?? null,
  },
  // ... other fields
};
```

**Step 4: Run test to verify it passes**

Run: `npm run test:run -- convex/setupProgress.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add convex/setupProgress.ts convex/setupProgress.test.ts
git commit -m "$(cat <<'EOF'
fix(setupProgress): check firstValueDefinitions for status

Foundation status now checks firstValueDefinitions table instead of
looking for first_value journey. Returns definitionId instead of journeyId.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Final Integration Test & Cleanup

**Files:**
- All files from previous tasks

**Step 1: Run all tests**

Run: `npm run test:run`
Expected: All tests PASS

**Step 2: Run linting**

Run: `npm run lint`
Expected: No errors

**Step 3: Test manually (if dev server available)**

1. Start dev server: `npm run dev` and `npx convex dev`
2. Navigate to homepage
3. Verify First Value card shows "Not yet defined" or definition
4. Test Edit button opens modal
5. Test Refine button navigates to interview
6. Test saving edits updates the card

**Step 4: Final commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: complete First Value dashboard display and editing

- Add firstValueDefinitions schema table
- Add getDefinition, updateDefinition, listActivities queries/mutations
- Add FirstValueDefinitionCard component with empty/display states
- Add EditFirstValueModal for manual definition editing
- Integrate card into HomePage
- Update foundationStatus to check definitions table

Closes #34

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Component | Files |
|------|-----------|-------|
| 1 | Schema | `convex/schema.ts` |
| 2 | getDefinition query | `convex/firstValue.ts` |
| 3 | updateDefinition mutation | `convex/firstValue.ts` |
| 4 | listActivities query | `convex/firstValue.ts` |
| 5 | Card empty state | `src/components/home/FirstValueDefinitionCard.tsx` |
| 6 | Card display state | `src/components/home/FirstValueDefinitionCard.tsx` |
| 7 | Edit modal | `src/components/home/EditFirstValueModal.tsx` |
| 8 | HomePage integration | `src/routes/HomePage.tsx` |
| 9 | foundationStatus fix | `convex/setupProgress.ts` |
| 10 | Final tests | All files |

**Total: 10 TDD tasks**

**Testing:**
- Run `npm run test:run` after each task
- Run `npm run lint` before final commit
